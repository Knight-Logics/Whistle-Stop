/* Stable admin preview frames — live data syncs without reloading or page jumps. */
window.WSAdminPreviewFrame = (function () {
  const bound = new WeakSet();

  /** Project-site base (e.g. /Whistle-Stop/) — never rewrite homepage to origin root /. */
  function siteBasePath() {
    try {
      const path = String(window.location.pathname || "/");
      // Staff portal at /admin.html or clean-url /admin — public pages are at site root, not /admin/*
      if (/\/admin\.html$/i.test(path) || /\/admin$/i.test(path)) {
        return path.slice(0, path.lastIndexOf("/") + 1) || "/";
      }
      if (path.endsWith(".html")) {
        const dir = path.slice(0, path.lastIndexOf("/") + 1);
        return dir || "./";
      }
      return path.endsWith("/") ? path : `${path}/`;
    } catch {
      return "./";
    }
  }

  /**
   * Build iframe preview paths without ".html".
   * npx serve 301-redirects *.html and drops query strings (preview=1, pageEditPreview=1),
   * which disables click-to-edit. Clean paths keep the query intact.
   */
  function normalizePreviewUrl(baseUrl) {
    if (!baseUrl) return baseUrl;
    const raw = String(baseUrl).trim();
    if (raw.includes("://")) return raw;

    let stem = raw.startsWith("/") ? raw.slice(1) : raw.replace(/^\.\//, "");
    stem = stem.replace(/\.html$/i, "").replace(/\/$/, "");
    const base = siteBasePath();

    if (!stem || stem === "index") {
      if (base === "./") return "./";
      // Keep a trailing slash so relative assets resolve under /Whistle-Stop/, not site root.
      return base.endsWith("/") ? base : `${base}/`;
    }

    return `${base}${stem}`;
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
