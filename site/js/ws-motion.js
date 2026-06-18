/* Whistle Stop — Knight Group-style slide-in enter animations */
(function () {
  document.documentElement.classList.add("ws-js");

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let scrollObserver = null;

  function getScrollObserver() {
    if (scrollObserver) return scrollObserver;
    scrollObserver = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.12 }
    );
    return scrollObserver;
  }

  function markImmediate(el) {
    el.dataset.wsEnterImmediate = "true";
  }

  function applyEnterRules(root = document) {
    root.querySelectorAll(".nav-desktop a").forEach((el, i) => {
      if (el.closest(".site-header")) return;
      if (el.dataset.wsEnter) return;
      el.dataset.wsEnter = "top";
      el.style.setProperty("--ws-enter-delay", `${60 + i * 45}ms`);
      markImmediate(el);
    });

    root.querySelectorAll("main h1, .page-hero h1, .hero h1").forEach((el) => {
      if (el.dataset.wsEnter || el.classList.contains("visible")) return;
      el.dataset.wsEnter = "left";
      markImmediate(el);
    });

    root.querySelectorAll(".hero-eyebrow, .page-hero .hero-eyebrow").forEach((el) => {
      if (el.dataset.wsEnter) return;
      el.dataset.wsEnter = "left";
      markImmediate(el);
    });

    root.querySelectorAll(".hero .lead, .page-hero > .container > p").forEach((el, i) => {
      if (i > 0 || el.dataset.wsEnter) return;
      el.dataset.wsEnter = "left";
      el.style.setProperty("--ws-enter-delay", "110ms");
      markImmediate(el);
    });

    root.querySelectorAll(".hero .btn-group, .page-hero .btn-group").forEach((el) => {
      if (el.dataset.wsEnter) return;
      el.dataset.wsEnter = "right";
      el.style.setProperty("--ws-enter-delay", "200ms");
      markImmediate(el);
    });

    root.querySelectorAll(".section-head").forEach((el) => {
      if (el.dataset.wsEnter) return;
      el.dataset.wsEnter = "top";
    });

    root.querySelectorAll(".card-grid .card, .card-grid .card-compact, .order-card").forEach((el, i) => {
      if (el.dataset.wsEnter) return;
      const dirs = ["left", "right", "bottom"];
      el.dataset.wsEnter = dirs[i % dirs.length];
      el.style.setProperty("--ws-enter-delay", `${(i % 4) * 85}ms`);
    });

    root.querySelectorAll(".split-media > div, .split-media > img").forEach((el, i) => {
      if (el.dataset.wsEnter) return;
      el.dataset.wsEnter = i % 2 === 0 ? "left" : "right";
    });

    root.querySelectorAll(".order-feature, .visit-location-info, .visit-map-embed").forEach((el, i) => {
      if (el.dataset.wsEnter) return;
      el.dataset.wsEnter = i % 2 === 0 ? "left" : "right";
    });
  }

  function observeEnterTargets(root = document) {
    const targets = [...root.querySelectorAll("[data-ws-enter]")].filter((el) => !el.classList.contains("is-visible"));
    if (!targets.length) return;

    if (reducedMotion) {
      targets.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const io = getScrollObserver();
    targets.forEach((el) => {
      if (el.dataset.wsEnterImmediate === "true") {
        requestAnimationFrame(() => el.classList.add("is-visible"));
        return;
      }
      io.observe(el);
    });
  }

  function initEnterAnimations(root = document) {
    applyEnterRules(root);
    observeEnterTargets(root);
  }

  function boot() {
    initEnterAnimations(document);
  }

  document.addEventListener("partials-loaded", () => {
    setTimeout(() => {
      initEnterAnimations(document.querySelector(".site-header")?.closest(".site-header") ? document : document);
      initEnterAnimations(document);
    }, 0);
  });

  document.addEventListener("ws-site-applied", () => {
    initEnterAnimations(document);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.WSMotion = { refresh: initEnterAnimations };
})();
