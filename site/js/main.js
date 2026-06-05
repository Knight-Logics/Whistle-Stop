/* Whistle Stop — shared UI */
(function () {
  let navInitialized = false;

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
    if (navInitialized) return;
    const toggle = document.querySelector(".nav-toggle");
    const mobileNav = document.querySelector(".nav-mobile");
    const backdrop = document.querySelector(".nav-backdrop");
    if (!toggle || !mobileNav) return;

    navInitialized = true;

    const setOpen = (open) => {
      mobileNav.classList.toggle("open", open);
      backdrop?.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      mobileNav.setAttribute("aria-hidden", open ? "false" : "true");
      document.body.classList.toggle("nav-open", open);
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

  function initSiteUI() {
    initHeaderScroll();
    initMobileNav();
    markActiveNav();
    initScrollReveal();
  }

  document.addEventListener("partials-loaded", initSiteUI);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      if (document.querySelector(".nav-toggle")) initSiteUI();
    });
  } else if (document.querySelector(".nav-toggle")) {
    initSiteUI();
  }
})();
