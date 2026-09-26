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
  // Only ever open pages of this app.
  const target = new URL(event.notification.data?.url || "/queue", self.location.origin);
  const url = target.origin === self.location.origin ? target.href : new URL("/queue", self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        const client = windows.find((w) => w.url.startsWith(self.location.origin) && "focus" in w);
        if (!client) return self.clients.openWindow(url);
        return client
          .focus()
          .then((focused) => (focused && "navigate" in focused ? focused.navigate(url) : self.clients.openWindow(url)))
          .catch(() => self.clients.openWindow(url));
      }),
  );
});
