/**
 * Smoke test: menu admin draft preview across menu types and sections
 * Run: node tests/menu-draft-preview-smoke.mjs
 */
import { chromium } from "playwright";
import { createServer } from "http";
import { readFile } from "fs/promises";
import { join, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const SITE_ROOT = join(__dirname, "..");
const PORT = 8769;

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".webp": "image/webp",
  ".png": "image/png",
};

const CASES = [
  { menuIndex: 0, sectionIndex: 0, sectionId: "main-menu-small-plates", sampleItem: "Southern Sampler" },
  { menuIndex: 0, sectionIndex: 2, sectionId: "main-menu-burgers", sampleItem: "Original Whistle Stop Burger" },
  { menuIndex: 1, sectionIndex: 1, sectionId: "seasonal-seasonal-mains", sampleItem: "Blackened Scallops" },
  { menuIndex: 2, sectionIndex: 0, sectionId: "bar-cocktails", sampleItem: "Old Florida Mule" },
];

function startServer() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        const path = (req.url || "/").split("?")[0];
        const filePath = join(SITE_ROOT, path === "/" ? "index.html" : path.replace(/^\//, ""));
        const body = await readFile(filePath);
        const ext = extname(filePath);
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end("Not found");
      }
    });
    server.listen(PORT, () => resolve(server));
  });
}

async function login(page) {
  await page.goto(`http://localhost:${PORT}/admin.html`);
  const password = page.locator('input[name="password"]');
  if (await password.count()) {
    await password.fill("whistlestop2026");
    await page.click('button[type="submit"]');
  }
  await page.waitForSelector("#admin-panel", { timeout: 15000 });
}

async function openMenusTab(page) {
  await page.click('button[data-tab="menus"]');
  await page.waitForSelector("#menu-items [data-menu-item]", { timeout: 10000 });
}

async function resetMenusTab(page) {
  await page.click('button[data-tab="events"]');
  await page.waitForSelector("#admin-panel");
  await page.click('button[data-tab="menus"]');
  await page.waitForSelector("#menu-draft-preview", { timeout: 10000 });
}

async function selectMenuSection(page, menuIndex, sectionIndex, sampleItem) {
  await page.selectOption("#menu-select", String(menuIndex));
  await page.waitForSelector(`#cat-select option[value="${sectionIndex}"]`, { state: "attached", timeout: 10000 });
  await page.selectOption("#cat-select", String(sectionIndex));
  await page.waitForSelector(`input[data-field="name"][value="${sampleItem}"]`, { timeout: 10000 });
}

async function editorItemNames(page) {
  const inputs = page.locator("#menu-items [data-menu-item] input[data-field='name']");
  const count = await inputs.count();
  const names = [];
  for (let i = 0; i < count; i += 1) names.push(await inputs.nth(i).inputValue());
  return names;
}

async function previewItemNames(page, sectionId) {
  const section = page.locator(`#menu-draft-preview #${sectionId}`);
  await section.waitFor({ timeout: 10000 });
  return section.locator(".menu-item h3").allTextContents();
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await login(page);
    await openMenusTab(page);

    for (const c of CASES) {
      await resetMenusTab(page);
      await selectMenuSection(page, c.menuIndex, c.sectionIndex, c.sampleItem);
      const editor = await editorItemNames(page);
      const preview = await previewItemNames(page, c.sectionId);

      if (!editor.includes(c.sampleItem)) {
        throw new Error(`menu ${c.menuIndex} section ${c.sectionIndex}: editor missing ${c.sampleItem}`);
      }
      if (!preview.includes(c.sampleItem)) {
        throw new Error(`menu ${c.menuIndex} section ${c.sectionIndex}: preview missing ${c.sampleItem}`);
      }

      const removeBtn = page
        .locator("#menu-items [data-menu-item]")
        .filter({ has: page.locator(`input[data-field="name"][value="${c.sampleItem}"]`) })
        .locator("[data-remove-item]");
      await removeBtn.click();
      await page.waitForTimeout(250);

      const editorAfter = await editorItemNames(page);
      const previewAfter = await previewItemNames(page, c.sectionId);

      if (editorAfter.includes(c.sampleItem)) {
        throw new Error(`menu ${c.menuIndex} section ${c.sectionIndex}: editor still has ${c.sampleItem}`);
      }
      if (previewAfter.includes(c.sampleItem)) {
        throw new Error(`menu ${c.menuIndex} section ${c.sectionIndex}: preview still has ${c.sampleItem}`);
      }
    }

    const livePage = await browser.newPage();
    await livePage.goto(`http://localhost:${PORT}/menu.html#main-menu-small-plates`);
    await livePage.waitForSelector("#main-menu-small-plates .menu-item h3", { timeout: 10000 });
    const liveItems = await livePage.locator("#main-menu-small-plates .menu-item h3").allTextContents();
    if (!liveItems.includes("Southern Sampler")) {
      throw new Error("Live menu page lost Southern Sampler before save");
    }

    console.log("PASS: menu draft preview smoke test");
    console.log(`  Verified ${CASES.length} menu/section combinations`);
    console.log("  Remove + draft preview sync: OK");
    console.log("  Live menu unchanged before save: OK");
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
