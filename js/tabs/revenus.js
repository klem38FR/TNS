'use strict';
/* Onglet Rémunération (bases, revenu fiscal) */

/* ---------- Revenus ---------- */
/* Notice de traitement des revenus de remplacement (reprise de la notice COT'TNS) */
const IJ_NOTICE = [
  ['Revenu imposable et non précompté de la CSG/CRDS', 'Revenu de remplacement fiscalisé (CPAM) <b>et</b> revenu de remplacement avec CSG à taux réduit', 'Soustrait de la base CSG-CRDS à taux plein ; CSG-CRDS au taux réduit des revenus de remplacement à la régularisation.'],
  ['Revenu imposable et précompté de la CSG/CRDS', 'Revenu de remplacement fiscalisé (CPAM)', 'Soustrait de la base CSG-CRDS à taux plein au moment de la régularisation ; réintégré (après abattement) dans la base sociale.'],
  ['Revenu imposable et précompté de la CSG/CRDS et non transmis à l\'Urssaf (contrat de prévoyance Madelin)', 'Revenu de remplacement organisme privé (avec CSG/CRDS précomptée)', 'Déduit de la base CSG-CRDS pour ne pas payer deux fois la CSG-CRDS au niveau déclaratif ; réintégré dans la base sociale ; déclaré en DSCZ/DSDZ.'],
  ['Revenu non imposable et non précompté de la CSG/CRDS', 'IJ ALD', 'Soustrait du revenu fiscal et de la base sociale ; assujetti au taux réduit de CSG à la régularisation.']
];
function ijNoticeHtml() {
  return `<details class="ijNotice"><summary>ⓘ Notice : traitement des revenus de remplacement</summary>
    <table style="margin-top:6px"><tr><th>Traitement des revenus de remplacement</th><th>Saisie à effectuer</th><th>Effet</th></tr>
    ${IJ_NOTICE.map(x => `<tr><td>${x[0]}</td><td>${x[1]}</td><td class="note" style="margin:0">${x[2]}</td></tr>`).join('')}</table>
    <p class="note">Montants <b>bruts</b> (avant précompte), compris dans la rémunération / le résultat saisi. Une IJ ALD n'est exonérée que si l'attestation CPAM vise l'ALD exonérante (art. L160-14 CSS) ; une ALD non exonérante (art. L324-1) relève du revenu fiscalisé. Taux des revenus de remplacement : CSG déductible 3,80 %, CSG non déductible 2,40 %, CRDS 0,50 % (réponse experte ameli du 05/03/2024). Sources : notice 2042-DRI revenus 2025 § 2.1.2, 2.2.2, 6.3, 6.5 ; BOI-RSA-PENS-10-20-20 § 70 (imposition dans la catégorie du revenu remplacé) ; art. 80 quinquies et 154 bis A CGI (ALD).</p></details>`;
}
function tabRevenus(d, e, r) {
  const b = r.b, p = r.p, P = p.pass, A = actDef(e.activite), N = e.annee, ij = b.ij;
  const root = b.isG ? 'rem' : 'eiRev', R = e[root] || {}, S = e.ijss || {}, Cm = (b.isG ? e.remCom : e.eiRevCom) || {}, Ci = e.ijssCom || {};
  const comI = (path, v) => `<td>${txt(path, v, 'style="width:100%;min-width:160px" placeholder="Nature / justification"')}</td>`;
  const com = key => comI(`e.${root}Com.` + key, Cm[key]);
  const pad = lvl => `style="padding-left:${6 + 16 * lvl}px"`;
  const sec = t => `<tr class="sub"><td colspan="4">${t}</td></tr>`;
  /* ligne saisie : libellé | calculé | saisi | commentaire */
  const rowI = (lab, key, o = {}) => `<tr><td ${pad(o.lvl || 0)}>${lab}${o.note ? `<div class="note">${o.note}</div>` : ''}</td><td class="n">${o.calc !== undefined ? fmt(o.calc) : ''}</td><td class="n">${inp(`e.${root}.` + key, R[key])}</td>${com(key)}</tr>`;
  const rowIJ = (lab, key, lvl, note) => `<tr><td ${pad(lvl)}>${lab}${note ? `<div class="note">${note}</div>` : ''}</td><td></td><td class="n">${inp('e.ijss.' + key, S[key], 'num', 'num', ij.legacy ? `placeholder="${fmt0(key === 'fisc' ? ij.fisc : key === 'ald' ? ij.ald : 0)}"` : '')}</td>${comI('e.ijssCom.' + key, Ci[key])}</tr>`;
  const rowA = (lab, v, o = {}) => `<tr class="${o.cls || ''}"><td ${pad(o.lvl || 0)}>${lab}${o.note ? `<div class="note">${o.note}</div>` : ''}</td><td class="n">${fmt(v)}</td><td></td>${o.key ? com(o.key) : '<td></td>'}</tr>`;
  const ijRows = `<tr><td ${pad(0)} colspan="4"><b>Dont revenus de remplacement / IJ</b> <span class="note">(compris dans le montant ci-dessus, montants bruts)</span>${ijNoticeHtml()}</td></tr>
      ${rowIJ('Revenu de remplacement fiscalisé (CPAM)', 'fisc', 1, 'Imposable ; montant transmis par la CPAM à l\'Urssaf')}
      ${rowIJ('dont revenu de remplacement avec CSG à taux réduit', 'reduit', 2, 'Part non précomptée de la CSG-CRDS par la CPAM')}
      ${rowIJ('Revenu de remplacement organisme privé (avec CSG/CRDS précomptée)', 'prive', 1, 'IJ contrat de prévoyance Madelin, non transmises à l\'Urssaf')}
      ${rowIJ('IJ affection longue durée (ALD)', 'ald', 1, 'Non imposables ; hors base sociale')}`;
  let h = `<div class="card"><h2>Éléments de rémunération ${esc(vueShort(e))} ${milBadge(r.pYear)} <span class="badge">${esc(STATUTS[e.statut] || '')}</span></h2>`;
  if (b.isG) {
    const mc = (k, extra = '') => inp('e.rem.' + k, R[k], 'num', 'num', (b.madLegacy ? `placeholder="${fmt0(b[k] || 0)}"` : '') + extra);
    h += `<div class="scroll"><table><tr><th>Désignation</th><th class="n">Calculé</th><th class="n">Saisi ${N}</th><th>Commentaire</th></tr>
      ${sec(`1 – Rémunération versée au gérant en ${N} (année civile)`)}
      ${rowI('Rémunération versée (nette, art. 62)', 'remVersee', { note: 'IJ comprises (voir détail ci-dessous)' })}
      ${rowI('Rémunération en compte courant', 'remCC')}
      ${ijRows}
      ${rowI('Autres avantages en nature', 'aen')}
      ${rowI('Dividendes / intérêts de CCA > 10 % (capital social, primes d\'émission, CCA)', 'divid')}
      ${rowI('Revenus des autres activités', 'autres')}
      ${sec(`2 – Cotisations obligatoires ${N} (détail : onglets Appel, Impayés, Cotisations)`)}
      ${rowA('Cotisations obligatoires (hors CSG-CRDS)', b.cotisAuto + b.impCotis, { lvl: 1, note: b.impCotis ? `dont impayés ${fmt(b.impCotis)}` : 'Courrier Urssaf : régularisation N-1 + provisionnel N' + (r.LS.cnbf.length ? ' + ' + esc(A.caisse) : ''), key: 'cotisAuto' })}
      ${rowI('Cotisations obligatoires – ajustement', 'adjCotis', { lvl: 2 })}
      ${rowA('CSG déductible', b.csgDauto + b.impD, { lvl: 1, key: 'csgDauto' })}
      ${rowI('CSG déductible – ajustement', 'adjD', { lvl: 2 })}
      ${rowA('CSG-CRDS non déductible', b.csgNDauto + b.impND, { lvl: 1, key: 'csgNDauto' })}
      ${rowI('CSG-CRDS non déductible – ajustement', 'adjND', { lvl: 2 })}
      ${rowI('dont cotisations obligatoires réglées par le gérant (sur sa rémunération)', 'cotisGerant', { lvl: 1, note: 'Partie des cotisations ci-dessus payée personnellement : non ajoutée aux charges de la société' })}
      ${rowA('Cotisations obligatoires payées par la société', b.cotisEnt, { cls: 'tot' })}
    </table></div>
    <h3>3 – Cotisations Madelin et PER payées par la société en ${N} (année civile)</h3>
    <p class="note">Déductibles fiscalement dans la limite des plafonds (onglet Madelin), si les cotisations obligatoires sont payées (art. 154 bis CGI).</p>
    <div class="scroll"><table><tr><th>Contrat</th><th class="n">Madelin</th><th class="n">PER</th><th class="n">Total</th><th>Commentaire</th></tr>
      <tr><td>Médicis</td><td class="n">${mc('madMed')}</td><td class="n">—</td>${money(b.madMed)}${com('madMed')}</tr>
      <tr><td>Retraite</td><td class="n">${mc('madRetM')}</td><td class="n">${mc('madRetP')}</td>${money(b.madRetM + b.madRetP)}${com('madRet')}</tr>
      <tr><td>Prévoyance</td><td class="n">${mc('madPrevM')}</td><td class="n">${mc('madPrevP')}</td>${money(b.madPrev)}${com('madPrev')}</tr>
      <tr><td>Chômage (perte d'emploi)</td><td class="n">${mc('madChomM')}</td><td class="n">${mc('madChomP')}</td>${money(b.madChom)}${com('madChom')}</tr>
      <tr class="tot"><td>Total Madelin / PER</td>${money(b.madMed + b.madRetM + b.madPrevM + b.madChomM)}${money(b.madRetP + b.madPrevP + b.madChomP)}${money(b.madTot)}<td></td></tr>
    </table></div>
    <div class="kpi" style="margin-top:10px">
      <div><span>Rémunération nette (versée + compte courant)</span><b>${fmt(b.remVersee + b.remCC)}</b></div>
      <div><span>Avantages en nature</span><b>${fmt(b.aen)}</b></div>
      <div><span>Total des charges pour la société</span><b>${fmt(b.chargesSoc)}</b></div>
    </div>
    <h3>4 – Épargne salariale et avantages</h3>
    <div class="scroll"><table><tr><th>Élément</th><th class="n">Montant ${N}</th><th class="n">Versement du bénéficiaire</th><th class="n">Plafond</th><th>Commentaire</th></tr>
      <tr><td>Abondement PEE, PEI<div class="note">Plafond : MIN(8 % PASS ; 3 × versement du bénéficiaire) ; 16 % PASS en cas d'abondement unilatéral de l'employeur. <label style="font-weight:normal"><input type="checkbox" data-b="e.rem.peeUnilat" data-t="bool" ${b.peeUnilat ? 'checked' : ''}> abondement unilatéral</label></div></td>
        <td class="n">${inp('e.rem.abondPEE', R.abondPEE, 'num', 'num', b.abondLegacy ? `placeholder="${fmt0(b.abondPEE)}"` : '')}</td><td class="n">${inp('e.rem.versPEE', R.versPEE)}</td><td class="n ${b.abondPEE > b.plafPEE + 0.005 && !b.peeUnilat ? 'negv' : ''}">${b.peeUnilat ? fmt(0.16 * P) : fmt(b.plafPEE)}</td>${com('abondPEE')}</tr>
      <tr><td>Abondement PERCO, PERECO<div class="note">Plafond : MIN(16 % PASS ; 3 × versement du bénéficiaire). Diminue le plafond épargne retraite (6QS).</div></td>
        <td class="n">${inp('e.rem.abondPER', R.abondPER)}</td><td class="n">${inp('e.rem.versPER', R.versPER)}</td><td class="n ${b.abondPER > b.plafPER + 0.005 ? 'negv' : ''}">${fmt(b.plafPER)}</td>${com('abondPER')}</tr>
      <tr><td>Intéressement / participation</td><td class="n">${inp('e.rem.interess', R.interess)}</td><td></td><td></td>${com('interess')}</tr>
      <tr><td>Chèques vacances<div class="note">Social : exonération de cotisations (hors CSG-CRDS) dans la limite de ${pc(p.chqvac.pctSmicMens, 0)} du SMIC mensuel (${fmt(b.chqSeuil)} €). Fiscal : exonération d'IR dans la limite d'un SMIC mensuel (${fmt(b.smicMens)} €) — à vérifier pour le gérant.</div></td>
        <td class="n">${inp('e.rem.chqVac', R.chqVac)}</td><td></td><td></td>${com('chqVac')}</tr>
    </table></div>`;
  } else {
    h += `<p class="note">${e.statut === 'gerant_ir' ? 'Gérant majoritaire de société à l\'IR : quote-part du résultat fiscal de l\'exercice clos en ' + N + ' revenant au gérant.' : 'Entreprise individuelle : résultat de l\'exercice clos en ' + N + '.'} Régime ${esc(REGIMES[e.regime] || '')}. Le prorata d'exercice décalé ne s'applique qu'à la comptabilisation.</p>
    <div class="scroll"><table><tr><th>Désignation</th><th class="n">Calculé</th><th class="n">Saisi</th><th>Commentaire</th></tr>
      ${rowI('Résultat fiscal (bénéfice / − déficit)', 'resultat', { note: 'Revenus de remplacement compris (gains divers)' })}
      ${ijRows}
      ${rowI('Cotisations sociales obligatoires déduites', 'cotisDed')}
      ${rowI('CSG / CRDS déduite', 'csgDed')}
      ${rowI('Madelin – prévoyance déduite', 'madPrev')}
      ${rowI('Madelin – perte d\'emploi déduite', 'madChom')}
      ${rowI('Madelin / PER – retraite déduite', 'madRet')}
      ${rowI('Exonérations / abattements fiscaux (ZFU, JEI…)', 'exo')}
      ${rowI('Autres réintégrations', 'autresReint')}
    </table></div>`;
  }
  h += `</div>` + basesCard(e, r) + (b.isG ? fiscCard(e, r) : '');
  return h;
}
/* Calcul des bases CSG-CRDS et sociale (assiette « super brute ») */
function basesRows(b, p) {
  const ij = b.ij, L = [], add = (l, v, o = {}) => L.push(Object.assign({ l, v }, o));
  if (b.isG) {
    add(`Rémunération versée + compte courant + avantages en nature${ij.tot ? ' + IJ' : ''}`, b.remTot);
    add('Cotisations sociales obligatoires payées par l\'entreprise (y c. CSG-CRDS)', b.cotisEnt);
    add('Cotisations Madelin et PER payées par l\'entreprise', b.madTot);
    add('Revenus des autres activités', b.autres);
    add('Revenus distribués > 10 % du capital social', b.divid);
    add('Frais professionnels réels', -b.fraisReels, { key: 'fraisReels' });
    add('dont frais exposés pour l\'acquisition de parts sociales', b.fraisParts, { key: 'fraisParts', lvl: 1, info: true });
    add('Chèques vacances', b.chqVac);
    add('Abondement PERCO, PERECO', b.abondPER);
    add('Abondement PEE, PEI', b.abondPEE);
    add('Intéressement / participation', b.interess);
  } else {
    add('Résultat fiscal (revenus de remplacement compris)', b.resultat);
    add('Cotisations sociales obligatoires et CSG-CRDS déduites', b.cotisDed + b.csgDed);
    add('Madelin / PER déduits', b.madTot);
    add('Exonérations fiscales et autres réintégrations', b.exo + b.autresReint);
  }
  add('Déduction revenu de remplacement fiscalisé (CPAM)', -ij.fisc);
  add('Déduction des IJ ALD', -ij.ald);
  add('Déduction IJ organisme privé', -ij.prive);
  add('Assiette super brute (revenu brut social)', b.brut, { cls: 'tot' });
  add(`Abattement ${pc(p.abatt.taux, 0)} (min. ${fmt0(b.abattMin)} ; max. ${fmt0(b.abattMax)})`, -b.abatt);
  add('BASE CSG / CRDS (taux plein)', b.baseCSG, { cls: 'tot' });
  add(`Déduction des chèques vacances dans la limite de ${pc(p.chqvac.pctSmicMens, 0)} du SMIC mensuel`, -b.chqExo);
  add('Déduction abondements et intéressement*', -b.dedAbond);
  add('Réintégration revenu de remplacement fiscalisé*', b.reintFisc);
  add('Réintégration IJ organisme privé*', b.reintPrive);
  add('BASE SOCIALE (R)', b.R, { cls: 'tot' });
  if (b.baseCSGred) add(`Base CSG-CRDS au taux réduit (${pc(ij.tx.tot)}) : revenus non précomptés + ALD*`, b.baseCSGred, { cls: 'sub' });
  return L;
}
function basesCard(e, r) {
  const b = r.b, p = r.p, P = p.pass, R = e.rem || {}, Cm = (b.isG ? e.remCom : e.eiRevCom) || {};
  const rows = basesRows(b, p).map(x => {
    const cell = x.key ? `<td class="n">${inp('e.rem.' + x.key, R[x.key])}</td>` : `<td class="n">${fmt(x.v)}</td>`;
    return `<tr class="${x.cls || ''}"><td style="padding-left:${6 + 16 * (x.lvl || 0)}px">${x.l}</td>${cell}${x.key ? `<td>${txt('e.remCom.' + x.key, Cm[x.key], 'style="width:100%;min-width:160px" placeholder="Nature / justification"')}</td>` : '<td></td>'}</tr>`;
  }).join('');
  return `<div class="card"><h2>Calcul des bases ${e.annee} ${milBadge(r.pYear)}</h2>
    <div class="scroll"><table><tr><th>Désignation</th><th class="n">Base CSG/CRDS – sociale</th><th>Commentaire</th></tr>${rows}</table></div>
    <p class="note">* Montants après abattement de ${pc(p.abatt.taux, 0)} (× ${fmt(1 - p.abatt.taux, 2)}). Base sociale / PASS ${r.pYear} : ${fmt(b.R / P * 100, 1)} %. Notice 2042-DRI : cotisations = revenu brut social − intéressement / participation + revenus de remplacement ; CSG-CRDS = revenu brut social (revenus de remplacement exclus, déjà précomptés).</p>
  </div>`;
}
/* Calcul du revenu fiscal (1GB) et des cotisations — gérant art. 62 */
function fiscCard(e, r) {
  const b = r.b, fi = b.fi, dc = r.d42.dc;
  const cell = v => v === null || v === undefined ? '<td class="n"></td>' : money(v, v < 0 ? 'negv' : '');
  const rows = fi.rows.map(x => `<tr><td>${x.l}${x.note ? `<div class="note">${esc(x.note)}</div>` : ''}</td>${cell(x.f)}${cell(x.s)}</tr>`).join('');
  return `<div class="card"><h2>Calcul du revenu fiscal et des cotisations ${e.annee} ${milBadge(r.pYear)}</h2>
    <div class="scroll"><table><tr><th>Désignation</th><th class="n">Revenu fiscal</th><th class="n">Cotisations sociales</th></tr>${rows}
      <tr class="sub"><td>Total</td>${money(fi.tot)}${money(fi.totS)}</tr>
      <tr><td>Chèques vacances (part > 1 SMIC mensuel, ${fmt(b.smicMens)} €)</td>${cell(fi.cv)}<td></td></tr>
      <tr><td>Retraitement IJ ALD (exonérées)</td>${cell(fi.ald)}<td></td></tr>
      <tr class="tot"><td>BASES IMPOSABLES — case ${dc === 1 ? '1GB' : '1HB'} / cotisations obligatoires</td>${money(fi.imposable)}${money(fi.totS)}</tr>
    </table></div>
    ${b.ij.fisc ? `<p class="note">IJ CPAM comprises en ${dc === 1 ? '1GB' : '1HB'} (catégorie du revenu remplacé, BOI-RSA-PENS-10-20-20 § 70) : retirer de ${dc === 1 ? '1AJ' : '1BJ'} le montant pré-rempli par la CPAM (estimation ${fmt(b.ij.pre1AJ)} €, onglet 2042).</p>` : ''}
  </div>`;
}

/* Lignes de rémunération du récapitulatif client (montant et commentaire) */
function remRows(e, r) {
  const b = r.b, ij = b.ij, isG = b.isG, bc = (isG ? e.remCom : e.eiRevCom) || {}, ic = e.ijssCom || {};
  const join = ks => ks.map(k => bc[k]).filter(Boolean).join(' ; ');
  const L = [];
  const add = (l, v, com = '') => L.push({ l, v, com });
  if (isG) {
    add('Rémunération versée (nette, art. 62)', b.remVersee, bc.remVersee); add('Rémunération en compte courant', b.remCC, bc.remCC); add('Avantages en nature', b.aen, bc.aen);
    add('dont revenu de remplacement fiscalisé (CPAM)', ij.fisc, ic.fisc); add('dont revenu de remplacement organisme privé', ij.prive, ic.prive); add('dont IJ ALD', ij.ald, ic.ald);
    add('Dividendes / intérêts de CCA > 10 %', b.divid, bc.divid); add('Revenus des autres activités', b.autres, bc.autres);
    add('Cotisations obligatoires payées par la société (y c. CSG-CRDS)', b.cotisEnt, join(['cotisAuto', 'adjCotis', 'csgDauto', 'adjD', 'csgNDauto', 'adjND', 'cotisGerant']));
    add('Madelin / PER – retraite (y c. Médicis)', b.madRet, bc.madRet); add('Madelin / PER – prévoyance', b.madPrev, bc.madPrev); add('Madelin – perte d\'emploi', b.madChom, bc.madChom);
    add('Abondement PEE, PEI', b.abondPEE, bc.abondPEE); add('Abondement PERCO, PERECO', b.abondPER, bc.abondPER); add('Intéressement / participation', b.interess, bc.interess);
    add('Chèques vacances', b.chqVac, bc.chqVac); add('Frais professionnels réels', -b.fraisReels, bc.fraisReels);
  } else {
    REM_IR_EI.forEach(([k, l]) => add(l, b[k] || 0, bc[k] || ''));
    add('dont revenu de remplacement fiscalisé (CPAM)', ij.fisc, ic.fisc); add('dont revenu de remplacement organisme privé', ij.prive, ic.prive); add('dont IJ ALD', ij.ald, ic.ald);
  }
  if (ij.tot) add('− Revenus de remplacement (fiscalisé, organisme privé, ALD)', -ij.tot, 'Exclus de la base CSG-CRDS ; fiscalisé et privé réintégrés dans la base sociale');
  return L;
}
