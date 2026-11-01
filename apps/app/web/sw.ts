/// <reference lib="webworker" />
// KlinDom service worker: offline app shell (Workbox precache) and web push notifications.
// Bundled and manifest-injected into dist/sw.js by scripts/build-sw.mjs.
import { clientsClaim } from 'workbox-core';
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { url: string; revision: string | null }>;
};

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

// Deep links (e.g. /welcome, /tasks/123) all get the precached SPA shell. Never fetch /index.html at
// navigation time: Cloudflare Pages redirects it (308 /index, 308 /) and a redirected response is a
// network error for a navigation. The precached copy is redirect-clean; skipWaiting rolls out deploys.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

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
        // navigate() rejects for a client this worker doesn't control; open a window instead.
        const navigated = await open.navigate(url).catch(() => null);
        if (navigated) return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
