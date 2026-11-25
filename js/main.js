'use strict';
/* Démarrage : mise en page du cabinet, millésimes publiés, données locales, service worker */

window.addEventListener('pagehide', () => flushSave());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSave(); });

(async function boot() {
  loadStyle();
  try { await loadPublishedMillesimes(); }
  catch (err) {
    console.error(err);
    document.getElementById('main').innerHTML = `<div class="alert err"><b>Barèmes millésimés indisponibles</b> (${esc(err.message)}).<br>L'application doit être ouverte depuis son adresse web (https) ou un serveur local : l'ouverture directe du fichier index.html n'est pas prise en charge. Hors connexion, ouvrez-la une première fois en ligne pour l'installer.</div>`;
    return;
  }
  loadStore();
  render();
  registerServiceWorker();
})();

/* Service worker : fonctionnement hors connexion ; bandeau lorsqu'une nouvelle version du service worker est prête */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  let updating = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (updating) { flushSave(); location.reload(); } });
  const offer = reg => {
    if (!reg.waiting || !navigator.serviceWorker.controller || document.getElementById('updBar')) return;
    const bar = document.createElement('div'); bar.id = 'updBar';
    bar.innerHTML = '<span>Nouvelle version de l\'application disponible.</span><button class="sm" id="btnUpd">Mettre à jour</button><button class="sm sec" id="btnUpdLater">Plus tard</button>';
    document.body.appendChild(bar);
    bar.querySelector('#btnUpd').addEventListener('click', () => { updating = true; flushSave(); reg.waiting.postMessage({ type: 'SKIP_WAITING' }); });
    bar.querySelector('#btnUpdLater').addEventListener('click', () => bar.remove());
  };
  navigator.serviceWorker.register('sw.js').then(reg => {
    offer(reg);
    reg.addEventListener('updatefound', () => { const w = reg.installing; if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') offer(reg); }); });
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  }).catch(err => console.warn('Service worker non enregistré :', err));
}
