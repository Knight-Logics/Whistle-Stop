/* Other Pages admin — click-to-edit blocks + header nav (not editable) */

(function () {

  const params = new URLSearchParams(window.location.search);

  const inAdminFrame = params.get("adminFrame") && window.parent !== window;



  if (!params.has("pageEditPreview")) {

    if (inAdminFrame) {

      window.parent.postMessage({ source: "ws-page-preview", type: "recover-preview" }, window.location.origin);

    }

    return;

  }



  document.documentElement.classList.add("ws-page-edit-preview");



  function pageIdFromPath() {

    const path = location.pathname.replace(/\/$/, "") || "/";

    if (path === "/" || path.endsWith("/index")) return "index";

    if (path.endsWith("/order")) return "order";

    if (path.endsWith("/happy-hour")) return "happyHour";

    if (path.endsWith("/about")) return "about";

    if (path.endsWith("/contact")) return "contact";

    if (path.endsWith("/menu")) return "menu";

    if (path.endsWith("/private-events")) return "privateEvents";

    return null;

  }



  const NAV_TARGETS = {

    "/": "index",

    "/index": "index",

    "/order": "order",

    "/menu": "menu",

    "/events": "events",

    "/happy-hour": "happyHour",

    "/about": "about",

    "/contact": "contact",

    "/private-events": "privateEvents",

  };



  function post(payload) {

    window.parent.postMessage({ source: "ws-page-preview", ...payload }, window.location.origin);

  }



  function normalizeHref(href) {

    try {

      const url = new URL(href, location.origin);

      if (url.origin !== location.origin) return null;

      let path = url.pathname.replace(/\.html$/i, "").replace(/\/$/, "") || "/";

      if (path === "/index") path = "/";

      return path;

    } catch {

      return null;

    }

  }



  function blockLabel(el) {

    const type = el.dataset.adminBlockType || window.WSPageBlocks?.blockType(el.dataset.adminBlock);

    const map = {

      intro: "section heading",

      stats: "stats row",

      feature: "feature block",

      card: "card",

      orderCard: "delivery partner card",

      split: "text & photos",

      gallery: "photo gallery",

      detail: "info block",

      fine: "note text",

      cta: "call to action",

      section: "section",

    };

    return map[type] || "section";

  }



  function decorateSections() {

    document.querySelectorAll("[data-admin-section], [data-admin-block]").forEach((el) => {

      el.classList.add("admin-preview-clickable");

      if (!el.getAttribute("title")) {

        el.setAttribute("title", `Click to edit this ${blockLabel(el)}`);

      }

    });

  }



  function markSections() {

    document.querySelectorAll("[data-admin-section]").forEach((el) => {

      el.removeAttribute("data-admin-section");

      el.classList.remove("admin-preview-clickable");

    });



    const page = pageIdFromPath();



    if (page === "index") {

      document.querySelector('[data-hero="index"] .hero-bg')?.setAttribute("data-admin-section", "hero-photos");

      document.querySelector('[data-hero="index"] .hero-content')?.setAttribute("data-admin-section", "hero-text");

      document.getElementById("home-stats")?.setAttribute("data-admin-section", "stats");

      document.getElementById("promo-happenings")?.setAttribute("data-admin-section", "promos");

      document.getElementById("home-gallery")?.closest("section")?.setAttribute("data-admin-section", "gallery");

      document.getElementById("signature-cards")?.closest("section")?.setAttribute("data-admin-section", "signatures");

      document.getElementById("home-faq")?.closest("section")?.setAttribute("data-admin-section", "faq");

    }



    document.querySelectorAll("[data-hero]").forEach((hero) => {

      const key = hero.getAttribute("data-hero");

      if (page === "index" && key === "index") return;

      hero.querySelector(".hero-bg, .page-hero-bg--desktop, .page-hero-photo")?.setAttribute("data-admin-section", "hero-photos");

      if (!hero.querySelector("[data-admin-section='hero-photos']")) {

        hero.setAttribute("data-admin-section", "hero-photos");

      }

      hero.querySelector(".hero-content, .page-hero-content")?.setAttribute("data-admin-section", "hero-text");

    });



    document.querySelectorAll("main .page-hero:not([data-hero])").forEach((el) => {

      el.setAttribute("data-admin-section", "page-hero");

    });



    if (page && page !== "index" && window.WSPageBlocks) {

      WSPageBlocks.markBlocks();

    }



    decorateSections();

  }



  function bindSectionClicks() {

    if (document.body.dataset.pageEditBound) return;

    document.body.dataset.pageEditBound = "1";



    document.addEventListener(

      "click",

      (event) => {

        if (event.target.closest(".site-header, .nav-mobile, .nav-backdrop")) return;



        const promo = event.target.closest("[data-admin-promo-id]");

        if (promo) {

          event.preventDefault();

          event.stopPropagation();

          post({ type: "promo", id: promo.dataset.adminPromoId });

          return;

        }



        const block = event.target.closest("[data-admin-block]");

        if (block) {

          event.preventDefault();

          event.stopPropagation();

          post({

            type: "block",

            blockId: block.dataset.adminBlock,

            blockType: block.dataset.adminBlockType || WSPageBlocks?.blockType(block.dataset.adminBlock),

            pageId: pageIdFromPath(),

          });

          return;

        }



        const section = event.target.closest("[data-admin-section]");

        if (!section) return;

        event.preventDefault();

        event.stopPropagation();

        post({ type: "section", section: section.dataset.adminSection, pageId: pageIdFromPath() });

      },

      true

    );

  }



  function bindAdminNav() {

    if (document.documentElement.dataset.adminNavBound) return;

    document.documentElement.dataset.adminNavBound = "1";



    document.addEventListener(

      "click",

      (event) => {

        const chrome = event.target.closest(".site-header, .nav-mobile");

        if (!chrome) return;



        const link = event.target.closest("a[href]");

        if (!link) return;



        const path = normalizeHref(link.getAttribute("href"));

        if (!path) return;



        const pageId = NAV_TARGETS[path];

        if (!pageId) return;



        event.preventDefault();

        event.stopPropagation();



        if (pageId === "events" || pageId === "menu") {

          post({ type: "admin-nav", target: pageId === "menu" ? "menus" : "events" });

          return;

        }



        post({ type: "switch-page", pageId });

      },

      true

    );



    document.querySelector(".site-header")?.classList.add("ws-admin-preview-chrome");

    document.querySelector(".nav-mobile")?.classList.add("ws-admin-preview-chrome");

  }



  function init() {

    markSections();

    bindSectionClicks();

    bindAdminNav();

  }



  document.addEventListener("DOMContentLoaded", init);

  document.addEventListener("partials-loaded", init);

  document.addEventListener("ws-config-updated", markSections);

  document.addEventListener("ws-site-applied", markSections);

  if (document.readyState !== "loading") init();

})();

