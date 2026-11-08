// Website forms (contact, private events) land in an admin inbox stored in KV.
// Spam protection: honeypot field, per-IP rate limit, and Cloudflare Turnstile when
// TURNSTILE_SECRET is configured.

import { json, errorJson } from "./http.js";

const LEAD_TTL_SECONDS = 60 * 60 * 24 * 365;
const MAX_PER_HOUR = 6;

function field(form, name, max = 2000) {
  return String(form.get(name) || "").trim().slice(0, max);
}

async function verifyTurnstile(env, token, ip) {
  const body = new FormData();
  body.append("secret", env.TURNSTILE_SECRET);
  body.append("response", token || "");
  if (ip) body.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  return Boolean(data.success);
}

async function overLimit(env, ip) {
  const key = `rl:form:${ip}:${Math.floor(Date.now() / 3600000)}`;
  const count = Number((await env.CONTENT.get(key)) || 0);
  if (count >= MAX_PER_HOUR) return true;
  await env.CONTENT.put(key, String(count + 1), { expirationTtl: 3700 });
  return false;
}

/** POST /api/forms/:kind (multipart or urlencoded form) */
export async function handleFormSubmit(request, env, kind) {
  if (!["contact", "private-event"].includes(kind)) return errorJson("Unknown form.", 404);
  let form;
  try {
    form = await request.formData();
  } catch {
    return errorJson("Could not read the form.");
  }
  if (field(form, "_gotcha")) return json({ ok: true }); // bot filled the hidden field

  const ip = request.headers.get("cf-connecting-ip") || "local";
  if (await overLimit(env, ip)) return errorJson("Too many messages from this connection. Please call us instead.", 429);
  if (env.TURNSTILE_SECRET) {
    const ok = await verifyTurnstile(env, field(form, "cf-turnstile-response", 4096), ip);
    if (!ok) return errorJson("Please complete the verification and try again.", 400);
  }

  const lead = {
    kind,
    name: field(form, "name", 120),
    email: field(form, "email", 160),
    phone: field(form, "phone", 40),
    topic: field(form, "topic", 120),
    date: field(form, "date", 40),
    guests: field(form, "guests", 20),
    message: field(form, "message", 4000),
    receivedAt: new Date().toISOString(),
    country: request.cf?.country || "",
    page: (request.headers.get("referer") || "").slice(0, 200),
  };
  if (!lead.name || !lead.message || (!lead.email && !lead.phone)) {
    return errorJson("Please add your name, a message, and an email or phone number.");
  }
  if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) return errorJson("That email address doesn't look right.");

  const id = `${String(Date.now()).padStart(14, "0")}-${crypto.randomUUID().slice(0, 8)}`;
  await env.CONTENT.put(`lead:${id}`, JSON.stringify(lead), {
    expirationTtl: LEAD_TTL_SECONDS,
    metadata: { kind, name: lead.name, receivedAt: lead.receivedAt, topic: lead.topic },
  });
  return json({ ok: true });
}

/** GET /api/admin/leads — newest first. */
export async function handleListLeads(env) {
  const listed = await env.CONTENT.list({ prefix: "lead:" });
  const keys = listed.keys.map((k) => k.name).sort().reverse().slice(0, 100);
  const leads = [];
  for (const key of keys) {
    const raw = await env.CONTENT.get(key);
    if (raw) leads.push({ id: key.slice(5), ...JSON.parse(raw) });
  }
  return json({ ok: true, leads });
}

/** DELETE /api/admin/leads/:id */
export async function handleDeleteLead(env, id) {
  if (!/^[0-9]{14}-[a-f0-9]{8}$/.test(String(id))) return errorJson("Unknown message.", 404);
  await env.CONTENT.delete(`lead:${id}`);
  return json({ ok: true });
}
