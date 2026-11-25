'use strict';
/* État de l'application et persistance (localStorage) */

/* ------------------------------------------------------------------ */
/* 4. ÉTAT & PERSISTANCE                                               */
/* ------------------------------------------------------------------ */
let store = null;
let ui = { tab: 'dossier', sub: 'params', paramYear: null, exportMode: 'signe', vue: 'bilan' };
let storageOK = true;
let PRINTING = false;   // rendu destiné à l'impression (affichage compact)

const defaultRegime = (act, st) => { const m = actDef(act).mode; return m === 'msa' ? 'ba' : (m === 'ssi' && act !== 'pl_ssi' ? 'bic' : 'bnc'); };
function emptyExo(annee, d) {
  const prev = d && d.exercices ? d.exercices[annee - 1] : null;
  const next = !prev && d && d.exercices ? d.exercices[annee + 1] : null;
  const ref = prev || next;
  const e = {
    annee,
    activite: ref ? ref.activite : (d ? d.activite : 'organic'),
    statut: ref ? ref.statut : (d ? d.statut : 'gerant_is'),
    regime: ref ? ref.regime : '',
    debutExercice: prev ? shiftYear(prev.debutExercice, 1) : next ? shiftYear(next.debutExercice, -1) : `${annee}-01-01`,
    finExercice: prev ? shiftYear(prev.finExercice, 1) : next ? shiftYear(next.finExercice, -1) : `${annee}-12-31`,
    dateCourrier: '',
    dateCnbf: '',
    appel: {}, appelCnbf: {}, csgDOverride: { def: '', deja: '', prov: '', provDeja: '' },
    courrierRevenus: { brut: '', abatt: '', assiette: '', assietteCsg: '' },
    totalCourrier: '',
    rem: {}, eiRev: {}, remCom: {}, eiRevCom: {}, ijss: {}, ijssCom: {},
    perType: prev && prev.perType ? prev.perType : 'per',
    acre: prev ? clone(prev.acre) : { actif: false, mois: 12, base: 'abattue' },
    conjoint: prev ? clone(prev.conjoint) : { actif: false, option: 'tiers_pass' },
    cnbf: prev ? Object.assign(clone(prev.cnbf), { anciennete: Math.min(6, n(prev.cnbf.anciennete) + 1), droitsVerses: 0 }) : { anciennete: 6, age65: false, retraiteActif: false, anneeInscription: 2015, droitsVerses: 0, classe: 'C1' },
    caisse: prev && prev.caisse ? Object.assign(clone(prev.caisse), { revRef: {}, pamcPart: '', produits: '', commissions: '' }) : defaultCaisseOpts(),
    msa: prev && prev.msa ? { atexa: prev.msa.atexa, assiette: '' } : { atexa: 'A', assiette: '' },
    ech: { jour: 5, rows: Array.from({ length: 12 }, () => ({ appele: '', verse: '', obs: '' })), majMois: 0, integrer: true },
    cloture: { tresoActif: false, paiements: {}, repriseManuelleCca: '', repriseManuelleProv: '', declarant: 1 },
    notes: ''
  };
  if (!e.regime) e.regime = defaultRegime(e.activite, e.statut);
  if (prev && prev.acre && prev.acre.actif) e.acre.mois = Math.max(0, 12 - n(prev.acre.mois));
  if (e.acre.mois === 0) e.acre.actif = false;
  return e;
}
function defaultCaisseOpts() { return { secteur: 's1', convPct: 100, pamcPart: '', allegement: false, classe: {}, choix: {}, revRef: {}, produits: '', commissions: '' }; }
function shiftYear(s, k) { const x = parseD(s); if (!x) return ''; let d = x.d; const y = x.y + k; if (x.m === 2 && d === 29) d = 28; return `${y}-${String(x.m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }

function newDossier(prenom, nom, statut = 'gerant_is', activite = 'organic', annee = 2026) {
  const d = { id: uid(), prenom, nom, statut, activite, comptes: clone(DEFAULT_ACCOUNTS[statut]), divers: { dom: false, cfp: true, ijAC: true, ijPL: true, zfu: false }, histo: {}, journal: 'OD', prefixe: 'SSI', exercices: {}, current: annee, creeLe: new Date().toISOString() };
  d.exercices[annee] = emptyExo(annee, d);
  return d;
}

function demoDossier() {
  const d = newDossier('Jean', 'Exemple', 'gerant_is', 'organic', 2026);
  const e = d.exercices[2026];
  e.debutExercice = '2025-09-01'; e.finExercice = '2026-08-31'; e.dateCourrier = '2026-06-15';
  e.notes = 'Dossier de démonstration – données fictives, à supprimer.';
  const A = { maladie: [600, 480, 1100, 1000], ij: [150, 140, 180, 170], af: [0, 0, 0, 0], rb1: [6100, 6000, 6500, 6300], rb2: [0, 0, 0, 0], rc1: [2800, 2700, 3000, 2900], rc2: [0, 0, 0, 0], id: [450, 440, 480, 470], cfp: [0, 0, 120, 120], csg: [3300, 3200, 3600, 3500] };
  Object.entries(A).forEach(([k, v]) => e.appel[k] = { def: v[0], deja: v[1], prov: v[2], provDeja: v[3] });
  Object.assign(e.rem, { remVersee: 30000, aen: 1200, madPrev: 1500, madRet: 3000 });
  return d;
}

/* Complète un objet par les clés manquantes d'un modèle (migration des millésimes) */
function fillMissing(t, src) {
  Object.keys(src).forEach(k => {
    if (t[k] === undefined) t[k] = clone(src[k]);
    else if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && t[k] && typeof t[k] === 'object' && !Array.isArray(t[k]) && k !== 'caisses') fillMissing(t[k], src[k]);
  });
}
function migrateDossier(d) {
  if (OLD_STATUT[d.statut]) d.statut = OLD_STATUT[d.statut];
  if (OLD_ACT[d.activite]) d.activite = OLD_ACT[d.activite];
  Object.values(d.exercices || {}).forEach(e => {
    if (OLD_STATUT[e.statut]) e.statut = OLD_STATUT[e.statut];
    if (OLD_ACT[e.activite]) e.activite = OLD_ACT[e.activite];
    if (!e.regime) e.regime = defaultRegime(e.activite, e.statut);
    if (!e.caisse) e.caisse = defaultCaisseOpts();
    ['classe', 'choix', 'revRef'].forEach(k => { if (!e.caisse[k]) e.caisse[k] = {}; });
    if (!e.msa) e.msa = { atexa: 'A', assiette: '' };
    if (!e.remCom) e.remCom = {}; if (!e.eiRevCom) e.eiRevCom = {}; if (!e.ijss) e.ijss = {}; if (!e.ijssCom) e.ijssCom = {};
    if (e.ir && e.ir.perType && !e.perType) e.perType = e.ir.perType; delete e.ir;
    if (e.fige && e.fige.ident) { if (OLD_STATUT[e.fige.ident.statut]) e.fige.ident.statut = OLD_STATUT[e.fige.ident.statut]; }
  });
  if (d.comptes) { if (d.comptes.cnbf && d.comptes.cnbf.l === 'Cotisations CNBF') d.comptes.cnbf.l = 'Cotisations caisse de retraite'; if (d.comptes.cnbfTiers && d.comptes.cnbfTiers.l === 'CNBF') d.comptes.cnbfTiers.l = 'Caisse de retraite (section professionnelle)'; }
}
function loadStore() {
  let raw = null;
  try { raw = localStorage.getItem(LS_KEY); } catch (err) { storageOK = false; }
  if (raw) { try { store = JSON.parse(raw); } catch (err) { store = null; } }
  if (!store || !store.params) {
    const d = demoDossier();
    store = { params: {}, dossiers: { [d.id]: d }, current: d.id };
  }
  delete store.version;
  syncPublished();   // millésimes publiés (hors versions locales) rechargés depuis le dépôt
  Object.entries(store.params).forEach(([y, p]) => migrateParams(y, p));
  Object.values(store.dossiers || {}).forEach(migrateDossier);
  ui.paramYear = Math.max(...Object.keys(store.params).map(Number));
}
/* Complète un millésime local (ancienne version, copie, import) avec le modèle publié de référence */
function migrateParams(y, p) {
  if (!p || typeof p !== 'object') return;
  const model = publishedModel(y);
  if (!p.trim) p.trim = { heures: 150, max: 4 };
  if (!model) return;
  if (isPublished(y) && !p.caisses) { ['sources', 'aVerifier'].forEach(k => { p[k] = [...new Set([...(model[k] || []), ...(p[k] || [])])]; }); }
  const hadCaisses = !!p.caisses;
  fillMissing(p, model);
  if (!hadCaisses) { p.caisses = clone(model.caisses); if (!isPublished(y)) p.verifie = false; }
  if (isPublished(y) && PUBLISHED[y].provAncienRegime && p.provAncienRegime === undefined) p.provAncienRegime = true;
}
let saveTimer = null;
let computeCache = new WeakMap();
function save() {
  computeCache = new WeakMap(); civCache = new WeakMap();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeStore, 150);
}
function writeStore() { saveTimer = null; if (!store) return; try { localStorage.setItem(LS_KEY, JSON.stringify(store)); storageOK = true; } catch (err) { storageOK = false; } }
/* Écriture immédiate d'une sauvegarde différée (fermeture de la page, mise à jour de l'application) */
function flushSave() { if (saveTimer) { clearTimeout(saveTimer); writeStore(); } }
const curD = () => store.dossiers[store.current];
/* Exercice enregistré (version « Bilan ») */
const baseE = () => { const d = curD(); return d ? d.exercices[d.current] : null; };
/* Vue « Année civile » d'un exercice décalé : mêmes éléments que le bilan (reprise par défaut),
   surchargés par les saisies propres à l'année civile (e.civ.data) ; période 01/01–31/12, gel distinct (e.civ.fige) */
let civCache = new WeakMap();
function deepMerge(t, o) {
  Object.keys(o || {}).forEach(k => { const v = o[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && t[k] && typeof t[k] === 'object') deepMerge(t[k], v);
    else t[k] = v && typeof v === 'object' ? clone(v) : v; });
  return t;
}
function civView(base) {
  let v = civCache.get(base); if (v) return v;
  const { civ, fige, ...rest } = base;
  v = deepMerge(clone(rest), (civ && civ.data) || {});
  v._exDeb = base.debutExercice; v._exFin = base.finExercice;
  v.debutExercice = `${base.annee}-01-01`; v.finExercice = `${base.annee}-12-31`;
  if (civ && civ.fige) v.fige = civ.fige; else delete v.fige;
  v._civ = true;
  civCache.set(base, v); return v;
}
const civData = base => { base.civ = base.civ || {}; base.civ.data = base.civ.data || {}; return base.civ.data; };
const curVue = () => { const b = baseE(); return b && isDecale(b) && ui.vue === 'civ' ? 'civ' : 'bilan'; };
const curE = () => { const b = baseE(); return b && curVue() === 'civ' ? civView(b) : b; };
/* Version retenue pour les revenus d'une année (historique, revenus N-1 / N-2) : année civile si l'exercice est décalé */
const yearView = (d, y) => { const ex = d.exercices && d.exercices[y]; return ex && isDecale(ex) ? civView(ex) : ex; };
const mm = s => { const x = parseD(s); return x ? String(x.m).padStart(2, '0') : ''; };
/* Libellé de la version : « exercice 2026 », « exercice clos 08/2026 », « année civile 2026 » */
function vueLib(e, cap) {
  const s = e._civ ? `année civile ${e.annee}` : isDecale(e) ? `exercice clos ${mm(e.finExercice)}/${e.annee}` : `exercice ${e.annee}`;
  return cap ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
const vueShort = e => e._civ ? `année civile ${e.annee}` : isDecale(e) ? `${e.annee} – exercice clos ${mm(e.finExercice)}/${e.annee}` : `${e.annee}`;
function vueNote2042(e) {
  if (e._civ) return `<p class="note">Montants de la vue « Année civile ${e.annee} ».</p>`;
  if (isDecale(e)) return `<div class="alert info">Exercice décalé : la déclaration des revenus porte sur l'année civile ${e.annee}. Les montants ci-dessous sont ceux de l'exercice clos ${mm(e.finExercice)}/${e.annee} ; sélectionnez la vue « Année civile » dans l'en-tête pour déclarer la rémunération définitive ${e.annee}.</div>`;
  return '';
}

/* Paramètres applicables à une année : millésime exact sinon le plus récent antérieur */
function paramsFor(annee) {
  const ys = Object.keys(store.params).map(Number).sort((a, b) => a - b);
  let y = ys.filter(x => x <= annee).pop();
  if (y === undefined) y = ys[0];
  return { p: store.params[y], year: y, fallback: y !== annee };
}
