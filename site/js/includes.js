/* Load partials, then move mobile nav to <body> (fixes drawer inside fixed header) */
document.addEventListener("DOMContentLoaded", async () => {
  const nodes = document.querySelectorAll("[data-include]");
  await Promise.all(
    [...nodes].map(async (el) => {
      try {
        const res = await fetch(el.dataset.include);
        if (res.ok) el.innerHTML = await res.text();
      } catch (e) {
        console.warn("Include failed:", el.dataset.include, e);
      }
    })
  );

  relocateMobileNav();
  ensureMotionScript();
  document.dispatchEvent(new Event("partials-loaded"));
});

function ensureMotionScript() {
  if (document.querySelector("script[data-ws-motion]")) return;
  const script = document.createElement("script");
  script.src = "js/ws-motion.js";
  script.defer = true;
  script.dataset.wsMotion = "1";
  document.head.appendChild(script);
}

function relocateMobileNav() {
  const backdrop = document.querySelector(".nav-backdrop");
  const mobile = document.querySelector(".nav-mobile");
  if (backdrop && backdrop.parentElement !== document.body) {
    document.body.appendChild(backdrop);
  }
  if (mobile && mobile.parentElement !== document.body) {
    document.body.appendChild(mobile);
  }
}
