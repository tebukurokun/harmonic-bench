// Service Worker のテンプレート。ビルド時に vite.config.ts の serviceWorker() が
// VERSION と PRECACHE_URLS を埋め込み、dist/sw.js として書き出す（開発サーバーでは使わない）。
// ビルド結果をすべて事前にキャッシュし、2回目以降はオフラインでも起動できるようにする。

const VERSION = '__VERSION__'
const PRECACHE_URLS = ['__PRECACHE_URLS__']

const CACHE_PREFIX = 'harmonic-bench-'
const CACHE_NAME = `${CACHE_PREFIX}${VERSION}`

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

// 古い版のキャッシュを消す
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return

  // ページ（HTML）はネットワークを優先し、新しい版をすぐ反映する。オフラインのときだけキャッシュを使う。
  // 取得した HTML はキャッシュに入れない（参照するアセットがキャッシュにない版を返さないため）
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/', { cacheName: CACHE_NAME }).then((cached) => cached ?? Response.error()),
      ),
    )
    return
  }

  // アセットはファイル名にハッシュが付くので、キャッシュにあればそれを使う
  event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)))
})
