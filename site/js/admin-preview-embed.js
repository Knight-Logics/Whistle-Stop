/* Marks customer pages as stable, internally scrollable admin previews. */
(function () {
  const params = new URLSearchParams(window.location.search);
  const frameId = params.get("adminFrame") || window.frameElement?.id || "";
  const isEmbed =
    params.has("preview") ||
    params.has("promoPreview") ||
    params.has("homepagePreview") ||
    params.has("pagePreview") ||
    params.has("pageEditPreview") ||
    params.has("heroPreview");

  if (!isEmbed || !frameId || window.parent === window) return;

  document.documentElement.classList.add("ws-admin-frame-embed");
})();
