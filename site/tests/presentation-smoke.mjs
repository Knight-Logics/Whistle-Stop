/**
 * Presentation smoke test: public order flow, admin rendering, social demo state,
 * asset references, and browser-local save behavior.
 *
 * Run: node tests/presentation-smoke.mjs
 */
import { chromium } from "playwright";
import { createServer } from "http";
import { existsSync } from "fs";
import { readdir, readFile } from "fs/promises";
import { join, extname, dirname, normalize } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const SITE_ROOT = join(__dirname, "..");
const PORT = 8771;
const BASE = `http://127.0.0.1:${PORT}`;

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
};

function startServer() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
        const filePath = join(SITE_ROOT, urlPath === "/" ? "index.html" : urlPath.replace(/^\//, ""));
        const body = await readFile(filePath);
        const ext = extname(filePath).toLowerCase();
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end("Not found");
      }
    });
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

async function readJsonFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await readJsonFiles(full)));
    else if (entry.name.endsWith(".json")) out.push(full);
  }
  return out;
}

function collectAssetRefs(value, refs = new Set()) {
  if (typeof value === "string" && /^assets\//.test(value)) refs.add(value);
  else if (Array.isArray(value)) value.forEach((item) => collectAssetRefs(item, refs));
  else if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectAssetRefs(item, refs));
  }
  return refs;
}

async function assertDataAssetRefsExist() {
  const refs = new Set();
  for (const file of await readJsonFiles(join(SITE_ROOT, "data"))) {
    const json = JSON.parse(await readFile(file, "utf8"));
    collectAssetRefs(json, refs);
  }

  const missing = [...refs].filter((ref) => {
    const resolved = normalize(join(SITE_ROOT, ref));
    return dirname(resolved).startsWith(SITE_ROOT) && !existsSync(resolved);
  });

  if (missing.length) {
    throw new Error(`Missing data asset references: ${missing.join(", ")}`);
  }
}

async function waitForNoAdminLoadError(page) {
  await page.waitForSelector("#admin-panel", { timeout: 10000 });
  const error = await page.locator("#admin-panel").getByText("Could not load this section", { exact: false }).count();
  if (error) throw new Error("Admin section rendered a load error");
}

async function login(page) {
  await page.goto(`${BASE}/admin.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    const cfg = await window.WSConfig.get("socialManager");
    cfg.bridgeUrl = "http://127.0.0.1:8787";
    window.WSConfig.save("socialManager", cfg);
  });
  await page.locator('input[name="password"]').fill("whistlestop2026");
  await page.locator('button[type="submit"]').click();
  await waitForNoAdminLoadError(page);
}

async function clickAdminTab(page, tab) {
  await page.locator(`button[data-tab="${tab}"]`).click();
  await waitForNoAdminLoadError(page);
}

async function assertPublicOrderFlow(page) {
  await page.goto(`${BASE}/menu.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#main-menu-small-plates [data-pickup-add]", { timeout: 10000 });

  const barButtons = await page.locator("#panel-bar [data-pickup-add]").count();
  const seasonalSipButtons = await page.locator("#seasonal-seasonal-sips [data-pickup-add]").count();
  if (barButtons || seasonalSipButtons) {
    throw new Error("Alcohol/bar sections still expose add-to-order buttons");
  }

  await page.locator("#main-menu-small-plates [data-pickup-add]").first().click();
  await page.waitForSelector("#pickup-order-bar", { timeout: 10000 });
  const count = await page.evaluate(() => window.WSPickupOrder.getCount());
  if (count !== 1) throw new Error(`Expected 1 pickup item, got ${count}`);

  await page.locator("#pickup-order-bar [data-fulfillment-checkout]").click();
  await page.waitForSelector("#ws-fulfillment-modal:not([hidden])", { timeout: 10000 });
  await page.locator("[data-fulfillment-pick]").click();
  const pickupHref = await page.locator("#fulfillment-pickup-open").getAttribute("href");
  if (!pickupHref || !pickupHref.includes("whistlestopgrill.com/online-ordering")) {
    throw new Error(`Unexpected pickup checkout URL: ${pickupHref}`);
  }
  await page.locator("#fulfillment-step-pickup [data-fulfillment-back]").click();
  await page.locator("[data-fulfillment-deliver]").click();
  const partnerCount = await page.locator(".fulfillment-partner").count();
  if (partnerCount !== 3) throw new Error(`Expected 3 delivery partners, got ${partnerCount}`);
}

async function assertAdminAndSocial(page) {
  await login(page);

  for (const tab of ["events", "menus", "promos", "homepage", "heroes", "social", "ordering-hub", "reports"]) {
    await clickAdminTab(page, tab);
  }

  await clickAdminTab(page, "events");
  const eventCalendar = page.frameLocator("#events-page-iframe");
  await eventCalendar.locator("[data-admin-date]").first().waitFor({ timeout: 10000 });
  const clickedDate = await page
    .locator("#events-page-iframe")
    .evaluate((iframe) => {
      const doc = iframe.contentDocument;
      const emptyDay = [...doc.querySelectorAll("[data-admin-date]")].find(
        (day) => !day.querySelector("[data-admin-event-id]")
      );
      return (emptyDay || doc.querySelector("[data-admin-date]")).dataset.adminDate;
    });
  await eventCalendar.locator(`[data-admin-date="${clickedDate}"]`).first().click({ position: { x: 10, y: 10 } });
  const focusDate = page.locator('#event-focus-editor input[data-focus-field="date"]');
  await focusDate.waitFor({ timeout: 10000 });
  if ((await focusDate.inputValue()) !== clickedDate) {
    throw new Error(`Calendar click did not open the selected date: ${clickedDate}`);
  }
  await page.locator('#event-focus-editor input[data-focus-field="title"]').fill("Presentation Calendar Test");
  await eventCalendar.getByText("Presentation Calendar Test").first().waitFor({ timeout: 10000 });

  await clickAdminTab(page, "menus");
  const firstName = page.locator('#menu-items [data-menu-item] input[data-field="name"]').first();
  await firstName.fill("Presentation Test Burger");
  await page.waitForSelector("#menu-draft-preview >> text=Presentation Test Burger", { timeout: 10000 });

  await page.evaluate(async () => {
    window.WSConfig.save("promos", { homepageFeatured: [], eventsPageFeatured: [] });
    const promos = await window.WSConfig.get("promos");
    if (promos.homepageFeatured.length !== 0 || promos.eventsPageFeatured.length !== 0) {
      throw new Error("Empty promo arrays did not persist through WSConfig.get");
    }
    window.WSConfig.clearOverlay("promos");
  });

  await clickAdminTab(page, "social");
  await page.waitForSelector("#social-post-preview", { timeout: 10000 });
  await page.waitForSelector('input[name="social-platform"]', { timeout: 10000 });
  const selected = await page.locator('input[name="social-platform"]:checked').count();
  if (selected < 2) throw new Error("Social poster did not select demo-ready platforms");
}

async function main() {
  await assertDataAssetRefsExist();

  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  const localFailures = [];
  const pageErrors = [];

  page.on("pageerror", (err) => pageErrors.push(err.message));
  page.on("response", (res) => {
    if (res.url().startsWith(BASE) && res.status() >= 400) {
      localFailures.push(`${res.status()} ${res.url()}`);
    }
  });

  try {
    await assertPublicOrderFlow(page);
    await assertAdminAndSocial(page);

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await mobile.goto(`${BASE}/menu.html`, { waitUntil: "domcontentloaded" });
    await mobile.waitForSelector("#main-menu-small-plates [data-pickup-add]", { timeout: 10000 });
    await mobile.locator("#main-menu-small-plates [data-pickup-add]").first().click();
    await mobile.waitForSelector("#pickup-order-bar", { timeout: 10000 });
    await mobile.close();

    if (pageErrors.length) throw new Error(`Page errors: ${pageErrors.join(" | ")}`);
    if (localFailures.length) throw new Error(`Local failed responses: ${localFailures.join(" | ")}`);

    console.log("PASS: presentation smoke test");
    console.log("  Asset references: OK");
    console.log("  Menu/order flow: OK");
    console.log("  Alcohol sections excluded from cart: OK");
    console.log("  Admin tabs + draft preview: OK");
    console.log("  Browser-local empty-array saves: OK");
    console.log("  Social poster demo state: OK");
    console.log("  Mobile order bar: OK");
  } finally {
    await context.close();
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
