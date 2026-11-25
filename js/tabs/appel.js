'use strict';
/* Onglet Appel URSSAF / SSI / MSA (+ tableaux d'appel et d'écritures partagés) */

/* ---------- Appel ---------- */
function appelCell(path, x, a, c) {
  const v = x[c], src = a.src[c], au = a.auto[c];
  if (src === 'auto') return `<td class="n">${inp(path, '', 'num auto', 'num', `placeholder="${fmt(au)}" title="Valeur pré-remplie (saisir pour forcer)"`)}</td>`;
  if (src === 'force') return `<td class="n">${inp(path, v, 'num forced', 'num', `title="Montant forcé — valeur calculée : ${fmt(au)} (écart ${fmt(n(v) - au)}). Videz la cellule pour revenir au calcul."`)}</td>`;
  return `<td class="n">${inp(path, v)}</td>`;
}
function appelTable(prefix, lines, A, src, r, isCnbf) {
  const e = curE();
  let h = `<div class="scroll"><table><tr><th>Ligne</th>${isCnbf ? '<th>Revenu</th>' : ''}<th class="n">Définitif ${e.annee - 1}</th><th class="n">Provisionnel ${e.annee - 1} déjà appelé</th><th class="n">Régularisation ${e.annee - 1}</th><th class="n">Provisionnel ${e.annee}</th></tr>`;
  lines.forEach(L => {
    const x = (src || {})[L.k] || {}; const a = A[L.k];
    h += `<tr><td>${esc(L.l)}</td>${isCnbf ? `<td>${refBadge(L.ref, e.annee)}</td>` : ''}${appelCell(`${prefix}.${L.k}.def`, x, a, 'def')}${appelCell(`${prefix}.${L.k}.deja`, x, a, 'deja')}${money(a.regul)}${appelCell(`${prefix}.${L.k}.prov`, x, a, 'prov')}</tr>`;
    if (L.k === 'csg' && A.csgD) {
      const ov = c => `<td class="n">${inp(`e.csgDOverride.${c}`, e.csgDOverride[c], 'num', 'num', `placeholder="${fmt(A.csgD[c])}"`)}</td>`;
      h += `<tr class="sub"><td>&nbsp;&nbsp;dont CSG déductible <span class="note">(auto ${pc(r.p.csg.ded)}/${pc(r.p.csg.total)} — saisir pour forcer)</span></td>${ov('def')}${ov('deja')}${money(A.csgD.regul)}${ov('prov')}</tr>`;
      h += `<tr class="sub"><td>&nbsp;&nbsp;dont CSG/CRDS non déductible</td>${money(A.csgND.def)}${money(A.csgND.deja)}${money(A.csgND.regul)}${money(A.csgND.prov)}</tr>`;
    }
  });
  const T = k => sum(lines.map(L => A[L.k][k]));
  h += `<tr class="tot"><td${isCnbf ? ' colspan="2"' : ''}>Total</td>${money(T('def'))}${money(T('deja'))}${money(T('regul'))}${money(T('prov'))}</tr></table></div>`;
  const nForce = sum(lines.map(L => ['def', 'deja', 'prov'].filter(c => A[L.k].src[c] === 'force').length));
  h += `<div class="row" style="margin-top:6px"><span class="badge" style="background:#eef6ff;color:#1f5fbf">bleu = pré-rempli</span><span class="badge" style="background:#ffe7c2;color:#8a4b00">orange = forcé</span>${nForce ? `<span class="note">${nForce} montant(s) forcé(s)</span><button class="sec sm" data-act="clearForced" data-prefix="${prefix}">Rétablir les montants calculés</button>` : ''}</div>`;
  return h;
}
const refBadge = (ref, N) => !ref ? '' : ref === 'N' ? `<span class="badge" title="Régularisable : définitif calculé sur le revenu ${N}">revenu ${N}</span>` : ref === 'N-1' ? `<span class="badge warn" title="Calculé sur le revenu ${N - 1}, sans régularisation">revenu ${N - 1}</span>` : ref === 'N-2' ? `<span class="badge warn" title="Calculé sur le revenu ${N - 2}, sans régularisation">revenu ${N - 2}</span>` : ref === 'produits' ? '<span class="badge">produits (moy. 3 ans)</span>' : ref === 'commissions' ? '<span class="badge">commissions N-1</span>' : '';
function modeSelect(e, r) {
  const s = sel('e.modeReglement', r.mode, { tiers: 'Saisie dette / créance : appel comptabilisé en dette (4377), règlements en tiers', charges: 'Comptabilisation sur la base des paiements (règlements passés en charges)' });
  return r.tresorerie ? s.replace('<select', '<select disabled title="Comptabilité recettes-dépenses"') : s;
}
function entryTable(en, compact = false) {
  const mode = ui.exportMode;
  return `<div class="scroll"><table><tr><th>Date</th><th>Journal</th><th>Compte</th><th>Libellé de compte</th><th>Libellé de ligne</th>${compact ? '' : '<th>Libellé de pièce</th><th>N° pièce</th>'}<th class="n">${mode === 'dc' ? 'Débit' : 'Débit et/ou Crédit'}</th><th class="n">Crédit</th></tr>
  ${en.rows.map(r => `<tr><td>${frDate(r.date)}</td><td>${esc(r.journal)}</td><td>${esc(r.compte)}</td><td>${esc(r.libCompte)}</td><td>${esc(r.libLigne)}</td>${compact ? '' : `<td>${esc(r.libPiece)}</td><td>${esc(r.piece)}</td>`}<td class="n">${mode === 'dc' ? (r.v > 0 ? fmt(r.v) : '') : fmt(r.v)}</td><td class="n">${mode === 'dc' && r.v < 0 ? fmt(-r.v) : ''}</td></tr>`).join('')}
  </table></div><div class="row" style="margin-top:4px">${Math.abs(en.bal) < 0.01 ? '<span class="badge ok">Écriture équilibrée</span>' : `<span class="badge err">Déséquilibre ${fmt(en.bal)}</span>`}
  <button class="sec sm" data-act="copyEntry" data-id="${en.id}">Copier (Excel)</button><button class="sec sm" data-act="csvEntry" data-id="${en.id}">CSV</button></div>`;
}
function revBlock(path, o, titre, ph) {
  o = o || {};
  const f = (k, l) => { const has = ph && ph[k] !== undefined && ph[k] !== '' && ph[k] !== null; return fld(l, inp(`${path}.${k}`, o[k], has && !filledV(o[k]) ? 'num auto' : 'num', 'num', has ? `placeholder="${esc(fmt(n(ph[k])))}" title="Pré-rempli (saisir pour remplacer)"` : '')); };
  return `<h3>${titre}</h3><div class="grid">${f('brut', 'Revenu brut')}${f('abatt', 'Abattement forfaitaire')}${f('assiette', 'Assiette sociale')}${f('assietteCsg', 'Assiette CSG / CRDS')}</div>`;
}
function tabUrssaf(d, e, r) {
  const A = actDef(e.activite), N = e.annee, org = A.mode === 'msa' ? 'MSA' : 'Urssaf';
  const totCourrier = r.tot.regul + r.tot.prov;
  const ctrl = n(e.totalCourrier) ? (Math.abs(n(e.totalCourrier) - totCourrier) < 1 ? '<span class="badge ok">Concordant</span>' : `<span class="badge err">Écart ${fmt(n(e.totalCourrier) - totCourrier)}</span>`) : '';
  const pre = r.pre;
  const st = [];
  st.push(pre.deja ? `<span class="badge ok">Provisionnel ${N - 1} déjà appelé : repris de l'exercice ${N - 1}</span>` : `<span class="badge">Provisionnel ${N - 1} déjà appelé : pas d'exercice ${N - 1} renseigné (saisie)</span>`);
  if (pre.revSrc) st.push(`<span class="badge ok">Revenus ${N - 1} repris : ${esc(pre.revSrc)}</span>`);
  if (pre.def) st.push(`<span class="badge ok">Définitif ${N - 1} pré-rempli</span> ${milBadge(pre.def)}`);
  if (pre.prov) st.push(`<span class="badge ok">Provisionnel ${N} pré-rempli${pre.provSrc === 'def' ? ' (revenus ' + (N - 1) + ')' : ''}</span> ${milBadge(pre.prov)}`);
  const en = r.entries.filter(x => ['appel', 'reclass'].includes(x.id));
  const intro = A.mode === 'pl' ? `<div class="alert info">${esc(A.l)} : l'Urssaf appelle la maladie-maternité, les IJ, les allocations familiales, la CSG-CRDS, la CFP${(r.p.pl.curps || {})[e.activite] ? ' et la CURPS' : ''}. La retraite (base CNAVPL et complémentaire) et l'invalidité-décès sont appelées par la ${esc(A.caisse)} : onglet « Retraite – ${esc(A.caisse)} ».</div>`
    : A.mode === 'cipav' ? '<div class="alert info">CIPAV : l\'Urssaf calcule et recouvre l\'ensemble des cotisations, y compris la retraite de base CNAVPL, la retraite complémentaire et l\'invalidité-décès Cipav.</div>'
    : A.mode === 'msa' ? '<div class="alert info">MSA : la caisse de MSA appelle l\'ensemble des cotisations (AMEXA, IJ, invalidité, retraites, PFA, ATEXA, VIVEA, CSG-CRDS).</div>' : '';
  const pamc = A.pamc ? `<h3>Praticien conventionné (PAMC)</h3><div class="grid">
      ${fld('Part des revenus tirés de l\'activité conventionnée (%)', inp('e.caisse.convPct', e.caisse.convPct, 'num', 'num', 'placeholder="100"'), `Le reste du revenu (dépassements, non conventionné) supporte ${pc(r.p.pl.pamcSupp)} de maladie supplémentaire.`)}
      ${fld(`Participation de l'Assurance maladie ${N} (€, montant du courrier)`, inp('e.caisse.pamcPart', e.caisse.pamcPart), 'Non recalculée par l\'outil (formules de prise en charge non publiées en clair).')}
    </div>` : '';
  const msa = A.mode === 'msa' ? `<h3>Paramètres MSA</h3><div class="grid">
      ${fld(`Assiette MSA retenue pour ${N} (€)`, inp('e.msa.assiette', e.msa.assiette, 'num', 'num', `placeholder="${fmt0(r.b.R)}"`), 'Vide : assiette sociale de l\'onglet Rémunération. Option annuelle / moyenne triennale à reporter ici.')}
      ${fld('Catégorie de risque ATEXA', sel('e.msa.atexa', e.msa.atexa || 'A', MSA_ATEXA))}
    </div>` : '';
  return `
  <div class="card"><h2>${A.mode === 'msa' ? `Appel MSA « cotisations ${N} »` : `Courrier Urssaf « Calendrier de paiement de vos cotisations définitives ${N - 1} et provisionnelles ${N} »`}</h2>
    ${intro}
    <div class="grid">
      ${fld('Date du courrier (date de l\'écriture d\'appel)', dateI('e.dateCourrier', e.dateCourrier))}
      ${fld(`Total indiqué (régul. ${N - 1} + provisionnel ${N})`, inp('e.totalCourrier', e.totalCourrier), ctrl)}
    </div>
    ${revBlock('e.courrierRevenus', e.courrierRevenus, `« Comment sont calculées vos cotisations définitives ${N - 1} ? » — revenus déclarés ${N - 1}`, r.rvAuto.def)}
    ${revBlock('e.courrierRevenusProv', e.courrierRevenusProv, `« Comment sont calculées vos cotisations provisionnelles ${N} ? » — revenus pris en compte`, r.rv)}
    <p class="note">Cases bleues : valeurs reprises de l'historique (exercice ${N - 1} de l'outil ou ligne ${N - 1} des « Données historiques ») — revenu brut, abattement, assiette sociale et assiette CSG du définitif ${N - 1}, reprises pour le provisionnel ${N}. Une saisie remplace la valeur reprise. Les montants définitifs ${N - 1} et provisionnels ${N} sont ensuite calculés (sans ACRE ni conjoint pour le définitif) ; les montants du courrier restent saisissables et prévalent.</p>
    <div class="row">${st.join(' ')}</div>
    ${pre.msgs.map(m => `<div class="alert warn">${esc(m)}</div>`).join('')}
    ${pamc}${msa}
    <h3>Montants par cotisation</h3>
    ${appelTable('e.appel', r.LS.urssaf, r.ap, e.appel, r, false)}
    <p class="note">Si vous ne disposez que du montant de régularisation, saisissez-le en « Définitif » et 0 en « déjà appelé ».</p>
  </div>
  ${docCard(e, 'appel', `Document archivé — appel ${org === 'MSA' ? 'MSA' : A.mode === 'ssi' ? 'Urssaf / SSI' : 'Urssaf'} ${N}`)}
  <div class="card"><h2>Écriture générée (format Pennylane)</h2>
    <div class="grid">${fld('Mode de comptabilisation des cotisations', modeSelect(e, r), r.tresorerie ? 'Comptabilité recettes-dépenses : comptabilisation sur la base des paiements imposée.' : 'Choix commun avec l\'onglet « Clôture & écritures ».')}</div>
    ${r.mode === 'charges' ? payBlock(d, e, r) : ''}
    ${en.length ? en.map(x => `<h3>${esc(x.titre)}</h3>${entryTable(x)}`).join('') : `<p class="note">${r.mode === 'tiers' ? 'Renseignez la date du courrier pour générer l\'écriture d\'appel.' : 'Aucun règlement à reclasser.'}</p>`}
  </div>`;
}
function payBlock(d, e, r) {
  const P = r.pay, hasC = r.LS.cnbf.length > 0, cN = actDef(e.activite).caisse;
  return `<p class="note">Les règlements ont été comptabilisés en totalité au compte « ${esc(d.comptes.cotis.n)} ${esc(d.comptes.cotis.l)} ». L'écriture de reclassement répartit la CSG déductible, la CSG/CRDS non déductible, la CFP et les autres taxes selon les quotes-parts payées (${esc(P.srcQP || 'prorata de l\'appel')}).${r.tresorerie ? '' : ' À la clôture : régularisation attendue et, en exercice décalé, provision des échéances restant dues moins CCA.'}</p>
    <div class="grid">
      ${fld(`Total des règlements ${actDef(e.activite).mode === 'msa' ? 'MSA' : 'Urssaf'} comptabilisés en charges sur l'exercice`, inp('e.cloture.paiementsCharges', e.cloture.paiementsCharges, 'num', 'num', `placeholder="${fmt(P.defautU)}"`), P.saisiU ? 'Montant saisi.' : `Par défaut : ${P.srcDefaut}.`)}
      ${hasC ? fld(`Total des règlements ${esc(cN)} comptabilisés en charges`, inp('e.cloture.paiementsCnbf', e.cloture.paiementsCnbf, 'num', 'num', `placeholder="${fmt(P.defautC)}"`)) : ''}
      ${r.pr.decale && !r.tresorerie ? fld(`Échéances ${e.annee} restant dues après la clôture (Urssaf)`, inp('e.cloture.resteU', e.cloture.resteU, 'num', 'num', `placeholder="${fmt(P.resteU)}"`), `Par défaut : ${esc(P.srcReste)}.`) : ''}
      ${r.pr.decale && !r.tresorerie && hasC ? fld(`Échéances ${e.annee} restant dues après la clôture (${esc(cN)})`, inp('e.cloture.resteC', e.cloture.resteC, 'num', 'num', `placeholder="${fmt(P.resteC)}"`)) : ''}
    </div>
    <table style="max-width:600px"><tr><th>Compte</th><th class="n">Quote-part des règlements</th></tr>${Object.entries(P.accU).map(([k, v]) => `<tr><td>${esc((d.comptes[k] || {}).n || k)} ${esc((d.comptes[k] || {}).l || '')}</td>${money(v)}</tr>`).join('')}</table>`;
}
