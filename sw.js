'use strict';
/* =====================================================================
   Service worker — fonctionnement hors connexion
   ---------------------------------------------------------------------
   • Réseau d'abord pour le code et les millésimes (une mise à jour poussée
     sur le dépôt est prise en compte dès la prochaine ouverture en ligne),
     repli sur le cache hors connexion.
   • Cache d'abord pour vendor/ (bibliothèques versionnées).
   • Incrémenter CACHE_VERSION lorsque la liste APP_SHELL change ou que ce
     fichier est modifié : l'application propose alors « Mettre à jour ».
   ===================================================================== */
const CACHE_VERSION = 1;
const CACHE = `cotis-tns-v${CACHE_VERSION}`;
const NET_TIMEOUT = 6000;
const APP_SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/core/config.js',
  'js/core/utils.js',
  'js/data/schema-parametres.js',
  'js/data/referentiels.js',
  'js/core/millesimes.js',
  'js/core/store.js',
  'js/engine/calculs.js',
  'js/engine/compute.js',
  'js/engine/ecritures.js',
  'js/ui/helpers.js',
  'js/ui/render.js',
  'js/tabs/dossier.js',
  'js/tabs/appel.js',
  'js/tabs/caisse.js',
  'js/tabs/revenus.js',
  'js/tabs/cotisations.js',
  'js/tabs/simulation.js',
  'js/tabs/impayes.js',
  'js/tabs/madelin.js',
  'js/tabs/cloture.js',
  'js/tabs/d2042.js',
  'js/tabs/historique.js',
  'js/tabs/millesime.js',
  'js/features/documents.js',
  'js/features/style.js',
  'js/features/sauvegarde.js',
  'js/features/impression.js',
  'js/ui/bind.js',
  'js/ui/actions.js',
  'js/main.js',
  'icons/favicon-32.png',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'vendor/pdfjs/pdfjs-3.11.174.bundle.min.js',
  'millesimes/index.json'
];

self.addEventListener('install', ev => {
  ev.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(APP_SHELL.map(u => new Request(u, { cache: 'reload' })));
    /* Millésimes déclarés dans millesimes/index.json */
    const idx = await (await fetch('millesimes/index.json', { cache: 'reload' })).json();
    await c.addAll((idx.millesimes || []).map(y => new Request(`millesimes/${y}.json`, { cache: 'reload' })));
  })());
});

self.addEventListener('activate', ev => {
  ev.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('cotis-tns-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', ev => { if (ev.data && ev.data.type === 'SKIP_WAITING') self.skipWaiting(); });

async function networkFirst(req) {
  const c = await caches.open(CACHE);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error('délai réseau dépassé')), NET_TIMEOUT))
    ]);
    if (res && res.ok && res.type === 'basic') c.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await c.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await c.match('index.html') : null);
    if (hit) return hit;
    throw err;
  }
}
async function cacheFirst(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok && res.type === 'basic') c.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  ev.respondWith(url.pathname.includes('/vendor/') ? cacheFirst(req) : networkFirst(req));
});
