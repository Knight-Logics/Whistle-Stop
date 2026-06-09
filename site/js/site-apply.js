/* Apply site.json to [data-site] bindings, theme, and heroes */
(function () {
  if (new URLSearchParams(window.location.search).has("heroPreview")) {
    document.documentElement.classList.add("ws-hero-preview-embed");
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
    document.querySelectorAll('[data-site="links.orderOnline"][data-site-attr="href"]').forEach((el) => setHref(el, l.orderOnline));
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

  async function apply() {
    try {
      const site = await WSConfig.get("site");
      applyTheme(site.theme);
      applyBindings(site);
      await applyAllHeroes(site);
      applyStats(site.stats);
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
