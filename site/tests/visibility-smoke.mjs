import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.resolve(here, "..");
const productionBase = "https://www.whistlestopgrill.com/";
const publicPages = [
  "index.html",
  "menu.html",
  "events.html",
  "order.html",
  "happy-hour.html",
  "private-events.html",
  "about.html",
  "contact.html",
];

for (const filename of publicPages) {
  const html = fs.readFileSync(path.join(site, filename), "utf8");
  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  assert.ok(jsonLdMatch, `${filename} must include JSON-LD`);
  const graph = JSON.parse(jsonLdMatch[1]);
  const serialized = JSON.stringify(graph);
  assert.equal(
    serialized.includes("knight-logics.github.io/Whistle-Stop"),
    false,
    `${filename} JSON-LD must not identify the preview host`,
  );
  assert.ok(serialized.includes(productionBase), `${filename} JSON-LD must identify the production host`);
  assert.match(html, /<meta name="robots" content="index, follow, max-image-preview:large" \/>/i);
  assert.match(html, /<meta property="og:title"/i);
  assert.match(html, /<meta property="og:image" content="https:\/\/www\.whistlestopgrill\.com\//i);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image" \/>/i);
}

const eventsHtml = fs.readFileSync(path.join(site, "events.html"), "utf8");
const eventsJsonLd = JSON.parse(
  eventsHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i)[1],
);
const today = new Date().toISOString().slice(0, 10);
for (const node of eventsJsonLd["@graph"] || []) {
  const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
  if (types.includes("Event") || types.includes("MusicEvent")) {
    assert.ok(
      String(node.startDate || "").slice(0, 10) >= today,
      `Expired event schema must not be published: ${node.name || node["@id"]}`,
    );
  }
}

const robots = fs.readFileSync(path.join(site, "robots.txt"), "utf8");
assert.match(robots, /Sitemap: https:\/\/www\.whistlestopgrill\.com\/sitemap\.xml/i);
assert.match(robots, /Disallow: \/admin\.html/i);
assert.match(robots, /Disallow: \/downloads\//i);
assert.match(robots, /Disallow: \/data\//i);

const sitemap = fs.readFileSync(path.join(site, "sitemap.xml"), "utf8");
for (const filename of publicPages) {
  const url = filename === "index.html" ? productionBase : `${productionBase}${filename}`;
  assert.ok(sitemap.includes(`<loc>${url}</loc>`), `sitemap must include ${url}`);
}

const llms = fs.readFileSync(path.join(site, "llms.txt"), "utf8");
assert.match(llms, /^# Whistle Stop Grill & Bar/m);
assert.match(llms, /Do not infer that Knight Logics demonstration social accounts belong to Whistle Stop\./);

console.log("Visibility smoke: production schema, fresh events, social previews, robots, sitemap, and llms.txt passed.");
