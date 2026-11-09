// End-to-end checks for the Cloudflare Worker. Run against a local `wrangler dev`:
//   npx wrangler dev --local --port 8787   (in one terminal)
//   node worker/test/worker-smoke.mjs      (in another)
// Refuses to run against anything but localhost, because it creates logins and publishes.
import assert from "node:assert/strict";

const BASE = (process.env.WS_TEST_BASE || "http://127.0.0.1:8787").replace(/\/$/, "");
const host = new URL(BASE).hostname;
if (!["127.0.0.1", "localhost"].includes(host)) {
  console.error("worker-smoke only runs against a local wrangler dev server.");
  process.exit(2);
}

let cookie = "";
async function call(path, { method = "GET", body, form, headers = {}, raw = false, redirect = "manual" } = {}) {
  const init = { method, headers: { ...headers }, redirect };
  if (cookie) init.headers.cookie = cookie;
  if (body !== undefined) {
    init.headers["content-type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  if (form) init.body = form;
  const res = await fetch(BASE + path, init);
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  if (raw) return res;
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}

const password = `test-${Math.random().toString(36).slice(2)}-${Date.now()}`;

// Pages, redirects, headers, prerender
let r = await call("/");
assert.equal(r.status, 200);
assert.match(r.data, /<meta name="ws-host" content="cloudflare">/);
assert.equal(r.headers.get("x-content-type-options"), "nosniff");
r = await call("/menus-1");
assert.equal(r.status, 301);
assert.equal(new URL(r.headers.get("location")).pathname, "/menu.html");
r = await call("/events");
assert.equal(r.status, 301);
r = await call("/menu.html");
assert.equal(r.status, 200);
assert.match(r.data, /menu-layout--prerendered/, "menu is written into the HTML");
assert.match(r.data, /Fried Green Tomatoes/);
r = await call("/does-not-exist.html");
assert.equal(r.status, 404);
r = await call("/tests/visibility-smoke.mjs");
assert.equal(r.status, 404, "dev files are not served");
r = await call("/admin.html");
assert.equal(r.headers.get("cache-control"), "no-store");
assert.match(r.headers.get("x-robots-tag") || "", /noindex/);

// site.json never exposes password hashes on Cloudflare
r = await call("/data/site.json");
assert.equal(r.status, 200);
assert.equal(JSON.stringify(r.data).includes("passwordHash"), false);
assert.equal(r.data.forms.contact.endpoint, "/api/forms/contact");

// Admin API is locked until someone signs in
r = await call("/api/admin/history");
assert.equal(r.status, 401);
r = await call("/api/admin/session");
assert.equal(r.status, 200);
const firstRun = r.data.setupRequired;

if (firstRun) {
  r = await call("/api/admin/setup", { method: "POST", body: { username: "owner", displayName: "Owner", password: "short" } });
  assert.equal(r.status, 400, "short passwords are refused");
  r = await call("/api/admin/setup", { method: "POST", body: { username: "owner", displayName: "Owner", password } });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.role, "owner");
  r = await call("/api/admin/setup", { method: "POST", body: { username: "intruder", password: "another-long-password" } });
  assert.equal(r.status, 409, "setup only works once");
} else {
  console.log("(owner already exists from an earlier run; using an editor login for the rest)");
}

// Wrong password is rejected; cross-site POST is blocked
const savedCookie = cookie;
cookie = "";
r = await call("/api/admin/login", { method: "POST", body: { username: "owner", password: "wrong-password-123" } });
assert.equal(r.status, 401);
cookie = savedCookie;
r = await call("/api/admin/publish", { method: "POST", body: {}, headers: { origin: "https://evil.example" } });
assert.equal(r.status, 403);

if (firstRun) {
  // Publish an event + a photo, then read them back from the public site
  const events = await (await fetch(`${BASE}/data/events.json`)).json();
  const stamp = `Smoke Test Act ${Date.now()}`;
  const today = new Date();
  const soon = new Date(today.getTime() + 3 * 86400000).toISOString().slice(0, 10);
  events.performances = [...(events.performances || []), { date: soon, title: stamp, startTime: "19:00", endTime: "22:00", category: "live-music", image: "ws-upload:11111111-2222-3333-4444-555555555555" }];
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  r = await call("/api/admin/publish", {
    method: "POST",
    headers: { origin: BASE },
    body: {
      bundle: {
        events,
        mediaUploads: [{ id: "11111111-2222-3333-4444-555555555555", name: "flyer.png", mime: "image/png", size: png.length, dataBase64: png.toString("base64") }],
      },
      source: { tab: "events" },
    },
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const v1 = r.data.versionId;
  r = await call("/data/events.json");
  const added = r.data.performances.find((p) => p.title === stamp);
  assert.ok(added, "published event is live");
  assert.match(added.image, /^media\/11111111-2222-3333-4444-555555555555\.png$/);
  const img = await call(`/${added.image}`, { raw: true });
  assert.equal(img.status, 200);
  assert.equal(img.headers.get("content-type"), "image/png");
  r = await call("/data/content-version.json");
  assert.equal(r.data.versionId, v1);
  r = await call("/events.html");
  assert.match(r.data, new RegExp(stamp), "upcoming event is written into the events page HTML");

  // Second publish, then restore the first
  events.performances = events.performances.filter((p) => p.title !== stamp);
  r = await call("/api/admin/publish", { method: "POST", headers: { origin: BASE }, body: { bundle: { events }, source: { tab: "events" } } });
  assert.equal(r.status, 200);
  r = await call("/api/admin/history");
  assert.ok(r.data.versions.length >= 2);
  r = await call("/api/admin/restore", { method: "POST", headers: { origin: BASE }, body: { versionId: v1 } });
  assert.equal(r.status, 200);
  r = await call("/data/events.json");
  assert.ok(r.data.performances.some((p) => p.title === stamp), "restore brought the event back");

  // Staff logins: add an editor, staff cannot publish
  r = await call("/api/admin/users", { method: "POST", headers: { origin: BASE }, body: { username: "smoke-staff", displayName: "Smoke Staff", role: "staff", password: "staff-password-123" } });
  assert.equal(r.status, 200);
  const ownerCookie = cookie;
  cookie = "";
  r = await call("/api/admin/login", { method: "POST", body: { username: "smoke-staff", password: "staff-password-123" } });
  assert.equal(r.status, 200);
  r = await call("/api/admin/publish", { method: "POST", headers: { origin: BASE }, body: { bundle: { events } } });
  assert.equal(r.status, 403, "staff role cannot publish");
  r = await call("/api/admin/users");
  assert.equal(r.status, 403, "staff cannot manage logins");
  cookie = ownerCookie;
  r = await call("/api/admin/users/smoke-staff", { method: "DELETE", headers: { origin: BASE } });
  assert.equal(r.status, 200);
}

// Contact form -> inbox
const form = new FormData();
form.append("name", "Smoke Tester");
form.append("email", "smoke@example.com");
form.append("topic", "General question");
form.append("message", "Do you have live music Friday?");
r = await call("/api/forms/contact", { method: "POST", form });
assert.equal(r.status, 200, JSON.stringify(r.data));
const bot = new FormData();
bot.append("name", "Bot");
bot.append("_gotcha", "filled");
bot.append("message", "spam");
r = await call("/api/forms/contact", { method: "POST", form: bot });
assert.equal(r.status, 200, "honeypot is accepted silently");
r = await call("/api/forms/campaign-signup", {
  method: "POST",
  body: { campaignTitle: "D&D Night", signup: { campaignId: "dnd", name: "Smoke Player", email: "player@example.com", role: "player", preferredNight: "Thursday", marketingConsent: true } },
});
assert.equal(r.status, 200, "campaign signup accepted: " + JSON.stringify(r.data));
const countAfter = r.data.count;
r = await call("/api/forms/campaign-count?campaign=dnd");
assert.equal(r.status, 200);
assert.equal(r.data.count, countAfter, "public campaign count matches");
r = await call("/api/forms/campaign-signup", { method: "POST", body: { signup: { name: "No Email" } } });
assert.equal(r.status, 400, "campaign signup needs an email");
if (firstRun) {
  r = await call("/api/admin/leads");
  const lead = r.data.leads.find((l) => l.email === "smoke@example.com");
  assert.ok(lead, "message reached the inbox");
  assert.equal(r.data.leads.some((l) => l.name === "Bot"), false, "honeypot message was dropped");
  const signupLead = r.data.leads.find((l) => l.email === "player@example.com");
  assert.ok(signupLead && signupLead.kind === "campaign-signup" && /D&D Night/.test(signupLead.topic), "campaign signup reached the inbox");
  r = await call(`/api/admin/leads/${lead.id}`, { method: "DELETE", headers: { origin: BASE } });
  assert.equal(r.status, 200);
  r = await call(`/api/admin/leads/${signupLead.id}`, { method: "DELETE", headers: { origin: BASE } });
  assert.equal(r.status, 200);

  r = await call("/api/admin/logout", { method: "POST", headers: { origin: BASE } });
  assert.equal(r.status, 200);
  r = await call("/api/admin/history");
  assert.equal(r.status, 401, "signed out");
}

console.log("PASS: Cloudflare Worker smoke test (pages, redirects, login, publish, photos, history, restore, roles, inbox)");
