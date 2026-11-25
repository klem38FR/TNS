'use strict';
/* Moteur de calcul : barèmes Urssaf / SSI, CNAVPL, CNBF, caisses libérales */

/* ------------------------------------------------------------------ */
/* 5. MOTEUR DE CALCUL                                                 */
/* ------------------------------------------------------------------ */
/* Taux progressifs arrondis à 2 décimales en % (p.arrondiTaux = 4 décimales du taux décimal) */
const arrT = p => (p && p.arrondiTaux !== undefined && p.arrondiTaux !== null && p.arrondiTaux !== '') ? n(p.arrondiTaux) : 4;
function tauxMaladie(R, P, m, dec = 4) {
  const b = m.bornes.map(Number), t = m.taux.map(Number);
  if (R < b[0] * P) return t[0] / 100;
  for (let i = 1; i < b.length; i++) if (R < b[i] * P) return rT((t[i - 1] + (t[i] - t[i - 1]) * (R - b[i - 1] * P) / ((b[i] - b[i - 1]) * P)) / 100, dec);
  return null; // au-delà de la dernière borne
}
function cotMaladie(R, P, m, dec = 4) {
  const b = m.bornes.map(Number), t = m.taux.map(Number), last = b[b.length - 1];
  const tx = tauxMaladie(R, P, m, dec);
  if (tx !== null) return { cot: rnd(Math.max(R, 0) * tx), taux: tx };
  const cot = rnd(last * P * t[t.length - 1] / 100 + (R - last * P) * n(m.tauxSup) / 100);
  return { cot, taux: R ? cot / R : 0 };
}
const tauxAF = (R, P, a, dec = 4) => rT(Math.min(a.taux, Math.max(0, a.taux / ((a.haut - a.seuil) * P) * (R - a.seuil * P))), dec);
function cfpRate(p, act, conj) {
  const k = actDef(act).cfp || 'pl';
  if (conj) { const v = p.cfp['conj_' + k]; if (v !== null && v !== undefined && v !== '') return { t: v, warn: false }; return { t: p.cfp[k], warn: k !== 'avocat' }; }
  return { t: p.cfp[k], warn: false };
}
const clampV = (x, lo, hi) => Math.min(Math.max(x, lo), hi);

/* Année incomplète (début ou cessation d'activité en cours d'année) : prorata temporis au jour.
   k = jours d'activité dans l'année civile / nombre de jours de l'année (365 ou 366).
   Appliqué aux seuils et plafonds exprimés en PASS des cotisations recouvrées par l'Urssaf, comme le
   simulateur officiel mon-entreprise (Urssaf / beta.gouv, règles modele-social, version du 05/11/2026) :
   seuils du taux progressif maladie, bornes IJ, seuils AF (110 % / 140 % PASS), plafond retraite de base,
   plafond RCI tranche 1, plafond et assiette minimale invalidité-décès, invalidité-décès Cipav.
   Non proratisés : cotisation minimale de retraite de base (D633-2 / D635-2), RCI tranche 2 (4 PASS),
   CFP, abattement de 26 % (bornes), caisses de retraite libérales, CNBF, MSA. */
function prorataOf(d, y) {
  const deb = parseD(d && d.debutActivite), fin = parseD(d && d.finActivite);
  const o = { k: 1, jours: 0, joursAn: 0, partiel: false, deb: null, fin: null, hors: false };
  if (!deb && !fin) return o;
  const t = x => Date.UTC(x.y, x.m - 1, x.d), D = 86400000;
  const a = Date.UTC(y, 0, 1), z = Date.UTC(y, 11, 31);
  o.joursAn = Math.round((z - a) / D) + 1;
  const s = deb ? Math.max(a, t(deb)) : a, e = fin ? Math.min(z, t(fin)) : z;
  if (e < s) { o.hors = true; return o; }
  o.jours = Math.round((e - s) / D) + 1;
  o.partiel = o.jours < o.joursAn;
  o.k = o.partiel ? o.jours / o.joursAn : 1;
  o.deb = deb && t(deb) >= a ? d.debutActivite : null; o.fin = fin && t(fin) <= z ? d.finActivite : null;
  return o;
}

/* Cotisations recouvrées par l'Urssaf (ou la MSA) pour une base R, base CSG Rcsg */
function calcUrssaf(R, Rcsg, act, p, opt = {}) {
  const P = p.pass, c = {}, tx = {}, base = {}, dec = arrT(p), mode = actDef(act).mode;
  const S = p.smic_h;
  const kP = opt.prorata > 0 && opt.prorata < 1 ? opt.prorata : 1, Pk = P * kP;   // PASS proratisé (année incomplète)
  if (mode === 'msa') {
    const q = p.msa || {};
    const m = cotMaladie(R, P, q.amexa || p.maladie, dec); c.maladie = m.cot; tx.maladie = m.taux; base.maladie = R;
    c.ij = n(q.ijForfait); base.ij = null; tx.ij = null;
    if (q.inval) { base.inval = Math.max(R, n(q.inval.minPct) * P); tx.inval = q.inval.taux; c.inval = rnd(base.inval * q.inval.taux); }
    if (q.avi) { base.avi = clampV(R, n(q.avi.minSmic) * S, n(q.avi.plafPass || 1) * P); tx.avi = q.avi.taux; c.avi = rnd(base.avi * q.avi.taux); } else c.avi = 0;
    if (q.avaP) { base.avaP = clampV(R, n(q.avaP.minSmic) * S, n(q.avaP.plafPass || 1) * P); tx.avaP = q.avaP.taux; c.avaP = rnd(base.avaP * q.avaP.taux); }
    if (q.avaD) { base.avaD = Math.max(R, n(q.avaD.minSmic) * S); tx.avaD = q.avaD.taux; c.avaD = rnd(base.avaD * q.avaD.taux); }
    if (q.rco) { base.rco = Math.max(R, n(q.rco.minSmic) * S); tx.rco = q.rco.taux; c.rco = rnd(base.rco * q.rco.taux); }
    tx.af = tauxAF(R, P, p.af, dec); base.af = R; c.af = rnd(tx.af * R);
    c.atexa = n((q.atexa || {})[opt.atexa || 'A']); base.atexa = null; tx.atexa = null;
    if (q.vivea) { base.cfp = R; tx.cfp = q.vivea.taux; c.cfp = opt.noCFP ? 0 : rnd(clampV(R * q.vivea.taux, n(q.vivea.minPct) * P, n(q.vivea.maxPct) * P)); }
    const cs = q.csg || p.csg; base.csg = Math.max(Rcsg, 0); tx.csg = cs.total;
    c.csg = rnd(base.csg * cs.total); c.csgD = rnd(base.csg * cs.ded); c.csgND = c.csg - c.csgD;
    return { c, tx, base, cfpWarn: false };
  }
  const m = cotMaladie(R, Pk, p.maladie, dec); c.maladie = opt.zfu ? 0 : m.cot; tx.maladie = opt.zfu ? 0 : m.taux; base.maladie = R;
  if (mode === 'pl' && actDef(act).pamc && n(opt.convPct) < 100 && !opt.zfu) {
    const Rnc = Math.max(R, 0) * (1 - clampV(n(opt.convPct), 0, 100) / 100);
    c.maladie = rnd(Math.max(R, 0) * m.taux + Rnc * n(p.pl.pamcSupp)); base.maladieNC = Rnc;
  }
  if (act === 'cnbf') { base.ij = Math.min(Math.max(R, 0), p.cnbf.ij_plafPass * P); tx.ij = p.cnbf.ij_taux; }
  else if (mode === 'pl' || mode === 'cipav') { const q = p.pl.ij; base.ij = clampV(R, q.minPct * Pk, q.maxPct * Pk); tx.ij = q.taux; }
  else { base.ij = clampV(R, p.ij.minPct * Pk, p.ij.maxPct * Pk); tx.ij = p.ij.taux; }
  if (opt.noIJ) tx.ij = 0;
  c.ij = rnd(tx.ij * base.ij);
  tx.af = tauxAF(R, Pk, p.af, dec); base.af = R; c.af = rnd(tx.af * R);
  const Rr = opt.Rretraite !== undefined ? opt.Rretraite : R;
  if (mode === 'ssi') {
    const minRB = p.rb.t1 * S * p.rb.minHeures;
    base.rb1 = clampV(Rr, 0, Pk); tx.rb1 = p.rb.t1; c.rb1 = rnd(Math.max(base.rb1 * p.rb.t1, minRB));
    base.rb2 = Math.max(Rr - Pk, 0); tx.rb2 = p.rb.t2; c.rb2 = rnd(base.rb2 * p.rb.t2);
    base.rc1 = clampV(Rr, 0, p.rc.plafT1 * Pk); tx.rc1 = p.rc.t1; c.rc1 = rnd(base.rc1 * p.rc.t1);
    base.rc2 = Math.max(0, clampV(Rr, p.rc.plafT1 * Pk, p.rc.plafT2 * P) - p.rc.plafT1 * Pk); tx.rc2 = p.rc.t2; c.rc2 = rnd(base.rc2 * p.rc.t2);
    base.id = clampV(Rr, 0, Pk); tx.id = p.id.taux; c.id = rnd(Math.max(base.id * p.id.taux, p.id.minPct * Pk * p.id.taux));
  }
  if (mode === 'cipav') {
    Object.assign(c, cnavplRB(Rr, p, base, tx));
    const q = p.cipav;
    base.rc1 = clampV(Rr, 0, q.rc.plafT1 * P); tx.rc1 = q.rc.t1; c.rc1 = rnd(base.rc1 * q.rc.t1);
    base.rc2 = clampV(Rr, q.rc.plafT1 * P, q.rc.plafT2 * P) - q.rc.plafT1 * P; tx.rc2 = q.rc.t2; c.rc2 = rnd(base.rc2 * q.rc.t2);
    base.id = clampV(Rr, q.id.minPct * Pk, q.id.plafPass * Pk); tx.id = q.id.taux; c.id = rnd(base.id * q.id.taux);
  }
  if (mode === 'pl') {
    const t = (p.pl.curps || {})[act];
    if (t) { base.curps = Math.max(R, 0); tx.curps = t; c.curps = Math.min(rnd(base.curps * t), n(p.pl.curpsPlaf) || Infinity); }
    if (actDef(act).pamc) { c.pamc = -Math.abs(n(opt.pamcPart)); }
  }
  const cf = cfpRate(p, act, opt.conjoint); base.cfp = P; tx.cfp = cf.t; c.cfp = opt.noCFP ? 0 : rnd(P * n(cf.t)); if (opt.noCFP) tx.cfp = 0;
  base.csg = Math.max(Rcsg, 0); tx.csg = p.csg.total;
  c.csg = rnd(base.csg * p.csg.total); c.csgD = rnd(base.csg * p.csg.ded); c.csgND = c.csg - c.csgD;
  return { c, tx, base, cfpWarn: cf.warn };
}
/* Retraite de base des professions libérales (CNAVPL) : 2 tranches, cotisation minimale sur 450 SMIC horaires */
function cnavplRB(R, p, base = {}, tx = {}) {
  const q = p.cnavpl, P = p.pass, c = {};
  base.rb1 = clampV(R, 0, P); tx.rb1 = q.t1; c.rb1 = rnd(base.rb1 * q.t1);
  base.rb2 = clampV(R, 0, q.plafT2 * P); tx.rb2 = q.t2; c.rb2 = rnd(base.rb2 * q.t2);
  const min = rnd(q.minHeures * p.smic_h * (q.t1 + q.t2));
  if (c.rb1 + c.rb2 < min) { c.rb1 = min - c.rb2; base.rbMin = min; }
  return c;
}

function calcCnbf(R, p, e) {
  const q = p.cnbf, P = p.pass, cn = e.cnbf || {}, c = {}, det = {};
  const anc = Math.max(1, Math.min(6, Math.round(n(cn.anciennete) || 1)));
  const debut = n(cn.anneeInscription) >= e.annee - 1;
  c.rb_forf = (cn.age65 || anc >= 6) ? n(q.rb_forf[5]) : n(q.rb_forf[anc - 1]);
  const assDebut = rnd(q.debutPctPass * P);
  det.assietteRb = debut ? assDebut : Math.min(Math.max(R, 0), q.rb_plaf);
  c.rb_prop = rnd(det.assietteRb * q.rb_taux);
  det.nbDroits = rnd(Math.min(Math.max(R, 0), q.dp_plaf) / q.dp_valeur);
  c.dp = Math.max(0, det.nbDroits * q.dp_montant - n(cn.droitsVerses));
  const classe = cn.classe || 'C1';
  const taux = classe === 'C2' ? q.rc_C2 : classe === 'C2+' ? q.rc_C2p : q.rc_C1;
  det.assietteRc = debut ? assDebut : Math.max(R, 0);
  det.tranches = []; let prev = 0, tot = 0;
  q.rc_bornes.forEach((b, i) => { const a = Math.max(0, Math.min(det.assietteRc, b) - prev); const v = r2(a * n(taux[i]) / 100); det.tranches.push({ de: prev, a: b, taux: n(taux[i]), assiette: a, cot: v }); tot += v; prev = b; });
  c.rc = rnd(tot);
  c.id = cn.retraiteActif ? n(q.id_retraite) : ((cn.age65 || anc >= 5) ? n(q.id_plein) : n(q.id_debut));
  det.barreau = n(q.id_barreau); det.debut = debut; det.anc = anc; det.classe = classe;
  return { c, det };
}

/* Cotisations de la section professionnelle (hors CNBF) : RB CNAVPL + composants de la caisse.
   revs = { N, 'N-1', 'N-2', produits, commissions } ; opts = options de l'exercice (e.caisse) */
function calcCaisse(act, p, revs, opts, W) {
  const c = {}, det = {}, P = p.pass;
  if (act === 'cnbf') return null;
  const tx = {}, base = {};
  Object.assign(c, cnavplRB(n(revs.N), p, base, tx));
  det.rb1 = { base: base.rb1, taux: tx.rb1, ref: 'N', min: base.rbMin }; det.rb2 = { base: base.rb2, taux: tx.rb2, ref: 'N' };
  const comps = (p.caisses || {})[act] || [];
  const o = opts || {};
  comps.forEach(k => {
    const d = { ref: k.ref, t: k.t }; let v = 0;
    let R = k.ref === 'produits' ? n(o.produits) : k.ref === 'commissions' ? n(o.commissions) : n(revs[k.ref || 'N']);
    if (k.conv) { R = R * clampV(o.convPct === '' || o.convPct === undefined ? 100 : n(o.convPct), 0, 100) / 100; d.conv = true; }
    d.rev = R;
    if (k.t === 'forfait') { if (k.montant === null || k.montant === undefined) d.missing = true; v = n(k.montant); }
    else if (k.t === 'prop') {
      const sub = k.secteur ? (k[o.secteur === 's2' ? 's2' : 's1'] || {}) : k;
      const forfait = sub.forfait, taux = sub.taux;
      if (taux === null || taux === undefined) d.missing = true;
      const lo = k.plancherPass !== undefined ? k.plancherPass * P : n(k.plancher);
      const hi = k.plafPass !== undefined ? k.plafPass * P : (k.plafond ? n(k.plafond) : Infinity);
      let b;
      if (k.tranche) b = Math.max(0, Math.min(Math.max(R, 0), hi) - lo);
      else if (k.clampBas) b = clampV(R, lo, hi);
      else b = clampV(R, 0, hi);
      v = n(forfait) + n(taux) * b;
      if (k.minPass) v = Math.max(v, k.minPass * P * n(taux));
      Object.assign(d, { base: b, taux: n(taux), forfait: n(forfait), lo, hi });
    } else if (k.t === 'classes') {
      let list = (k.classes || []).slice();
      if (o.allegement && k.allegement) list = [...k.allegement, ...list];
      if (!list.length) d.missing = true;
      const forced = (o.classe || {})[k.k];
      let row = forced ? list.find(x => String(x[0]) === String(forced)) : null;
      if (!row) row = list.find(x => x[1] === null || x[1] === undefined || R <= x[1]) || list[list.length - 1];
      if (row) { v = n(row[2]); d.classe = row[0]; d.forced = !!forced; }
      d.list = list;
    } else if (k.t === 'choix') {
      const key = (o.choix || {})[k.k] || k.defaut; const ch = (k.choix || {})[key];
      if (ch) { v = n(ch[1]); d.classe = ch[0]; } d.key = key;
    } else if (k.t === 'multiple') {
      const cl = Math.max(1, Math.min(k.max || 8, Math.round(n((o.classe || {})[k.k]) || k.defaut || 1)));
      if (k.unite === null || k.unite === undefined) d.missing = true;
      v = n(k.unite) * cl; d.classe = cl;
    }
    if (d.missing && W) W.push({ t: 'warn', m: `${actDef(act).caisse} ${p.annee} – « ${k.l} » : barème non renseigné dans les paramètres (montant à 0).` });
    c[k.k] = r2(v); det[k.k] = d;
  });
  return { c, det };
}
