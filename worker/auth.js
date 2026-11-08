// Staff identity for admin routes.
//
// Production: Cloudflare Access sits in front of /admin* and /api/admin/*. Access adds a signed
// JWT (Cf-Access-Jwt-Assertion) to each request; we verify it against the team's public keys.
// Roles come from OWNER_EMAILS / EDITOR_EMAILS / STAFF_EMAILS (comma-separated Worker variables).
// If none of those lists is set, anyone Access lets in is treated as an owner, so the Access
// policy alone decides who can edit.
//
// Local development only: DEV_ACCESS_EMAIL is honoured when DEV_ALLOW_LOCAL_LOGIN is "1" AND the
// request is for localhost. Never set those variables on the deployed Worker.

const KEY_CACHE = new Map(); // team domain -> { keys, fetchedAt }
const KEY_TTL_MS = 60 * 60 * 1000;

function b64urlToBytes(input) {
  const pad = "=".repeat((4 - (input.length % 4)) % 4);
  const b64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlToJson(input) {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(input)));
}

function normalizeTeamDomain(value) {
  const raw = String(value || "").trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  if (!raw) return "";
  return raw.includes(".") ? raw : `${raw}.cloudflareaccess.com`;
}

async function getAccessKeys(teamDomain, fetchImpl = fetch) {
  const cached = KEY_CACHE.get(teamDomain);
  if (cached && Date.now() - cached.fetchedAt < KEY_TTL_MS) return cached.keys;
  const res = await fetchImpl(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`Access certs fetch failed (${res.status})`);
  const body = await res.json();
  const keys = Array.isArray(body.keys) ? body.keys : [];
  KEY_CACHE.set(teamDomain, { keys, fetchedAt: Date.now() });
  return keys;
}

/** Verifies an Access JWT. Returns the payload or throws. */
export async function verifyAccessJwt(token, { teamDomain, audience, fetchImpl } = {}) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("Malformed token");
  const [h, p, s] = parts;
  const header = b64urlToJson(h);
  const payload = b64urlToJson(p);
  if (header.alg !== "RS256") throw new Error("Unexpected algorithm");
  const keys = await getAccessKeys(teamDomain, fetchImpl);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("Unknown signing key");
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    b64urlToBytes(s),
    new TextEncoder().encode(`${h}.${p}`)
  );
  if (!valid) throw new Error("Bad signature");
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp < now) throw new Error("Token expired");
  if (typeof payload.nbf === "number" && payload.nbf > now + 60) throw new Error("Token not yet valid");
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(audience)) throw new Error("Wrong audience");
  if (payload.iss && payload.iss !== `https://${teamDomain}`) throw new Error("Wrong issuer");
  return payload;
}

function emailList(value) {
  return String(value || "")
    .split(/[,\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function roleFor(email, env) {
  const e = String(email || "").toLowerCase();
  const owners = emailList(env.OWNER_EMAILS);
  const editors = emailList(env.EDITOR_EMAILS);
  const staff = emailList(env.STAFF_EMAILS);
  if (!owners.length && !editors.length && !staff.length) return "owner";
  if (owners.includes(e)) return "owner";
  if (editors.includes(e)) return "editor";
  if (staff.includes(e)) return "staff";
  return null;
}

function displayNameFor(email, payload = {}) {
  if (payload.name) return String(payload.name);
  const local = String(email || "").split("@")[0] || "Staff";
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function accessConfigured(env) {
  return Boolean(normalizeTeamDomain(env.ACCESS_TEAM_DOMAIN) && String(env.ACCESS_AUD || "").trim());
}

function isLocalRequest(request) {
  const host = new URL(request.url).hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

/**
 * Resolves the signed-in staff member, or returns { ok:false, status, error }.
 */
export async function getStaffUser(request, env, { fetchImpl } = {}) {
  if (env.DEV_ALLOW_LOCAL_LOGIN === "1" && env.DEV_ACCESS_EMAIL && isLocalRequest(request)) {
    const email = String(env.DEV_ACCESS_EMAIL).toLowerCase();
    const role = roleFor(email, env);
    if (!role) return { ok: false, status: 403, error: "This email is not on the staff list." };
    return { ok: true, user: { email, role, displayName: displayNameFor(email), via: "dev" } };
  }

  if (!accessConfigured(env)) {
    return {
      ok: false,
      status: 503,
      error: "Staff sign-in is not set up yet. Add Cloudflare Access to this site to enable publishing.",
      code: "access_not_configured",
    };
  }

  const token =
    request.headers.get("cf-access-jwt-assertion") ||
    (request.headers.get("cookie") || "").match(/(?:^|;\s*)CF_Authorization=([^;]+)/)?.[1] ||
    "";
  if (!token) return { ok: false, status: 401, error: "Please sign in again.", code: "signed_out" };

  try {
    const payload = await verifyAccessJwt(token, {
      teamDomain: normalizeTeamDomain(env.ACCESS_TEAM_DOMAIN),
      audience: String(env.ACCESS_AUD).trim(),
      fetchImpl,
    });
    const email = String(payload.email || "").toLowerCase();
    if (!email) return { ok: false, status: 401, error: "Sign-in did not include an email." };
    const role = roleFor(email, env);
    if (!role) return { ok: false, status: 403, error: "This email is not on the staff list." };
    return { ok: true, user: { email, role, displayName: displayNameFor(email, payload), via: "access" } };
  } catch (err) {
    return { ok: false, status: 401, error: "Please sign in again.", detail: String(err.message || err) };
  }
}

export function canPublish(role) {
  return role === "owner" || role === "editor";
}

export function logoutUrl() {
  return "/cdn-cgi/access/logout";
}
