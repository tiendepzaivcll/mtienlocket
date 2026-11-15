/* global clients */
console.log("[SW] T97 SW v2.2.15 - loaded");
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { createHandlerBoundToURL } from "workbox-precaching";

import { CacheFirst, NetworkFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

const LEGACY_CACHES = [
  "t97-fonts-v1",
  "t97-navigation-v2",
  "t97-navigation-v3",
];

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("install", () => {
  self.skipWaiting(); // Cập nhật ngay
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      clients.claim(),
      ...LEGACY_CACHES.map((cacheName) => caches.delete(cacheName)),
    ])
  );
});

// Precache và cleanup
precacheAndRoute(self.__WB_MANIFEST || []);
console.log("[SW] started precache");
cleanupOutdatedCaches();

// Online navigation always checks the deployed app shell first. The precached
// index remains the offline fallback, so routes such as /tools#celebrity cannot
// stay pinned to an old bundle after a deployment.
const navigationStrategy = new NetworkFirst({
  cacheName: "t97-navigation-v4",
  networkTimeoutSeconds: 5,
});
const offlineAppShell = createHandlerBoundToURL("index.html");

registerRoute(
  new NavigationRoute(async (options) => {
    try {
      return await navigationStrategy.handle(options);
    } catch {
      return offlineAppShell(options);
    }
  }),
);
registerRoute(
  ({ url, request }) =>
    url.origin === "https://cdn.locket-dio.com" &&
    request.destination === "image" &&
    url.pathname.startsWith("/v1/images/"),
  new CacheFirst({
    cacheName: "t97-images-v1",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 300,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      }),
    ],
  })
);

// Push Notification handler
self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  const notificationTitle = data.title || "🔔 Thông báo";
  const notificationOptions = {
    body: data.body || "Bạn có thông báo mới!",
    data: { url: data.url || self.location.origin }, // truyền URL để redirect khi click
    icon: "/android-chrome-192x192.png",
    badge: "/maskable_icon.png",
  };

  event.waitUntil(
    self.registration.showNotification(notificationTitle, notificationOptions)
  );
});

// Click handler: mở tab hoặc focus vào web
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const requestedUrl = event.notification.data?.url || self.location.origin;
  let urlToOpen = self.location.origin;
  try {
    const parsedUrl = new URL(requestedUrl, self.location.origin);
    if (parsedUrl.origin === self.location.origin) {
      urlToOpen = parsedUrl.href;
    }
  } catch {
    // Invalid or external notification URLs fall back to T97.
  }

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === urlToOpen && "focus" in client) {
            return client.focus();
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
