// Whistle Stop Grill & Bar — Toast Menus v2 Auto-Sync Module
// Authenticates via TOAST_MACHINE_CLIENT using Cloudflare Worker secrets:
//   TOAST_API_HOST (default https://ws-api.toasttab.com)
//   TOAST_CLIENT_ID
//   TOAST_CLIENT_SECRET
//   TOAST_RESTAURANT_GUID
// Pulls live Toast Menus v2, preserves existing item descriptions where Toast omits them,
// formats into the exact site/data/menus.json schema, stages in KV, and publishes live on apply=true.

import { json, errorJson } from "./http.js";

const DEFAULT_TOAST_HOST = "https://ws-api.toasttab.com";
const SKIP_ITEMS = new Set(["water", "special #1", "special item #2", "open food", "open liquor"]);
const SKIP_GROUPS = new Set(["add ons protein"]);
const MAIN_ORDER = [
  "small-plates",
  "salads",
  "burgers",
  "sandwiches",
  "wraps",
  "flatbreads",
  "large-plates",
  "sides",
  "kid-s-meals",
  "desserts",
  "beverages",
];

export function toastConfigured(env) {
  return Boolean(env.TOAST_CLIENT_ID && env.TOAST_CLIENT_SECRET && env.TOAST_RESTAURANT_GUID);
}

async function getToastToken(env) {
  const host = (env.TOAST_API_HOST || DEFAULT_TOAST_HOST).replace(/\/+$/, "");
  const res = await fetch(`${host}/authentication/v1/authentication/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      clientId: env.TOAST_CLIENT_ID,
      clientSecret: env.TOAST_CLIENT_SECRET,
      userAccessType: "TOAST_MACHINE_CLIENT",
    }),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 240);
    throw new Error(`Toast auth failed (${res.status}): ${detail}`);
  }
  const data = await res.json();
  const token = data && data.token && data.token.accessToken;
  if (!token) throw new Error("Toast auth response missing accessToken");
  return { host, token };
}

export async function fetchToastMenus(env) {
  const { host, token } = await getToastToken(env);
  const headers = {
    authorization: `Bearer ${token}`,
    "Toast-Restaurant-External-ID": env.TOAST_RESTAURANT_GUID,
  };
  const [menusRes, stockRes] = await Promise.all([
    fetch(`${host}/menus/v2/menus`, { headers }),
    fetch(`${host}/stock/v1/inventory`, { headers }).catch(() => null),
  ]);
  if (!menusRes.ok) {
    const detail = (await menusRes.text()).slice(0, 240);
    throw new Error(`Toast Menus v2 failed (${menusRes.status}): ${detail}`);
  }
  const raw = await menusRes.json();
  const outOfStockGuids = new Set();
  if (stockRes && stockRes.ok) {
    try {
      const inv = await stockRes.json();
      if (Array.isArray(inv)) {
        for (const row of inv) {
          if (row && row.guid && (row.status === "OUT_OF_STOCK" || row.quantity === 0)) {
            outOfStockGuids.add(row.guid);
          }
        }
      }
    } catch {
      // Non-fatal: continue with menu data if stock response fails to parse
    }
  }
  return { raw, outOfStockGuids };
}

function slugify(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
}

function normKey(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function formatPrice(val) {
  if (val === null || val === undefined || val === "") return "MP";
  const num = Number(val);
  if (!Number.isFinite(num)) return String(val);
  if (num <= 0) return "";
  return Number.isInteger(num) ? `$${num}` : `$${num.toFixed(2)}`;
}

function cleanText(name) {
  return String(name || "")
    .trim()
    .replace(/Martinins/g, "Martinis")
    .replace(/Mantattan/g, "Manhattan")
    .replace(/Ceaser/g, "Caesar")
    .replace(/Quesedilla/g, "Quesadilla")
    .replace(/Fried Green Tomatos/g, "Fried Green Tomatoes");
}

function convertGroups(toastMenu, descMap, outOfStockGuids = new Set()) {
  if (!toastMenu) return [];
  const cats = [];
  for (const grp of toastMenu.menuGroups || []) {
    const gname = cleanText(grp.name);
    if (!gname || SKIP_GROUPS.has(gname.toLowerCase())) continue;
    const items = [];
    for (const it of grp.menuItems || []) {
      const iname = cleanText(it.name);
      if (!iname || SKIP_ITEMS.has(iname.toLowerCase())) continue;
      if (it.outOfStock || (it.guid && outOfStockGuids.has(it.guid))) continue;
      if (it.visibility === "NONE" || (Array.isArray(it.visibility) && it.visibility.length === 0)) continue;
      const price = formatPrice(it.price);
      if (!price) continue;
      const desc = String(it.description || "").trim() || descMap.get(normKey(iname)) || "";
      const row = { name: iname, price };
      if (desc) row.desc = desc;
      items.push(row);
    }
    if (items.length) {
      const cat = { id: slugify(gname), name: gname, items };
      if (grp.description && String(grp.description).trim()) cat.note = String(grp.description).trim();
      cats.push(cat);
    }
  }
  return cats;
}

export function buildSiteMenusFromToast(raw, existingMenusJson, outOfStockGuids = new Set()) {
  const descMap = new Map();
  for (const m of (existingMenusJson && existingMenusJson.menus) || []) {
    for (const c of m.categories || []) {
      for (const it of c.items || []) {
        if (it.name && it.desc) descMap.set(normKey(it.name), it.desc);
      }
    }
  }
  const menus = Array.isArray(raw && raw.menus) ? raw.menus : [];
  const byName = (n) => menus.find((m) => m.name === n);

  const mainCats = convertGroups(byName("Main Menu"), descMap, outOfStockGuids);
  mainCats.sort((a, b) => {
    const ia = MAIN_ORDER.indexOf(a.id);
    const ib = MAIN_ORDER.indexOf(b.id);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const seasonalCats = [
    ...convertGroups(byName("Seasonal Menu 11 to 7pm"), descMap, outOfStockGuids),
    ...convertGroups(byName("Happy Hour Wednesday"), descMap, outOfStockGuids).filter((c) => c.name.toLowerCase().includes("food")),
    ...convertGroups(byName("Taco Monday"), descMap, outOfStockGuids),
    ...convertGroups(byName("Happy Hour"), descMap, outOfStockGuids),
  ];

  const barCats = [
    ...convertGroups(byName("Cocktails"), descMap, outOfStockGuids),
    ...convertGroups(byName("Beer"), descMap, outOfStockGuids),
    ...convertGroups(byName("Wine"), descMap, outOfStockGuids),
    ...convertGroups(byName("Martini Monday"), descMap, outOfStockGuids),
    ...convertGroups(byName("Liquor"), descMap, outOfStockGuids),
  ];

  return {
    syncedFromToast: (raw && raw.lastUpdated) || new Date().toISOString(),
    menus: [
      {
        id: "main-menu",
        label: "Main Menu",
        intro: "Live prices synced from our Whistle Stop kitchen POS. Burgers & sandwiches include a side; dine on the patio or order online.",
        categories: mainCats,
      },
      {
        id: "seasonal",
        label: "Seasonal & Specials",
        intro: "Seasonal favorites (11 AM–7 PM), Happy Hour deals (4–7 PM daily, 4 PM–close Tue & Wed), and Taco Monday.",
        categories: seasonalCats,
      },
      {
        id: "bar",
        label: "The Bar",
        intro: "Handcrafted Whistle Stop cocktails, 18 taps & rotating craft drafts, bottle beers, wines, $5 Martini Mondays, and full liquor bar.",
        categories: barCats,
      },
    ],
  };
}

export async function handleToastStatus(env) {
  const metaRaw = env.CONTENT ? await env.CONTENT.get("toast:last_sync") : null;
  const meta = metaRaw ? JSON.parse(metaRaw) : null;
  return json({
    ok: true,
    configured: toastConfigured(env),
    hasClientId: Boolean(env.TOAST_CLIENT_ID),
    hasClientSecret: Boolean(env.TOAST_CLIENT_SECRET),
    hasRestaurantGuid: Boolean(env.TOAST_RESTAURANT_GUID),
    lastSync: meta,
  });
}

export async function runToastSync(env, { apply = false, actor = "cron" } = {}) {
  if (!toastConfigured(env)) {
    return {
      ok: false,
      status: 400,
      error: "Toast secrets not configured (need TOAST_CLIENT_ID, TOAST_CLIENT_SECRET, TOAST_RESTAURANT_GUID).",
    };
  }
  const existingRaw = env.CONTENT ? await env.CONTENT.get("data:data/menus.json") : null;
  const existing = existingRaw ? JSON.parse(existingRaw) : null;
  const { raw, outOfStockGuids } = await fetchToastMenus(env);
  const siteMenus = buildSiteMenusFromToast(raw, existing, outOfStockGuids);
  const itemCount = siteMenus.menus.reduce(
    (sum, m) => sum + m.categories.reduce((s2, c) => s2 + c.items.length, 0),
    0
  );

  if (env.CONTENT) {
    await env.CONTENT.put("toast:staging_menus", JSON.stringify(siteMenus));
    const summary = {
      syncedAt: new Date().toISOString(),
      toastLastUpdated: siteMenus.syncedFromToast,
      menuTabs: siteMenus.menus.length,
      itemCount,
      applied: Boolean(apply),
      actor,
    };
    await env.CONTENT.put("toast:last_sync", JSON.stringify(summary));
    if (apply) {
      // Writes directly into the live KV menus key served at /data/menus.json
      await env.CONTENT.put("data:data/menus.json", JSON.stringify(siteMenus));
    }
    return { ok: true, summary };
  }
  return { ok: true, summary: { menuTabs: siteMenus.menus.length, itemCount, applied: false } };
}

export async function handleToastSync(request, env, user) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  try {
    const result = await runToastSync(env, {
      apply: Boolean(body && body.apply),
      actor: (user && user.username) || "admin",
    });
    if (!result.ok) return errorJson(result.error, result.status || 400);
    return json(result);
  } catch (err) {
    return errorJson(err && err.message ? err.message : "Toast sync failed.", 502);
  }
}
