/** Registers the Workbox service worker (dist/sw.js) in production builds only. */
export function registerServiceWorker(): void {
  if (__DEV__ || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  // Service workers need a secure context: https, or localhost for local previews.
  const secure = location.protocol === 'https:' || location.hostname === 'localhost';
  if (!secure) return;
  navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Service worker registration failed', err));
}
