// Published content lives in KV so staff edits go live in seconds, with no git commit or rebuild.
//
// Keys:
//   data:<path>            published JSON for a data file, e.g. data:data/events.json
//   media:<id>             uploaded photo/video bytes (metadata: mime, name, size)
//   history:<ts>:<version> a full copy of every published data file, for undo
//   sys:last-version       metadata for the latest publish
//
// Files with no KV copy fall back to the static file shipped in /site/data.

import { json, errorJson, readJsonSafe } from "./http.js";

export const SECTION_FILES = {
  site: "data/site.json",
  events: "data/events.json",
  menus: "data/menus.json",
  reviews: "data/reviews.json",
  promos: "data/promos.json",
  staffSchedule: "data/staff-schedule.json",
};

const UPLOAD_PREFIX = "ws-upload:";
const MAX_MEDIA_BYTES = 24 * 1024 * 1024; // KV values max out at 25 MiB
const MAX_BODY_BYTES = 95 * 1024 * 1024;
const HISTORY_KEEP = 15;

const MIME_EXT = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

function extFor(mime, name) {
  const fromMime = MIME_EXT[String(mime || "").toLowerCase()];
  if (fromMime) return fromMime;
  const m = String(name || "").toLowerCase().match(/\.([a-z0-9]{2,5})$/);
  return m ? m[1] : "bin";
}

function base64ToBytes(b64) {
  const bin = atob(String(b64 || ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function replaceUploadRefs(value, map) {
  if (typeof value === "string") {
    if (value.startsWith(UPLOAD_PREFIX)) {
      const id = value.slice(UPLOAD_PREFIX.length);
      return map.get(id) || value;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => replaceUploadRefs(v, map));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = replaceUploadRefs(v, map);
    return out;
  }
  return value;
}

/** Removes anything that must never be public from site.json (old shared-password hashes). */
export function sanitizeSite(site) {
  if (!site || typeof site !== "object") return site;
  const copy = structuredClone(site);
  if (copy.admin && typeof copy.admin === "object") {
    delete copy.admin.passwordHash;
    if (Array.isArray(copy.admin.users)) {
      copy.admin.users = copy.admin.users.map(({ passwordHash, ...rest }) => rest);
    }
  }
  return copy;
}

/** site.json as served on Cloudflare: no secrets, and the contact form posts to the Worker. */
export function siteForCloud(site) {
  const copy = sanitizeSite(site) || {};
  copy.forms = copy.forms || {};
  copy.forms.contact = copy.forms.contact || {};
  if (!String(copy.forms.contact.endpoint || "").trim()) copy.forms.contact.endpoint = "/api/forms/contact";
  copy.platform = { ...(copy.platform || {}), host: "cloudflare" };
  return copy;
}

async function readStaticJson(env, request, path) {
  const res = await env.ASSETS.fetch(new Request(new URL(`/${path}`, request.url)));
  if (!res.ok) return null;
  return readJsonSafe(await res.text());
}

/** Reads a data file: published KV copy first, then the shipped static file. */
export async function readDataFile(env, request, path) {
  const fromKv = await env.CONTENT.get(`data:${path}`);
  if (fromKv) return readJsonSafe(fromKv);
  return readStaticJson(env, request, path);
}

export async function serveData(request, env, path) {
  let body = await env.CONTENT.get(`data:${path}`);
  let source = "published";
  if (!body) {
    const res = await env.ASSETS.fetch(new Request(new URL(`/${path}`, request.url)));
    if (!res.ok) return new Response("Not found", { status: 404 });
    body = await res.text();
    source = "static";
  }
  if (path === "data/site.json") {
    const parsed = readJsonSafe(body);
    if (parsed) body = JSON.stringify(siteForCloud(parsed), null, 2);
  }
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-cache",
      "x-robots-tag": "noindex",
      "x-ws-content-source": source,
    },
  });
}

export async function serveMedia(env, id) {
  const clean = String(id || "").replace(/\.[a-z0-9]+$/i, "");
  if (!/^[a-z0-9-]{8,64}$/i.test(clean)) return new Response("Not found", { status: 404 });
  const { value, metadata } = await env.CONTENT.getWithMetadata(`media:${clean}`, { type: "arrayBuffer" });
  if (!value) return new Response("Not found", { status: 404 });
  return new Response(value, {
    headers: {
      "content-type": metadata?.mime || "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}

function versionId() {
  const rand = crypto.getRandomValues(new Uint8Array(4));
  return `cf-${Date.now()}-${[...rand].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

async function pruneHistory(env) {
  const listed = await env.CONTENT.list({ prefix: "history:" });
  const keys = listed.keys.map((k) => k.name).sort();
  const extra = keys.length - HISTORY_KEEP;
  for (let i = 0; i < extra; i += 1) await env.CONTENT.delete(keys[i]);
}

async function writePublished(env, files, meta) {
  for (const [path, data] of Object.entries(files)) {
    await env.CONTENT.put(`data:${path}`, JSON.stringify(data, null, 2));
  }
  const version = {
    versionId: meta.versionId,
    publishedAt: meta.publishedAt,
    publishedBy: meta.publishedBy,
    host: "cloudflare",
  };
  await env.CONTENT.put("data:data/content-version.json", JSON.stringify(version, null, 2));
  await env.CONTENT.put(
    `history:${String(Date.parse(meta.publishedAt)).padStart(14, "0")}:${meta.versionId}`,
    JSON.stringify({ ...version, note: meta.note || "", files }),
    { metadata: { versionId: meta.versionId, publishedAt: meta.publishedAt, publishedBy: meta.publishedBy, note: meta.note || "" } }
  );
  await env.CONTENT.put("sys:last-version", JSON.stringify(version));
  await pruneHistory(env);
  return version;
}

/** POST /api/admin/publish — same bundle the admin already builds for GitHub publishing. */
export async function handlePublish(request, env, user) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY_BYTES) return errorJson("This publish is too large. Remove large videos and try again.", 413);
  const body = readJsonSafe(await request.text());
  const bundle = body?.bundle;
  if (!bundle || typeof bundle !== "object") return errorJson("Nothing to publish.");

  const uploads = Array.isArray(bundle.mediaUploads) ? bundle.mediaUploads : [];
  const refMap = new Map();
  for (const item of uploads) {
    const id = String(item.id || "");
    if (!/^[a-z0-9-]{8,64}$/i.test(id)) continue;
    const bytes = base64ToBytes(item.dataBase64);
    if (bytes.byteLength > MAX_MEDIA_BYTES) {
      return errorJson(`"${item.name || "Upload"}" is over 24 MB. Use a smaller photo or a shorter video.`, 413);
    }
    const ext = extFor(item.mime, item.name);
    await env.CONTENT.put(`media:${id}`, bytes, {
      metadata: { mime: item.mime || "application/octet-stream", name: String(item.name || "").slice(0, 120), size: bytes.byteLength },
    });
    refMap.set(id, `media/${id}.${ext}`);
  }

  const files = {};
  for (const [section, path] of Object.entries(SECTION_FILES)) {
    if (!(section in bundle)) continue;
    let data = replaceUploadRefs(bundle[section], refMap);
    if (section === "site") data = sanitizeSite(data);
    files[path] = data;
  }
  if (!Object.keys(files).length) return errorJson("Nothing to publish.");

  const meta = {
    versionId: versionId(),
    publishedAt: new Date().toISOString(),
    publishedBy: user.email,
    note: String(body?.source?.tab || "").slice(0, 60),
  };
  const version = await writePublished(env, files, meta);
  return json({ ok: true, live: true, host: "cloudflare", ...version, media: refMap.size });
}

export async function handleHistory(env) {
  const listed = await env.CONTENT.list({ prefix: "history:" });
  const versions = listed.keys
    .map((k) => ({ key: k.name, ...(k.metadata || {}) }))
    .sort((a, b) => (a.key < b.key ? 1 : -1))
    .map(({ key, ...rest }) => rest);
  const current = readJsonSafe(await env.CONTENT.get("sys:last-version"));
  return json({ ok: true, current, versions });
}

/** POST /api/admin/restore { versionId } — republishes an earlier version as a new version. */
export async function handleRestore(request, env, user) {
  const body = readJsonSafe(await request.text()) || {};
  const target = String(body.versionId || "");
  if (!target) return errorJson("Choose a version to restore.");
  const listed = await env.CONTENT.list({ prefix: "history:" });
  const key = listed.keys.map((k) => k.name).find((name) => name.endsWith(`:${target}`));
  if (!key) return errorJson("That version is no longer in history.", 404);
  const record = readJsonSafe(await env.CONTENT.get(key));
  if (!record?.files) return errorJson("That version could not be read.", 500);
  const meta = {
    versionId: versionId(),
    publishedAt: new Date().toISOString(),
    publishedBy: user.email,
    note: `Restored ${target}`,
  };
  const version = await writePublished(env, record.files, meta);
  return json({ ok: true, live: true, restoredFrom: target, ...version });
}
