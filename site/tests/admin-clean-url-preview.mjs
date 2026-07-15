/**
 * npx serve exposes /admin (clean URL). Preview iframes must still load /index.html,
 * not /admin/index.html (which re-loads the staff portal and breaks click-to-edit).
 */
import { chromium } from "playwright";
import { createServer } from "http";
import { readFile } from "fs/promises";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import { resolveSiteFile } from "./static-site-resolve.mjs";

const SITE_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
};

function resolvePath(urlPath) {
  if (urlPath === "/admin" || urlPath === "/admin/") return "admin.html";
  return urlPath.replace(/^\//, "");
}

const server = createServer(async (req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const filePath = resolveSiteFile(SITE_ROOT, urlPath === "/admin" || urlPath === "/admin/" ? "/admin" : urlPath);
  try {
    const body = await readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("404");
  }
});

await new Promise((resolve) => server.listen(8773, "127.0.0.1", resolve));
const BASE = "http://127.0.0.1:8773";
const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto(`${BASE}/admin`);
await page.locator('input[name="username"]').fill("owner");
await page.locator('input[name="password"]').fill("whistlestop2026");
await page.locator('button[type="submit"]').click();
await page.waitForSelector("#admin-panel");
await page.locator('button[data-tab="pages"]').click();
await page.waitForSelector("#other-page-iframe");
await page.waitForTimeout(2000);

const state = await page.evaluate(() => {
  const iframe = document.querySelector("#other-page-iframe");
  try {
    const doc = iframe?.contentDocument;
    return {
      adminPath: window.location.pathname,
      iframePath: iframe?.contentWindow?.location.pathname,
      iframeSearch: iframe?.contentWindow?.location.search,
      hasAdminBody: !!doc?.body?.classList?.contains("admin-body"),
      hasPageEdit: !!doc?.documentElement?.classList?.contains("ws-page-edit-preview"),
      editable: doc?.querySelectorAll("[data-admin-section], [data-admin-block]").length || 0,
    };
  } catch (e) {
    return { error: String(e) };
  }
});

if (state.adminPath !== "/admin.html") {
  throw new Error(`Expected /admin to normalize to /admin.html, got ${state.adminPath}`);
}
if (!state.iframePath?.match(/\/$|\/index$/) || !state.iframeSearch?.includes("pageEditPreview=1") || state.hasAdminBody || !state.hasPageEdit || state.editable < 1) {
  throw new Error(`Homepage preview broken on /admin clean URL: ${JSON.stringify(state)}`);
}

await page.locator('button[data-tab="events"]').click();
await page.waitForSelector("#events-page-iframe");
await page.waitForTimeout(2000);

const eventsState = await page.evaluate(() => {
  const iframe = document.querySelector("#events-page-iframe");
  try {
    const doc = iframe?.contentDocument;
    return {
      iframePath: iframe?.contentWindow?.location.pathname,
      hasPreview: iframe?.contentWindow?.location.search.includes("preview=1"),
      clickable: doc?.querySelectorAll(".admin-preview-clickable").length || 0,
    };
  } catch (e) {
    return { error: String(e) };
  }
});

if (!eventsState.iframePath?.endsWith("/events") || !eventsState.hasPreview || eventsState.clickable < 1) {
  throw new Error(`Events preview broken on /admin clean URL: ${JSON.stringify(eventsState)}`);
}

console.log("PASS: clean /admin URL preview routing");
await browser.close();
server.close();
