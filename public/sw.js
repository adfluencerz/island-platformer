// The service worker that makes the game installable and lets the farm open
// without a connection (the farm plays from this browser's own save; only the
// lobbies need the game server). Registered by src/main.js in built pages only.
//
// - the page: from the network when there is one (so a new build shows up at
//   once), else the copy kept from last time
// - the built files (/assets/, named by their content): kept forever, fetched once.
//   The ones the page no longer uses are dropped whenever a fresh page comes in.
// - icons, the manifest and the game's font: from the copy, refreshed behind it
// - /api and /ws (the lobbies, the farm's server copy): never touched
const CACHE = 'island-v1';
const PAGE = '/';
const SHELL = [PAGE, '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon.svg'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

// the built files a page loads: /assets/… in its src= and href=
const assetsOf = (html) => [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    const page = await cache.match(PAGE);
    await cache.addAll(assetsOf(await page.text()));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === location.origin) {
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws')) return;
    if (request.mode === 'navigate') event.respondWith(page(request));
    else if (url.pathname.startsWith('/assets/')) event.respondWith(kept(request));
    else event.respondWith(refreshed(request));
  } else if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(refreshed(request));
  }
});

// Any address is the page (?lobby=CODE links too), so one copy of it serves them all
async function page(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) {
      const html = await res.clone().text();
      await cache.put(PAGE, res.clone());
      prune(cache, assetsOf(html)); // (in the background)
    }
    return res;
  } catch {
    return (await cache.match(PAGE)) ?? Response.error();
  }
}

async function kept(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function refreshed(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  const fresh = fetch(request).then((res) => {
    if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
    return res;
  });
  if (!hit) return fresh;
  fresh.catch(() => {}); // (offline: the copy will do)
  return hit;
}

// Drop the built files of older builds. Only once the page's own are all here,
// so the copy kept for going offline always has what it needs.
async function prune(cache, keep) {
  const wanted = new Set(keep);
  for (const path of keep) if (!(await cache.match(path))) await cache.add(path).catch(() => {});
  for (const req of await cache.keys()) {
    const { pathname } = new URL(req.url);
    if (pathname.startsWith('/assets/') && !wanted.has(pathname)) await cache.delete(req);
  }
}
