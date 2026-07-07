/* Reports iframe content height to admin parent — one scroll on admin, not nested bars */
(function () {
  const params = new URLSearchParams(window.location.search);
  const frameId = params.get("adminFrame");
  const isEmbed =
    params.has("preview") ||
    params.has("promoPreview") ||
    params.has("homepagePreview") ||
    params.has("pagePreview") ||
    params.has("pageEditPreview") ||
    params.has("heroPreview");

  if (!isEmbed || !frameId || window.parent === window) return;

  document.documentElement.classList.add("ws-admin-frame-embed");

  function postHeight() {
    const height = Math.ceil(document.documentElement.scrollHeight);
    window.parent.postMessage(
      { source: "ws-preview-height", frameId, height, path: location.pathname },
      window.location.origin
    );
  }

  function scheduleHeight() {
    requestAnimationFrame(() => {
      postHeight();
      setTimeout(postHeight, 120);
      setTimeout(postHeight, 400);
    });
  }

  window.addEventListener("load", scheduleHeight);
  document.addEventListener("ws-config-updated", scheduleHeight);
  document.addEventListener("DOMContentLoaded", scheduleHeight);
  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type === "ws-preview-request-height") scheduleHeight();
  });

  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(scheduleHeight).observe(document.body);
  }
})();
