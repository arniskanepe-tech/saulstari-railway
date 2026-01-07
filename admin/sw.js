self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Nav cache, nav offline — viss kā parastā web lapa.
self.addEventListener("fetch", () => {});
