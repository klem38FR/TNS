'use strict';
/* Onglet Retraite – caisse (+ trimestres) */

/* ---------- Retraite – caisse ---------- */
function tabCaisse(d, e, r) {
  const A = actDef(e.activite), N = e.annee, p = r.p;
  if (A.mode !== 'pl') {
    const keys = A.mode === 'msa' ? ['avi', 'avaP', 'avaD', 'rco', 'inval'] : ['rb1', 'rb2', 'rc1', 'rc2', 'id', 'conj'];
    const rows = r.cmp.filter(c => keys.includes(c.k));
    return `<div class="card"><h2>Retraite – ${esc(A.caisse)} ${milBadge(r.pYear)}</h2>
      <div class="alert info">${A.mode === 'msa' ? 'Les cotisations de retraite et d\'invalidité sont appelées par la MSA avec les autres cotisations (onglet « Appel MSA »).' : A.mode === 'cipav' ? 'Les cotisations de retraite de base (CNAVPL), complémentaire et d\'invalidité-décès Cipav sont appelées par l\'Urssaf (onglet « Appel URSSAF »).' : 'Pour les artisans et commerçants, la retraite de base, la retraite complémentaire (RCI) et l\'invalidité-décès sont incluses dans l\'appel URSSAF (onglet « Appel URSSAF / SSI »).'}</div>
      <div class="scroll"><table><tr><th>Cotisation</th><th class="n">Assiette</th><th class="n">Taux</th><th class="n">Calculé ${N}</th><th class="n">Provisionnel ${N}</th><th class="n">Écart</th></tr>
      ${rows.map(c => `<tr><td>${esc(c.l)}</td><td class="n">${c.base !== undefined && c.base !== null ? fmt0(c.base) : ''}</td><td class="n">${c.taux !== undefined && c.taux !== null ? pc(c.taux) : ''}</td>${money(c.calc)}${money(c.prov)}${money(c.ecart, sgnCls(c.ecart))}</tr>`).join('')}
      <tr class="tot"><td colspan="3">Total retraite et invalidité</td>${money(sum(rows.map(c => c.calc)))}${money(sum(rows.map(c => c.prov)))}${money(sum(rows.map(c => c.ecart)))}</tr></table></div></div>` + trimCard(d, e, r);
  }
  const co = e.caisse || {}, comps = (p.caisses || {})[e.activite] || [];
  const ph = (k, v) => `placeholder="${v !== undefined ? fmt0(v) : 'inconnu'}"`;
  let opts = '';
  if (e.activite === 'cnbf') {
    opts = `<div class="grid">
      ${fld('Année d\'exercice au 1er janvier (1 à 6 et plus)', inp('e.cnbf.anciennete', e.cnbf.anciennete, 'num', 'int'))}
      ${fld('Avocat de 65 ans et plus', chk('e.cnbf.age65', e.cnbf.age65, 'Oui'))}
      ${fld('Retraité actif au 1er janvier', chk('e.cnbf.retraiteActif', e.cnbf.retraiteActif, 'Oui'))}
      ${fld('Année d\'inscription à la CNBF', inp('e.cnbf.anneeInscription', e.cnbf.anneeInscription, 'num', 'int'), `Inscription en ${N - 1} ou ${N} ⇒ assiettes forfaitaires de début d'activité.`)}
      ${fld('Droits de plaidoirie déjà versés dans l\'année (€)', inp('e.cnbf.droitsVerses', e.cnbf.droitsVerses))}
      ${fld('Classe de retraite complémentaire', sel('e.cnbf.classe', e.cnbf.classe, { C1: 'C1', C2: 'C2', 'C2+': 'C2+' }))}
    </div>`;
  } else {
    const f = [];
    const refs = new Set(comps.map(c => c.ref));
    if (refs.has('N-1')) f.push(fld(`Revenu ${N - 1} de référence (€)`, inp('e.caisse.revRef.N-1', (co.revRef || {})['N-1'], 'num', 'num', ph('', r.rN1 ? r.rN1.R : undefined)), r.rN1 ? `Repris : ${esc(r.rN1.src)} (assiette sociale).` : 'Aucun exercice ni historique : à saisir.'));
    if (refs.has('N-2')) f.push(fld(`Revenu ${N - 2} de référence (€)`, inp('e.caisse.revRef.N-2', (co.revRef || {})['N-2'], 'num', 'num', ph('', r.rN2 ? r.rN2.R : undefined)), r.rN2 ? `Repris : ${esc(r.rN2.src)} (assiette sociale).` : 'Aucun exercice ni historique : à saisir.'));
    if (comps.some(c => c.conv) && !A.pamc) f.push(fld('Part des revenus conventionnés (%)', inp('e.caisse.convPct', co.convPct, 'num', 'num', 'placeholder="100"')));
    if (comps.some(c => c.conv) && A.pamc) f.push(fld('Part des revenus conventionnés (%)', inp('e.caisse.convPct', co.convPct, 'num', 'num', 'placeholder="100"'), 'Commune avec l\'onglet Appel URSSAF.'));
    comps.forEach(c => {
      if (c.secteur) f.push(fld('Secteur conventionnel', sel('e.caisse.secteur', co.secteur || 's1', { s1: 'Secteur 1', s2: 'Secteur 2 / non conventionné' })));
      if (c.t === 'classes') {
        const list = [...(co.allegement && c.allegement ? c.allegement : []), ...(c.classes || [])];
        f.push(fld(`${esc(c.l)} : classe`, sel(`e.caisse.classe.${c.k}`, (co.classe || {})[c.k] || '', Object.assign({ '': 'Selon le revenu (automatique)' }, Object.fromEntries(list.map(x => [x[0], `Classe ${x[0]} – ${fmt(x[2])} €`]))))));
        if (c.allegement) f.push(fld('Classes d\'allègement', chk('e.caisse.allegement', co.allegement, 'Demandées (selon conditions de la caisse)')));
      }
      if (c.t === 'choix') f.push(fld(`${esc(c.l)}`, sel(`e.caisse.choix.${c.k}`, (co.choix || {})[c.k] || c.defaut, Object.fromEntries(Object.entries(c.choix).map(([k, v]) => [k, `${v[0]} – ${fmt(v[1])} €`])))));
      if (c.t === 'multiple') f.push(fld(`${esc(c.l)} : classe`, sel(`e.caisse.classe.${c.k}`, (co.classe || {})[c.k] || c.defaut, Object.fromEntries(Array.from({ length: c.max || 8 }, (_, i) => [i + 1, `Classe ${i + 1}${c.unite ? ' – ' + fmt((i + 1) * c.unite) + ' €' : ''}`]))), 'Montant de la classe 1 et coefficients à vérifier (voir paramètres).'));
      if (c.ref === 'produits') f.push(fld('Moyenne triennale des produits de l\'office (€)', inp('e.caisse.produits', co.produits)));
      if (c.ref === 'commissions') f.push(fld(`Commissions et rémunérations brutes ${N - 1} (€)`, inp('e.caisse.commissions', co.commissions)));
    });
    opts = `<div class="grid">${f.join('')}</div><p class="note">Revenu ${N} (régularisable, retraite de base CNAVPL) : assiette sociale de l'onglet Rémunération (${fmt0(r.revsN.N)} €). Les composants calculés sur un revenu antérieur ne sont pas régularisés : l'écart avec le provisionnel signale un appel à vérifier.</p>`;
  }
  const rows = r.cmpC.map(c => {
    const dt = c.det || {};
    let det = '';
    if (dt.classe !== undefined) det = `classe ${esc(dt.classe)}${dt.forced ? ' (forcée)' : ''}`;
    else if (dt.taux !== undefined && dt.base !== undefined) det = `${dt.forfait ? fmt(dt.forfait) + ' € + ' : ''}${pc(dt.taux, 4)} × ${fmt0(dt.base)}`;
    else if (c.k === 'rb1' || c.k === 'rb2') { const x = r.K && r.K.det[c.k]; if (x) det = `${pc(x.taux)} × ${fmt0(x.base)}${x.min ? ' (minimum ' + fmt0(x.min) + ' €)' : ''}`; }
    return `<tr><td>${esc(c.l)}${dt.missing ? ' <span class="badge err">barème manquant</span>' : ''}</td><td>${refBadge(c.ref, N)}</td><td class="note">${det}</td>${money(c.calc)}${money(c.prov)}${money(c.ecart, sgnCls(c.ecart))}</tr>`;
  }).join('');
  let cnbfDet = '';
  if (e.activite === 'cnbf' && r.C) {
    const C = r.C;
    cnbfDet = `<p class="note">Ancienneté retenue : ${C.det.anc}${C.det.debut ? ' — début d\'activité : assiettes forfaitaires' : ''} ; nombre théorique de droits de plaidoirie : ${C.det.nbDroits} (arrondi à l'entier : NON VÉRIFIÉ) ; mémo invalidité-décès recouvrée auprès du Barreau : ${fmt0(C.det.barreau)} € (non due par l'avocat).</p>
      <table><tr><th>Tranche RC (classe ${esc(C.det.classe)})</th><th class="n">Taux</th><th class="n">Assiette</th><th class="n">Cotisation</th></tr>
      ${C.det.tranches.map(t => `<tr><td>${fmt0(t.de)} à ${fmt0(t.a)} €</td><td class="n">${fmt(t.taux, 1)} %</td>${money(t.assiette)}${money(t.cot)}</tr>`).join('')}</table>`;
  }
  const en = r.entries.filter(x => x.id === 'appelCnbf');
  return `<div class="card"><h2>Situation ${esc(A.caisse)} ${e.annee} ${milBadge(r.pYear)}</h2>${opts}</div>
  <div class="card"><h2>Appel ${esc(A.caisse)} (régularisation ${N - 1} et provisionnel ${N})</h2>
    <div class="grid">${fld(`Date de l'appel ${esc(A.caisse)} (date de l'écriture)`, dateI('e.dateCnbf', e.dateCnbf))}</div>
    ${appelTable('e.appelCnbf', r.LS.cnbf, r.apC, e.appelCnbf, r, true)}
    <p class="note">${e.activite === 'cnbf' ? 'La CNBF appelle ses cotisations une fois par an (début avril) : provisoirement sur le revenu de l\'avant-dernière année, ajustées puis régularisées l\'année suivante.' : 'Cases bleues : montants estimés avec le barème du millésime (définitif ' + (N - 1) + ' sur les revenus ' + (N - 1) + ', provisionnel ' + N + ' sur les revenus connus). Saisissez les montants de l\'appel de la caisse : ils prévalent.'}</p>
    ${en.length ? en.map(x => `<h3>${esc(x.titre)}</h3>${entryTable(x)}`).join('') : (r.mode === 'tiers' ? '<p class="note">Renseignez la date de l\'appel pour générer l\'écriture.</p>' : '')}
  </div>
  ${docCard(e, 'caisse', `Document archivé — appel ${A.caisse} ${N}`)}
  <div class="card"><h2>Cotisations ${esc(A.caisse)} ${N} recalculées ${milBadge(r.pYear)}</h2>
    <div class="scroll"><table><tr><th>Cotisation</th><th>Revenu</th><th>Calcul</th><th class="n">Calculé ${N}</th><th class="n">Provisionnel ${N}</th><th class="n">Écart (régul.)</th></tr>${rows}
    <tr class="tot"><td colspan="3">Total ${esc(A.caisse)}</td>${money(r.totCalcC)}${money(r.totProvC)}${money(r.totCalcC - r.totProvC, sgnCls(r.totCalcC - r.totProvC))}</tr></table></div>
    ${cnbfDet}
  </div>` + trimCard(d, e, r);
}
function trimCard(d, e, r) {
  if (!(r.trim && r.trim.applicable)) return '';
  const t = r.trim, c = histoCumul(d, e.annee), p = r.p;
  return `<div class="card"><h2>Trimestres de retraite de base validés au titre de ${e.annee} ${milBadge(r.pYear)}</h2>
      <div class="kpi"><div><span>Revenu cotisé retraite de base</span><b>${fmt(t.revenu)}</b></div><div><span>Assiette validante${t.minimum ? ' (plancher)' : ''}</span><b>${fmt(t.assiette)}</b></div><div><span>Seuil par trimestre</span><b>${fmt(t.seuil)}</b></div><div><span>Trimestres ${e.annee}</span><b>${t.nb} / ${t.max}</b></div><div><span>Cumul fin ${e.annee}</span><b>${c && c.v !== null ? c.v : '— (cumul ' + (e.annee - 1) + ' à saisir)'}</b></div></div>
      <div class="formula">[Barème ${r.pYear}] Trimestres = MIN( ${t.max} ; ENT( MAX(revenu ; ${p.rb.minHeures} × SMIC = ${fmt(t.plancher)}) / (${t.heures} × ${fmt(p.smic_h)} = ${fmt(t.seuil)}) ) ) = ${t.nb}</div>
      <p class="note">${t.minimum ? 'Revenu inférieur au plancher : la cotisation minimale de retraite de base est due et valide 3 trimestres. ' : ''}${t.note ? esc(t.note) + ' ' : ''}Estimation : la validation définitive intervient après régularisation des cotisations de ${e.annee}. Cas non modélisés : trimestres en cas de début ou fin d'activité en cours d'année, ACRE, pluriactivité.</p></div>`;
}
