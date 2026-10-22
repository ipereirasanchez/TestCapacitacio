// sw.js — Service worker para uso sin conexión.
// - En la instalación se precachea la app y los datos, así una sola visita
//   basta para que funcione sin red (la primera carga de la página no pasa
//   por el worker, por eso no se puede confiar solo en la caché de paso).
// - En uso: "red primero, caché de respaldo" para todas las peticiones GET del
//   mismo origen. Con red siempre se sirve la versión fresca (y se guarda).
const CACHE = "tc-v1";
const PRECACHE = [
  "./", "index.html", "style.css", "manifest.json",
  "js/app.state.js", "js/app.utils.js", "js/app.dom.js", "js/app.scoring.js",
  "js/app.render.js", "js/app.actions.js", "js/app.events.js", "js/app.init.js",
  "data/meta.json", "data/preguntas.json", "data/casos.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) =>
      // Una a una: si falla un archivo no se pierde el resto.
      Promise.all(PRECACHE.map((p) =>
        fetch(p, { cache: "no-cache" }).then((r) => (r.ok ? c.put(p, r) : null)).catch(() => null)
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || Response.error()))
  );
});
