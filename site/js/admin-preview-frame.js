/* Admin-side iframe auto-height — avoids double vertical scrollbars */
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

    iframe.setAttribute("scrolling", "no");
    iframe.classList.add("admin-preview-frame--fit");

    function onMessage(event) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.source !== "ws-preview-height") return;
      if (event.data.frameId !== iframe.id) return;
      const height = Math.max(420, Number(event.data.height) || 0);
      iframe.style.height = `${height}px`;
    }

    window.addEventListener("message", onMessage);

    iframe.addEventListener("load", () => {
      try {
        iframe.contentWindow?.postMessage({ type: "ws-preview-request-height" }, window.location.origin);
      } catch {
        /* cross-origin guard */
      }
    });
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
    if (!iframe?.id) bind(iframe);
    iframe.src = previewSrc(baseUrl, iframe.id, extraParams);
  }

  return { bind, previewSrc, setSrc, normalizePreviewUrl };
})();
