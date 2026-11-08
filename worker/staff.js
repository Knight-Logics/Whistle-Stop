// Built-in staff accounts for the Cloudflare version (works without Cloudflare Access).
//
// - Passwords are stored only as PBKDF2-SHA256 hashes in KV (never in the repo or site.json).
// - Sessions are HttpOnly, Secure, SameSite=Strict cookies signed with an HMAC key that the
//   Worker generates itself on first use and keeps in KV.
// - First run: when no accounts exist, /admin shows "Create the owner login". After that the
//   owner adds editors and staff from the admin.
// - Login attempts are rate limited per IP + username.

import { json, errorJson, readJsonSafe } from "./http.js";

const USERS_KEY = "sys:users";
const SESSION_KEY_KEY = "sys:session-key";
const COOKIE = "ws_staff";
const SESSION_HOURS = 12;
const PBKDF2_ITERATIONS = 100000; // Workers' maximum
const MAX_ATTEMPTS = 8; // per 15 minutes
const ROLES = ["owner", "editor", "staff"];

const enc = new TextEncoder();

function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hashPassword(password, saltHex) {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    key,
    256
  );
  return { salt: toHex(salt), hash: toHex(bits), iterations: PBKDF2_ITERATIONS };
}

async function verifyPassword(password, record) {
  if (!record?.salt || !record?.hash) return false;
  const { hash } = await hashPassword(password, record.salt);
  return timingSafeEqual(hash, record.hash);
}

async function loadUsers(env) {
  return readJsonSafe(await env.CONTENT.get(USERS_KEY), []) || [];
}

async function saveUsers(env, users) {
  await env.CONTENT.put(USERS_KEY, JSON.stringify(users));
}

async function sessionKey(env) {
  let hex = await env.CONTENT.get(SESSION_KEY_KEY);
  if (!hex) {
    hex = toHex(crypto.getRandomValues(new Uint8Array(32)));
    await env.CONTENT.put(SESSION_KEY_KEY, hex);
  }
  return crypto.subtle.importKey("raw", fromHex(hex), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function sign(env, payload) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await sessionKey(env), enc.encode(body));
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

async function unsign(env, token) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const expected = await crypto.subtle.sign("HMAC", await sessionKey(env), enc.encode(body));
  if (!timingSafeEqual(b64url(new Uint8Array(expected)), sig)) return null;
  try {
    const padded = body.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function cookieHeader(value, maxAgeSeconds, secure) {
  return [
    `${COOKIE}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    secure ? "Secure" : "",
    `Max-Age=${maxAgeSeconds}`,
  ]
    .filter(Boolean)
    .join("; ");
}

function isSecure(request) {
  return new URL(request.url).protocol === "https:";
}

function publicUser(u) {
  return { username: u.username, displayName: u.displayName || u.username, role: u.role, email: u.email || "" };
}

function cleanUsername(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9._@-]/g, "").slice(0, 60);
}

function passwordProblem(password) {
  if (String(password || "").length < 10) return "Use at least 10 characters for the password.";
  if (String(password).length > 200) return "That password is too long.";
  return null;
}

async function rateLimited(env, request, username) {
  const ip = request.headers.get("cf-connecting-ip") || "local";
  const bucket = Math.floor(Date.now() / (15 * 60 * 1000));
  const key = `rl:login:${ip}:${username}:${bucket}`;
  const count = Number((await env.CONTENT.get(key)) || 0);
  if (count >= MAX_ATTEMPTS) return true;
  await env.CONTENT.put(key, String(count + 1), { expirationTtl: 60 * 20 });
  return false;
}

/** Signed-in staff member from the session cookie, or null. */
export async function sessionUser(request, env) {
  const cookie = request.headers.get("cookie") || "";
  const token = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))?.[1];
  if (!token) return null;
  const payload = await unsign(env, token);
  if (!payload) return null;
  const users = await loadUsers(env);
  const user = users.find((u) => u.username === payload.u && !u.disabled);
  if (!user || (user.sessionVersion || 0) !== (payload.v || 0)) return null;
  return { ...publicUser(user), via: "password" };
}

export async function setupRequired(env) {
  return (await loadUsers(env)).length === 0;
}

/** POST /api/admin/setup — only works while no accounts exist. Creates the owner and signs in. */
export async function handleSetup(request, env) {
  const users = await loadUsers(env);
  if (users.length) return errorJson("The owner login already exists. Sign in instead.", 409);
  const body = readJsonSafe(await request.text()) || {};
  const username = cleanUsername(body.username || "owner");
  const problem = passwordProblem(body.password);
  if (!username) return errorJson("Choose a username.");
  if (problem) return errorJson(problem);
  const record = await hashPassword(String(body.password));
  const owner = {
    username,
    displayName: String(body.displayName || "Owner").slice(0, 60),
    email: String(body.email || "").slice(0, 120),
    role: "owner",
    ...record,
    createdAt: new Date().toISOString(),
    sessionVersion: 0,
  };
  await saveUsers(env, [owner]);
  return issueSession(request, env, owner);
}

async function issueSession(request, env, user) {
  const token = await sign(env, {
    u: user.username,
    v: user.sessionVersion || 0,
    exp: Date.now() + SESSION_HOURS * 3600 * 1000,
  });
  return json({ ok: true, user: publicUser(user) }, 200, {
    "set-cookie": cookieHeader(token, SESSION_HOURS * 3600, isSecure(request)),
  });
}

/** POST /api/admin/login { username, password } */
export async function handleLogin(request, env) {
  const body = readJsonSafe(await request.text()) || {};
  const username = cleanUsername(body.username);
  const password = String(body.password || "");
  if (!username || !password) return errorJson("Enter your username and password.");
  if (await rateLimited(env, request, username)) {
    return errorJson("Too many attempts. Wait 15 minutes and try again.", 429);
  }
  const users = await loadUsers(env);
  const user = users.find((u) => u.username === username && !u.disabled);
  const ok = user ? await verifyPassword(password, user) : await verifyPassword(password, { salt: "00".repeat(16), hash: "x" });
  if (!user || !ok) return errorJson("Incorrect username or password.", 401);
  return issueSession(request, env, user);
}

export function handleLogout(request) {
  return json({ ok: true }, 200, { "set-cookie": cookieHeader("", 0, isSecure(request)) });
}

/** GET /api/admin/users (owner) */
export async function handleListUsers(env) {
  const users = await loadUsers(env);
  return json({ ok: true, users: users.map(publicUser), roles: ROLES });
}

/** POST /api/admin/users { username, displayName, role, password } — add or update (owner). */
export async function handleSaveUser(request, env, actor) {
  const body = readJsonSafe(await request.text()) || {};
  const username = cleanUsername(body.username);
  const role = ROLES.includes(body.role) ? body.role : "staff";
  if (!username) return errorJson("Choose a username.");
  const users = await loadUsers(env);
  const existing = users.find((u) => u.username === username);
  if (!existing && !body.password) return errorJson("Set a password for the new account.");
  if (body.password) {
    const problem = passwordProblem(body.password);
    if (problem) return errorJson(problem);
  }
  if (existing && existing.role === "owner" && role !== "owner") {
    const owners = users.filter((u) => u.role === "owner" && !u.disabled);
    if (owners.length <= 1) return errorJson("Keep at least one owner.");
  }
  const next = existing ? { ...existing } : { username, createdAt: new Date().toISOString(), sessionVersion: 0 };
  next.displayName = String(body.displayName || next.displayName || username).slice(0, 60);
  next.email = String(body.email ?? next.email ?? "").slice(0, 120);
  next.role = role;
  if (body.password) {
    Object.assign(next, await hashPassword(String(body.password)));
    next.sessionVersion = (next.sessionVersion || 0) + 1; // signs out old sessions
  }
  next.updatedAt = new Date().toISOString();
  next.updatedBy = actor.username;
  const out = existing ? users.map((u) => (u.username === username ? next : u)) : [...users, next];
  await saveUsers(env, out);
  return json({ ok: true, user: publicUser(next) });
}

/** DELETE /api/admin/users/:username (owner) */
export async function handleDeleteUser(env, actor, username) {
  const name = cleanUsername(username);
  const users = await loadUsers(env);
  const target = users.find((u) => u.username === name);
  if (!target) return errorJson("No such account.", 404);
  if (target.username === actor.username) return errorJson("You cannot remove your own account.");
  if (target.role === "owner" && users.filter((u) => u.role === "owner").length <= 1) {
    return errorJson("Keep at least one owner.");
  }
  await saveUsers(env, users.filter((u) => u.username !== name));
  return json({ ok: true });
}

/** POST /api/admin/password { current, next } — any signed-in user changes their own password. */
export async function handleChangePassword(request, env, actor) {
  const body = readJsonSafe(await request.text()) || {};
  const users = await loadUsers(env);
  const user = users.find((u) => u.username === actor.username);
  if (!user || !(await verifyPassword(String(body.current || ""), user))) {
    return errorJson("Your current password is not right.", 401);
  }
  const problem = passwordProblem(body.next);
  if (problem) return errorJson(problem);
  Object.assign(user, await hashPassword(String(body.next)));
  user.sessionVersion = (user.sessionVersion || 0) + 1;
  await saveUsers(env, users);
  return issueSession(request, env, user);
}
