/// <reference lib="webworker" />
// KlinDom service worker: offline app shell (Workbox precache) and web push notifications.
// Bundled and manifest-injected into dist/sw.js by scripts/build-sw.mjs.
import { clientsClaim } from 'workbox-core';
import { matchPrecache, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { url: string; revision: string | null }>;
};

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

// Deep links (e.g. /welcome) all get the SPA shell: network first, then the cached copy, then the
// precached one (the runtime cache is empty until the first online navigation has been served).
const shell = new NetworkFirst({ cacheName: 'app-shell', networkTimeoutSeconds: 3 });
registerRoute(
  new NavigationRoute(async ({ event }) => {
    try {
      return await shell.handle({ event, request: new Request('/index.html') });
    } catch {
      return (await matchPrecache('/index.html')) ?? Response.error();
    }
  }),
);

interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
}

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const { title, body, url, tag }: PushPayload = event.data.json();
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      data: { url: url ?? '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url: string = event.notification.data?.url ?? '/';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows[0];
      if (open) {
        await open.focus();
        await open.navigate(url);
      } else {
        await self.clients.openWindow(url);
      }
    })(),
  );
});
