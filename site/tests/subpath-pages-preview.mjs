/**
 * Other Pages preview must keep public site pages in the iframe on subpath hosts
 * (e.g. github.io/Whistle-Stop/) and route header nav correctly.
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
  ".webp": "image/webp",
  ".png": "image/png",
};

const server = createServer(async (req, res) => {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/Whistle-Stop") {
    res.writeHead(302, { Location: "/Whistle-Stop/" });
    res.end();
    return;
  }
  if (!urlPath.startsWith("/Whistle-Stop/")) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  urlPath = urlPath.replace(/^\/Whistle-Stop\//, "/");
  const filePath = resolveSiteFile(SITE_ROOT, urlPath === "/" ? "/" : urlPath);
  try {
    const body = await readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("404");
  }
});

await new Promise((resolve) => server.listen(8772, "127.0.0.1", resolve));
const BASE = "http://127.0.0.1:8772/Whistle-Stop";
const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto(`${BASE}/admin.html`);
await page.locator('input[name="username"]').fill("owner");
await page.locator('input[name="password"]').fill("whistlestop2026");
await page.locator('button[type="submit"]').click();
await page.waitForSelector("#admin-panel");
await page.locator('button[data-tab="pages"]').click();
await page.waitForSelector("#other-page-iframe");
await page.waitForTimeout(1500);

function iframeState() {
  const iframe = document.querySelector("#other-page-iframe");
  try {
    const doc = iframe?.contentDocument;
    return {
      path: iframe?.contentWindow?.location.pathname,
      search: iframe?.contentWindow?.location.search,
      hasAdminBody: !!doc?.body?.classList?.contains("admin-body"),
      hasPageEdit: !!doc?.documentElement?.classList?.contains("ws-page-edit-preview"),
      outerTab: document.querySelector("button[data-tab].is-active")?.dataset?.tab,
    };
  } catch (e) {
    return { error: String(e) };
  }
}

const initial = await page.evaluate(iframeState);
if (initial.outerTab !== "pages" || initial.hasAdminBody || !initial.hasPageEdit || !initial.search?.includes("pageEditPreview=1")) {
  throw new Error(`Homepage preview failed on subpath: ${JSON.stringify(initial)}`);
}

await page.evaluate(() => {
  const iframe = document.querySelector("#other-page-iframe");
  iframe?.contentDocument?.querySelector('a[href="menu.html"]')?.click();
});
await page.waitForTimeout(2500);

const afterMenu = await page.evaluate(iframeState);
if (afterMenu.outerTab !== "pages" || afterMenu.hasAdminBody || !afterMenu.path?.endsWith("/menu")) {
  throw new Error(`Menu nav should stay in Other Pages preview: ${JSON.stringify(afterMenu)}`);
}

await page.evaluate(() => {
  const iframe = document.querySelector("#other-page-iframe");
  iframe?.contentDocument?.querySelector('a[href="events.html"]')?.click();
});
await page.waitForTimeout(1500);

const afterEvents = await page.evaluate(() => ({
  outerTab: document.querySelector("button[data-tab].is-active")?.dataset?.tab,
  heading: document.querySelector(".admin-topbar h2")?.textContent?.trim(),
}));
if (afterEvents.outerTab !== "events" || afterEvents.heading !== "Events") {
  throw new Error(`Events nav should open Events tab: ${JSON.stringify(afterEvents)}`);
}

console.log("PASS: subpath Other Pages preview nav");
await browser.close();
server.close();
