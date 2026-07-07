/* Apply site.json to [data-site] bindings, theme, and heroes */
(function () {
  (function loadOfferBanner() {
    if (document.querySelector("script[data-ws-qr-offer]")) return;
    const s = document.createElement("script");
    s.src = "js/qr-offer-banner.js?v=2";
    s.defer = true;
    s.dataset.wsQrOffer = "1";
    document.head.appendChild(s);
  })();

  const params = new URLSearchParams(window.location.search);
  if (params.has("heroPreview")) {
    document.documentElement.classList.add("ws-hero-preview-embed");
  }
  if (params.has("homepagePreview")) {
    document.documentElement.classList.add("ws-homepage-preview-embed");
  }
  function setText(el, value) {
    if (value == null || el == null) return;
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") el.value = value;
    else el.textContent = value;
  }

  function setHref(el, value) {
    if (value && el) el.href = value;
  }

  function applyTheme(theme) {
    if (!theme?.colors) return;
    const root = document.documentElement;
    const map = {
      chalk: "--chalk",
      chalkMid: "--chalk-mid",
      chalkLight: "--chalk-light",
      cream: "--cream",
      creamDim: "--cream-dim",
      lime: "--lime",
      limeDark: "--lime-dark",
      purple: "--purple",
      rust: "--rust",
      gold: "--gold",
      textMuted: "--text-muted",
    };
    Object.entries(map).forEach(([key, cssVar]) => {
      if (theme.colors[key]) root.style.setProperty(cssVar, theme.colors[key]);
    });
    if (theme.radius) root.style.setProperty("--radius", theme.radius);
    if (theme.fonts) {
      root.style.setProperty(
        "--font-display",
        `"${theme.fonts.display}", "Impact", sans-serif`
      );
      root.style.setProperty("--font-script", `"${theme.fonts.script}", cursive`);
      root.style.setProperty("--font-body", `"${theme.fonts.body}", system-ui, sans-serif`);
      let link = document.getElementById("ws-theme-fonts");
      if (!link) {
        link = document.createElement("link");
        link.id = "ws-theme-fonts";
        link.rel = "stylesheet";
        document.head.appendChild(link);
      }
      if (theme.fonts.googleFontsUrl) link.href = theme.fonts.googleFontsUrl;
    }
  }

  function applyBindings(site) {
    const b = site.business || {};
    const h = site.hours || {};
    const s = site.social || {};
    const l = site.links || {};
    const addr = [b.street, `${b.city}, ${b.state} ${b.zip}`].filter(Boolean).join(" · ");

    const map = {
      "business.name": b.name,
      "business.logoName": b.logoName,
      "business.logoSub": b.logoSub,
      "business.tagline": b.tagline,
      "business.phoneDisplay": b.phoneDisplay,
      "business.email": b.email,
      "business.street": b.street,
      "business.cityStateZip": `${b.city}, ${b.state} ${b.zip}`,
      "business.address": addr,
      "business.gm": b.gm,
      "business.owners": b.owners,
      "hours.footer": h.footer,
      "hours.weekday": h.weekday?.display,
      "hours.weekend": h.weekend?.display,
      "hours.happyHourDaily": h.happyHourDaily,
      "hours.happyHourTuesday": h.happyHourTuesday,
    };

    document.querySelectorAll("[data-site]").forEach((el) => {
      const key = el.dataset.site;
      const attr = el.dataset.siteAttr || "text";
      let value = map[key];
      if (value == null) value = WSConfig.getPath(site, key);

      if (attr === "text") setText(el, value);
      else if (attr === "html" && value) el.innerHTML = value;
      else if (attr === "href") setHref(el, value);
      else if (attr === "tel" && b.phone) el.href = `tel:${b.phone}`;
      else if (attr === "mailto" && b.email) el.href = `mailto:${b.email}`;
    });

    document.querySelectorAll('[data-site="social.facebook"][data-site-attr="href"]').forEach((el) => setHref(el, s.facebook));
    document.querySelectorAll('[data-site="social.instagram"][data-site-attr="href"]').forEach((el) => setHref(el, s.instagram));
    document.querySelectorAll('[data-site="business.phoneDisplay"]').forEach((el) => setText(el, b.phoneDisplay));
    document.querySelectorAll('[data-site="links.orderMenu"][data-site-attr="href"]').forEach((el) =>
      setHref(el, l.orderMenu || l.orderOnline || "menu.html")
    );
    document.querySelectorAll('[data-site="links.orderOnline"][data-site-attr="href"]').forEach((el) =>
      setHref(el, l.orderMenu || l.orderOnline || "menu.html")
    );
    document.querySelectorAll('[data-site="links.giftCards"][data-site-attr="href"]').forEach((el) => setHref(el, l.giftCards));
    document.querySelectorAll('[data-site="links.googleMaps"][data-site-attr="href"]').forEach((el) => setHref(el, l.googleMaps));
    document.querySelectorAll('[data-site="links.googleReviews"][data-site-attr="href"]').forEach((el) => setHref(el, l.googleReviews));

    document.querySelectorAll("[data-map-lazy]").forEach((el) => {
      if (l.googleMapsEmbed) el.dataset.mapSrc = l.googleMapsEmbed;
    });
  }

  async function applyHero(pageKey, hero) {
    if (!hero) return;
    const root = document.querySelector(`[data-hero="${pageKey}"]`);
    if (!root) return;

    const eyebrow = root.querySelector("[data-hero-eyebrow]");
    const line1 = root.querySelector("[data-hero-title-1]");
    const line2 = root.querySelector("[data-hero-title-2]");
    const tagline = root.querySelector("[data-hero-tagline]");
    const lead = root.querySelector("[data-hero-lead]");
    if (eyebrow && hero.eyebrow) eyebrow.textContent = hero.eyebrow;
    if (line1 && hero.titleLine1) line1.innerHTML = hero.titleLine1;
    if (line2 && hero.titleLine2) line2.innerHTML = hero.titleLine2;
    if (tagline && hero.tagline) tagline.textContent = hero.tagline;
    if (lead && hero.lead) lead.textContent = hero.lead;

    if (hero.panels?.length) {
      await Promise.all(
        hero.panels.map(async (src, i) => {
          if (!src) return;
          const resolved = window.WSConfig?.resolveMediaSrc
            ? await WSConfig.resolveMediaSrc(src)
            : src;
          root.querySelectorAll(`[data-hero-panel="${i}"] img`).forEach((img) => {
            img.src = resolved;
          });
        })
      );
      root.classList.add("hero-panels-ready");
    }
  }

  async function applyAllHeroes(site) {
    const keys = ["index", "events", "menu", "contact", "happyHour"];
    await Promise.all(keys.map((key) => applyHero(key, site.heroes?.[key])));
  }

  async function applyEventsPage(site) {
    const page = site.pages?.events;
    if (!page) return;

    const recurringTitle = document.querySelector("[data-events-recurring-title]");
    const recurringLead = document.querySelector("[data-events-recurring-lead]");
    if (recurringTitle && page.recurringSection?.title) recurringTitle.textContent = page.recurringSection.title;
    if (recurringLead && page.recurringSection?.lead) recurringLead.textContent = page.recurringSection.lead;

    const oneOffTitle = document.querySelector("[data-events-one-off-title]");
    const oneOffLead = document.querySelector("[data-events-one-off-lead]");
    if (oneOffTitle && page.oneOffSection?.title) oneOffTitle.textContent = page.oneOffSection.title;
    if (oneOffLead && page.oneOffSection?.lead) oneOffLead.textContent = page.oneOffSection.lead;

    const galleryRoot = document.getElementById("events-page-gallery");
    if (galleryRoot && page.gallery?.length) {
      const parts = await Promise.all(
        page.gallery.map(async (g, i) => {
          const src = window.WSConfig?.resolveMediaSrc
            ? await WSConfig.resolveMediaSrc(g.image)
            : g.image;
          const wide = i === 0 ? " photo-wide" : "";
          return `<figure class="reveal-photo visible${wide}"><img src="${src}" alt="${g.alt || ""}" loading="lazy" /><figcaption>${g.caption || ""}</figcaption></figure>`;
        })
      );
      galleryRoot.innerHTML = parts.join("");
      galleryRoot.classList.add("visible");
    }
  }

  function applyStats(stats) {
    const bar = document.getElementById("home-stats");
    if (!bar || !stats?.length) return;
    bar.innerHTML = stats
      .map(
        (s) => `
      <div class="stat" ${s.id === "google" ? 'id="google-stat"' : ""}>
        <strong>${s.value}</strong>
        <span>${s.label}</span>
      </div>`
      )
      .join("");
  }

  function pageIdFromPath() {
    const path = location.pathname.replace(/\.html$/i, "").replace(/\/$/, "") || "/";
    if (path === "/" || path.endsWith("/index")) return "index";
    if (path.endsWith("/order")) return "order";
    if (path.endsWith("/happy-hour")) return "happyHour";
    if (path.endsWith("/about")) return "about";
    if (path.endsWith("/contact")) return "contact";
    if (path.endsWith("/private-events")) return "privateEvents";
    return null;
  }

  function applyPageHeroes(site) {
    const pageId = pageIdFromPath();
    if (!pageId || pageId === "index") return;
    const hero = site.pages?.[pageId]?.hero;
    if (!hero) return;
    const root =
      document.querySelector(`[data-page-hero="${pageId}"]`) ||
      document.querySelector("main .page-hero:not([data-hero])");
    if (!root) return;
    const eyebrow = root.querySelector("[data-page-hero-eyebrow]");
    const title = root.querySelector("[data-page-hero-title]");
    const lead = root.querySelector("[data-page-hero-lead]");
    if (eyebrow && hero.eyebrow) eyebrow.textContent = hero.eyebrow;
    if (title && hero.title) title.textContent = hero.title;
    if (lead && hero.lead) lead.textContent = hero.lead;
  }

  function applyPageSections(site) {
    const pageId = pageIdFromPath();
    if (!pageId || pageId === "index") return;
    const blocks = site.pages?.[pageId]?.blocks;
    if (blocks && window.WSPageBlocks) {
      WSPageBlocks.applyAll(blocks);
    }
  }

  async function apply() {
    try {
      const usePreview =
        (params.has("heroPreview") ||
          params.has("homepagePreview") ||
          params.has("preview") ||
          params.has("pagePreview") ||
          params.has("pageEditPreview")) &&
        window.WSConfig?.getForPreview;
      const site = usePreview ? await WSConfig.getForPreview("site") : await WSConfig.get("site");
      applyTheme(site.theme);
      applyBindings(site);
      await applyAllHeroes(site);
      await applyEventsPage(site);
      applyStats(site.stats);
      applyPageHeroes(site);
      applyPageSections(site);
      document.dispatchEvent(new CustomEvent("ws-site-applied", { detail: { site } }));
    } catch (e) {
      console.warn("site-apply:", e);
    }
  }

  document.addEventListener("partials-loaded", apply);
  document.addEventListener("ws-config-updated", apply);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(apply, 0));
  } else {
    setTimeout(apply, 0);
  }
})();
