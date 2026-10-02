/* VICTORIA — service worker.
   Кэшируются только статические файлы этого же сайта (GET). Форма записи (POST),
   запросы на другие адреса (сервер заявок, Яндекс, шрифты) не перехватываются вообще.
   Стратегия: сначала сеть, при отсутствии интернета — кэш, для страниц — offline.html. */
const CACHE = "victoria-v1";
const PRECACHE = ["/", "/offline.html", "/styles.css", "/data.js", "/script.js", "/common.js", "/manifest.webmanifest",
  "/assets/icons/icon-192.png", "/assets/icons/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok && res.type === "basic") { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      if (req.mode === "navigate") return caches.match("/offline.html");
      return Response.error();
    })
  );
});
