/**
 * Capture presentation screenshots from a running local preview server.
 * Start the site first, then run:
 *   node tests/capture-presentation-screens.mjs
 */
import { chromium } from "playwright";
import { mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const BASE = process.env.WS_PREVIEW_BASE || "http://127.0.0.1:3456";
const OUT = join(tmpdir(), "whistle-stop-presentation-screens");

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(`${BASE}/menu.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#main-menu-small-plates [data-pickup-add]", { timeout: 10000 });
    await page.locator("#main-menu-small-plates [data-pickup-add]").first().click();
    await page.locator("#pickup-order-bar [data-fulfillment-checkout]").click();
    await page.screenshot({ path: join(OUT, "desktop-order-modal.png"), fullPage: false });

    const admin = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await admin.goto(`${BASE}/admin.html`, { waitUntil: "domcontentloaded" });
    await admin.locator('input[name="password"]').fill("whistlestop2026");
    await admin.locator('button[type="submit"]').click();
    await admin.waitForSelector("#admin-panel", { timeout: 10000 });
    await admin.locator('button[data-tab="menus"]').click();
    await admin.waitForSelector("#menu-draft-preview", { timeout: 10000 });
    await admin.screenshot({ path: join(OUT, "admin-menu-preview.png"), fullPage: false });

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await mobile.goto(`${BASE}/menu.html`, { waitUntil: "domcontentloaded" });
    await mobile.waitForSelector("#main-menu-small-plates [data-pickup-add]", { timeout: 10000 });
    await mobile.locator("#main-menu-small-plates [data-pickup-add]").first().click();
    await mobile.screenshot({ path: join(OUT, "mobile-menu-order-bar.png"), fullPage: false });
  } finally {
    await browser.close();
  }

  console.log(OUT);
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
