// ═══════════════════════════════════════════════════════════════════════
//  Mundial 2026 — Service Worker
//
//  Hace 3 cosas:
//    1) Web Push          → recibe pushes y abre deep-links
//    2) Offline caching    → la app sigue funcionando sin internet
//    3) Background Sync    → reintentar apuestas cuando vuelva la red
//
//  Estrategias por tipo de recurso:
//    /api/* (GET)              → stale-while-revalidate (sirve cache si no hay red)
//    /api/* (POST/PATCH/DELETE)→ network-only + Background Sync si falla offline
//    Static (.js/.css/.png/…)  → cache-first
//    Navegación HTML            → network-first con fallback a /offline.html
// ═══════════════════════════════════════════════════════════════════════

// ⚠️ La cadena __BUILD_ID__ es reemplazada por el SHA del commit en CI antes
//    de publicar a Plesk. Cada deploy invalida los caches anteriores
//    (los nombres cambian → activate() borra los viejos).
//    En dev local queda con el placeholder y se trata como una versión más.
const VERSION = 'mundial2026-__BUILD_ID__';
const STATIC_CACHE  = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const API_CACHE     = `${VERSION}-api`;

// Recursos que pre-cacheamos al instalar el SW.
// Mantén la lista corta — el bundle JS se cachea solo al primer load.
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/favicon.png',
  '/icon-192.png',
  '/icon-512.png',
];

// ─── install ─────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

// ─── activate (limpia caches viejos + notifica a clientes) ──────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))
      );
      await self.clients.claim();
      // Avisa a las pestañas abiertas que hay una versión nueva.
      // El cliente decide si auto-recarga (ver `OfflineIndicator.tsx`).
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const c of clients) c.postMessage({ type: 'sw-updated', version: VERSION });
    })()
  );
});

// ─── helpers ─────────────────────────────────────────────────────────
function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}
function isStaticAsset(url) {
  return /\.(?:js|css|png|jpg|jpeg|svg|webp|woff2?|ttf|ico)$/.test(url.pathname);
}
function isHtmlNavigation(req) {
  return req.mode === 'navigate' ||
         (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'));
}

// stale-while-revalidate: sirve cache YA y refetch en background
async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const networkPromise = fetch(req).then((res) => {
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  return cached || (await networkPromise) || new Response(
    JSON.stringify({ error: 'offline', cached: false }),
    { status: 503, headers: { 'Content-Type': 'application/json' } },
  );
}

// network-first para API GET: SIEMPRE intenta la red primero (datos frescos),
// y solo cae al cache si NO hay red. Antes era stale-while-revalidate, que servía
// el cache VIEJO primero → en web mostraba datos de OTRO usuario / apuestas viejas
// hasta recargar (el cache no varía por el token Authorization).
async function networkFirstApi(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req);
    return cached || new Response(
      JSON.stringify({ error: 'offline', cached: false }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

// cache-first: estático
async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  } catch {
    return cached || new Response('Offline', { status: 503 });
  }
}

// network-first con fallback HTML
async function networkFirstHtml(req) {
  try {
    const res = await fetch(req);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(req, res.clone());
    return res;
  } catch {
    const cache = await caches.open(RUNTIME_CACHE);
    return (await cache.match(req)) ||
           (await caches.match('/offline.html')) ||
           new Response('Offline', { status: 503 });
  }
}

// ─── fetch — enrutador de estrategias ────────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo manejamos same-origin (el backend en otro dominio sigue camino normal)
  if (url.origin !== self.location.origin && !isApiRequest(url)) return;

  // Mutaciones a la API → network-only (con Background Sync si están offline)
  if (isApiRequest(url) && req.method !== 'GET') {
    event.respondWith(handleApiMutation(event, req));
    return;
  }

  // Lecturas a la API → NETWORK-FIRST (fresco si hay red; cache solo offline).
  // /api/auth/me NUNCA se cachea: la sesión debe ser siempre fresca y por-usuario.
  // (Antes, con stale-while-revalidate, al cambiar de usuario el reload servía el
  //  /api/auth/me cacheado del usuario anterior → volvía al usuario viejo. Mismo
  //  problema con los tickets: mostraba la apuesta vieja hasta recargar.)
  if (isApiRequest(url) && req.method === 'GET') {
    if (url.pathname === '/api/auth/me') {
      event.respondWith(
        fetch(req).catch(() => new Response(
          JSON.stringify({ error: 'offline' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } },
        )),
      );
    } else {
      event.respondWith(networkFirstApi(req, API_CACHE));
    }
    return;
  }

  // Estáticos → cache-first
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // Navegación → network-first con offline.html
  if (isHtmlNavigation(req)) {
    event.respondWith(networkFirstHtml(req));
    return;
  }
});

// ─── Background Sync para apuestas hechas sin red ────────────────────
//  Si el POST a /api/tickets falla porque no hay red, lo guardamos en IndexedDB
//  y nos suscribimos a un sync tag. Cuando vuelve la red, lo reintentamos.
async function handleApiMutation(event, req) {
  try {
    return await fetch(req.clone());
  } catch (e) {
    // Solo encolamos métodos seguros de reintentar (idempotentes desde la UI)
    if (['POST', 'PATCH', 'PUT'].includes(req.method)) {
      try {
        const body = await req.clone().text();
        await queueRequest({
          url: req.url,
          method: req.method,
          headers: [...req.headers.entries()],
          body,
          ts: Date.now(),
        });
        if ('sync' in self.registration) {
          await self.registration.sync.register('flush-queue');
        }
        // Devolvemos un 202 Accepted indicando "encolado"
        return new Response(JSON.stringify({ queued: true, offline: true }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch {/* ignore */}
    }
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ─── Mini IndexedDB para la cola de requests ─────────────────────────
const DB_NAME = 'mundial2026';
const STORE   = 'queue';

function openDB() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function queueRequest(payload) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add(payload);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
async function drainQueue() {
  const db = await openDB();
  const all = await new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => rej(req.error);
  });
  for (const item of all) {
    try {
      const r = await fetch(item.url, {
        method: item.method,
        headers: new Headers(item.headers),
        body: item.body,
      });
      if (r.ok || (r.status >= 400 && r.status < 500)) {
        // Éxito o error de cliente (4xx no se reintenta) → remover de la cola
        await new Promise((res, rej) => {
          const tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).delete(item.id);
          tx.oncomplete = () => res();
          tx.onerror = () => rej(tx.error);
        });
      }
    } catch {/* dejamos en cola para próximo intento */}
  }

  // Notificar a las pestañas abiertas para que refresquen UI
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const c of clients) c.postMessage({ type: 'queue-flushed' });
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'flush-queue') {
    event.waitUntil(drainQueue());
  }
});

// ─── Web Push (igual que antes) ──────────────────────────────────────
self.addEventListener('push', (event) => {
  let payload = { title: 'Mundial 2026', body: '', data: {} };
  try { payload = event.data ? event.data.json() : payload; }
  catch (e) { payload.body = event.data ? event.data.text() : ''; }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Mundial 2026', {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/favicon.png',
      data: payload.data || {},
      vibrate: [120, 60, 120],
      requireInteraction: false,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  let target = '/';
  if (data.type === 'matchday_reminder' && data.matchday_id) {
    target = `/quiniela/${data.matchday_id}`;
  } else if (data.type === 'final_bet_reminder' && data.tournament_id) {
    target = `/tournament/${data.tournament_id}`;
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c) {
          c.focus();
          if ('navigate' in c) c.navigate(target);
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    }),
  );
});
