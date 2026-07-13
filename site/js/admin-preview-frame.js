/* Stable admin preview frames — live data syncs without reloading or page jumps. */
window.WSAdminPreviewFrame = (function () {
  const bound = new WeakSet();

  /** Project-site base (e.g. /Whistle-Stop/) — never rewrite homepage to origin root /. */
  function siteBasePath() {
    try {
      const path = String(window.location.pathname || "/");
      if (path.endsWith(".html")) {
        const dir = path.slice(0, path.lastIndexOf("/") + 1);
        return dir || "./";
      }
      return path.endsWith("/") ? path : `${path}/`;
    } catch {
      return "./";
    }
  }

  function normalizePreviewUrl(baseUrl) {
    if (!baseUrl) return baseUrl;
    const raw = String(baseUrl).trim();
    // Keep .html so python -m http.server and GitHub project pages resolve the file.
    // Never map index.html → "/" (that 404s on github.io/Whistle-Stop/).
    if (raw === "index.html" || raw === "./index.html" || raw === "/index.html") {
      return `${siteBasePath()}index.html`;
    }
    if (raw === "/" || raw === "./") {
      return `${siteBasePath()}index.html`;
    }
    return raw;
  }

  function bind(iframe) {
    if (!iframe || bound.has(iframe)) return;
    bound.add(iframe);

    if (!iframe.id) {
      iframe.id = `admin-preview-${Date.now()}`;
    }

    iframe.setAttribute("scrolling", "yes");
    iframe.classList.add("admin-preview-frame--fit");
    iframe.style.removeProperty("height");
  }

  function previewSrc(baseUrl, frameId, extraParams = "") {
    const q = new URLSearchParams();
    q.set("adminFrame", frameId);
    if (extraParams) {
      extraParams.split("&").forEach((part) => {
        const [key, ...rest] = part.split("=");
        if (key) q.set(key, rest.join("=") || "");
      });
    }
    q.set("_", String(Date.now()));
    return `${normalizePreviewUrl(baseUrl)}?${q.toString()}`;
  }

  function setSrc(iframe, baseUrl, extraParams = "") {
    bind(iframe);
    const next = previewSrc(baseUrl, iframe.id, extraParams);
    try {
      const currentUrl = new URL(iframe.src, window.location.href);
      const nextUrl = new URL(next, window.location.href);
      currentUrl.searchParams.delete("_");
      nextUrl.searchParams.delete("_");
      currentUrl.searchParams.sort();
      nextUrl.searchParams.sort();
      if (
        currentUrl.origin === nextUrl.origin &&
        currentUrl.pathname === nextUrl.pathname &&
        currentUrl.search === nextUrl.search
      ) {
        return false;
      }
    } catch {
      /* Initial about:blank or malformed URL — load the requested preview. */
    }
    iframe.src = next;
    return true;
  }

  return { bind, previewSrc, setSrc, normalizePreviewUrl };
})();
