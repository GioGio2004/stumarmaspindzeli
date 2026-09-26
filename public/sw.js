/* Service worker for the staff PWA: receives Web Push and opens the task. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "სტუმარ-მასპინძელი", body: event.data.text() };
  }

  const options = {
    body: payload.body,
    icon: payload.icon || "/android-chrome-192x192.png",
    vibrate: [150, 60, 150],
    tag: payload.tag, // same tag = replace, not stack
    renotify: Boolean(payload.tag),
    data: { url: payload.url || "/queue" },
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/queue", self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        for (const client of windows) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
