/**
 * Mobile width regression: public header/drawer and authenticated staff shell.
 * No live publish or social post is performed.
 */
import { chromium } from "playwright";
import { createServer } from "http";
import { readFile } from "fs/promises";
import { extname, join } from "path";
import { fileURLToPath } from "url";
import { resolveSiteFile } from "./static-site-resolve.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const SITE_ROOT = join(__dirname, "..");
const PUBLIC_ROUTES = [
  "index.html",
  "menu.html",
  "events.html",
  "order.html",
  "happy-hour.html",
  "about.html",
  "private-events.html",
  "contact.html",
];
const WIDTHS = [320, 390];
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

function startServer() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        const path = resolveSiteFile(SITE_ROOT, req.url || "/");
        const body = await readFile(path);
        res.writeHead(200, { "Content-Type": MIME[extname(path).toLowerCase()] || "application/octet-stream" });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end("Not found");
      }
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, base: `http://127.0.0.1:${address.port}` });
    });
  });
}

async function widthMetrics(page) {
  return page.evaluate(() => ({
    viewport: window.innerWidth,
    html: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
}

function assertNoPageOverflow(label, metrics) {
  if (metrics.html > metrics.viewport + 1 || metrics.body > metrics.viewport + 1) {
    throw new Error(`${label} overflows horizontally: ${JSON.stringify(metrics)}`);
  }
}

async function assertPublicMobile(page, base, route, width) {
  await page.goto(`${base}/${route}`, { waitUntil: "domcontentloaded" });
  await page.locator(".site-header .nav-toggle").waitFor({ state: "visible", timeout: 10000 });
  assertNoPageOverflow(`${route} at ${width}px`, await widthMetrics(page));

  const header = await page.evaluate(() => {
    const viewport = window.innerWidth;
    const inner = document.querySelector(".site-header .header-inner")?.getBoundingClientRect();
    const toggle = document.querySelector(".site-header .nav-toggle")?.getBoundingClientRect();
    const call = document.querySelector(".site-header .ws-header-call")?.getBoundingClientRect();
    const number = document.querySelector(".site-header .ws-header-call__number");
    const numberRect = number?.getBoundingClientRect();
    return {
      viewport,
      innerLeft: inner?.left,
      innerRight: inner?.right,
      toggleLeft: toggle?.left,
      toggleRight: toggle?.right,
      callLeft: call?.left,
      callRight: call?.right,
      numberVisible:
        Boolean(numberRect?.width && numberRect.height) &&
        number &&
        getComputedStyle(number).visibility !== "hidden" &&
        getComputedStyle(number).display !== "none",
    };
  });
  if (
    header.innerLeft < -1 ||
    header.innerRight > width + 1 ||
    header.toggleLeft < -1 ||
    header.toggleRight > width + 1 ||
    header.callLeft < -1 ||
    header.callRight > width + 1
  ) {
    throw new Error(`${route} header escapes ${width}px viewport: ${JSON.stringify(header)}`);
  }
  if (!header.numberVisible) throw new Error(`${route} hides the phone number at ${width}px`);

  const toggle = page.locator(".site-header .nav-toggle");
  if ((await toggle.count()) !== 1) throw new Error(`${route} has an ambiguous mobile-menu control`);
  await toggle.click();
  await page.locator("#site-nav-mobile.open").waitFor({ state: "visible", timeout: 5000 });
  await page.waitForFunction(() => {
    const el = document.getElementById("site-nav-mobile");
    if (!el?.classList.contains("open")) return false;
    const rect = el.getBoundingClientRect();
    return Math.abs(rect.left) <= 1 && Math.abs(rect.width - innerWidth) <= 1;
  }, null, { timeout: 2000 });
  const drawer = await page.locator("#site-nav-mobile").evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return { left: rect.left, right: rect.right, width: rect.width, viewport: innerWidth };
  });
  if (Math.abs(drawer.left) > 1 || Math.abs(drawer.right - drawer.viewport) > 1 || Math.abs(drawer.width - drawer.viewport) > 1) {
    throw new Error(`${route} mobile menu is not viewport width: ${JSON.stringify(drawer)}`);
  }
}

async function loginAdmin(page, base) {
  await page.goto(`${base}/admin.html`, { waitUntil: "domcontentloaded" });
  assertNoPageOverflow("admin login", await widthMetrics(page));
  await page.evaluate(() => {
    if (window.WSSocial) {
      window.WSSocial.checkHostAndPrompt = async () => ({
        tunnelOnline: false,
        cloudRemoteBridge: false,
        needsPackage: false,
      });
    }
  });
  await page.locator('input[name="username"]').fill("owner");
  await page.locator('input[name="password"]').fill("whistlestop2026");
  await page.locator('button[type="submit"]').click();
  await page.locator(".admin-shell.is-active").waitFor({ state: "visible", timeout: 10000 });
  const closeHost = page.locator("#ws-social-host-modal .admin-modal__close");
  if ((await closeHost.count()) === 1) await closeHost.click();
}

async function assertAdminMobile(page, width) {
  assertNoPageOverflow(`authenticated admin at ${width}px`, await widthMetrics(page));
  const menuButton = page.locator("#admin-mobile-nav-toggle");
  if ((await menuButton.count()) !== 1 || !(await menuButton.isVisible())) {
    throw new Error(`Admin has no compact mobile section control at ${width}px`);
  }
  const initial = await page.evaluate(() => ({
    navVisible: document.querySelector("#admin-nav")?.getBoundingClientRect().height > 1,
    mainTop: document.querySelector("#admin-main")?.getBoundingClientRect().top,
    viewport: innerHeight,
  }));
  if (initial.navVisible) throw new Error(`Admin section list should start collapsed at ${width}px`);
  if (initial.mainTop > Math.min(180, initial.viewport * 0.3)) {
    throw new Error(`Admin content starts too far below the fold at ${width}px: ${JSON.stringify(initial)}`);
  }

  await menuButton.click();
  await page.locator(".admin-sidebar.is-mobile-open #admin-nav").waitFor({ state: "visible", timeout: 5000 });
  assertNoPageOverflow(`open admin navigation at ${width}px`, await widthMetrics(page));

  const pagesTab = page.locator('#admin-nav button[data-tab="pages"]');
  if ((await pagesTab.count()) !== 1) throw new Error("Admin Pages navigation is ambiguous");
  await pagesTab.click();
  await page.locator("#admin-panel").waitFor({ state: "visible", timeout: 10000 });
  if (await page.locator(".admin-sidebar.is-mobile-open").count()) {
    throw new Error("Admin mobile section list did not collapse after choosing a section");
  }
  assertNoPageOverflow(`admin Pages section at ${width}px`, await widthMetrics(page));

  await menuButton.click();
  await page.locator(".admin-sidebar.is-mobile-open #admin-nav").waitFor({ state: "visible", timeout: 5000 });
  const scheduleTab = page.locator('#admin-nav button[data-tab="staff-scheduling"]');
  if ((await scheduleTab.count()) !== 1) throw new Error("Admin Staff Scheduling navigation is missing");
  await scheduleTab.click();
  await page.locator(".admin-schedule-week").waitFor({ state: "visible", timeout: 10000 });
  if (await page.locator(".admin-sidebar.is-mobile-open").count()) {
    throw new Error("Admin mobile section list did not collapse after Staff Scheduling");
  }
  assertNoPageOverflow(`admin Staff Scheduling at ${width}px`, await widthMetrics(page));
  const scheduleVisible = await page.evaluate(() => {
    const week = document.querySelector(".admin-schedule-week");
    const save = document.getElementById("admin-save-tab");
    const publish = document.getElementById("admin-publish-live");
    if (!week) return { ok: false, reason: "missing week board" };
    const wr = week.getBoundingClientRect();
    if (wr.width < 200) return { ok: false, reason: "week board too narrow", wr };
    if (save && publish) {
      const sr = save.getBoundingClientRect();
      const pr = publish.getBoundingClientRect();
      if (Math.abs(sr.top - pr.top) > 6) return { ok: false, reason: "save/publish not same row", sr, pr };
    }
    return { ok: true };
  });
  if (!scheduleVisible.ok) {
    throw new Error(`Staff Scheduling mobile layout failed: ${JSON.stringify(scheduleVisible)}`);
  }
}

async function main() {
  const { server, base } = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of WIDTHS) {
      for (const route of PUBLIC_ROUTES) {
        const page = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true });
        try {
          await assertPublicMobile(page, base, route, width);
        } finally {
          await page.close();
        }
      }

      const admin = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true });
      try {
        await loginAdmin(admin, base);
        await assertAdminMobile(admin, width);
      } finally {
        await admin.close();
      }
    }
    console.log("PASS: mobile width, full-screen menu, visible phone CTA, and compact staff navigation");
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error("FAIL:", error.message);
  process.exit(1);
});
