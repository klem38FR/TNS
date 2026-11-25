'use strict';
/* Écritures comptables (format Pennylane) */

/* ------------------------------------------------------------------ */
/* 6. ÉCRITURES (format Pennylane)                                     */
/* ------------------------------------------------------------------ */
function buildEntries(d, e, x) {
  const { ap, apC, LS, pr, accs } = x;
  const N = e.annee, nomP = `${d.prenom || ''} ${d.nom || ''}`.trim();
  const J = d.journal || 'OD', pref = d.prefixe || 'SSI', cN = x.caisseNom;
  const orgU = x.umode === 'msa' ? 'MSA' : 'Urssaf';
  const out = [];
  const mk = (id, titre, date, piece, libPiece, lines, tiersKey, libT, opt = {}) => {
    const rows = []; let s = 0;
    lines.forEach(l => { if (Math.abs(l.v) < 0.005) return; const a = accs[l.acc] || { n: l.acc, l: '' }; rows.push({ date, journal: J, compte: a.n, libCompte: a.l, libLigne: l.lib, libPiece, piece, v: r2(l.v) }); s += r2(l.v); });
    if (tiersKey && Math.abs(s) >= 0.005) { const t = accs[tiersKey]; rows.push({ date, journal: J, compte: t.n, libCompte: t.l, libLigne: libT, libPiece, piece, v: r2(-s) }); }
    const bal = r2(rows.reduce((a, r) => a + r.v, 0));
    if (!rows.length) return null;
    const en = { id, titre, date, rows, bal, groupe: opt.groupe || 'appel' }; out.push(en);
    if (opt.extourne) {
      const dx = addDays(e.finExercice, 1);
      out.push({ id: id + 'X', titre: `Extourne au ${frDate(dx)} (ouverture de l'exercice suivant) — ${titre}`, date: dx, groupe: opt.groupe, extourne: true,
        rows: rows.map(r => Object.assign({}, r, { date: dx, piece: r.piece + '-EXT', libPiece: 'Extourne ' + r.libPiece, libLigne: 'Extourne ' + r.libLigne, v: r2(-r.v) })), bal: -bal });
    }
    return en;
  };
  const fromAcc = (obj, lib, sign = 1) => Object.entries(obj).map(([acc, v]) => ({ acc, v: sign * v, lib }));
  const capPar = (s, lib) => Math.abs(s) < 0.005 ? [] : [{ acc: s >= 0 ? 'cap' : 'par', v: -s, lib }];

  // 1. Appels (mode dette / créance)
  if (x.mode === 'tiers' && e.dateCourrier) {
    const reg = byAcc(ap, LS.urssaf, 'regul'), prv = byAcc(ap, LS.urssaf, 'prov');
    mk('appel', `Appel ${orgU} ${N} (régularisation ${N - 1} et provisionnel ${N}) — en date du document`, e.dateCourrier, pref, `${pref} Appel ${N} et Regul ${N - 1} ${nomP}`,
      [...fromAcc(reg, `Regularisation ${N - 1}`), ...fromAcc(prv, `Provisionnelles ${N}`)], 'tiers', `${orgU} appel ${N} / regul ${N - 1}`);
  }
  if (x.mode === 'tiers' && LS.cnbf.length && e.dateCnbf) {
    const reg = byAcc(apC, LS.cnbf, 'regul'), prv = byAcc(apC, LS.cnbf, 'prov');
    mk('appelCnbf', `Appel ${cN} ${N} (régularisation ${N - 1} et provisionnel ${N}) — en date du document`, e.dateCnbf, cN, `${cN} Appel ${N} et Regul ${N - 1} ${nomP}`,
      [...fromAcc(reg, `${cN} regularisation ${N - 1}`), ...fromAcc(prv, `${cN} provisionnelles ${N}`)], 'cnbfTiers', `${cN} appel ${N}`);
  }
  // 1 bis. Paiements comptabilisés en charges : reclassement des quotes-parts payées
  if (x.mode === 'charges') {
    const lines = Object.entries(x.pay.accU).filter(([k]) => k !== 'cotis').map(([k, v]) => ({ acc: k, v, lib: `Reclassement reglements ${orgU} ${N}` }));
    const s = sum(lines.map(l => l.v)); if (Math.abs(s) >= 0.005) lines.push({ acc: 'cotis', v: -s, lib: `Reclassement reglements ${orgU} ${N}` });
    mk('reclass', `Reclassement des règlements ${orgU} de l'exercice (${fmt(x.pay.totU)} comptabilisés en « ${accs.cotis.n} ») selon les quotes-parts payées (${x.pay.srcQP || '—'})`, e.finExercice, pref + '-RCL', `${pref} Reclassement reglements ${N} ${nomP}`, lines, null);
  }
  // 2. Reprise manuelle (exercice précédent absent de l'outil)
  const cl = e.cloture || {};
  if (!x.prevExo && (n(cl.repriseManuelleCca) || n(cl.repriseManuelleProv))) {
    const lines = [];
    if (n(cl.repriseManuelleCca)) { lines.push({ acc: 'cotis', v: n(cl.repriseManuelleCca), lib: `Reprise CCA ${N - 1}` }, { acc: 'cca', v: -n(cl.repriseManuelleCca), lib: `Reprise CCA ${N - 1}` }); }
    const v = n(cl.repriseManuelleProv);
    if (v) lines.push({ acc: 'cotis', v: -v, lib: `Reprise provision regul ${N - 1}` }, { acc: v >= 0 ? 'cap' : 'par', v, lib: `Reprise provision regul ${N - 1}` });
    mk('reprise', `Reprises à l'ouverture (saisie manuelle des écritures de clôture ${N - 1})`, e.debutExercice, pref + '-REP', `${pref} Reprises cloture ${N - 1} ${nomP}`, lines, null, '', { groupe: 'cloture' });
  }
  if (!pr.ok || x.tresorerie) return out;     // comptabilité recettes-dépenses : pas de provision ni de CCA

  // 3. Régularisation attendue à l'année civile N (définitif recalculé − provisionnel), sans prorata
  {
    const dU = {}, dC = {};
    new Set([...Object.keys(x.calcAccU), ...Object.keys(x.provAccU)]).forEach(k => { const v = r2((x.calcAccU[k] || 0) - (x.provAccU[k] || 0)); if (Math.abs(v) >= 0.005) dU[k] = v; });
    new Set([...Object.keys(x.calcAccC), ...Object.keys(x.provAccC)]).forEach(k => { const v = r2((x.calcAccC[k] || 0) - (x.provAccC[k] || 0)); if (Math.abs(v) >= 0.005) dC[k] = v; });
    const lib = `Regul ${N} attendue`;
    const lines = [...fromAcc(dU, `${lib} ${orgU}`), ...capPar(sum(Object.values(dU)), `${lib} ${orgU}`), ...fromAcc(dC, `${lib} ${cN}`), ...capPar(sum(Object.values(dC)), `${lib} ${cN}`)];
    mk('prov', `Régularisation ${N} attendue (définitif ${N} recalculé − provisionnel ${N}), année civile entière — en date de clôture`, e.finExercice, pref + '-REG', `${pref} Regul attendue ${N} ${nomP}`, lines, null, '', { extourne: true, groupe: 'cloture' });
  }
  // 4. Exercice décalé : CCA des cotisations de l'année N × x/12 (x = mois entre la clôture et le 31/12)
  if (pr.decale) {
    const k = pr.moisApres / 12, lib = `CCA cotisations ${N} (${pr.moisApres}/12)`;
    const ccaU = {}, ccaC = {};
    Object.entries(x.calcAccU).forEach(([a, v]) => { const w = r2(v * k); if (Math.abs(w) >= 0.005) ccaU[a] = w; });
    Object.entries(x.calcAccC).forEach(([a, v]) => { const w = r2(v * k); if (Math.abs(w) >= 0.005) ccaC[a] = w; });
    const totCca = r2(sum(Object.values(ccaU)) + sum(Object.values(ccaC)));
    if (x.mode === 'tiers') {
      const lines = [...fromAcc(ccaU, lib, -1), ...fromAcc(ccaC, lib, -1), { acc: 'cca', v: totCca, lib }];
      mk('cca', `Charges constatées d'avance : cotisations ${N} (provisionnel + régularisation) × ${pr.moisApres}/12 — en date de clôture`, e.finExercice, pref + '-CCA', `${pref} CCA ${N} ${nomP}`, lines, null, '', { extourne: true, groupe: 'cloture' });
    } else {
      const libP = `Echeances ${N} restant dues apres cloture`;
      const restT = r2(sum(Object.values(x.pay.resteAccU)) + sum(Object.values(x.pay.resteAccC)));
      const lines = [...fromAcc(x.pay.resteAccU, libP), ...fromAcc(x.pay.resteAccC, libP), ...(Math.abs(restT) >= 0.005 ? [{ acc: 'cap', v: -restT, lib: libP }] : []),
        ...fromAcc(ccaU, lib, -1), ...fromAcc(ccaC, lib, -1), { acc: 'cca', v: totCca, lib }];
      mk('cca', `Exercice décalé : provision des échéances ${N} restant dues après la clôture (${fmt(restT)}) − CCA des cotisations ${N} × ${pr.moisApres}/12 (${fmt(totCca)}) — en date de clôture`, e.finExercice, pref + '-CCA', `${pref} Provision echeances et CCA ${N} ${nomP}`, lines, null, '', { extourne: true, groupe: 'cloture' });
    }
  }
  return out;
}
