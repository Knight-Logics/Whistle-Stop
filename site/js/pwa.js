/* Installable public/staff app shell. Private admin and live data always stay network-only. */
(function () {
  const isAdmin = /(?:^|\/)admin\.html$/i.test(location.pathname);
  const manifest = isAdmin ? "admin-manifest.webmanifest" : "manifest.webmanifest";

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

  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(new URL("sw.js", document.baseURI).href).catch((err) => {
        console.warn("[Whistle Stop PWA] service worker registration failed", err);
      });
    });
  }
})();
