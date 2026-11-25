// DMHA Smart Learning App — Lightweight PWA Service Worker
// Enables Desktop & Mobile standalone installation while keeping live SQLite APIs network-only.

const CACHE_NAME = 'dmhs-os-shell-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['/favicon.svg'])).catch(() => {}),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  // Always keep SQLite & Payload APIs strictly network-only for real-time data accuracy
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/dmhs-api/') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/admin')
  ) {
    return
  }

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request)),
  )
})
