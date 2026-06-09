/* Homepage gallery, signature cards, FAQ from site.json */
(function () {
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function render() {
    try {
      const site = await WSConfig.get("site");
      const hp = site.homepage || {};

      const gallery = document.getElementById("home-gallery");
      if (gallery && hp.gallery?.length) {
        gallery.innerHTML = hp.gallery
          .map(
            (g) => `
          <figure class="reveal-photo visible">
            <img src="${escapeHtml(g.image)}" alt="${escapeHtml(g.alt || g.caption)}" loading="lazy" decoding="async" width="400" height="400" />
            <figcaption>${escapeHtml(g.caption)}</figcaption>
          </figure>`
          )
          .join("");
        gallery.classList.add("visible");
      }

      const sig = document.getElementById("signature-cards");
      if (sig && hp.signatureCards?.length) {
        sig.innerHTML = hp.signatureCards
          .map((c, i) => {
            const cls = i % 2 === 0 ? "reveal-left" : "reveal-right";
            const imgClass = c.title?.toLowerCase().includes("tomato") ? " card-img--food-plate" : "";
            return `
          <article class="card ${cls} visible">
            <div class="card-img${imgClass}"><img src="${escapeHtml(c.image)}" alt="${escapeHtml(c.alt || c.title)}" loading="lazy" decoding="async" /></div>
            <div class="card-body">
              <h3>${escapeHtml(c.title)}</h3>
              <p>${escapeHtml(c.summary)}</p>
              <a href="${escapeHtml(c.ctaHref || "menu.html")}" class="btn btn-primary">${escapeHtml(c.ctaLabel || "View menu")}</a>
            </div>
          </article>`;
          })
          .join("");
      }

      const faq = document.getElementById("home-faq");
      if (faq && hp.faq?.length) {
        faq.innerHTML = hp.faq
          .map((item, i) => {
            const cls = i % 2 === 0 ? "reveal-left" : "reveal-right";
            return `
          <article class="card ${cls} visible">
            <div class="card-body">
              <h3>${escapeHtml(item.q)}</h3>
              <p>${escapeHtml(item.a)}</p>
            </div>
          </article>`;
          })
          .join("");
      }
      window.WSUI?.refreshScrollReveal?.();
    } catch (e) {
      console.warn("home-content:", e);
    }
  }

  document.addEventListener("DOMContentLoaded", render);
  document.addEventListener("ws-config-updated", render);
})();
