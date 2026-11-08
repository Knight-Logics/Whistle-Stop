// Whistle Stop Grill & Bar — Cloudflare Worker
// Serves the static site from /site and adds what GitHub Pages cannot do:
//   staff login, instant publishing with undo, photo storage, a form inbox,
//   prerendered menu/events HTML, redirects from the old Wix URLs, and security headers.

import { json, errorJson, withPageHeaders } from "./http.js";
import { getStaffUser, accessConfigured, canPublish } from "./auth.js";
import {
  serveData,
  serveMedia,
  readDataFile,
  handlePublish,
  handleHistory,
  handleRestore,
} from "./content.js";
import {
  sessionUser,
  setupRequired,
  handleSetup,
  handleLogin,
  handleLogout,
  handleListUsers,
  handleSaveUser,
  handleDeleteUser,
  handleChangePassword,
} from "./staff.js";
import { handleFormSubmit, handleListLeads, handleDeleteLead } from "./forms.js";
import { menuHtml, upcomingEventsHtml } from "./prerender.js";

const PAGES = [
  "index",
  "menu",
  "events",
  "order",
  "happy-hour",
  "private-events",
  "about",
  "contact",
  "campaign",
  "unsubscribe",
  "privacy",
  "terms",
  "accessibility",
  "admin",
  "offline",
];

// Old Wix addresses and clean paths -> the pages that replace them (permanent).
const REDIRECTS = {
  "/menus-1": "/menu.html",
  "/online-ordering": "/order.html",
  "/book-club": "/events.html",
  "/shop": "/order.html",
  "/copy-of-home": "/",
  "/tracker-page": "/",
  "/home": "/",
  "/live-music": "/events.html#live-music",
  "/live-music.html": "/events.html#live-music",
  "/index.html": "/",
};
for (const page of PAGES) {
  if (page !== "index") REDIRECTS[`/${page}`] = `/${page}.html`;
}

const BLOCKED_PREFIXES = ["/tests/", "/node_modules/", "/downloads/"];

async function currentUser(request, env) {
  const fromCookie = await sessionUser(request, env);
  if (fromCookie) return { ok: true, user: fromCookie };
  if (accessConfigured(env) || env.DEV_ALLOW_LOCAL_LOGIN === "1") {
    const viaAccess = await getStaffUser(request, env);
    if (viaAccess.ok) return viaAccess;
  }
  return { ok: false, status: 401, error: "Please sign in.", code: "signed_out" };
}

function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin fetches from older browsers omit it; cookie is SameSite=Strict
  return origin === new URL(request.url).origin;
}

async function handleAdminApi(request, env, path) {
  const method = request.method;
  if (method !== "GET" && !sameOrigin(request)) return errorJson("Cross-site request blocked.", 403);

  if (path === "/api/admin/session" && method === "GET") {
    const auth = await currentUser(request, env);
    return json({
      ok: true,
      host: "cloudflare",
      setupRequired: !auth.ok && (await setupRequired(env)),
      access: accessConfigured(env),
      user: auth.ok ? auth.user : null,
    });
  }
  if (path === "/api/admin/setup" && method === "POST") return handleSetup(request, env);
  if (path === "/api/admin/login" && method === "POST") return handleLogin(request, env);
  if (path === "/api/admin/logout" && method === "POST") return handleLogout(request);

  const auth = await currentUser(request, env);
  if (!auth.ok) return errorJson(auth.error, auth.status || 401, { code: auth.code });
  const user = auth.user;
  const isOwner = user.role === "owner";

  if (path === "/api/admin/health" && method === "GET") return json({ ok: true, host: "cloudflare", user });
  if (path === "/api/admin/publish" && method === "POST") {
    if (!canPublish(user.role)) return errorJson("Publishing needs an owner or editor account.", 403);
    return handlePublish(request, env, user);
  }
  if (path === "/api/admin/history" && method === "GET") return handleHistory(env);
  if (path === "/api/admin/restore" && method === "POST") {
    if (!isOwner) return errorJson("Only the owner can restore an earlier version.", 403);
    return handleRestore(request, env, user);
  }
  if (path === "/api/admin/leads" && method === "GET") return handleListLeads(env);
  if (path.startsWith("/api/admin/leads/") && method === "DELETE") {
    if (!canPublish(user.role)) return errorJson("Owners and editors can clear messages.", 403);
    return handleDeleteLead(env, decodeURIComponent(path.slice("/api/admin/leads/".length)));
  }
  if (path === "/api/admin/password" && method === "POST") return handleChangePassword(request, env, user);
  if (path === "/api/admin/users") {
    if (!isOwner) return errorJson("Only the owner manages staff logins.", 403);
    if (method === "GET") return handleListUsers(env);
    if (method === "POST") return handleSaveUser(request, env, user);
  }
  if (path.startsWith("/api/admin/users/") && method === "DELETE") {
    if (!isOwner) return errorJson("Only the owner manages staff logins.", 403);
    return handleDeleteUser(env, user, decodeURIComponent(path.slice("/api/admin/users/".length)));
  }
  return errorJson("Not found.", 404);
}

async function prerender(response, request, env, pathname) {
  const rewriter = new HTMLRewriter().on("head", {
    element(el) {
      el.prepend('<meta name="ws-host" content="cloudflare">', { html: true });
    },
  });
  try {
    if (pathname === "/menu.html") {
      const html = menuHtml(await readDataFile(env, request, "data/menus.json"));
      if (html) rewriter.on("#menu-app", { element: (el) => el.setInnerContent(html, { html: true }) });
    } else if (pathname === "/events.html") {
      const html = upcomingEventsHtml(await readDataFile(env, request, "data/events.json"));
      if (html) rewriter.on("#events-one-off", { element: (el) => el.setInnerContent(html, { html: true }) });
    }
  } catch {
    /* prerender is best effort; the page still renders client-side */
  }
  return rewriter.transform(response);
}

async function servePage(request, env, url) {
  let assetPath = url.pathname === "/" ? "/index.html" : url.pathname;
  let res = await env.ASSETS.fetch(new Request(new URL(assetPath + url.search, url), request));
  if (res.status === 404) {
    const notFound = await env.ASSETS.fetch(new Request(new URL("/404.html", url), request));
    res = new Response(notFound.body, { status: 404, headers: notFound.headers });
    assetPath = "/404.html";
  }
  const type = res.headers.get("content-type") || "";
  if (!type.includes("text/html")) return res;

  const isAdmin = assetPath === "/admin.html";
  let out = await prerender(res, request, env, assetPath);
  out = withPageHeaders(out, { noindex: isAdmin || assetPath === "/404.html", noStore: isAdmin });
  if (!isAdmin) {
    const headers = new Headers(out.headers);
    headers.set("cache-control", "public, max-age=0, must-revalidate");
    out = new Response(out.body, { status: out.status, headers });
  }
  return out;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path.startsWith("/api/admin/")) return await handleAdminApi(request, env, path);
      if (path.startsWith("/api/forms/") && request.method === "POST") {
        return await handleFormSubmit(request, env, path.slice("/api/forms/".length));
      }
      if (path === "/api/health") return json({ ok: true, host: "cloudflare" });
      if (path.startsWith("/api/")) return errorJson("Not found.", 404);

      if (request.method !== "GET" && request.method !== "HEAD") return errorJson("Method not allowed.", 405);
      if (BLOCKED_PREFIXES.some((p) => path.startsWith(p))) return new Response("Not found", { status: 404 });

      const target = REDIRECTS[path];
      if (target) return Response.redirect(new URL(target + (target.includes("#") ? "" : url.search), url).toString(), 301);

      if (path.startsWith("/data/") && path.endsWith(".json")) return await serveData(request, env, path.slice(1));
      if (path.startsWith("/media/")) return await serveMedia(env, path.slice("/media/".length));

      return await servePage(request, env, url);
    } catch (err) {
      console.error("worker error", path, err && err.stack ? err.stack : err);
      if (path.startsWith("/api/")) return errorJson("Something went wrong. Try again in a moment.", 500);
      return new Response("Something went wrong. Please refresh.", { status: 500 });
    }
  },
};
