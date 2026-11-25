'use strict';
/* Actions des boutons et écouteurs d'événements */

function act(a, el) {
  const d = curD(), e = curE();
  switch (a) {
    case 'resetAcc': if (confirm('Remplacer les comptes du dossier par les comptes par défaut de cette catégorie ?')) { d.comptes = clone(DEFAULT_ACCOUNTS[e.statut] || DEFAULT_ACCOUNTS.ei); } break;
    case 'splitTreso': {
      const T = n(document.getElementById('tresoTotal').value); const r = compute(d, e);
      const base = {}; ['regul', 'provAdj'].forEach(c => Object.entries(byAcc(r.ap, r.LS.urssaf, c)).forEach(([k, v]) => base[k] = (base[k] || 0) + v));
      const tot = sum(Object.values(base)); if (!tot) { alert('Aucun appel saisi.'); return; }
      e.cloture.paiements = e.cloture.paiements || {};
      ['cotis', 'csgD', 'csgND', 'cfp', 'autre'].forEach(k => e.cloture.paiements[k] = r2(T * (base[k] || 0) / tot));
      break;
    }
    case 'copyEntry': case 'csvEntry': {
      const r = compute(d, e); const en = r.entries.filter(x => x.id === el.dataset.id); const rows = plRows(en);
      if (a === 'copyEntry') copyText(toTSV(rows)); else download(`${sanit(d.prenom)}_${sanit(d.nom)}_${e.annee}_${el.dataset.id}.csv`, toCSV(rows), 'text/csv;charset=utf-8');
      return;
    }
    case 'csvAll': case 'copyAll': {
      const r = compute(d, e); const rows = plRows(r.entries);
      if (a === 'copyAll') copyText(toTSV(rows)); else download(`${sanit(d.prenom)}_${sanit(d.nom)}_${e.annee}_ecritures_pennylane.csv`, toCSV(rows), 'text/csv;charset=utf-8');
      return;
    }
    case 'freeze': {
      if (!confirm(`Figer l'${vueLib(e)} ?\n\nLes saisies seront verrouillées et les calculs conserveront les paramètres (millésime), les comptes et l'identité actuels, même si vous les modifiez ensuite.`)) return;
      const pf = paramsFor(e.annee);
      const tgF = curVue() === 'civ' ? (baseE().civ = baseE().civ || { data: {} }) : baseE();
      tgF.fige = { le: new Date().toISOString(), pYear: pf.year, fallback: pf.fallback, params: clone(pf.p), paramsN1: store.params[e.annee - 1] ? clone(store.params[e.annee - 1]) : null, comptes: clone(d.comptes), ident: { prenom: d.prenom, nom: d.nom, nir: d.nir || '', divers: clone(d.divers || {}), journal: d.journal, prefixe: d.prefixe } };
      break;
    }
    case 'unfreeze': {
      if (!confirm(`Défiger l'${vueLib(e)} ?\n\nL'instantané sera abandonné : les calculs utiliseront à nouveau les paramètres, comptes et identité actuels (les résultats peuvent changer).`)) return;
      if (curVue() === 'civ') delete baseE().civ.fige; else delete baseE().fige; break;
    }
    case 'collapseAll': case 'expandAll': {
      store.collapsed = store.collapsed || {};
      document.querySelectorAll('#main .card').forEach(c => { if (a === 'collapseAll') store.collapsed[c.dataset.ck] = true; else delete store.collapsed[c.dataset.ck]; });
      break;
    }
    case 'clearForced': {
      const pfx = el.dataset.prefix; const tgt = pfx === 'e.appelCnbf' ? e.appelCnbf : e.appel; const r = compute(d, e); const A = pfx === 'e.appelCnbf' ? r.apC : r.ap;
      const civ = curVue() === 'civ', base = baseE(), btgt = pfx === 'e.appelCnbf' ? base.appelCnbf : base.appel;
      Object.keys(tgt || {}).forEach(k => ['def', 'deja', 'prov'].forEach(c => { if (A[k] && A[k].src[c] === 'force') { if (civ) setPath(civData(base), `${pfx.slice(2)}.${k}.${c}`, ''); else delete btgt[k][c]; } }));
      break;
    }
    case 'printClient': printClient(); return;
    case 'docAdd': ui.docSlot = el.dataset.slot; document.getElementById('fileDoc').click(); return;
    case 'docOpen': {
      const w = window.open('', '_blank');
      docBlob(el.dataset.id).then(b => { if (!b) { if (w) w.close(); return; } const u = URL.createObjectURL(b); if (w) w.location.href = u; else window.open(u, '_blank'); setTimeout(() => URL.revokeObjectURL(u), 120000); });
      return;
    }
    case 'docDl': { const m = docMeta(el.dataset.id); docBlob(el.dataset.id).then(b => { if (b) download((m && m.nom) || 'document.pdf', b, 'application/pdf'); }); return; }
    case 'docDel': {
      if (e.fige) return;
      const be = baseE(), L = docList(be, el.dataset.slot), m = L.find(x => x.id === el.dataset.id);
      if (!m || !confirm(`Supprimer le document « ${m.nom} » de l'exercice ?`)) return;
      be.docs[el.dataset.slot] = L.filter(x => x !== m);
      save(); render(); docPurge([m.id]); return;
    }
    case 'simReset': ui.sim = { mode: ui.sim ? ui.sim.mode : 'detail', s: [{}, {}, {}] }; break;
    case 'goExo': d.current = Number(el.dataset.y); ui.vue = el.dataset.vue || 'bilan'; ui.tab = 'dossier'; break;
    case 'civReset': if (confirm(`Reprendre tous les éléments de l'exercice clos ${mm(baseE().finExercice)}/${baseE().annee} dans l'année civile ? Les saisies propres à l'année civile seront effacées.`)) { const b = baseE(); b.civ.data = {}; } break;
    case 'dupParams': {
      const ys = Object.keys(store.params).map(Number); const last = Math.max(...ys);
      const np = clone(store.params[last]); np.annee = last + 1; np.verifie = false; np.maj = ''; np.origine = `Copie du millésime ${last} — À ACTUALISER`;
      np._local = true;   // millésime local : un millésime publié ultérieurement ne l'écrase pas sans votre accord
      np.aVerifier = [`Toutes les valeurs sont celles de ${last} : actualiser PASS, SMIC, taux et barèmes ${last + 1}.`, ...(np.aVerifier || [])];
      store.params[last + 1] = np; ui.paramYear = last + 1; break;
    }
    case 'delParams': {
      if (isPublished(ui.paramYear)) { alert(`Le millésime ${ui.paramYear} est publié avec l'application : il ne peut pas être supprimé. Utilisez « Rétablir la version publiée » pour abandonner une version locale.`); return; }
      if (Object.keys(store.params).length < 2) { alert('Au moins un millésime doit être conservé.'); return; }
      if (confirm(`Supprimer définitivement le millésime ${ui.paramYear} ?`)) { delete store.params[ui.paramYear]; ui.paramYear = Math.max(...Object.keys(store.params).map(Number)); }
      break;
    }
    case 'resetPublished': {
      const y = ui.paramYear; if (!isPublished(y)) return;
      if (!confirm(`Rétablir le millésime ${y} publié avec l'application ?\n\nLa version locale (modifications et statut « non vérifié ») sera abandonnée. Les exercices figés conservent leur instantané.`)) return;
      store.params[y] = clone(PUBLISHED[y]); break;
    }
    case 'exportParams': download(`parametres_cotisations_TNS_${Object.keys(store.params).join('-')}.json`, JSON.stringify({ format: 'cotis-tns-params', appli: APP_ID, parametres: store.params }, null, 2), 'application/json'); return;
    case 'logoAdd': case 'logoDel': case 'styleExport': case 'styleImport': case 'styleReset': case 'stylePreset': styleAct(a, el); return;
    case 'importParams': document.getElementById('fileImport').click(); return;
  }
  save(); render();
}

document.addEventListener('change', ev => {
  const el = ev.target;
  if (el.id === 'selDossier') { store.current = el.value; save(); render(); return; }
  if (el.id === 'selVue') { ui.vue = el.value; render(); return; }
  if (el.id === 'selExo') { curD().current = Number(el.value); save(); render(); return; }
  if (el.id === 'fileImport') { const f = el.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { importJSON(rd.result); el.value = ''; }; rd.readAsText(f); return; }
  if (el.id === 'fileDoc') { const fs = [...el.files]; el.value = ''; if (fs.length) addDocs(ui.docSlot, fs); return; }
  if (el.id === 'fileLogo') { const f = el.files[0]; el.value = ''; if (f) importLogoFile(f); return; }
  if (el.id === 'fileStyle') { const f = el.files[0]; el.value = ''; if (f) importStyleFile(f); return; }
  if (el.id === 'tresoTotal') return;
  if (el.dataset && el.dataset.b) onBind(el);
});
document.addEventListener('click', ev => {
  const h2 = ev.target.closest('#main .card > h2.tog');
  if (h2 && !ev.target.closest('button,input,select,a')) {
    const c = h2.parentElement; c.classList.toggle('collapsed');
    store.collapsed = store.collapsed || {};
    if (c.classList.contains('collapsed')) store.collapsed[c.dataset.ck] = true; else delete store.collapsed[c.dataset.ck];
    save(); return;
  }
  const t = ev.target.closest('[data-tab],[data-sub],[data-act],button');
  if (!t) return;
  if (t.dataset.tab) { ui.tab = t.dataset.tab; render(); window.scrollTo(0, 0); return; }
  if (t.dataset.sub) { ui.sub = t.dataset.sub; render(); return; }
  if (t.dataset.act) { ev.preventDefault(); act(t.dataset.act, t); return; }
  switch (t.id) {
    case 'btnNewDossier': {
      const prenom = prompt('Prénom du travailleur indépendant :'); if (prenom === null) return;
      const nom = prompt('Nom :'); if (nom === null) return;
      const y = Math.max(...Object.keys(store.params).map(Number));
      const d = newDossier(prenom.trim(), nom.trim(), 'gerant_is', 'organic', y);
      store.dossiers[d.id] = d; store.current = d.id; ui.tab = 'dossier'; break;
    }
    case 'btnDelDossier': {
      const d = curD(); if (!d) return;
      if (!confirm(`Supprimer le dossier ${d.prenom} ${d.nom} et tout son historique ? (Exportez-le d'abord si besoin.)`)) return;
      const ids = dossierDocRefs(d).map(x => x.id);
      delete store.dossiers[d.id]; store.current = Object.keys(store.dossiers)[0] || null; docPurge(ids); break;
    }
    case 'btnNewExo': {
      const d = curD(); if (!d) return; const y = Math.max(...Object.keys(d.exercices).map(Number)) + 1;
      d.exercices[y] = emptyExo(y, d); d.current = y; ui.tab = 'dossier'; break;
    }
    case 'btnPrevExo': {
      const d = curD(); if (!d) return; const y = Math.min(...Object.keys(d.exercices).map(Number)) - 1;
      if (!confirm(`Créer l'exercice ${y} (antérieur au plus ancien exercice du dossier) ?`)) return;
      d.exercices[y] = emptyExo(y, d); d.current = y; ui.tab = 'dossier'; break;
    }
    case 'btnDelExo': {
      const d = curD(); if (!d) return; if (Object.keys(d.exercices).length < 2) { alert('Le dossier doit conserver au moins un exercice.'); return; }
      if (!confirm(`Supprimer l'exercice ${d.current} de ce dossier ?${d.exercices[d.current].fige ? '\n\nATTENTION : cet exercice est figé.' : ''}`)) return;
      const ids = exoDocRefs(d.exercices[d.current]).map(x => x.id);
      delete d.exercices[d.current]; d.current = Math.max(...Object.keys(d.exercices).map(Number)); docPurge(ids); break;
    }
    case 'btnExport': exportDossier(); return;
    case 'btnImport': document.getElementById('fileImport').click(); return;
    case 'btnPdf': printRecap(); return;
    default: return;
  }
  save(); render();
});
window.addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.target.matches('input[data-b]')) ev.target.blur(); });

/* Sauvegarde complète (tous dossiers) via Ctrl+Maj+S */
window.addEventListener('keydown', ev => {
  if (ev.ctrlKey && ev.shiftKey && (ev.key === 'S' || ev.key === 's')) {
    ev.preventDefault();
    const refs = allDocRefs();
    (refs.length ? docsPayload(refs) : Promise.resolve(null)).then(docs => download(`sauvegarde_cotisations_TNS_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ format: 'cotis-tns-base', appli: APP_ID, ...store, ...(docs ? { documents: docs } : {}) }, null, 2), 'application/json'));
  }
});
/* Glisser-déposer d'un PDF sur le cadre « Document archivé » */
document.addEventListener('dragover', ev => {
  const z = ev.target.closest && ev.target.closest('.docDrop');
  document.querySelectorAll('.docDrop.over').forEach(x => { if (x !== z) x.classList.remove('over'); });
  if (!z || (curE() && curE().fige)) return;
  ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; z.classList.add('over');
});
document.addEventListener('dragleave', ev => { const z = ev.target.closest && ev.target.closest('.docDrop'); if (z && !z.contains(ev.relatedTarget)) z.classList.remove('over'); });
document.addEventListener('drop', ev => {
  const z = ev.target.closest && ev.target.closest('.docDrop');
  if (!z) return;
  ev.preventDefault(); z.classList.remove('over');
  if (curE() && curE().fige) return;
  const fs = [...(ev.dataTransfer.files || [])]; if (fs.length) addDocs(z.dataset.drop, fs);
});
