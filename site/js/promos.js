/* Render promo / happening cards from promos.json */

(function () {
  const params = new URLSearchParams(window.location.search);

  function isEventsPagePath() {
    const path = location.pathname.replace(/\/$/, "") || "/";
    return path.endsWith("/events") || /events\.html$/i.test(path);
  }

  function isHomePagePath() {
    const path = location.pathname.replace(/\/$/, "") || "/";
    return path === "/" || path.endsWith("/index") || /index\.html$/i.test(path);
  }

  const isFullEventsAdminPreview =
    params.has("preview") && params.has("promoPreview") && isEventsPagePath();

  const isHomepagePageEdit =
    params.has("pageEditPreview") && params.has("homepagePreview") && isHomePagePath();

  if (params.has("promoPreview")) {
    document.documentElement.classList.add("ws-promo-preview-embed");
    if (isFullEventsAdminPreview || isHomepagePageEdit) {
      /* Full page admin preview — no crop classes */
    } else if (isEventsPagePath()) {
      document.documentElement.classList.add("ws-promo-preview-events");
    } else if (!params.has("homepagePreview")) {
      document.documentElement.classList.add("ws-promo-preview-home");
    }
  }
  if (params.has("homepagePreview")) {
    document.documentElement.classList.add("ws-homepage-preview-embed");
  }
  if (params.has("pagePreview") || params.has("pageEditPreview")) {
    document.documentElement.classList.add("ws-page-preview-embed");
  }

  function escapeHtml(s) {

    return String(s)

      .replace(/&/g, "&amp;")

      .replace(/</g, "&lt;")

      .replace(/>/g, "&gt;")

      .replace(/"/g, "&quot;");

  }



  function mediaTypeFor(p) {

    if (p.mediaType) return p.mediaType;

    if (window.WSConfig) return WSConfig.inferMediaType("", p.image);

    return /\.(mp4|webm|mov|m4v|ogv)$/i.test(p.image || "") ? "video" : "image";

  }



  function mediaHtml(src, mediaType, alt) {

    const safeSrc = escapeHtml(src);

    const safeAlt = escapeHtml(alt || "");

    if (mediaType === "video") {

      return `<video src="${safeSrc}" muted loop playsinline autoplay preload="metadata" aria-label="${safeAlt}"></video>`;

    }

    return `<img src="${safeSrc}" alt="${safeAlt}" loading="lazy" decoding="async" />`;

  }



  async function cardHtml(p, stagger) {

    const tagClass = p.tagClass ? ` ${escapeHtml(p.tagClass)}` : "";

    const layoutClass = p.layout === "highlight" ? " card-promo-highlight" : "";

    const fallback = "assets/gallery/WSGoodTimes.webp";

    const raw = p.image || fallback;

    const src = window.WSConfig ? await WSConfig.resolveMediaSrc(raw) : raw;

    const mediaType = mediaTypeFor(p);

    const alt = p.alt || p.title;

    const clickAttrs = isFullEventsAdminPreview || isHomepagePageEdit
      ? ` data-admin-promo-id="${escapeHtml(p.id || "")}" tabindex="0" role="button"`
      : "";

    return `

      <article class="card reveal visible${layoutClass}${isFullEventsAdminPreview || isHomepagePageEdit ? " admin-preview-clickable" : ""} ${stagger || ""}"${clickAttrs}>

        <div class="card-img card-img--media">${mediaHtml(src || fallback, mediaType, alt)}</div>

        <div class="card-body">

          <h3>${escapeHtml(p.title)}</h3>

          <p>${escapeHtml(p.summary)}</p>

          <div class="card-meta"><span class="tag${tagClass}">${escapeHtml(p.tag || "")}</span></div>

        </div>

      </article>`;

  }



  async function render() {

    try {

      const promos =
        params.has("promoPreview") && WSConfig.getForPreview
          ? await WSConfig.getForPreview("promos")
          : await WSConfig.get("promos");



      const home = document.getElementById("promo-cards-home");

      if (home && promos.homepageFeatured?.length) {

        home.innerHTML = (

          await Promise.all(

            promos.homepageFeatured.map((p, i) => cardHtml(p, `stagger-${(i % 3) + 1}`))

          )

        ).join("");

      }



      const events = document.getElementById("promo-cards-events");

      /* Recurring favorites on the events page are rendered from events.json by events.js */

      window.WSUI?.refreshScrollReveal?.();

      bindPromoAdminClicks();

    } catch (e) {

      console.warn("promos:", e);

    }

  }



  function bindPromoAdminClicks() {
    if (!isFullEventsAdminPreview && !isHomepagePageEdit) return;
    const bindings = [
      isHomepagePageEdit ? { root: document.getElementById("promo-cards-home"), source: "ws-page-preview" } : null,
    ].filter((b) => b?.root);

    bindings.forEach(({ root, source }) => {
      if (root.dataset.adminClickBound) return;
      root.dataset.adminClickBound = "1";
      const send = (card) => {
        window.parent.postMessage({ source, type: "promo", id: card.dataset.adminPromoId }, window.location.origin);
      };
      root.addEventListener("click", (event) => {
        const card = event.target.closest("[data-admin-promo-id]");
        if (!card) return;
        event.preventDefault();
        event.stopPropagation();
        send(card);
      });
      root.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const card = event.target.closest("[data-admin-promo-id]");
        if (!card) return;
        event.preventDefault();
        send(card);
      });
    });
  }



  document.addEventListener("DOMContentLoaded", render);

  document.addEventListener("ws-config-updated", render);

  if (params.has("promoPreview")) {
    window.addEventListener("storage", (e) => {
      if (e.key === "ws-admin-preview-store") render();
    });
    window.addEventListener("message", (e) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "ws-promo-preview-refresh") render();
    });
  }

})();

