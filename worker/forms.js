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

async function saveLead(env, kind, lead) {
  const id = `${String(Date.now()).padStart(14, "0")}-${crypto.randomUUID().slice(0, 8)}`;
  await env.CONTENT.put(`lead:${id}`, JSON.stringify(lead), {
    expirationTtl: LEAD_TTL_SECONDS,
    metadata: { kind, name: lead.name, receivedAt: lead.receivedAt, topic: lead.topic },
  });
}

/** POST /api/forms/campaign-signup — JSON { signup } from campaign.html; lands in Messages. */
async function handleCampaignSignup(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorJson("Could not read the signup.");
  }
  const s = body?.signup || {};
  const text = (v, max) => String(v ?? "").trim().slice(0, max);
  if (text(s._gotcha, 200)) return json({ ok: true });
  const ip = request.headers.get("cf-connecting-ip") || "local";
  if (await overLimit(env, ip)) return errorJson("Too many signups from this connection. Please call us instead.", 429);

  const name = text(s.name, 120);
  const email = text(s.email, 160).toLowerCase();
  if (!name || !email) return errorJson("Name and email are required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return errorJson("That email address doesn't look right.");
  const campaign = text(body?.campaignTitle || s.campaignId, 120);
  const lines = [
    `Signed up for: ${campaign || "a campaign"}`,
    s.role ? `Role: ${text(s.role, 60)}` : "",
    s.preferredNight ? `Preferred night: ${text(s.preferredNight, 60)}` : "",
    s.experience ? `Experience: ${text(s.experience, 60)}` : "",
    s.notes ? `Notes: ${text(s.notes, 1500)}` : "",
    `Email updates: ${s.marketingConsent ? "yes" : "no"}`,
  ].filter(Boolean);
  await saveLead(env, "campaign-signup", {
    kind: "campaign-signup",
    name,
    email,
    phone: text(s.phone, 40),
    topic: campaign ? `Signup · ${campaign}` : "Campaign signup",
    campaignId: text(s.campaignId, 80),
    message: lines.join("\n"),
    receivedAt: new Date().toISOString(),
    country: request.cf?.country || "",
    page: (request.headers.get("referer") || "").slice(0, 200),
  });
  const count = await bumpCampaignCount(env, text(s.campaignId, 80));
  return json({ ok: true, count, signup: { ...s, name, email } });
}

const countKey = (campaignId) => `count:campaign:${campaignId}`;

async function bumpCampaignCount(env, campaignId) {
  if (!campaignId) return null;
  const next = (Number(await env.CONTENT.get(countKey(campaignId))) || 0) + 1;
  await env.CONTENT.put(countKey(campaignId), String(next));
  return next;
}

/** GET /api/forms/campaign-count?campaign=<id> — public aggregate for the progress bar (no names). */
export async function handleCampaignCount(url, env) {
  const id = String(url.searchParams.get("campaign") || "").trim().slice(0, 80);
  if (!/^[a-z0-9-]+$/i.test(id)) return errorJson("Unknown campaign.", 404);
  const count = Number(await env.CONTENT.get(countKey(id))) || 0;
  return json({ ok: true, campaign: id, count });
}

/** POST /api/forms/:kind (multipart or urlencoded form) */
export async function handleFormSubmit(request, env, kind) {
  if (kind === "campaign-signup") return handleCampaignSignup(request, env);
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

  await saveLead(env, kind, lead);
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
