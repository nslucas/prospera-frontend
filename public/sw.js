const APP_NAME = "AppProspera";
const CACHE_NAME = "prospera-pwa-v5";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/prospera-mark.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-192.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/src") ||
    url.pathname.startsWith("/@")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/").then((cached) => cached || Response.error())),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});

self.addEventListener("push", (event) => {
  const payload = readPushPayload(event);
  const body = payload.body || payload.title || "Voce tem uma nova notificacao.";
  const options = {
    body,
    icon: payload.icon || "/icon-192.png",
    badge: payload.badge || "/icon-maskable-192.png",
    image: payload.image,
    tag: payload.tag || payload.url || "prospera-notification",
    renotify: Boolean(payload.tag),
    data: {
      url: payload.url || "/notifications",
      notificationId: payload.notificationId,
    },
  };

  event.waitUntil(self.registration.showNotification(APP_NAME, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(event.notification.data?.url || "/notifications", self.location.origin)
    .href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client && new URL(client.url).origin === self.location.origin) {
          return client
            .navigate(targetUrl)
            .then((navigatedClient) => (navigatedClient || client).focus());
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    }),
  );
});

function readPushPayload(event) {
  if (!event.data) return {};

  try {
    return event.data.json();
  } catch {
    return { body: event.data.text() };
  }
}
