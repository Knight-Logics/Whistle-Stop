import { extname, join } from "path";

/** Map clean preview paths (/events, /order) and .html URLs to files on disk. */
export function resolveSiteFile(siteRoot, urlPath) {
  const clean = decodeURIComponent(String(urlPath || "/").split("?")[0]);
  if (clean === "/" || clean === "") return join(siteRoot, "index.html");
  if (extname(clean) && !/\.html$/i.test(clean)) return join(siteRoot, clean.replace(/^\//, ""));
  const bare = clean.replace(/^\//, "").replace(/\.html$/i, "");
  if (!bare || bare === "index") return join(siteRoot, "index.html");
  if (bare === "admin") return join(siteRoot, "admin.html");
  return join(siteRoot, `${bare}.html`);
}
