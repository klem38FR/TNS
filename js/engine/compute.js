'use strict';
/* Moteur de calcul : lecture des appels, échéancier, assiette, cotisations, 2042 */

function lineSets(act, e, d, p) {
  const A = actDef(act), mode = A.mode;
  const base = mode === 'msa' ? MSA_LINES : mode === 'cipav' ? CIPAV_LINES : mode === 'pl' ? PL_URSSAF_LINES : SSI_LINES;
  const hasData = k => e && e.appel && e.appel[k] && ['def', 'deja', 'prov'].some(c => n(e.appel[k][c]) !== 0);
  const keep = L => {
    if (L.k === 'conj') return (e && e.conjoint && e.conjoint.actif && mode === 'ssi') || hasData('conj');
    if (L.k === 'autre') return (d && d.divers && d.divers.taxeConsulaire) || hasData('autre');
    if (L.k === 'pamc') return !!A.pamc;
    if (L.k === 'curps') return !!(p && p.pl && p.pl.curps && p.pl.curps[act]) || hasData('curps');
    if (L.k === 'avi') return !!(p && p.msa && p.msa.avi) || hasData('avi');
    return true;
  };
  return { urssaf: base.filter(keep), cnbf: mode === 'pl' ? caisseLines(act, p) : [] };
}

/* Lecture d'un appel (courrier) */
function readAppel(src, lines, csgOv, p, auto) {
  const ap = {}; const cols = ['def', 'deja', 'prov'];
  const filled = v => v !== undefined && v !== null && v !== '';
  lines.forEach(L => {
    const x = (src || {})[L.k] || {}, A = (auto || {})[L.k] || {}; const o = { src: {}, auto: {} };
    cols.forEach(c => {
      const au = A[c]; o.auto[c] = au;
      if (filled(x[c])) { o[c] = n(x[c]); o.src[c] = (au !== undefined && Math.abs(o[c] - au) > 0.005) ? 'force' : 'man'; }
      else { o[c] = au !== undefined ? au : 0; o.src[c] = au !== undefined ? 'auto' : ''; }
    });
    o.provDeja = 0; o.regul = o.def - o.deja; o.provAdj = o.prov; ap[L.k] = o;
  });
  if (ap.csg) {
    const ratio = p.csg.ded / p.csg.total; const D = {}, ND = {};
    cols.forEach(c => { const ov = csgOv ? csgOv[c] : ''; D[c] = filled(ov) ? n(ov) : r2(ap.csg[c] * ratio); ND[c] = r2(ap.csg[c] - D[c]); });
    D.provDeja = 0; ND.provDeja = 0;
    D.regul = r2(D.def - D.deja); ND.regul = r2(ND.def - ND.deja); D.provAdj = D.prov; ND.provAdj = ND.prov;
    ap.csgD = D; ap.csgND = ND;
  }
  return ap;
}
/* Ventilation par compte d'une colonne d'un appel */
function byAcc(ap, lines, col) {
  const out = {};
  const add = (k, v) => { if (Math.abs(v) < 0.005) return; out[k] = r2((out[k] || 0) + v); };
  lines.forEach(L => {
    if (L.k === 'csg') { add('csgD', ap.csgD[col]); add('csgND', ap.csgND[col]); }
    else add(L.acc, ap[L.k][col]);
  });
  return out;
}

/* Mois d'échéance actifs : mensuel ou trimestriel (février, mai, août, novembre) */
const echMonths = e => (e.ech && e.ech.periodicite === 'trimestriel') ? [1, 4, 7, 10] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
/* Échéancier & impayés (reprend la logique de l'onglet « Retards paiement ») */
function computeEch(e, ap, p, lines) {
  const rows = (e.ech && e.ech.rows) || [];
  const per = echMonths(e);
  const D = rows.map((r, i) => per.includes(i) ? n(r.appele) : 0), E = rows.map((r, i) => per.includes(i) ? n(r.verse) : 0);
  const Dtot = sum(D);
  const res = { actif: Dtot > 0, rows: [], Dtot, Etot: sum(E) };
  if (!res.actif) return res;
  const F = D.map((d, i) => Math.min(E[i], d)), G = D.map((d, i) => Math.max(0, E[i] - d)), H = D.map((d, i) => d - F[i]);
  const Gtot = sum(G); let cumH = 0;
  const I = H.map(h => { const v = Math.min(h, Math.max(0, Gtot - cumH)); cumH += h; return v; });
  const J = F.map((f, i) => f + I[i]), K = D.map((d, i) => d - J[i]);
  // Totaux appelés par nature (régularisation N-1 + provisionnel N)
  const natTot = {}; NATURES.forEach(x => natTot[x.k] = 0);
  lines.forEach(L => { natTot[L.nat] += ap[L.k].regul + ap[L.k].prov; });
  const appeleNat = sum(Object.values(natTot));
  const regleNat = {}; NATURES.forEach(x => regleNat[x.k] = 0);
  rows.forEach((r, i) => {
    let rest = Math.max(0, J[i]); const due = {}, imp = {};
    NATURES.forEach(x => { due[x.k] = Dtot ? natTot[x.k] * D[i] / Dtot : 0; const v = Math.min(due[x.k], rest); imp[x.k] = Math.max(0, v); rest -= imp[x.k]; regleNat[x.k] += imp[x.k]; });
    res.rows.push({ mois: MOIS[i], date: `${String(n(e.ech.jour) || 5).padStart(2, '0')}/${String(i + 1).padStart(2, '0')}/${e.annee}`, D: D[i], E: E[i], F: F[i], G: G[i], H: H[i], I: I[i], J: J[i], K: K[i], due, imp });
  });
  res.natTot = natTot; res.regleNat = regleNat; res.appeleNat = appeleNat; res.Ktot = sum(K); res.Jtot = sum(J);
  res.controle = r2(Dtot - appeleNat);
  const csgT = natTot.csg, csgDapp = ap.csg ? ap.csgD.regul + ap.csgD.prov : 0;
  res.regleCsgD = csgT ? regleNat.csg * csgDapp / csgT : 0;
  res.regleCsgND = regleNat.csg - res.regleCsgD;
  res.appCsgD = csgDapp; res.appCsgND = csgT - csgDapp;
  const cotisNat = ['maladie', 'rb', 'id', 'rc', 'af', 'cfp'];
  res.appCotis = sum(cotisNat.map(k => natTot[k])); res.regleCotis = sum(cotisNat.map(k => regleNat[k]));
  res.adjND = r2(res.regleCsgND - res.appCsgND); res.adjCotis = r2(res.regleCotis - res.appCotis); res.adjD = r2(res.regleCsgD - res.appCsgD);
  res.majInit = r2(res.Ktot * p.retard.initiale); res.majCompl = r2(res.Ktot * p.retard.mensuelle * n(e.ech.majMois)); res.majTot = res.majInit + res.majCompl;
  return res;
}

function compute(d, e) {
  if (computeCache.has(e)) return computeCache.get(e);
  const r = computeRaw(d, e); computeCache.set(e, r); return r;
}
/* Revenus d'une année civile : exercice de l'outil (calculé) puis valeurs saisies dans l'historique (prioritaires) */
function revOf(d, y) {
  const h = (d.histo || {})[y] || {};
  const fv = v => v !== undefined && v !== null && v !== '';
  const ex = yearView(d, y);
  let r = null;
  if (ex) { try { const x = compute(d, ex); if (x.b.brut || x.b.R) r = { brut: x.b.brut, R: x.b.R, baseCsg: x.b.baseCSG, src: (ex._civ ? 'année civile ' : 'exercice ') + y }; } catch (err) { /* ignoré */ } }
  if (fv(h.revSocial) || fv(h.baseSociale) || fv(h.baseCsg)) {
    r = r || {};
    if (fv(h.revSocial)) r.brut = n(h.revSocial);
    if (fv(h.baseSociale)) r.R = n(h.baseSociale);
    if (fv(h.baseCsg)) r.baseCsg = n(h.baseCsg);
    r.src = 'historique ' + y;
  }
  if (r) {
    if (r.R === undefined) r.R = r.baseCsg; if (r.baseCsg === undefined) r.baseCsg = r.R;
    r.abatt = (r.brut !== undefined && r.baseCsg !== undefined) ? r2(r.brut - r.baseCsg) : undefined;
  }
  return r;
}
const filledV = v => v !== undefined && v !== null && v !== '';

/* Plafonds Madelin (art. 154 bis CGI) pour un jeu d'éléments de rémunération */
function madelinOf(b, isG, p) {
  const P = p.pass, q = p.madelin, m = { pass: P };
  m.base = isG ? b.remVersee + b.remCC + b.aen + b.autres + b.csgND + b.madPrev + b.madChom + b.madRet - ((b.ij && b.ij.ald) || 0) : b.resultat + b.madPrev + b.madChom + b.madRet - ((b.ij && b.ij.ald) || 0);
  m.plafPrev = Math.min(Math.max(q.prev.tauxBase * m.base + q.prev.tauxPass * P, q.prev.tauxPass * P), q.prev.plafTaux * q.prev.plafMult * P);
  m.plafChom = Math.max(q.chom.taux * Math.min(m.base, q.chom.plafMult * P), q.chom.plancherPass * P);
  const bl = Math.min(m.base, q.ret.plafMult * P);
  m.plafRet = Math.max(q.ret.taux1 * bl + q.ret.taux2 * Math.max(0, bl - P), q.ret.plancherPass * P) - (b.abondPER !== undefined ? b.abondPER : b.abond);
  m.reintPrev = Math.max(b.madPrev - m.plafPrev, 0); m.reintChom = Math.max(b.madChom - m.plafChom, 0); m.reintRet = Math.max(b.madRet - m.plafRet, 0);
  m.reint = m.reintPrev + m.reintChom + m.reintRet;
  /* Épargne retraite (2042, cases 6OS/6OT ou 6QS/6QT) : cotisations retraite déduites du revenu professionnel,
     hors fraction correspondant aux 15 % du revenu compris entre 1 et 8 PASS (art. 163 quatervicies CGI) */
  m.dedRet = Math.max(0, b.madRet - m.reintRet);
  m.part15 = q.ret.taux2 * Math.max(0, bl - P);
  m.perDecl = Math.max(0, m.dedRet - m.part15);
  return m;
}
/* Exercice décalé : clôture en N avant décembre */
function isDecale(e) { const a = parseD(e && e.debutExercice), f = parseD(e && e.finExercice); return !!(a && f && f.y === e.annee && f.m < 12); }
/* Éléments de rémunération (clé, libellé) — récapitulatif client */
const REM_IR_G = [['remVersee', 'Rémunération versée (nette, art. 62)'], ['remCC', 'Rémunération en compte courant'], ['aen', 'Avantages en nature'], ['divid', 'Dividendes / intérêts de CCA > 10 % (capital social, primes d\'émission, CCA)'], ['autres', 'Autres revenus'],
  ['csgND', 'CSG/CRDS non déductible réglée'], ['cotis', 'Cotisations obligatoires réglées'], ['csgD', 'CSG déductible réglée'], ['abond', 'Abondements PEE, PEI, PERCO / PER, intéressement'], ['chqVac', 'Chèques vacances'],
  ['madPrev', 'Madelin / PER – prévoyance'], ['madChom', 'Madelin – perte d\'emploi'], ['madRet', 'Madelin / PER – retraite']];
const REM_IR_EI = [['resultat', 'Résultat fiscal (bénéfice / − déficit)'], ['cotisDed', 'Cotisations sociales obligatoires déduites'], ['csgDed', 'CSG / CRDS déduite'], ['madPrev', 'Madelin – prévoyance déduite'], ['madChom', 'Madelin – perte d\'emploi déduite'], ['madRet', 'Madelin / PER – retraite déduite'], ['exo', 'Exonérations / abattements fiscaux (ZFU, JEI…)'], ['autresReint', 'Autres réintégrations']];
const brutOf = (b, isG) => isG ? b.remVersee + b.remCC + b.aen + b.divid + b.autres + b.csgND + b.cotis + b.csgD + b.abond + b.madPrev + b.madChom + b.madRet + b.chqVac
  : b.resultat + b.cotisDed + b.csgDed + b.exo + b.autresReint + b.madPrev + b.madChom + b.madRet;

/* IJ / revenus de remplacement — montants BRUTS compris dans la rémunération (gérant) ou le résultat (EI) saisis.
   Classement repris de la notice de traitement des revenus de remplacement (logiciel COT'TNS) :
     fisc   : revenu de remplacement fiscalisé (CPAM) — imposable ; montant transmis par la CPAM à l'Urssaf.
              Soustrait de la base CSG-CRDS à taux plein, réintégré (après abattement) dans la base sociale.
     reduit : dont revenu de remplacement NON précompté de la CSG-CRDS : CSG-CRDS au taux réduit à la régularisation.
     prive  : revenu de remplacement organisme privé (prévoyance Madelin), CSG-CRDS précomptée, non transmis à l'Urssaf :
              déduit de la base CSG-CRDS, réintégré dans la base sociale, déclaré en DSCZ/DSDZ (notice 2042-DRI § 6.5).
     ald    : IJ affection longue durée — soustraites du revenu fiscal et de la base sociale ; CSG au taux réduit à la régularisation.
   Taux des revenus de remplacement : CSG déductible 3,80 %, CSG non déductible 2,40 %, CRDS 0,50 %
   (réponse experte ameli du 05/03/2024). Surchargeables par p.ijss = { csgD, csgND, crds }. */
const IJSS_TX = { csgD: 0.038, csgND: 0.024, crds: 0.005 };
function ijssOf(e, p) {
  const s = e.ijss || {}, t = Object.assign({}, IJSS_TX, (p && p.ijss) || {});
  t.tot = t.csgD + t.csgND + t.crds;
  /* Reprise des saisies d'IJ des versions antérieures de l'outil (genPas, genReint, aldPas, aldReint) */
  const old = n(s.genPas) + n(s.genReint) + n(s.aldPas) + n(s.aldReint);
  const legacy = !['fisc', 'reduit', 'prive', 'ald'].some(k => filledV(s[k])) && old !== 0;
  const o = { tx: t, legacy,
    fisc: legacy ? n(s.genPas) + n(s.genReint) : n(s.fisc), reduit: legacy ? 0 : n(s.reduit),
    prive: legacy ? 0 : n(s.prive), ald: legacy ? n(s.aldPas) + n(s.aldReint) : n(s.ald) };
  o.reduitSaisi = o.reduit; o.reduit = Math.min(Math.max(o.reduit, 0), Math.max(o.fisc, 0));
  o.precompte = o.fisc - o.reduit;                       // IJ CPAM déjà précomptées
  o.tot = o.fisc + o.prive + o.ald;
  o.prelD = r2((o.precompte + o.prive) * t.csgD);        // CSG déductible déjà précomptée
  o.prel = r2((o.precompte + o.prive) * t.tot);          // CSG-CRDS déjà précomptée
  o.pre1AJ = r2(o.precompte * (1 - t.csgD) + o.reduit);  // estimation du pré-remplissage 1AJ/1BJ (CPAM)
  return o;
}

function computeRaw(d, e) {
  let p, pYear, fallback;
  if (e.fige && e.fige.params) {
    /* Exercice figé : paramètres, comptes et identité de l'instantané */
    p = e.fige.params; pYear = e.fige.pYear; fallback = e.fige.fallback;
    d = Object.assign({}, d, e.fige.ident || {}, { comptes: e.fige.comptes || d.comptes });
  } else ({ p, year: pYear, fallback } = paramsFor(e.annee));
  const P = p.pass, act = e.activite, A = actDef(act), umode = A.mode, isAv = act === 'cnbf', isG = isArt62(e.statut);
  const isPL = umode === 'pl' || umode === 'cipav', hasCaisse = umode === 'pl';
  const N = e.annee;
  const W = [];
  if (fallback) W.push({ t: 'warn', m: `Aucun paramètre millésimé ${N} : le barème ${pYear} est utilisé. Créez le millésime ${N} dans l'onglet « Millésime » (sous-onglet « Paramètres millésimés »).` });
  if (p.verifie === false) W.push({ t: 'warn', m: `Le millésime ${pYear} est une copie non vérifiée : actualisez les valeurs puis cochez « vérifié ».` });
  if (!e.fige && p._local && isPublished(pYear)) W.push({ t: 'warn', m: `Le millésime ${pYear} utilisé est une version locale, différente du millésime publié : onglet « Millésime » pour rétablir la version publiée.` });
  const LS = lineSets(act, e, d, p);
  if (LS.urssaf.some(L => L.k === 'conj') && !(e.conjoint && e.conjoint.actif)) W.push({ t: 'warn', m: 'Montants saisis sur la ligne « Conjoint collaborateur » alors que l\'option n\'est pas cochée : ligne conservée.' });
  if (LS.urssaf.some(L => L.k === 'autre') && !(d.divers && d.divers.taxeConsulaire)) W.push({ t: 'warn', m: 'Montants saisis sur la ligne « Autres (CMA / CCI) » alors que la taxe consulaire n\'est pas cochée : ligne conservée.' });
  const dv = d.divers || {};
  const co = e.caisse || defaultCaisseOpts();
  const pro = prorataOf(d, N), proN1 = prorataOf(d, N - 1), acreOn = !!(e.acre && e.acre.actif);
  const optA = { prorata: pro.k, noCFP: dv.cfp === false, noIJ: isPL ? dv.ijPL === false : dv.ijAC === false, zfu: !!dv.zfu, convPct: co.convPct, pamcPart: co.pamcPart, atexa: (e.msa || {}).atexa };
  if (pro.hors) W.push({ t: 'warn', m: `Dates d'activité (onglet Dossier) hors de l'année ${N} : aucun prorata appliqué — vérifiez les dates.` });
  if (pro.partiel) {
    W.push({ t: 'info', m: `Année incomplète${pro.deb ? ' — début le ' + frDate(pro.deb) : ''}${pro.fin ? ' — cessation le ' + frDate(pro.fin) : ''} : ${pro.jours} jours / ${pro.joursAn} (prorata ${fmt(pro.k * 100, 2)} %). PASS proratisé = ${fmt0(p.pass * pro.k)} € pour les seuils et plafonds Urssaf (maladie, IJ, allocations familiales, retraite de base, RCI tranche 1, invalidité-décès). Non proratisés : cotisation minimale de retraite de base, RCI tranche 2, CFP, bornes de l'abattement de 26 %.` });
    if (umode !== 'ssi') W.push({ t: 'warn', m: `Année incomplète : cotisations ${A.caisse || (umode === 'msa' ? 'MSA' : 'de la caisse')} non proratisées (règles propres à la caisse) — à vérifier.` });
    if (acreOn) W.push({ t: 'warn', m: 'Année incomplète et ACRE : seuils ACRE calculés sur le PASS annuel (prorata non modélisé) — à vérifier.' });
  }
  if (umode === 'msa') W.push({ t: 'warn', m: 'MSA : modèle simplifié (chef d\'exploitation à titre exclusif ou principal) — voir « Points non vérifiés » du millésime.' });

  // ---- Revenus de référence (historique)
  const rN1 = revOf(d, N - 1), rN2 = revOf(d, N - 2), rN3 = revOf(d, N - 3);
  const rv0 = e.courrierRevenus || {}, rvp0 = e.courrierRevenusProv || {};
  const auto1 = rN1 ? { brut: rN1.brut, abatt: rN1.abatt, assiette: rN1.R, assietteCsg: rN1.baseCsg } : {};
  const RV_K = ['brut', 'abatt', 'assiette', 'assietteCsg'];
  const rv = {}, rvp = {};
  RV_K.forEach(k => { rv[k] = filledV(rv0[k]) ? rv0[k] : (auto1[k] !== undefined ? r2(auto1[k]) : ''); });
  RV_K.forEach(k => { rvp[k] = filledV(rvp0[k]) ? rvp0[k] : rv[k]; });
  const rvAuto = { def: auto1, src: rN1 ? rN1.src : '' };

  // ---- Pré-remplissage du courrier
  const autoU = {}, autoC = {}, pre = { deja: false, def: null, prov: null, msgs: [], revSrc: rvAuto.src };
  const setA = (o, k, c, v) => { (o[k] = o[k] || {})[c] = v; };
  const prevExo = d.exercices[N - 1];
  if (prevExo) {
    const rp = compute(d, prevExo);
    if (rp.tot.prov) { LS.urssaf.forEach(L => { if (rp.ap[L.k]) setA(autoU, L.k, 'deja', rp.ap[L.k].prov); }); pre.deja = true; }
    if (rp.tot.cnbf_prov) LS.cnbf.forEach(L => { if (rp.apC[L.k]) setA(autoC, L.k, 'deja', rp.apC[L.k].prov); });
  }
  const fillFrom = (U, col) => LS.urssaf.forEach(L => { if (!['conj', 'autre', 'pamc'].includes(L.k) && U.c[L.k] !== undefined) setA(autoU, L.k, col, U.c[L.k]); });
  const fillC = (Cc, col) => LS.cnbf.forEach(L => { if (Cc && Cc.c[L.k] !== undefined) setA(autoC, L.k, col, Cc.c[L.k]); });
  const optP = Object.assign({ conjoint: !!(e.conjoint && e.conjoint.actif) && umode === 'ssi', pamcPart: 0 }, optA, { pamcPart: 0 });
  const pN1 = e.fige ? e.fige.paramsN1 : store.params[N - 1];
  const refRev = (k, r) => filledV((co.revRef || {})[k]) ? n(co.revRef[k]) : (r ? r.R : undefined);
  const RN1 = refRev('N-1', rN1), RN2 = refRev('N-2', rN2), RN3 = rN3 ? rN3.R : undefined;
  if (filledV(rv.assiette)) {
    if (pN1) {
      fillFrom(calcUrssaf(n(rv.assiette), filledV(rv.assietteCsg) ? n(rv.assietteCsg) : n(rv.assiette), act, pN1, Object.assign({}, optP, { prorata: proN1.k })), 'def'); pre.def = N - 1;
      if (hasCaisse && !isAv) { const o1 = prevExo && prevExo.caisse ? prevExo.caisse : co; fillC(calcCaisse(act, pN1, { N: n(rv.assiette), 'N-1': n(RN2), 'N-2': n(RN3) }, o1), 'def'); }
    }
    else pre.msgs.push(`Définitif ${N - 1} non pré-rempli : millésime de paramètres ${N - 1} absent.`);
  }
  if (filledV(rvp.assiette)) {
    if (fallback) pre.msgs.push(`Provisionnel ${N} non pré-rempli : millésime de paramètres ${N} absent.`);
    else if (p.provAncienRegime) pre.msgs.push(`Provisionnel ${N} non pré-rempli : il a été appelé selon l'ancien régime d'assiette (avant la réforme) — saisissez les montants du courrier.`);
    else {
      fillFrom(calcUrssaf(n(rvp.assiette), filledV(rvp.assietteCsg) ? n(rvp.assietteCsg) : n(rvp.assiette), act, p, optP), 'prov'); pre.prov = N; pre.provSrc = filledV(rvp0.assiette) ? 'prov' : 'def';
      if (hasCaisse && !isAv) fillC(calcCaisse(act, p, { N: n(rvp.assiette), 'N-1': n(RN1 !== undefined ? RN1 : rvp.assiette), 'N-2': n(RN2) }, co), 'prov');
    }
  }
  const ap = readAppel(e.appel, LS.urssaf, e.csgDOverride, p, autoU);
  const apC = readAppel(e.appelCnbf, LS.cnbf, null, p, autoC);
  const sumCol = (Ap, lines, col) => sum(lines.map(L => Ap[L.k][col]));
  const tot = {}; ['def', 'deja', 'regul', 'prov', 'provDeja', 'provAdj'].forEach(c => { tot[c] = r2(sumCol(ap, LS.urssaf, c)); tot['cnbf_' + c] = r2(sumCol(apC, LS.cnbf, c)); });

  // ---- Échéancier / impayés
  const ech = computeEch(e, ap, p, LS.urssaf);

  // ---- Assiette
  const b = { isG };
  const cotisLines = LS.urssaf.filter(L => !['csg', 'autre'].includes(L.k));
  const ij = ijssOf(e, p);
  b.ij = ij;
  const kA = 1 - p.abatt.taux;
  b.smicMens = r2(p.smic_h * p.duree_mens);
  if (isG) {
    const r = e.rem || {};
    b.remVersee = n(r.remVersee); b.remCC = n(r.remCC); b.aen = n(r.aen); b.divid = n(r.divid); b.autres = n(r.autres);
    b.csgNDauto = r2((ap.csgND ? ap.csgND.regul + ap.csgND.prov : 0));
    b.csgDauto = r2((ap.csgD ? ap.csgD.regul + ap.csgD.prov : 0));
    b.cotisAuto = r2(sum(cotisLines.map(L => ap[L.k].regul + ap[L.k].prov)) + sum(LS.cnbf.map(L => apC[L.k].regul + apC[L.k].prov)));
    const useImp = ech.actif && e.ech.integrer;
    b.impND = useImp ? ech.adjND : 0; b.impCotis = useImp ? ech.adjCotis : 0; b.impD = useImp ? ech.adjD : 0;
    b.adjND = n(r.adjND); b.adjCotis = n(r.adjCotis); b.adjD = n(r.adjD);
    b.csgND = b.csgNDauto + b.impND + b.adjND; b.cotis = b.cotisAuto + b.impCotis + b.adjCotis; b.csgD = b.csgDauto + b.impD + b.adjD;
    b.cotisGerant = n(r.cotisGerant);
    /* Madelin / PER payés par la société : détail Madelin / PER (reprise de l'ancienne saisie globale selon e.perType) */
    const MK = ['madMed', 'madRetM', 'madRetP', 'madPrevM', 'madPrevP', 'madChomM', 'madChomP'];
    const legM = MK.every(k => !filledV(r[k])) && (n(r.madRet) || n(r.madPrev) || n(r.madChom));
    const g = k => n(r[k]);
    b.madMed = legM ? 0 : g('madMed');
    b.madRetM = legM ? (e.perType === 'madelin' ? g('madRet') : 0) : g('madRetM');
    b.madRetP = legM ? (e.perType === 'madelin' ? 0 : g('madRet')) : g('madRetP');
    b.madPrevM = legM ? g('madPrev') : g('madPrevM'); b.madPrevP = legM ? 0 : g('madPrevP');
    b.madChomM = legM ? g('madChom') : g('madChomM'); b.madChomP = legM ? 0 : g('madChomP');
    b.madLegacy = !!legM;
    b.madRet = b.madMed + b.madRetM + b.madRetP; b.madPrev = b.madPrevM + b.madPrevP; b.madChom = b.madChomM + b.madChomP;
    b.madRetMad = b.madMed + b.madRetM; b.madRetPer = b.madRetP;
    b.madTot = b.madRet + b.madPrev + b.madChom;
    /* Épargne salariale (ancienne saisie globale « abond » reprise en abondement PEE) */
    const legA = !['abondPEE', 'abondPER', 'interess'].some(k => filledV(r[k])) && n(r.abond);
    b.abondPEE = legA ? n(r.abond) : g('abondPEE'); b.versPEE = g('versPEE'); b.peeUnilat = !!r.peeUnilat;
    b.abondPER = g('abondPER'); b.versPER = g('versPER'); b.interess = g('interess');
    b.abondLegacy = !!legA;
    b.abond = b.abondPEE + b.abondPER + b.interess;
    b.chqVac = g('chqVac'); b.fraisReels = g('fraisReels'); b.fraisParts = g('fraisParts');
    b.remTot = b.remVersee + b.remCC + b.aen;                      // rémunération + AEN (IJ comprises)
    b.cotisEnt = b.cotis - b.cotisGerant + b.csgD + b.csgND;       // cotisations obligatoires payées par la société (hors part réglée par le gérant)
    b.chargesSoc = b.remTot + b.cotisEnt + b.madTot;               // total des charges pour la société
    b.brutSaisi = b.remTot + b.divid + b.autres + b.cotisEnt + b.madTot + b.chqVac + b.abond - b.fraisReels;
  } else {
    const r = e.eiRev || {};
    b.resultat = n(r.resultat); b.cotisDed = n(r.cotisDed); b.csgDed = n(r.csgDed); b.exo = n(r.exo); b.autresReint = n(r.autresReint);
    b.madPrev = n(r.madPrev); b.madChom = n(r.madChom); b.madRet = n(r.madRet); b.abond = 0; b.chqVac = 0; b.fraisReels = 0;
    b.madTot = b.madRet + b.madPrev + b.madChom;
    b.brutSaisi = b.resultat + b.cotisDed + b.csgDed + b.exo + b.autresReint + b.madTot;
  }
  /* Assiette « super brute » : éléments saisis − revenus de remplacement (fiscalisé CPAM, ALD, organisme privé) */
  const isSimBrut = !!(e._sim && e._sim.brut !== undefined);
  b.brut = isSimBrut ? e._sim.brut : b.brutSaisi - ij.fisc - ij.ald - ij.prive;
  b.abattMin = rnd(p.abatt.minPct * P); b.abattMax = rnd(p.abatt.maxPct * P);
  b.abatt = Math.min(Math.max(b.abattMin, b.brut * p.abatt.taux), b.abattMax);
  b.baseCSG = Math.max(b.brut - b.abatt, 0);
  b.chqSeuil = rnd(b.smicMens * p.chqvac.pctSmicMens);
  b.chqExo = b.chqVac - Math.max(0, b.chqVac - b.chqSeuil);
  b.dedAbond = r2(kA * b.abond);
  b.reintFisc = r2(kA * ij.fisc); b.reintPrive = r2(kA * ij.prive);
  b.R = Math.max(0, b.baseCSG - b.chqExo - b.dedAbond + b.reintFisc + b.reintPrive);
  /* CSG-CRDS au taux réduit des revenus de remplacement (non précomptés et ALD), après abattement */
  b.baseCSGred = r2(kA * (ij.reduit + ij.ald));
  b.csgRed = rnd(b.baseCSGred * ij.tx.tot); b.csgRedD = rnd(b.baseCSGred * ij.tx.csgD);
  if (ij.tot) {
    if (ij.legacy) W.push({ t: 'warn', m: 'IJ reprises de l\'ancienne saisie (version antérieure de l\'outil) : vérifiez leur classement dans le nouveau tableau « Dont revenus de remplacement / IJ » et qu\'elles sont bien comprises dans la rémunération / le résultat saisi.' });
    if (ij.reduitSaisi > ij.fisc + 0.005) W.push({ t: 'warn', m: 'Revenu de remplacement « avec CSG à taux réduit » supérieur au revenu de remplacement fiscalisé : limité à ce dernier (il en est une composante).' });
    if (b.csgRed) W.push({ t: 'info', m: `CSG-CRDS au taux réduit (${pc(ij.tx.tot)}) sur revenus de remplacement non précomptés / ALD : ${fmt(b.csgRed)} € (base ${fmt(b.baseCSGred)} après abattement) ajoutés à la ligne CSG / CRDS.` });
    if (umode === 'msa') W.push({ t: 'warn', m: 'Revenus de remplacement en MSA : traitement non vérifié pour le régime agricole.' });
    if ((isAv || hasCaisse) && (ij.fisc || ij.prive)) W.push({ t: 'warn', m: `Revenus de remplacement réintégrés dans la base sociale (R) : leur prise en compte dans l'assiette ${A.caisse || 'de la caisse de retraite'} n'est pas confirmée par la notice 2042-DRI — à vérifier.` });
  }
  if (isG) {
    const P8 = (b.peeUnilat ? 0.16 : 0.08) * P;
    b.plafPEE = r2(Math.min(P8, 3 * b.versPEE)); b.plafPER = r2(Math.min(0.16 * P, 3 * b.versPER));
    if (b.abondPEE && !b.peeUnilat && b.abondPEE > b.plafPEE + 0.005) W.push({ t: 'warn', m: `Abondement PEE / PEI (${fmt(b.abondPEE)}) supérieur au plafond : MIN(8 % PASS = ${fmt0(0.08 * P)} ; 3 × versement du bénéficiaire = ${fmt(3 * b.versPEE)}) = ${fmt(b.plafPEE)}.` });
    if (b.abondPER && b.abondPER > b.plafPER + 0.005) W.push({ t: 'warn', m: `Abondement PERCO / PERECO (${fmt(b.abondPER)}) supérieur au plafond : MIN(16 % PASS = ${fmt0(0.16 * P)} ; 3 × versement du bénéficiaire = ${fmt(3 * b.versPER)}) = ${fmt(b.plafPER)}.` });
    if (b.abondLegacy) W.push({ t: 'info', m: 'Ancienne saisie globale « Abondements / intéressement » reprise en abondement PEE / PEI : ventilez-la si besoin.' });
    if (b.madLegacy) W.push({ t: 'info', m: `Ancienne saisie Madelin / PER reprise (retraite classée en ${e.perType === 'madelin' ? 'Madelin' : 'PER'} selon l'onglet Madelin) : vérifiez la ventilation Madelin / PER.` });
  }

  // ---- Conjoint collaborateur (SSI uniquement)
  const cj = { actif: !!(e.conjoint && e.conjoint.actif) && umode === 'ssi' };
  let Rretraite = b.R;
  if (e.conjoint && e.conjoint.actif && umode !== 'ssi') W.push({ t: 'warn', m: `Conjoint collaborateur (${A.caisse}) : cotisations du conjoint non calculées (règles propres à la caisse) — saisissez-les dans l'appel.` });
  if (cj.actif) {
    const o = e.conjoint.option;
    cj.option = o;
    cj.base = o === 'tiers_pass' ? P / 3 : o === 'tiers_rev' || o === 'partage_tiers' ? b.R / 3 : b.R / 2;
    if (o === 'partage_tiers') Rretraite = b.R * 2 / 3;
    if (o === 'partage_moitie') Rretraite = b.R / 2;
    const B = cj.base;
    cj.c = {
      rb1: rnd(Math.min(B, P) * p.rb.t1), rb2: rnd(Math.max(B - P, 0) * p.rb.t2),
      rc1: rnd(Math.min(B, p.rc.plafT1 * P) * p.rc.t1), rc2: rnd((Math.min(Math.max(B, p.rc.plafT1 * P), p.rc.plafT2 * P) - p.rc.plafT1 * P) * p.rc.t2),
      id: rnd(Math.min(B, P) * p.id.taux)
    };
    cj.total = sum(Object.values(cj.c));
  }

  // ---- Cotisations recalculées
  if (dv.dom) W.push({ t: 'warn', m: 'Domiciliation DOM : les taux et dispositifs spécifiques aux DOM ne sont pas modélisés.' });
  if (optA.zfu) W.push({ t: 'warn', m: 'Exonération ZFU / ZRU : cotisation maladie-maternité mise à 0 ; plafond de revenu et durée de l\'exonération non modélisés (à vérifier).' });
  if (optA.noIJ) W.push({ t: 'info', m: 'Non assujetti aux indemnités journalières : IJ à 0.' });
  if (optA.noCFP) W.push({ t: 'info', m: 'Non assujetti à la CFP : CFP à 0.' });
  if (A.pamc) W.push({ t: 'info', m: 'Praticien conventionné : la participation de l\'Assurance maladie n\'est pas recalculée ; saisissez-la (onglet Appel URSSAF) depuis le courrier.' });
  const Rm = umode === 'msa' && filledV((e.msa || {}).assiette) ? n(e.msa.assiette) : b.R;
  const Rmcsg = umode === 'msa' && filledV((e.msa || {}).assiette) ? n(e.msa.assiette) : b.baseCSG;
  const U = calcUrssaf(Rm, Rmcsg, act, p, Object.assign({ Rretraite: umode === 'msa' ? Rm : Rretraite, conjoint: cj.actif }, optA));
  if (b.csgRed && umode !== 'msa') { U.c.csg += b.csgRed; U.c.csgD += b.csgRedD; U.c.csgND = U.c.csg - U.c.csgD; }
  if (U.cfpWarn) W.push({ t: 'warn', m: 'Taux CFP « avec conjoint collaborateur » non renseigné pour cette activité : taux sans conjoint appliqué.' });
  const calc = clone(U.c); calc.conj = cj.actif ? cj.total : 0; calc.autre = ap.autre ? ap.autre.prov : 0;
  const C = isAv ? calcCnbf(b.R, p, e) : null;
  const revsN = { N: Rretraite, 'N-1': n(RN1), 'N-2': n(RN2) };
  const K = hasCaisse && !isAv ? calcCaisse(act, p, revsN, co, W) : null;
  if (K) { const needs = ((p.caisses || {})[act] || []).map(c => c.ref).filter(x => x === 'N-1' || x === 'N-2'); [...new Set(needs)].forEach(x => { if ((x === 'N-1' ? RN1 : RN2) === undefined) W.push({ t: 'warn', m: `${A.caisse} : revenu ${x === 'N-1' ? N - 1 : N - 2} inconnu (ni exercice, ni historique) — cotisations calculées sur 0. Renseignez-le dans l'onglet Retraite ou l'historique.` }); }); }

  // ---- ACRE
  const acre = { actif: !!(e.acre && e.acre.actif) };
  if (acre.actif) {
    let elig = LS.urssaf.filter(L => L.acre).map(L => L.k);
    if (umode === 'pl') elig = elig.filter(k => ['maladie', 'ij', 'af'].includes(k));
    const R75 = p.acre.seuilBas * P;
    const U75 = calcUrssaf(R75, R75, act, p, Object.assign({}, optA, { prorata: 1 }));
    acre.R = e.acre.base === 'brut' ? b.brut : b.R;
    acre.elig = elig; acre.dueTot = sum(elig.map(k => calc[k])); acre.E = sum(elig.map(k => U75.c[k]));
    acre.seuilBas = R75; acre.seuilHaut = p.acre.seuilHaut * P;
    if (acre.R <= R75) acre.theo = p.acre.taux * acre.dueTot;
    else if (acre.R >= acre.seuilHaut) acre.theo = 0;
    else acre.theo = Math.min(p.acre.taux * acre.dueTot, p.acre.taux * acre.E / ((p.acre.seuilHaut - p.acre.seuilBas) * P) * (acre.seuilHaut - acre.R));
    acre.mois = Math.max(0, Math.min(12, n(e.acre.mois))); acre.exo = rnd(acre.theo * acre.mois / 12);
    acre.parLigne = {}; elig.forEach(k => acre.parLigne[k] = acre.dueTot ? acre.exo * calc[k] / acre.dueTot : 0);
    if (umode === 'pl') W.push({ t: 'warn', m: `ACRE ${A.caisse} : seule la part Urssaf (maladie, IJ, AF) est traitée ; exonération des cotisations de la caisse à voir avec celle-ci.` });
    if (umode === 'msa') W.push({ t: 'warn', m: 'ACRE / exonération jeunes agriculteurs (MSA) : non modélisée.' });
  }
  calc.acre = acre.actif ? -acre.exo : 0;

  // ---- Comparaison avec le provisionnel N
  const courrierDansEx = e.dateCourrier && cmpD(e.dateCourrier, e.debutExercice) >= 0 && cmpD(e.dateCourrier, e.finExercice) <= 0;
  const cnbfDansEx = e.dateCnbf && cmpD(e.dateCnbf, e.debutExercice) >= 0 && cmpD(e.dateCnbf, e.finExercice) <= 0;
  const cmp = []; let totCalc = 0, totProv = 0;
  LS.urssaf.forEach(L => {
    let v = L.k === 'csg' ? calc.csg : (calc[L.k] || 0);
    if (L.k === 'autre') v = ap.autre.prov;
    if (L.k === 'pamc' && !filledV(co.pamcPart)) v = ap.pamc.prov;
    const prv = ap[L.k].prov;
    cmp.push({ k: L.k, l: L.l, acc: L.acc, calc: v, prov: prv, ecart: v - prv, taux: U.tx[L.k], base: U.base[L.k] });
    totCalc += v; totProv += prv;
  });
  if (acre.actif) { cmp.push({ k: 'acre', l: 'Exonération ACRE', acc: 'cotis', calc: calc.acre, prov: 0, ecart: calc.acre }); totCalc += calc.acre; }
  const cmpC = [];
  LS.cnbf.forEach(L => {
    const v = isAv ? C.c[L.k] : (K ? K.c[L.k] || 0 : 0), prv = apC[L.k].prov;
    const dt = K ? K.det[L.k] : null;
    cmpC.push({ k: L.k, l: L.l, acc: 'cnbf', calc: v, prov: prv, ecart: v - prv, ref: L.ref || 'N', det: dt });
    totCalc += v; totProv += prv;
  });
  const totCalcU = sum(cmp.map(c => c.calc)), totProvU = sum(cmp.map(c => c.prov));
  const totCalcC = sum(cmpC.map(c => c.calc)), totProvC = sum(cmpC.map(c => c.prov));

  // ---- Trimestres de retraite de base validés au titre de l'année N
  const trim = { applicable: !isAv && umode !== 'msa' };
  if (trim.applicable) {
    const t = p.trim || { heures: 150, max: 4 };
    trim.heures = t.heures; trim.max = t.max;
    trim.seuil = r2(t.heures * p.smic_h);
    trim.plancher = r2(p.rb.minHeures * p.smic_h);
    trim.revenu = Math.max(Rretraite, 0);
    trim.assiette = Math.max(trim.revenu, trim.plancher);
    trim.minimum = trim.revenu < trim.plancher;
    trim.nb = Math.min(t.max, Math.floor(trim.assiette / trim.seuil + 1e-9));
    if (cj.actif && /partage/.test(cj.option)) trim.note = 'Option de partage : revenu du chef réduit de la part du conjoint.';
  }

  // ---- Madelin
  const m = madelinOf(b, isG, p);

  // ---- Prorata exercice décalé
  const pr = { ok: !!(parseD(e.debutExercice) && parseD(e.finExercice)) };
  if (pr.ok) {
    const a = parseD(e.debutExercice), f = parseD(e.finExercice);
    const startN = a.y < N ? { y: N, m: 1 } : a; pr.moisN = f.y === N ? Math.max(0, monthsSpan(startN, f)) : (f.y > N ? 12 : 0);
    pr.moisApres = f.y === N ? 12 - f.m : 0;
    pr.moisN1 = a.y < N ? Math.max(0, monthsSpan(a, { y: N - 1, m: 12 })) : 0;
    pr.dureeEx = monthsSpan(a, f); pr.moisCloture = f.m;
    if (f.y !== N) W.push({ t: 'warn', m: `La clôture (${frDate(e.finExercice)}) n'est pas en ${N} : l'année N de l'exercice doit être l'année de clôture.` });
    if (pr.dureeEx !== 12) W.push({ t: 'info', m: `Exercice de ${pr.dureeEx} mois.` });
  }
  pr.decale = pr.ok && pr.moisApres > 0;

  // ---- Écritures
  const accs = d.comptes;
  const tresorerie = (d.comptabilite || 'commerciale') === 'tresorerie';
  const mode = tresorerie ? 'charges' : (e.modeReglement === 'charges' ? 'charges' : 'tiers');
  const calcAccU = {}; const addA = (o, k, v) => { if (Math.abs(v) < 0.005) return; o[k] = r2((o[k] || 0) + v); };
  cmp.forEach(c => { if (c.k === 'csg') { addA(calcAccU, 'csgD', U.c.csgD); addA(calcAccU, 'csgND', U.c.csgND); } else addA(calcAccU, c.acc, c.calc); });
  const calcAccC = {}; if (totCalcC) calcAccC.cnbf = r2(totCalcC);
  const provAccU = byAcc(ap, LS.urssaf, 'prov'), provAccC = byAcc(apC, LS.cnbf, 'prov');
  const appAccU = {}; ['regul', 'prov'].forEach(c => Object.entries(byAcc(ap, LS.urssaf, c)).forEach(([k, v]) => addA(appAccU, k, v)));
  const appAccC = {}; ['regul', 'prov'].forEach(c => Object.entries(byAcc(apC, LS.cnbf, c)).forEach(([k, v]) => addA(appAccC, k, v)));
  const cl = e.cloture || {};
  const pay = payments(e, ech, ap, LS, appAccU, appAccC, pr, cl);
  const xx = { mode, tresorerie, pay, calcAccU, calcAccC, provAccU, provAccC, appAccU, appAccC, ap, apC, LS, tot, cmp, cmpC, pr, isAv, accs, prevExo: d.exercices[N - 1], caisseNom: A.caisse, umode };
  const entries = buildEntries(d, e, xx);

  // ---- Charge théorique de l'exercice (contrôle)
  const defN1 = tot.def + tot.cnbf_def;
  pr.chargeTheo = pr.ok ? defN1 * pr.moisN1 / 12 + totCalc * pr.moisN / 12 : 0;

  // ---- Revenu fiscal et cotisations (gérant art. 62)
  const fi = { rows: [] };
  if (isG) {
    const cvImp = Math.max(0, b.chqVac - b.smicMens);
    const madDed = b.madTot - m.reint;
    const R_ = (l, f, s_, note) => fi.rows.push({ l, f, s: s_, note });
    R_('Rémunération versée + compte courant + avantages en nature (IJ comprises)', b.remTot, null);
    R_('Cotisations sociales payées par l\'entreprise (obligatoires + Madelin / PER)', b.cotisEnt + b.madTot, b.cotisEnt + b.madTot);
    if (b.cotisGerant) R_('Cotisations sociales obligatoires payées par le gérant', null, b.cotisGerant, 'Réglées sur la rémunération versée (déjà comprises dans celle-ci)');
    R_('CSG-CRDS non déductible', null, -b.csgND);
    R_('CSG déductible', -b.csgD, -b.csgD);
    R_('Cotisations sociales obligatoires', -b.cotis, null);
    R_('Madelin, PER et facultatives', -madDed, -b.madTot, m.reint ? `Excédent non déductible réintégré : ${fmt(m.reint)}` : '');
    if (b.ij.prelD) R_('CSG déductible précomptée sur revenus de remplacement', -b.ij.prelD, null, `${pc(b.ij.tx.csgD)} × (IJ CPAM précomptées + IJ organisme privé) — IJ saisies pour leur montant brut`);
    fi.tot = sum(fi.rows.map(x => x.f || 0)); fi.totS = sum(fi.rows.map(x => x.s || 0));
    fi.cv = cvImp; fi.ald = -b.ij.ald;
    fi.imposable = fi.tot + fi.cv + fi.ald;
  }
  b.fi = fi;

  // ---- 2042
  const dc = n(e.cloture && e.cloture.declarant) === 2 ? 2 : 1;
  const d42 = { dc, rows: [] };
  const c1AJ = dc === 1 ? '1AJ' : '1BJ';
  if (isG) {
    d42.rows.push({ zone: 'Fiscal – 2042', code: dc === 1 ? '1GB' : '1HB', lib: 'Rémunérations des gérants et associés (art. 62 CGI) – montant net imposable', v: fi.imposable, det: 'Rémunération + CC + AEN (IJ comprises) + CSG/CRDS non déductible + excédent Madelin non déductible' + (b.ij.prelD ? ' − CSG déductible précomptée sur IJ' : '') + (fi.cv ? ' + chèques vacances > 1 SMIC mensuel' : '') + (b.ij.ald ? ' − IJ ALD exonérées' : '') + ' (onglet Rémunération, « Calcul du revenu fiscal »)' });
    d42.rows.push({ zone: 'Volet social', code: dc === 1 ? 'DSEC' : 'DSED', lib: 'Société à l\'IS : rémunérations brutes (y compris charges sociales prises en charge)', v: b.remTot + b.autres + b.cotisEnt + b.madTot - b.ij.tot, det: 'Rémunération + CC + AEN + autres + cotisations obligatoires + CSG/CRDS + Madelin' + (b.ij.tot ? ' − revenus de remplacement (IJ CPAM, IJ Madelin, ALD : à ne pas déclarer en DSEC/DSED, notice 2042-DRI § 6.3)' : '') });
    if (b.fraisReels) d42.rows.push({ zone: 'Volet social', code: dc === 1 ? 'DSSC' : 'DSSD', lib: 'Société à l\'IS : frais professionnels réels', v: b.fraisReels, det: b.fraisParts ? `dont frais d'acquisition de parts sociales : ${fmt(b.fraisParts)}` : undefined });
    d42.rows.push({ zone: 'Volet social', code: dc === 1 ? 'DSEM' : 'DSEN', lib: 'Intéressement, participation, abondements (PEE, PER…)', v: b.abond, det: `PEE/PEI ${fmt(b.abondPEE)} + PERCO/PERECO ${fmt(b.abondPER)} + intéressement ${fmt(b.interess)}` });
    d42.rows.push({ zone: 'Volet social', code: dc === 1 ? 'DSAA' : 'DSAB', lib: 'Dividendes et intérêts de CCA > 10 % (capital social, primes d\'émission, CCA)', v: b.divid });
    d42.rows.push({ zone: 'Volet social', code: dc === 1 ? 'DSCN' : 'DSDN', lib: 'Chèques vacances (montant total, sans abattement)', v: b.chqVac });
  } else {
    const rg = REGIMES[e.regime] || 'BIC/BNC';
    const ir = e.statut === 'gerant_ir';
    d42.rows.push({ zone: e.regime === 'ba' ? 'Fiscal – 2042-C-PRO (BA)' : 'Fiscal – 2042-C-PRO', code: '—', lib: `Résultat fiscal ${rg}${ir ? ' (quote-part du gérant associé)' : ''} (case selon régime) – réintégration Madelin excédentaire à vérifier`, v: b.resultat + m.reint - b.ij.ald, det: 'Résultat fiscal saisi + excédent Madelin non déductible (si déduit à tort)' + (b.ij.ald ? ' − IJ ALD exonérées comprises dans le résultat (déduction extra-comptable)' : '') });
    const lib = ir ? 'Gérant majoritaire de société à l\'IR : revenu brut social' : 'Entreprise individuelle à l\'IR : revenu brut social';
    const detIJ = b.ij.tot ? 'Revenu brut social hors revenus de remplacement compris dans le résultat (assiette « super brute ») — traitement déclaratif à vérifier' : undefined;
    if (b.brut >= 0) d42.rows.push({ zone: 'Volet social', code: dc === 1 ? 'DSDE' : 'DSDF', lib: lib + ' positif' + (ir ? ' (case à vérifier)' : ''), v: b.brut, det: detIJ });
    else d42.rows.push({ zone: 'Volet social', code: dc === 1 ? 'DSDG' : 'DSDH', lib: lib + ' négatif' + (ir ? ' (case à vérifier)' : ''), v: -b.brut, det: detIJ });
  }
  if (b.ij.prive) d42.rows.push({ zone: 'Volet social', code: dc === 1 ? 'DSCZ' : 'DSDZ', lib: 'Revenus de remplacement : IJ versées dans le cadre d\'un contrat Madelin (hors ALD), montant brut', v: b.ij.prive, det: 'Notice 2042-DRI § 6.5 : ajoutés à la base de calcul des cotisations sociales' });
  /* IJ CPAM comprises dans le revenu professionnel : pré-remplissage 1AJ/1BJ à retirer */
  if (b.ij.fisc) d42.rows.push({ zone: 'Fiscal – 2042 (contrôle)', code: c1AJ + ' (à retirer)', lib: `IJ CPAM comprises ${isG ? 'dans la rémunération art. 62 (1GB/1HB)' : 'dans le résultat BIC/BNC'} : à retirer du montant pré-rempli (double imposition)`, v: b.ij.pre1AJ, det: `Estimation : IJ précomptées ${fmt(b.ij.precompte)} × (1 − ${pc(b.ij.tx.csgD)}) + IJ non précomptées ${fmt(b.ij.reduit)} — à rapprocher du montant pré-rempli` });
  /* Épargne retraite TNS (art. 154 bis) : part déduite du revenu professionnel, hors fraction des 15 % — ventilation Madelin / PER */
  const split = isG && !b.madLegacy && (b.madRetMad || b.madRetPer);
  const perQS = e.perType === 'madelin';
  d42.per = { type: perQS ? 'madelin' : 'per', ded: m.dedRet, part15: m.part15, v: m.perDecl };
  const rowQS = v => ({ zone: 'Fiscal – 2042 (épargne retraite)', code: dc === 1 ? '6QS' : '6QT', lib: 'Cotisations versées sur un contrat Madelin retraite, déduites du revenu professionnel (hors fraction de 15 %)', v, det: 'Madelin retraite déduit (versé − excédent réintégré) − 15 % du revenu compris entre 1 et 8 PASS' + (split ? ' — ventilé au prorata Madelin / PER' : ''), per: true });
  const rowOS = v => ({ zone: 'Fiscal – 2042 (épargne retraite)', code: dc === 1 ? '6OS' : '6OT', lib: 'Versements sur un PER individuel déduits du revenu professionnel (art. 154 bis CGI), hors fraction de 15 %', v, det: 'PER retraite déduit (versé − excédent réintégré) − 15 % du revenu compris entre 1 et 8 PASS' + (split ? ' — ventilé au prorata Madelin / PER' : ''), per: true });
  if (split) {
    const q = b.madRetMad / (b.madRetMad + b.madRetPer);
    if (b.madRetPer) d42.rows.push(rowOS(r2(m.perDecl * (1 - q))));
    if (b.madRetMad) d42.rows.push(rowQS(r2(m.perDecl * q)));
  } else d42.rows.push(perQS ? rowQS(m.perDecl) : rowOS(m.perDecl));
  if (isG && b.abondPER) d42.rows.push({ zone: 'Fiscal – 2042 (épargne retraite)', code: dc === 1 ? '6QS' : '6QT', lib: 'Abondement de l\'entreprise sur un PERCO / PERECO', v: b.abondPER, det: 'Abondements PERCO / PERECO saisis (diminuent le plafond épargne retraite) — à vérifier sur le relevé du gestionnaire', per: true });
  return { pro, pre, rv, rvp, rvAuto, RN1, RN2, rN1, rN2, revsN, K, pay, mode, tresorerie, trim, p, pYear, fallback, W, ap, apC, tot, LS, ech, b, U, calc, C, cj, acre, cmp, cmpC, totCalc, totProv, totCalcU, totProvU, totCalcC, totProvC, m, pr, entries, courrierDansEx, cnbfDansEx, d42, calcAccU, calcAccC };
}

const HISTO_ROWS = [
  { k: 'revSocial', l: 'Revenu social (revenu brut)', auto: true },
  { k: 'baseSociale', l: 'Base sociale (après abattement)', auto: true },
  { k: 'baseCsg', l: 'Base CSG / CRDS', auto: true },
  { k: 'remplacement', l: 'Dont revenu de remplacement / IJ – revenu de remplacement fiscalisé', ind: 1, auto: true },
  { k: 'remplReduit', l: 'dont revenu de remplacement avec CSG à taux réduit', ind: 2, auto: true },
  { k: 'divid', l: 'Dont revenus distribués > 10 % du capital social', auto: true, ind: 1 },
  { k: 'ijAld', l: 'IJ ALD', auto: true },
  { k: 'cotisDed', l: 'Cotisations déduites', auto: true },
  { k: 'trimAnnee', l: 'Trimestres validés dans l\'année (150 × SMIC horaire au 01/01)', auto: true, int: true },
  { k: 'trimestres', l: 'Cumul nb de trimestres validés retraite de base exploitant', auto: true, int: true }
];
function histoAuto(d, y) {
  const e = yearView(d, y); if (!e) return null;
  let r; try { r = compute(d, e); } catch (err) { return null; }
  const b = r.b;
  return { remplacement: b.ij ? b.ij.fisc + b.ij.prive : undefined, remplReduit: b.ij ? b.ij.reduit : undefined, ijAld: b.ij ? b.ij.ald : undefined, trimAnnee: r.trim && r.trim.applicable ? r.trim.nb : undefined, revSocial: b.brut, baseSociale: b.R, baseCsg: b.baseCSG, divid: b.isG ? b.divid : 0, cotisDed: b.isG ? b.cotis + b.csgD : b.cotisDed + b.csgDed };
}

/* Cumul des trimestres : valeur saisie de l'année, sinon cumul N-1 (saisi ou calculé) + trimestres de N */
function histoCumul(d, y, depth = 0) {
  const h = (d.histo || {})[y] || {};
  if (h.trimestres !== undefined && h.trimestres !== '') return { v: n(h.trimestres), src: 'saisi' };
  if (depth > 80) return null;
  let add = (h.trimAnnee !== undefined && h.trimAnnee !== '') ? n(h.trimAnnee) : undefined;
  if (add === undefined) { const a = histoAuto(d, y); if (a && a.trimAnnee !== undefined) add = a.trimAnnee; }
  if (add === undefined) return null;
  const prev = histoCumul(d, y - 1, depth + 1);
  if (!prev || prev.v === null) return { v: null, add };
  return { v: prev.v + add, src: 'calc', add, prev: prev.v };
}

/* Règlements de l'exercice (mode « paiements en charges ») et échéances restant dues après la clôture */
function payments(e, ech, ap, LS, appAccU, appAccC, pr, cl) {
  const pay = {};
  const appTotU = sum(Object.values(appAccU)), appTotC = sum(Object.values(appAccC));
  pay.appTotU = appTotU; pay.appTotC = appTotC;
  pay.defautU = ech.actif ? ech.Etot : appTotU; pay.srcDefaut = ech.actif ? 'échéancier (versements)' : 'montant appelé (régul. + provisionnel)';
  pay.saisiU = filledV(cl.paiementsCharges); pay.totU = pay.saisiU ? n(cl.paiementsCharges) : pay.defautU;
  /* Quote-parts : imputation légale de l'échéancier si renseigné, sinon prorata de l'appel */
  let shares = null;
  if (ech.actif && ech.Jtot > 0) {
    const rg = ech.regleNat; const totR = sum(Object.values(rg));
    if (totR > 0) {
      shares = { csgD: ech.regleCsgD / totR, csgND: ech.regleCsgND / totR, cfp: rg.cfp / totR, autre: rg.autre / totR };
      shares.cotis = 1 - shares.csgD - shares.csgND - shares.cfp - shares.autre;
      pay.srcQP = 'imputation légale des versements (échéancier)';
    }
  }
  if (!shares && appTotU) { shares = {}; Object.entries(appAccU).forEach(([k, v]) => shares[k] = v / appTotU); pay.srcQP = 'prorata de l\'appel (régul. + provisionnel)'; }
  pay.accU = {};
  if (shares) Object.entries(shares).forEach(([k, v]) => { const a = r2(pay.totU * v); if (Math.abs(a) >= 0.005) pay.accU[k] = a; });
  else if (pay.totU) pay.accU.cotis = pay.totU;
  const dU = r2(pay.totU - sum(Object.values(pay.accU))); if (Math.abs(dU) >= 0.005) pay.accU.cotis = r2((pay.accU.cotis || 0) + dU);
  pay.defautC = appTotC; pay.totC = filledV(cl.paiementsCnbf) ? n(cl.paiementsCnbf) : pay.defautC;
  /* Échéances de l'année N restant dues entre la clôture et le 31/12 (exercice décalé) */
  pay.resteU = 0; pay.resteC = 0; pay.srcReste = '';
  if (pr.decale) {
    if (filledV(cl.resteU)) { pay.resteU = n(cl.resteU); pay.srcReste = 'saisi'; }
    else if (ech.actif) { const per = echMonths(e); pay.resteU = r2(sum((e.ech.rows || []).map((r, i) => (per.includes(i) && i >= pr.moisCloture) ? n(r.appele) : 0))); pay.srcReste = `échéancier (échéances de ${MOIS[pr.moisCloture] || ''} à décembre)`; }
    else { pay.resteU = r2(appTotU * pr.moisApres / 12); pay.srcReste = `estimation : appel × ${pr.moisApres}/12 (échéances mensuelles égales)`; }
    pay.resteC = filledV(cl.resteC) ? n(cl.resteC) : r2(appTotC * pr.moisApres / 12);
  }
  const split = (tot, accs, totA) => { const o = {}; if (!tot) return o; if (!totA) { o.cotis = tot; return o; } Object.entries(accs).forEach(([k, v]) => { const a = r2(tot * v / totA); if (Math.abs(a) >= 0.005) o[k] = a; }); const dd = r2(tot - sum(Object.values(o))); if (Math.abs(dd) >= 0.005) { const k0 = Object.keys(o)[0] || 'cotis'; o[k0] = r2((o[k0] || 0) + dd); } return o; };
  pay.resteAccU = split(pay.resteU, appAccU, appTotU);
  pay.resteAccC = pay.resteC ? { cnbf: pay.resteC } : {};
  return pay;
}
