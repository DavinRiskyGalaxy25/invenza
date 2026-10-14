/* ==========================================================================
   INVENZA — Service Worker
   Melakukan caching terhadap asset dasar aplikasi (app shell) agar
   Invenza dapat di-install sebagai PWA dan tetap dapat dibuka meski
   koneksi internet tidak stabil. Data dari Supabase TIDAK di-cache
   di sini karena bersifat dinamis/real-time.
   ========================================================================== */

const CACHE_NAME = "invenza-cache-v21";

const APP_SHELL = [
  "./",
  "./index.html",
  "./login.html",
  "./signup.html",
  "./reset-password.html",
  "./dashboard.html",
  "./products.html",
  "./product-detail.html",
  "./profile.html",
  "./about.html",
  "./download.html",
  "./import.html",
  "./manifest.json",
  "./css/style.css",
  "./css/auth.css",
  "./css/dashboard.css",
  "./css/products.css",
  "./css/profile.css",
  "./css/about.css",
  "./css/download.css",
  "./css/import.css",
  "./js/config.js",
  "./js/supabase.js",
  "./js/utils.js",
  "./js/auth.js",
  "./js/pwa.js",
  "./js/login.js",
  "./js/signup.js",
  "./js/reset-password.js",
  "./js/dashboard.js",
  "./js/products.js",
  "./js/product-detail.js",
  "./js/profile.js",
  "./js/download.js",
  "./js/import.js",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/favicon.png",
  "./assets/images/glass-bg-1.jpg",
  "./assets/images/glass-bg-2.jpg",
  "./assets/images/glass-bg-3.jpg",
  "./assets/images/glass-bg-4.jpg",
  "./assets/images/glass-bg-5.jpg",
  "./assets/images/glass-bg-6.jpg",
  // Pustaka eksternal penting agar PWA dapat berjalan offline
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js",
  "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css",
  "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/fonts/bootstrap-icons.woff2",
  "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
];

// Install: cache seluruh app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch((err) => {
      console.warn("Service worker gagal melakukan precache:", err);
    })
  );
  self.skipWaiting();
});

// Activate: bersihkan cache versi lama
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// 1. Permintaan ke Supabase API / Storage -> selalu network (data real-time & auth aman).
// 2. Permintaan CDN (jsdelivr: supabase-js, bootstrap-icons, xlsx) -> Cache-First dengan network fallback & cache update.
// 3. Permintaan Navigasi HTML -> Network-First dengan fallback ke cache halaman / index.html.
// 4. Permintaan Aset Statis Lokal -> Network-First dengan fallback ke cache.
self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  // Supabase API / Auth / Storage: selalu ke jaringan, jangan di-cache
  if (url.includes("supabase.co") || url.includes("supabase.in")) {
    return;
  }

  if (event.request.method !== "GET") return;

  // Intercept CDN jsDelivr: layani dari cache jika offline agar library tetap tersedia
  if (url.includes("cdn.jsdelivr.net")) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);
      })
    );
    return;
  }

  if (!url.startsWith(self.location.origin)) return;

  // Navigasi halaman HTML: jika offline, fallback ke cache halaman atau index.html
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cachedMatch = await caches.match(event.request);
          if (cachedMatch) return cachedMatch;
          return (await caches.match("./index.html")) || (await caches.match("./"));
        })
    );
    return;
  }

  // Aset statis lokal: CSS, JS, Icon, Gambar
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
