'use strict';
/* =====================================================================
   Millésimes publiés (données publiques du dépôt)
   ---------------------------------------------------------------------
   Chaque année est un fichier autonome millesimes/AAAA.json, déclaré dans
   millesimes/index.json. Les millésimes publiés et « contrôlés » sont
   rechargés à chaque ouverture : une mise à jour poussée sur le dépôt est
   donc prise en compte automatiquement.
   Un millésime publié dévalidé (ou remplacé par une version importée)
   devient une « version locale » (_local: true) : elle est conservée dans
   le navigateur jusqu'à ce que l'utilisateur rétablisse la version publiée.
   Un millésime créé dans l'application (copie N → N+1) est local par nature.
   ===================================================================== */
const PUBLISHED = {};   // { annee: paramètres publiés (gelés) }

const deepFreeze = o => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };
/* Sérialisation à clés triées (comparaison indépendante de l'ordre des clés) */
const stableStr = v => v === null || typeof v !== 'object' ? JSON.stringify(v) : Array.isArray(v) ? '[' + v.map(stableStr).join(',') + ']'
  : '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + stableStr(v[k])).join(',') + '}';
const withoutKeys = (p, ks) => { const o = Object.assign({}, p); ks.forEach(k => delete o[k]); return o; };

async function fetchJson(url) {
  const rs = await fetch(url, { cache: 'no-cache' });
  if (!rs.ok) throw new Error(`${url} : HTTP ${rs.status}`);
  return rs.json();
}
async function loadPublishedMillesimes() {
  const idx = await fetchJson(MILLESIMES_DIR + 'index.json');
  const ys = (idx.millesimes || []).map(Number).filter(Number.isInteger);
  const all = await Promise.all(ys.map(y => fetchJson(`${MILLESIMES_DIR}${y}.json`).then(p => [y, p])));
  all.forEach(([y, p]) => {
    if (!p || Number(p.annee) !== y) throw new Error(`millesimes/${y}.json : champ « annee » incohérent`);
    PUBLISHED[y] = deepFreeze(p);
  });
  if (!Object.keys(PUBLISHED).length) throw new Error('Aucun millésime publié (millesimes/index.json)');
}
const publishedYears = () => Object.keys(PUBLISHED).map(Number).sort((a, b) => a - b);
const isPublished = y => !!PUBLISHED[y];
/* Modèle de référence d'une année : millésime publié de l'année, sinon le plus récent antérieur, sinon le plus ancien */
function publishedModel(y) {
  const ys = publishedYears();
  const k = ys.filter(x => x <= Number(y)).pop();
  return PUBLISHED[k !== undefined ? k : ys[0]];
}
/* Identique à la version publiée (hors statut de contrôle et marque locale) ? */
const sameAsPublished = (y, p) => !!PUBLISHED[y] && stableStr(withoutKeys(p, ['_local', 'verifie'])) === stableStr(withoutKeys(PUBLISHED[y], ['_local', 'verifie']));
const isControlled = p => !!p && p.verifie !== false;

/* Recharge les millésimes publiés dans le store, sauf versions locales */
function syncPublished() {
  Object.entries(PUBLISHED).forEach(([y, P]) => {
    const p = store.params[y];
    if (!p || !p._local) store.params[y] = clone(P);
  });
}
