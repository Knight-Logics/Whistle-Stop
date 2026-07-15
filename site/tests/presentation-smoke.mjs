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
import { resolveSiteFile } from "./static-site-resolve.mjs";

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
        const filePath = resolveSiteFile(SITE_ROOT, urlPath);
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

async function assertVerifiedSocialHostPackage() {
  const packageName = "whistle-stop-social-host-2026-07-13-v2.zip";
  const packagePath = join(SITE_ROOT, "downloads", packageName);
  if (!existsSync(packagePath)) throw new Error(`Missing verified Social Host package: ${packageName}`);

  const [manager, guide] = await Promise.all([
    readFile(join(SITE_ROOT, "js", "social-manager.js"), "utf8"),
    readFile(join(SITE_ROOT, "downloads", "social-host.html"), "utf8"),
  ]);
  if (!manager.includes(packageName) || !guide.includes(packageName)) {
    throw new Error("Admin or Social Host guide still points to an unverified package");
  }
  if (
    !manager.includes("Do not install this on every device") ||
    !manager.includes("Any-device posting ready") ||
    !guide.includes("one-time shared-host setup")
  ) {
    throw new Error("Social Host copy does not explain the install-once, post-from-any-device architecture");
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
  await page.locator('input[name="username"]').fill("owner");
  await page.locator('input[name="password"]').fill("whistlestop2026");
  await page.locator('button[type="submit"]').click();
  await waitForNoAdminLoadError(page);
}

async function clickAdminTab(page, tab) {
  const tabBtn = page.locator(`button[data-tab="${tab}"]`);
  if (!(await tabBtn.isVisible())) {
    const toggle = page.locator("#admin-mobile-nav-toggle");
    if ((await toggle.count()) && (await toggle.isVisible())) {
      await toggle.click();
      await page.locator(".admin-sidebar.is-mobile-open #admin-nav").waitFor({ state: "visible", timeout: 5000 });
    }
  }
  await tabBtn.click();
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

  for (const tab of [
    "events",
    "menus",
    "pages",
    "social",
    "gbp",
    "reviews-mgr",
    "campaign-calendar",
    "qr-codes",
    "ordering-hub",
    "reports",
    "integrations",
  ]) {
    await clickAdminTab(page, tab);
  }

  await clickAdminTab(page, "events");
  await page.waitForSelector("#events-page-iframe");
  const eventFrameMetrics = await page.locator("#events-page-iframe").evaluate((el) => ({
    height: el.getBoundingClientRect().height,
    scrolling: el.getAttribute("scrolling"),
    inlineHeight: el.style.height,
  }));
  if (
    eventFrameMetrics.height < 560 ||
    eventFrameMetrics.height > 980 ||
    eventFrameMetrics.scrolling !== "yes" ||
    eventFrameMetrics.inlineHeight
  ) {
    throw new Error(`Events preview is not stable: ${JSON.stringify(eventFrameMetrics)}`);
  }
  const eventFrame = page.frames().find((frame) => frame.url().includes("preview=1") && frame.url().includes("/events"));
  if (!eventFrame) throw new Error("Events preview frame did not load");
  const calendarDays = eventFrame.locator("[data-admin-date]");
  const calendarDayCount = await calendarDays.count();
  if (!calendarDayCount) throw new Error("Events calendar has no editable day cells");
  await calendarDays.nth(Math.min(15, calendarDayCount - 1)).click();
  await page.waitForSelector("#admin-modal-root .admin-modal", { timeout: 10000 });
  let closeButtons = page.locator("#admin-modal-root [data-admin-modal-close]");
  let closeButtonCount = await closeButtons.count();
  await closeButtons.nth(closeButtonCount - 1).click();

  await page.locator("#add-perf").click();
  const addTitle = page.locator('#admin-modal-root [data-add-oneoff-field="title"]');
  await addTitle.waitFor({ timeout: 10000 });
  await addTitle.fill("Presentation Calendar Test");
  await page.locator("#admin-modal-root #modal-add-event-submit").click();
  const focusTitle = page.locator('#admin-modal-root [data-focus-field="title"]');
  await focusTitle.waitFor({ timeout: 10000 });
  if ((await focusTitle.inputValue()) !== "Presentation Calendar Test") {
    throw new Error("New performance did not reopen in the event editor");
  }
  await page.locator("#admin-modal-root [data-admin-modal-close]").last().click();

  await clickAdminTab(page, "menus");
  await page.locator("#edit-menu-section").click();
  const firstName = page.locator('#menu-items [data-menu-item] input[data-field="name"]').first();
  await firstName.fill("Presentation Test Burger");
  await page.waitForSelector("#menu-draft-preview >> text=Presentation Test Burger", { timeout: 10000 });
  await page.locator("#admin-modal-root [data-admin-modal-close]").last().click();

  await clickAdminTab(page, "pages");
  await page.waitForSelector("#other-page-iframe");
  const pageSelect = page.locator("#edit-page-select");
  const editablePages = [
    ["index", "pageEditPreview=1"],
    ["order", "/order?"],
    ["happyHour", "/happy-hour?"],
    ["about", "/about?"],
    ["contact", "/contact?"],
    ["menu", "/menu?"],
    ["privateEvents", "/private-events?"],
  ];
  for (const [pageId, pathPart] of editablePages) {
    await pageSelect.selectOption(pageId);
    await page.waitForFunction(
      ({ pathPart }) => {
        const iframe = document.querySelector("#other-page-iframe");
        try {
          return Boolean(
            iframe?.contentWindow?.location.href.includes(pathPart) &&
            iframe.contentDocument?.querySelector("[data-admin-section], [data-admin-block]")
          );
        } catch {
          return false;
        }
      },
      { pathPart },
      { timeout: 10000 }
    );
    const previewFrame = page.frameLocator("#other-page-iframe");
    const editableCount = await previewFrame.locator("[data-admin-section], [data-admin-block]").count();
    if (!editableCount) throw new Error(`${pageId} preview exposes no editable sections`);
  }

  const pageFrameMetrics = await page.locator("#other-page-iframe").evaluate((el) => ({
    height: el.getBoundingClientRect().height,
    scrolling: el.getAttribute("scrolling"),
    inlineHeight: el.style.height,
  }));
  if (
    pageFrameMetrics.height < 560 ||
    pageFrameMetrics.height > 980 ||
    pageFrameMetrics.scrolling !== "yes" ||
    pageFrameMetrics.inlineHeight
  ) {
    throw new Error(`Page preview is not stable: ${JSON.stringify(pageFrameMetrics)}`);
  }

  await pageSelect.selectOption("order");
  await page.waitForFunction(
    () => {
      const iframe = document.querySelector("#other-page-iframe");
      try {
        return Boolean(
          iframe?.contentWindow?.location.href.includes("/order?") &&
          iframe.contentDocument?.querySelector("[data-admin-block]")
        );
      } catch {
        return false;
      }
    },
    null,
    { timeout: 10000 }
  );
  const orderBlocks = page.frameLocator("#other-page-iframe").locator("[data-admin-block]");
  const orderBlockCount = await orderBlocks.count();
  if (!orderBlockCount) throw new Error("Order page exposes no editable content blocks");
  await orderBlocks.nth(0).click();
  await page.waitForSelector("#admin-modal-root .admin-modal", { timeout: 10000 });
  closeButtons = page.locator("#admin-modal-root [data-admin-modal-close]");
  closeButtonCount = await closeButtons.count();
  await closeButtons.nth(closeButtonCount - 1).click();

  const previewSrcBeforeSync = await page.locator("#other-page-iframe").getAttribute("src");
  await page.evaluate(async () => {
    const site = await window.WSConfig.get("site");
    window.WSConfig.savePreview("site", site);
  });
  await page.waitForTimeout(250);
  const previewSrcAfterSync = await page.locator("#other-page-iframe").getAttribute("src");
  if (previewSrcBeforeSync !== previewSrcAfterSync) {
    throw new Error("Draft sync reloaded the page preview instead of updating it in place");
  }
  await page.evaluate(() => window.WSConfig.clearPreview("site"));

  await page.locator("#admin-publish-live").click();
  await page.waitForSelector("#admin-publish-confirm", { timeout: 10000 });
  const publishPasswordReady = await page.locator("#admin-publish-password").inputValue();
  if (!publishPasswordReady) throw new Error("Publish modal did not retain the authenticated session password");
  closeButtons = page.locator("#admin-modal-root [data-admin-modal-close]");
  closeButtonCount = await closeButtons.count();
  await closeButtons.nth(closeButtonCount - 1).click();

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
  if (selected !== 5) throw new Error(`Social poster selected ${selected}/5 demo-ready platforms`);

  await page.locator("#social-test-routing").click();
  await page.getByText("All five routes passed — nothing was posted", { exact: true }).waitFor({
    state: "visible",
    timeout: 45000,
  });
  const readyRoutes = await page.locator("#social-post-results .social-result-row.is-ok").count();
  if (readyRoutes !== 5) throw new Error(`Social routing dry run passed ${readyRoutes}/5 platforms`);
}

async function main() {
  await assertDataAssetRefsExist();
  await assertVerifiedSocialHostPackage();

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

    const mobileAdmin = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await login(mobileAdmin);
    await clickAdminTab(mobileAdmin, "campaign-calendar");
    await mobileAdmin.waitForSelector(".ws-campaign-layout", { timeout: 10000 });
    await clickAdminTab(mobileAdmin, "social");
    await mobileAdmin.waitForSelector("#social-post-preview", { timeout: 10000 });
    const mobileAdminOverflow = await mobileAdmin.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 2
    );
    if (mobileAdminOverflow) throw new Error("Mobile admin has horizontal page overflow");
    await mobileAdmin.close();

    if (pageErrors.length) throw new Error(`Page errors: ${pageErrors.join(" | ")}`);
    if (localFailures.length) throw new Error(`Local failed responses: ${localFailures.join(" | ")}`);

    console.log("PASS: presentation smoke test");
    console.log("  Asset references: OK");
    console.log("  Verified Social Host package: OK");
    console.log("  Menu/order flow: OK");
    console.log("  Alcohol sections excluded from cart: OK");
    console.log("  Admin tabs + draft preview: OK");
    console.log("  Events calendar click-to-edit: OK");
    console.log("  Seven-page section editor + stable live previews: OK");
    console.log("  Publish modal/session handoff: OK");
    console.log("  Browser-local empty-array saves: OK");
    console.log("  Social poster demo state: OK");
    console.log("  Five-platform no-post routing test: OK");
    console.log("  Mobile order bar: OK");
    console.log("  Mobile staff campaigns + social: OK");
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
