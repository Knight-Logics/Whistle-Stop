/* Whistle Stop — shared UI */
(function () {
  function initHeaderScroll() {
    const header = document.querySelector(".site-header");
    if (!header || header.dataset.scrollInit) return;
    header.dataset.scrollInit = "1";
    const update = () => header.classList.toggle("scrolled", window.scrollY > 12);
    update();
    window.addEventListener("scroll", update, { passive: true });
  }

  function initMobileNav() {
    const toggle = document.querySelector(".nav-toggle");
    const mobileNav = document.querySelector(".nav-mobile");
    const backdrop = document.querySelector(".nav-backdrop");
    if (!toggle || !mobileNav) return;
    if (toggle.dataset.navBound === "1") return;

    toggle.dataset.navBound = "1";

    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    function setMobileNavAccessibility(open) {
      if (open) {
        mobileNav.removeAttribute("inert");
        mobileNav.setAttribute("aria-hidden", "false");
        mobileNav.querySelectorAll(focusableSelector).forEach((el) => {
          if (el.dataset.savedTabindex !== undefined) {
            const saved = el.dataset.savedTabindex;
            if (saved) el.setAttribute("tabindex", saved);
            else el.removeAttribute("tabindex");
            delete el.dataset.savedTabindex;
          }
        });
      } else {
        mobileNav.setAttribute("inert", "");
        mobileNav.setAttribute("aria-hidden", "true");
        mobileNav.querySelectorAll(focusableSelector).forEach((el) => {
          if (el.dataset.savedTabindex === undefined) {
            el.dataset.savedTabindex = el.getAttribute("tabindex") ?? "";
          }
          el.setAttribute("tabindex", "-1");
        });
      }
    }

    const setOpen = (open) => {
      mobileNav.classList.toggle("open", open);
      backdrop?.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      setMobileNavAccessibility(open);
      document.body.classList.toggle("nav-open", open);
      document.querySelector(".site-header")?.classList.toggle("nav-open", open);
    };

    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setOpen(!mobileNav.classList.contains("open"));
    });

    backdrop?.addEventListener("click", () => setOpen(false));

    mobileNav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => setOpen(false));
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setOpen(false);
    });

    setOpen(false);
  }

  function markActiveNav() {
    const path = location.pathname.split("/").pop() || "index.html";
    const isHome = !path || path === "index.html";
    document.querySelectorAll(".nav-desktop a, .nav-mobile-links a").forEach((a) => {
      const href = a.getAttribute("href") || "";
      const hrefFile = href.split("/").pop() || href;
      const active =
        hrefFile === path ||
        (isHome && (hrefFile === "index.html" || href === "/" || href === "./"));
      a.classList.toggle("active", active);
      if (active) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  const REVEAL_SELECTOR =
    ".reveal, .reveal-left, .reveal-right, .reveal-scale, .reveal-photo";
  let revealObserver = null;

  function getRevealObserver() {
    if (!("IntersectionObserver" in window)) return null;
    if (revealObserver) return revealObserver;
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            revealObserver.unobserve(e.target);
            delete e.target.dataset.revealPending;
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    return revealObserver;
  }

  function observeRevealElements(root = document) {
    const revealEls = [...root.querySelectorAll(REVEAL_SELECTOR)].filter(
      (el) => !el.classList.contains("visible") && el.dataset.revealPending !== "1"
    );
    if (!revealEls.length) return;

    const io = getRevealObserver();
    if (!io) {
      revealEls.forEach((el) => el.classList.add("visible"));
      return;
    }
    revealEls.forEach((el) => {
      el.dataset.revealPending = "1";
      io.observe(el);
    });
  }

  function initScrollReveal() {
    observeRevealElements(document);
  }

  window.WSUI = window.WSUI || {};
  window.WSUI.refreshScrollReveal = () => observeRevealElements(document);

  function initHeroPanels() {
    document.querySelectorAll(".hero, .page-hero--gallery, .menu-hero--gallery").forEach((hero) => {
      if (hero.dataset.panelsInit) return;
      hero.dataset.panelsInit = "1";
      requestAnimationFrame(() => hero.classList.add("hero-panels-ready"));
    });

    document.querySelectorAll(".page-hero--photo").forEach((hero) => {
      if (hero.dataset.photoInit) return;
      hero.dataset.photoInit = "1";
      requestAnimationFrame(() => hero.classList.add("page-hero-photo-ready"));
    });
  }

  function loadMap(wrap) {
    if (wrap.dataset.mapLoaded === "1") return;
    wrap.dataset.mapLoaded = "1";
    const iframe = document.createElement("iframe");
    iframe.src = wrap.dataset.mapSrc || "";
    iframe.title = wrap.dataset.mapTitle || "Google Map";
    iframe.loading = "lazy";
    iframe.referrerPolicy = "no-referrer-when-downgrade";
    iframe.allowFullscreen = true;
    wrap.replaceChildren(iframe);
  }

  function initLazyMaps() {
    const maps = document.querySelectorAll("[data-map-lazy]");
    if (!maps.length) return;

    if (!("IntersectionObserver" in window)) {
      maps.forEach(loadMap);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            loadMap(entry.target);
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "600px 0px" }
    );
    maps.forEach((map) => io.observe(map));
  }

  function initSiteUI() {
    initHeaderScroll();
    initMobileNav();
    markActiveNav();
    initScrollReveal();
    initHeroPanels();
    initLazyMaps();
  }

  document.addEventListener("partials-loaded", initSiteUI);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(initSiteUI, 0);
    });
  } else {
    setTimeout(initSiteUI, 0);
  }
})();
