'use strict';
/* Export / import des sauvegardes clients (.json) */

async function exportDossier() {
  const d = curD(); if (!d) return;
  const ys = Object.keys(d.exercices).map(Number); const last = Math.max(...ys);
  const used = {}; ys.forEach(y => { const { year } = paramsFor(y); used[year] = store.params[year]; });
  const refs = dossierDocRefs(d);
  const payload = { format: 'cotis-tns-dossier', appli: APP_ID, exporteLe: new Date().toISOString(), dossier: d, parametres: used, ...(refs.length ? { documents: await docsPayload(refs) } : {}) };
  const ev = curE();
  download(`TNS_${sanit(d.prenom)}_${sanit(d.nom)}_${d.current}_${mm(ev.finExercice) || '12'}.json`, JSON.stringify(payload, null, 2), 'application/json');
}
async function importJSON(text) {
  let o; try { o = JSON.parse(text); } catch (err) { alert('Fichier JSON illisible.'); return; }
  const mergeParams = ps => { let added = 0; Object.entries(ps || {}).forEach(([y, p0]) => {
    if (!p0 || typeof p0 !== 'object' || !/^\d{4}$/.test(y)) return;
    const p = clone(p0); migrateParams(y, p);
    const cur = store.params[y];
    const same = (a, b) => stableStr(withoutKeys(a, ['_local'])) === stableStr(withoutKeys(b, ['_local']));
    if (cur && same(cur, p)) return;
    if (cur) {
      const msg = isControlled(cur)
        ? `⚠ Le millésime ${y} de l'application est contrôlé (valeurs verrouillées)${isPublished(y) ? ', publié avec l\'application' : ''}.\n\nLe millésime ${y} importé est différent. Remplacer le millésime ${y} par la version importée ?\nElle deviendra une version locale${p.verifie === false ? ' non vérifiée' : ''}${isPublished(y) ? ' (« Rétablir la version publiée » permettra de revenir en arrière)' : ''}.`
        : `Le millésime ${y} importé diffère de celui de l'application. Remplacer le millésime ${y} local ?`;
      if (!confirm(msg)) return;
    }
    if (isPublished(y) && p.verifie !== false && sameAsPublished(y, p)) store.params[y] = clone(PUBLISHED[y]);
    else { p._local = true; store.params[y] = p; }
    added++;
  }); return added; };
  if (o.format === 'cotis-tns-dossier' && o.dossier) {
    const d = o.dossier;
    if (store.dossiers[d.id] && !confirm(`Le dossier ${d.prenom} ${d.nom} existe déjà. Le remplacer par la version importée ?\n(Annuler = l'importer comme copie)`)) d.id = uid();
    store.dossiers[d.id] = d; store.current = d.id; mergeParams(o.parametres);
  } else if (o.format === 'cotis-tns-params') { const k = mergeParams(o.parametres); alert(`${k} millésime(s) importé(s) ou remplacé(s).`); }
  else if (o.format === 'cotis-tns-base') {
    if (!confirm('Importer une sauvegarde complète : les dossiers importés s\'ajoutent / remplacent ceux de même identifiant. Continuer ?')) return;
    Object.assign(store.dossiers, o.dossiers || {}); mergeParams(o.params); if (o.current && store.dossiers[o.current]) store.current = o.current;
  } else { alert('Format non reconnu.'); return; }
  if (o.documents) await importDocs(o.documents);
  save(); render();
}
