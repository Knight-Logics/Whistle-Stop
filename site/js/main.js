/* Whistle Stop — shared UI */
(function () {
  function initHeaderScroll() {
    const header = document.querySelector(".site-header");
    if (!header || header.dataset.scrollInit) return;
    header.dataset.scrollInit = "1";
    window.addEventListener(
      "scroll",
      () => header.classList.toggle("scrolled", window.scrollY > 40),
      { passive: true }
    );
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
    document.querySelectorAll(".nav-desktop a, .nav-mobile a").forEach((a) => {
      const href = a.getAttribute("href");
      a.classList.toggle(
        "active",
        href === path || (path === "" && href === "index.html")
      );
    });
  }

  function initScrollReveal() {
    const revealEls = document.querySelectorAll(
      ".reveal, .reveal-left, .reveal-right, .reveal-scale, .reveal-photo"
    );
    if (!revealEls.length) return;

    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add("visible");
              io.unobserve(e.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
      );
      revealEls.forEach((el) => io.observe(el));
    } else {
      revealEls.forEach((el) => el.classList.add("visible"));
    }
  }

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

  function initMapFacades() {
    document.querySelectorAll("[data-map-lazy]").forEach((wrap) => {
      if (wrap.dataset.mapBound === "1") return;
      wrap.dataset.mapBound = "1";

      const button = wrap.querySelector("[data-map-load]");
      button?.addEventListener("click", () => {
        const iframe = document.createElement("iframe");
        iframe.src = wrap.dataset.mapSrc || "";
        iframe.title = wrap.dataset.mapTitle || "Google Map";
        iframe.loading = "lazy";
        iframe.referrerPolicy = "no-referrer-when-downgrade";
        iframe.allowFullscreen = true;
        wrap.replaceChildren(iframe);
      });
    });
  }

  function initSiteUI() {
    initHeaderScroll();
    initMobileNav();
    initMapFacades();
    markActiveNav();
    initScrollReveal();
    initHeroPanels();
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
