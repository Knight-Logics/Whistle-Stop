/* Whistle Stop — shared UI */
(function () {
  const header = document.querySelector(".site-header");
  const toggle = document.querySelector(".nav-toggle");
  const mobileNav = document.querySelector(".nav-mobile");

  if (header) {
    window.addEventListener(
      "scroll",
      () => header.classList.toggle("scrolled", window.scrollY > 40),
      { passive: true }
    );
  }

  if (toggle && mobileNav) {
    toggle.addEventListener("click", () => {
      const open = mobileNav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open);
    });
    mobileNav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => mobileNav.classList.remove("open"));
    });
  }

  // Mark active nav
  const path = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-desktop a, .nav-mobile a").forEach((a) => {
    const href = a.getAttribute("href");
    if (href === path || (path === "" && href === "index.html")) {
      a.classList.add("active");
    }
  });

  // Scroll reveal (Clearwater-style slide-in)
  const revealEls = document.querySelectorAll(
    ".reveal, .reveal-left, .reveal-right, .reveal-scale"
  );
  if (revealEls.length && "IntersectionObserver" in window) {
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

})();
