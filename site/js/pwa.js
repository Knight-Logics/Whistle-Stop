/* Installable public/staff app shell — same install method as Handyman Ticket Manager.
   Private admin and live data always stay network-only. */
(function () {
  const isAdmin = /(?:^|\/)admin(?:\.html)?$/i.test(location.pathname);
  const manifest = isAdmin ? "admin-manifest.webmanifest" : "manifest.webmanifest";
  const appShortName = isAdmin ? "Whistle Stop Staff" : "Whistle Stop";
  const DISMISS_KEY = isAdmin ? "ws-staff-install-dismissed" : "ws-install-dismissed";
  const DISMISS_MS = 30 * 24 * 60 * 60 * 1000;
  const hadServiceWorkerController = Boolean(navigator.serviceWorker?.controller);

  let deferredInstall = null;

  if (!document.querySelector('link[rel="manifest"]')) {
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = new URL(manifest, document.baseURI).href;
    document.head.appendChild(link);
  }

  if (!document.querySelector('meta[name="theme-color"]')) {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = "#141414";
    document.head.appendChild(meta);
  }

  if (document.body) {
    document.body.dataset.appShortName = appShortName;
    document.body.dataset.wsApp = isAdmin ? "staff" : "public";
  }

  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadServiceWorkerController) return;
      try {
        if (sessionStorage.getItem("ws-pwa-update-reload") === "1") return;
        sessionStorage.setItem("ws-pwa-update-reload", "1");
      } catch {
        /* reload once even if storage is unavailable */
      }
      location.reload();
    });
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register(new URL("sw.js", document.baseURI).href)
        .then((registration) => registration.update())
        .catch((err) => {
          console.warn("[Whistle Stop PWA] service worker registration failed", err);
        });
    });
  }

  function isStandalone() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  function isMobile() {
    return (
      window.matchMedia("(max-width: 768px)").matches ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    );
  }

  function isIOS() {
    const ua = navigator.userAgent;
    return (
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
  }

  function isPreviewEmbed() {
    if (window.parent !== window) return true;
    const params = new URLSearchParams(window.location.search);
    return (
      params.has("adminFrame") ||
      params.has("preview") ||
      params.has("pageEditPreview") ||
      params.has("homepagePreview") ||
      params.has("heroPreview") ||
      params.has("promoPreview")
    );
  }

  function isDismissed() {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (!raw) return false;
      return Date.now() - parseInt(raw, 10) < DISMISS_MS;
    } catch {
      return false;
    }
  }

  function dismissBanner() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    document.getElementById("ws-install-banner")?.remove();
    document.body.classList.remove("has-install-banner", "is-ios-install-top");
  }

  function promptInstall() {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    deferredInstall.userChoice.then((choice) => {
      if (choice.outcome === "accepted") dismissBanner();
      deferredInstall = null;
    });
  }

  function ensureHeaderInstallButton() {
    if (isStandalone() || !isMobile() || isPreviewEmbed()) return;
    const actions = document.querySelector(".nav-mobile-ctas");
    if (!actions || document.getElementById("ws-install-header-btn")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "ws-install-header-btn";
    btn.className = "btn btn-outline btn-sm ws-header-install-btn";
    btn.textContent = "Install app";
    btn.addEventListener("click", () => {
      if (deferredInstall) {
        promptInstall();
        return;
      }
      showInstallBanner(true);
    });
    actions.appendChild(btn);
  }

  function showInstallBanner(force) {
    if (isStandalone() || !isMobile() || isPreviewEmbed()) return;
    if (!force && isDismissed()) return;
    if (document.getElementById("ws-install-banner")) return;

    const ios = isIOS();
    const bar = document.createElement("div");
    bar.id = "ws-install-banner";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", `Install ${appShortName}`);
    if (ios) {
      bar.classList.add("is-ios-top");
      document.body.classList.add("is-ios-install-top");
    }

    const text = document.createElement("div");
    text.className = "ws-install-text";
    if (ios) {
      text.innerHTML =
        `<strong>Install ${appShortName}</strong>` +
        "<span>At the bottom of Safari, tap <strong>Share</strong> " +
        '<span class="ws-install-icon" aria-hidden="true">&#x2197;</span> ' +
        "then <strong>Add to Home Screen</strong>.</span>";
    } else if (deferredInstall) {
      text.innerHTML =
        `<strong>Install ${appShortName}</strong>` +
        "<span>Add the app to your home screen for faster access.</span>";
    } else {
      text.innerHTML =
        `<strong>Install ${appShortName}</strong>` +
        "<span>Tap the browser menu " +
        '<span class="ws-install-icon" aria-hidden="true">&#x22EE;</span> ' +
        "then <strong>Install app</strong> or <strong>Add to Home screen</strong>.</span>";
    }

    const actions = document.createElement("div");
    actions.className = "ws-install-actions";

    if (!ios && deferredInstall) {
      const installBtn = document.createElement("button");
      installBtn.type = "button";
      installBtn.className = "ws-install-btn";
      installBtn.textContent = "Install";
      installBtn.addEventListener("click", promptInstall);
      actions.appendChild(installBtn);
    }

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "ws-install-close";
    closeBtn.setAttribute("aria-label", "Dismiss install tip");
    closeBtn.textContent = "\u00d7";
    closeBtn.addEventListener("click", dismissBanner);
    actions.appendChild(closeBtn);

    bar.appendChild(text);
    bar.appendChild(actions);
    document.body.appendChild(bar);
    document.body.classList.add("has-install-banner");
  }

  function bootInstallUi() {
    if (document.body && !document.body.dataset.appShortName) {
      document.body.dataset.appShortName = appShortName;
      document.body.dataset.wsApp = isAdmin ? "staff" : "public";
    }
    ensureHeaderInstallButton();
    showInstallBanner(false);
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstall = event;
    showInstallBanner(false);
  });

  window.addEventListener("appinstalled", () => {
    deferredInstall = null;
    dismissBanner();
  });

  document.addEventListener("DOMContentLoaded", () => {
    window.setTimeout(bootInstallUi, 250);
  });
  window.addEventListener("load", () => {
    window.setTimeout(bootInstallUi, 600);
  });
  document.addEventListener("partials-loaded", () => {
    window.setTimeout(bootInstallUi, 100);
  });
})();
