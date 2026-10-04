// PrintFlow service worker: installability only, no offline caching (see ROADMAP.md)
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
