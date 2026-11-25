#!/usr/bin/env node
/* =====================================================================
   Vérifications avant publication (Node.js 18+, sans dépendance)
   node tools/verifier.mjs
   1. Millésimes : index.json ↔ fichiers, JSON valide, année cohérente,
      structure complète (mêmes clés que le millésime précédent), types.
   2. Service worker : tous les fichiers chargés par index.html sont
      dans APP_SHELL de sw.js et existent.
   3. Aucune donnée cabinet / client dans le dépôt (image intégrée,
      fichiers de style ou de sauvegarde exportés).
   Code de sortie 1 en cas d'erreur (utilisé par l'intégration continue).
   ===================================================================== */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = f => path.relative(ROOT, f);
let errors = 0, warnings = 0;
const err = m => { errors++; console.error('✗ ' + m); };
const warn = m => { warnings++; console.warn('⚠ ' + m); };
const okm = m => console.log('✓ ' + m);
const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { err(`${rel(f)} : JSON invalide (${e.message})`); return null; } };

/* ---------- 1. Millésimes ---------- */
const DIR = path.join(ROOT, 'millesimes');
const idx = readJson(path.join(DIR, 'index.json'));
const years = idx && Array.isArray(idx.millesimes) ? idx.millesimes : [];
if (!idx || idx.format !== 'cotis-tns-millesimes') err('millesimes/index.json : format « cotis-tns-millesimes » attendu');
if (!years.length) err('millesimes/index.json : liste « millesimes » vide');
if (years.some(y => !Number.isInteger(y))) err('millesimes/index.json : les années doivent être des entiers');
if (JSON.stringify(years) !== JSON.stringify([...new Set(years)].sort((a, b) => a - b))) err('millesimes/index.json : années à trier par ordre croissant, sans doublon');
const files = fs.readdirSync(DIR).filter(f => /^\d{4}\.json$/.test(f));
files.filter(f => !years.includes(Number(f.slice(0, 4)))).forEach(f => warn(`millesimes/${f} n'est pas déclaré dans index.json (ignoré par l'application)`));

/* Chemins des clés (objets ; tableaux non parcourus sauf caisses) */
const keyPaths = (o, p = '') => Object.keys(o).flatMap(k => { const v = o[k], q = p ? `${p}.${k}` : k; return v && typeof v === 'object' && !Array.isArray(v) ? [q, ...keyPaths(v, q)] : [q]; });
const typeOf = v => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
const getP = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
const OPTIONAL = new Set(['provAncienRegime', 'ijss', 'ijss.csgD', 'ijss.csgND', 'ijss.crds']);
let prev = null;
for (const y of years) {
  const f = path.join(DIR, `${y}.json`);
  if (!fs.existsSync(f)) { err(`millesimes/${y}.json absent (déclaré dans index.json)`); continue; }
  const p = readJson(f); if (!p) continue;
  if (p.annee !== y) err(`millesimes/${y}.json : "annee" vaut ${p.annee}`);
  if (typeof p.verifie !== 'boolean') err(`millesimes/${y}.json : "verifie" doit valoir true ou false`);
  if (p._local !== undefined) err(`millesimes/${y}.json : clé technique "_local" à retirer`);
  if (typeof p.pass !== 'number' || p.pass <= 0) err(`millesimes/${y}.json : PASS invalide`);
  if (typeof p.smic_h !== 'number' || p.smic_h <= 0) err(`millesimes/${y}.json : SMIC horaire invalide`);
  ['sources', 'aVerifier'].forEach(k => { if (!Array.isArray(p[k]) || p[k].some(s => typeof s !== 'string')) err(`millesimes/${y}.json : "${k}" doit être une liste de textes`); });
  if (p.verifie === false) warn(`millesimes/${y}.json : millésime publié NON vérifié (signalé dans l'application)`);
  if (prev) {
    const kp = new Set(keyPaths(p)), kq = new Set(keyPaths(prev.p));
    /* une valeur null (« sans objet » ou « non renseigné ») dispense de ses sous-clés */
    const underNull = (o, k) => k.split('.').slice(0, -1).some((_, i, a) => getP(o, a.slice(0, i + 1).join('.')) === null);
    [...kq].filter(k => !kp.has(k) && !OPTIONAL.has(k) && !underNull(p, k)).forEach(k => err(`millesimes/${y}.json : clé « ${k} » absente (présente en ${prev.y})`));
    [...kp].filter(k => !kq.has(k) && !OPTIONAL.has(k) && !underNull(prev.p, k)).forEach(k => warn(`millesimes/${y}.json : nouvelle clé « ${k} » (absente en ${prev.y}) — le code doit la gérer`));
    [...kp].filter(k => kq.has(k)).forEach(k => {
      const a = typeOf(getP(p, k)), b = typeOf(getP(prev.p, k));
      if (a !== b && a !== 'null' && b !== 'null') err(`millesimes/${y}.json : « ${k} » de type ${a} (${b} en ${prev.y})`);
    });
    const ca = Object.keys(p.caisses || {}).sort().join(), cb = Object.keys(prev.p.caisses || {}).sort().join();
    if (ca !== cb) err(`millesimes/${y}.json : caisses différentes de ${prev.y} (${ca} / ${cb})`);
  }
  prev = { y, p };
}
if (!errors) okm(`millésimes : ${years.join(', ')}`);

/* ---------- 2. Service worker ---------- */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const shellSrc = /const APP_SHELL = \[([\s\S]*?)\];/.exec(sw);
const shell = shellSrc ? [...shellSrc[1].matchAll(/'([^']+)'/g)].map(m => m[1]) : [];
if (!shell.length) err('sw.js : liste APP_SHELL introuvable');
const refs = [...html.matchAll(/(?:src|href)="([^"#:]+)"/g)].map(m => m[1]);
refs.filter(r => !shell.includes(r)).forEach(r => err(`sw.js : « ${r} » (chargé par index.html) absent de APP_SHELL`));
shell.filter(s => s !== './' && !fs.existsSync(path.join(ROOT, s))).forEach(s => err(`sw.js : « ${s} » introuvable`));
const pdfjs = /const PDFJS_SRC = '([^']+)'/.exec(fs.readFileSync(path.join(ROOT, 'js/core/config.js'), 'utf8'));
if (!pdfjs || !shell.includes(pdfjs[1])) err('sw.js : la bibliothèque pdf.js (PDFJS_SRC) doit figurer dans APP_SHELL');
if (!/const CACHE_VERSION = \d+;/.test(sw)) err('sw.js : CACHE_VERSION introuvable');
if (errors === 0) okm(`service worker : ${shell.length} fichiers précachés`);

/* ---------- 3. Pas de données cabinet / client ---------- */
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.name === '.git' || e.name === 'node_modules' ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const all = walk(ROOT);
all.filter(f => /TNS_Param_Style_.*\.json$|^TNS_.*\.json$|sauvegarde_cotisations_TNS_.*\.json$/.test(path.basename(f))).forEach(f => err(`${rel(f)} : fichier exporté (style cabinet ou sauvegarde client) à ne pas publier`));
all.filter(f => /\.(html|js|mjs|css|json|webmanifest)$/.test(f) && !f.includes(`${path.sep}vendor${path.sep}`))
  .forEach(f => { if (/data:image\/[a-z+]+;base64,[A-Za-z0-9+/]{200}/.test(fs.readFileSync(f, 'utf8'))) err(`${rel(f)} : image intégrée (base64) — le logo du cabinet ne doit pas être dans le dépôt`); });
okm('aucun fichier de style cabinet ni sauvegarde client détecté');

console.log(`\n${errors} erreur(s), ${warnings} avertissement(s)`);
process.exit(errors ? 1 : 0);
