/* Too Arna service worker — offline pages + map tiles for the mountains (no signal up there). */
const VERSION = "v2";
const PAGES = `pages-${VERSION}`;
const STATIC = `static-${VERSION}`;
const TILES = `tiles-${VERSION}`;
const OFFLINE_URL = "/offline";
const MAP_HOST = "tiles.openfreemap.org";
const STYLE_URL = `https://${MAP_HOST}/styles/dark`;
const MAX_TILES = 600;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.add(OFFLINE_URL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(cacheName, request) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return (await cache.match(request)) || (await cache.match(OFFLINE_URL)) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.hostname === MAP_HOST) {
    event.respondWith(cacheFirst(TILES, request));
  } else if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(STATIC, request));
  } else if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
  }
});

/* ---- "Save offline": pre-cache a trail page and the map tiles around it ---- */

const lng2x = (lng, z) => Math.floor(((lng + 180) / 360) * 2 ** z);
const lat2y = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

function tileUrls(template, [w, s, e, n]) {
  const urls = [];
  for (let z = 8; z <= 14; z++) {
    const [x0, x1] = [lng2x(w, z), lng2x(e, z)];
    const [y0, y1] = [lat2y(n, z), lat2y(s, z)];
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++) urls.push(template.replace("{z}", z).replace("{x}", x).replace("{y}", y));
    if (urls.length > MAX_TILES) break; // keep storage sane: stop zooming in
  }
  return urls.slice(0, MAX_TILES);
}

async function saveTrail({ pageUrl, bbox }) {
  const pages = await caches.open(PAGES);
  await pages.add(pageUrl);

  const tiles = await caches.open(TILES);
  const style = await (await cacheFirst(TILES, new Request(STYLE_URL))).clone().json();
  const vector = Object.values(style.sources).find((s) => s.type === "vector" && s.url);
  const tilejson = await (await cacheFirst(TILES, new Request(vector.url))).clone().json();
  const urls = tileUrls(tilejson.tiles[0], bbox);

  let done = 0;
  const queue = [...urls];
  const worker = async () => {
    while (queue.length) {
      const u = queue.shift();
      try {
        if (!(await tiles.match(u))) {
          const res = await fetch(u);
          if (res.ok) await tiles.put(u, res);
        }
      } catch {}
      done++;
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return { tiles: done };
}

self.addEventListener("message", (event) => {
  if (event.data?.type !== "save-trail") return;
  const port = event.ports[0];
  event.waitUntil(
    saveTrail(event.data)
      .then((r) => port?.postMessage({ ok: true, ...r }))
      .catch((e) => port?.postMessage({ ok: false, error: String(e) })),
  );
});
