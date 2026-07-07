/* Admin-side iframe auto-height — avoids double vertical scrollbars */
window.WSAdminPreviewFrame = (function () {
  const bound = new WeakSet();

  function normalizePreviewUrl(baseUrl) {
    if (!baseUrl) return baseUrl;
    if (baseUrl === "index.html" || baseUrl === "/index.html") return "/";
    // Keep .html so python -m http.server and other static hosts resolve the file.
    return baseUrl;
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
