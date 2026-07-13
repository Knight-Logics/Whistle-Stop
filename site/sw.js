const CACHE_VERSION = "ws-public-v2";
const OFFLINE_URL = new URL("offline.html", self.registration.scope).href;
const PUBLIC_SHELL = [
  "index.html",
  "menu.html",
  "events.html",
  "order.html",
  "contact.html",
  "offline.html",
  "css/main.css",
  "assets/logo.webp",
  "assets/logo.png",
].map((path) => new URL(path, self.registration.scope).href);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(PUBLIC_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("ws-public-") && key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isSensitive(url) {
  return (
    /\/admin(?:\.html)?$/i.test(url.pathname) ||
    /\/data\//i.test(url.pathname) ||
    /\/downloads\//i.test(url.pathname) ||
    /\/api\//i.test(url.pathname) ||
    /\/campaign(?:\.html)?$/i.test(url.pathname) ||
    /\/unsubscribe(?:\.html)?$/i.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin || isSensitive(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_VERSION).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(async () => (await caches.match(request)) || caches.match(OFFLINE_URL))
    );
    return;
  }

  if (["style", "script"].includes(request.destination)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_VERSION).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  if (["image", "font"].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request).then((response) => {
          if (response.ok) caches.open(CACHE_VERSION).then((cache) => cache.put(request, response.clone()));
          return response;
        });
        return cached || network;
      })
    );
  }
});
