/* Render promo / happening cards from promos.json */

(function () {
  const params = new URLSearchParams(window.location.search);
  if (params.has("promoPreview")) {
    document.documentElement.classList.add("ws-promo-preview-embed");
    if (location.pathname.includes("events.html")) {
      document.documentElement.classList.add("ws-promo-preview-events");
    } else {
      document.documentElement.classList.add("ws-promo-preview-home");
    }
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

    return `

      <article class="card reveal visible${layoutClass} ${stagger || ""}">

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

      if (events && promos.eventsPageFeatured?.length) {

        events.innerHTML = (

          await Promise.all(promos.eventsPageFeatured.map((p) => cardHtml(p)))

        ).join("");

      }

      window.WSUI?.refreshScrollReveal?.();

    } catch (e) {

      console.warn("promos:", e);

    }

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

