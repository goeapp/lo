// sw.js — LibroObra PWA · v7.0.1 (07-oct-2026) — solo cambia CACHE_NAME (index v7.0.1)
// Se entrega como sw_libroobra_v7_0_1.js y se sube al repo "lo" RENOMBRADO
// a sw.js (al lado de index.html). Base: sw de BUP v1.1.0 (patrón MdT).
//
// Para qué: que la app ABRA SIN SEÑAL (Parte de Contrato, D20).
//  - Página (index.html): red primero; sin conexión, la copia guardada.
//    Así una versión nueva se ve al recargar, sin quedar pegada a la vieja.
//  - Íconos, manifest y librerías: caché primero.
//  - Diferencia con BUP: jQuery, DataTables y d3 vienen de otro dominio
//    (CDN) y el sw de BUP no los guardaba (type !== 'basic'). Sin jQuery el
//    script de LibroObra no arranca, así que acá se PRECARGAN en la
//    instalación y se aceptan respuestas 'cors' de esos CDN.
//  - Nunca se intercepta el backend (script.google.com) ni Google Fonts:
//    sin señal se ve con la letra del sistema.
// Cambiar CACHE_NAME en cada versión nueva del index.

const CACHE_NAME = 'lo-v7.0.1';

const PROPIOS = [
  './',
  './index.html',
  './manifest.json',
  './icons/favicon.ico',
  './icons/lo_icon_16.png',
  './icons/lo_icon_32.png',
  './icons/lo_icon_180.png',
  './icons/lo_icon_192.png',
  './icons/lo_icon_512.png'
];

// Las mismas URL exactas que carga index.html (si cambia una versión allá, cambiarla acá)
const CDN = [
  'https://cdn.datatables.net/1.13.11/css/jquery.dataTables.min.css',
  'https://code.jquery.com/jquery-3.7.1.min.js',
  'https://cdn.datatables.net/1.13.11/js/jquery.dataTables.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js'
];
const CDN_HOSTS = ['code.jquery.com', 'cdn.datatables.net', 'cdnjs.cloudflare.com', 'cdn.jsdelivr.net'];

// Uno por uno: si falta un ícono, no se cae toda la instalación (cache.addAll es todo o nada)
function guardar(cache, url) {
  const req = url.indexOf('http') === 0 ? new Request(url, { mode: 'cors' }) : url;
  return fetch(req).then(function (resp) {
    if (resp && (resp.ok || resp.type === 'opaque')) return cache.put(url, resp);
  }).catch(function () { /* se reintenta cuando la página lo pida con señal */ });
}

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return Promise.all(PROPIOS.concat(CDN).map(function (u) { return guardar(cache, u); })); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Datos siempre en vivo: backend y Google
  if (url.hostname.indexOf('script.google') !== -1 || url.hostname.indexOf('googleusercontent.com') !== -1) return;
  if (url.hostname.indexOf('googleapis.com') !== -1 || url.hostname.indexOf('gstatic.com') !== -1) return;
  if (url.hostname.indexOf('accounts.google.com') !== -1) return;

  // Página: red primero, caché si no hay conexión
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (resp) {
        const copia = resp.clone();
        if (resp.ok) caches.open(CACHE_NAME).then(function (c) { c.put('./index.html', copia); });
        return resp;
      }).catch(function () {
        return caches.match('./index.html').then(function (r) { return r || caches.match('./'); });
      })
    );
    return;
  }

  const esPropio = url.origin === self.location.origin;
  const esCdn = CDN_HOSTS.indexOf(url.hostname) !== -1;
  if (!esPropio && !esCdn) return;

  // Resto: caché primero (igual que MdT/BUP), guardando también lo del CDN
  e.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (resp) {
        if (resp && resp.status === 200 && (resp.type === 'basic' || resp.type === 'cors')) {
          const copia = resp.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put(req, copia); });
        }
        return resp;
      });
    })
  );
});
