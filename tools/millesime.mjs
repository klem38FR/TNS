#!/usr/bin/env node
/* =====================================================================
   Outil de maintenance des millésimes (Node.js 18+, sans dépendance)
   ---------------------------------------------------------------------
   node tools/millesime.mjs nouveau 2027
       Crée millesimes/2027.json à partir du dernier millésime publié
       (verifie = false, à actualiser) et l'ajoute à millesimes/index.json.
   node tools/millesime.mjs depuis-export export.json 2027
       Extrait le millésime 2027 d'un fichier « Exporter les paramètres »
       de l'application (onglet Millésime) vers millesimes/2027.json.
   node tools/millesime.mjs format
       Remet en forme tous les fichiers millésimes (diff lisibles).
   Puis : node tools/verifier.mjs
   ===================================================================== */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fmtJson } from './fmtjson.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'millesimes');
const IDX = path.join(DIR, 'index.json');
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const writeJson = (f, o) => fs.writeFileSync(f, fmtJson(o) + '\n');
const index = () => readJson(IDX);
const saveIndex = ys => writeJson(IDX, { format: 'cotis-tns-millesimes', millesimes: [...new Set(ys.map(Number))].sort((a, b) => a - b) });
const die = m => { console.error('✗ ' + m); process.exit(1); };
const yearArg = v => { const y = Number(v); if (!Number.isInteger(y) || y < 2000 || y > 2100) die(`année invalide : ${v}`); return y; };

const [cmd, a1, a2] = process.argv.slice(2);
switch (cmd) {
  case 'nouveau': {
    const y = yearArg(a1), ys = index().millesimes;
    const f = path.join(DIR, `${y}.json`);
    if (fs.existsSync(f)) die(`${path.relative(ROOT, f)} existe déjà`);
    const last = Math.max(...ys.filter(x => x < y));
    if (!Number.isFinite(last)) die('aucun millésime antérieur à copier');
    const p = readJson(path.join(DIR, `${last}.json`));
    Object.assign(p, { annee: y, verifie: false, maj: '', origine: `Copie du millésime ${last} — À ACTUALISER` });
    delete p._local; delete p.provAncienRegime;
    p.aVerifier = [`Toutes les valeurs sont celles de ${last} : actualiser PASS, SMIC, taux et barèmes ${y}.`, ...(p.aVerifier || [])];
    writeJson(f, p); saveIndex([...ys, y]);
    console.log(`✓ ${path.relative(ROOT, f)} créé (copie de ${last}, non vérifié) et ajouté à millesimes/index.json`);
    console.log('  Actualisez les valeurs, les sources et les points à vérifier, puis passez "verifie" à true.');
    break;
  }
  case 'depuis-export': {
    if (!a1) die('fichier d\'export manquant');
    const y = yearArg(a2), o = readJson(path.resolve(a1));
    if (o.format !== 'cotis-tns-params' || !o.parametres || !o.parametres[y]) die(`le fichier ne contient pas le millésime ${y} (format « cotis-tns-params » attendu)`);
    const p = o.parametres[y]; delete p._local;
    if (Number(p.annee) !== y) die(`champ « annee » incohérent (${p.annee})`);
    writeJson(path.join(DIR, `${y}.json`), p); saveIndex([...index().millesimes, y]);
    console.log(`✓ millesimes/${y}.json écrit depuis ${path.basename(a1)} (verifie = ${p.verifie !== false})`);
    break;
  }
  case 'format': {
    index().millesimes.forEach(y => { const f = path.join(DIR, `${y}.json`); writeJson(f, readJson(f)); });
    saveIndex(index().millesimes);
    console.log('✓ fichiers millésimes remis en forme');
    break;
  }
  default:
    console.log('Usage :\n  node tools/millesime.mjs nouveau <année>\n  node tools/millesime.mjs depuis-export <fichier.json> <année>\n  node tools/millesime.mjs format');
    process.exit(cmd ? 1 : 0);
}
