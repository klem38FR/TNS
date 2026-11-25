'use strict';
/* Onglet Clôture & écritures */

/* ---------- Clôture ---------- */
function tabCloture(d, e, r) {
  const pr = r.pr, cl = e.cloture, A = actDef(e.activite), N = e.annee;
  const prev = d.exercices[N - 1];
  const x = pr.moisApres;
  let h = `<div class="card"><h2>Prorata d'exercice ${milBadge(r.pYear)}</h2>
    ${pr.ok ? `<div class="kpi">
      <div><span>Exercice</span><b>${frDate(e.debutExercice)} → ${frDate(e.finExercice)}</b></div>
      <div><span>Mois de ${N - 1} dans l'exercice</span><b>${pr.moisN1}/12</b></div>
      <div><span>Mois de ${N} dans l'exercice</span><b>${pr.moisN}/12</b></div>
      <div><span>Mois de ${N} après la clôture (x)</span><b>${x}/12</b></div>
      <div><span>Charge théorique de l'exercice (contrôle)</span><b>${fmt(pr.chargeTheo)}</b></div></div>
      <div class="formula">Charge théorique = définitif ${N - 1} (courrier) × ${pr.moisN1}/12 + définitif ${N} recalculé × ${pr.moisN}/12</div>
      <p class="note">${r.tresorerie ? 'Comptabilité recettes-dépenses : seules les écritures de reclassement des quotes-parts payées sont proposées (ni provision, ni CCA).'
        : pr.decale ? `Exercice décalé : la régularisation ${N} attendue est constatée en totalité (année civile, sans prorata) ; la part des cotisations ${N} (provisionnel + régularisation) relative à l'exercice suivant (${x}/12) est neutralisée en charges constatées d'avance. Ces écritures de clôture sont extournées le lendemain de la clôture (${frDate(addDays(e.finExercice, 1))}).`
        : `Exercice calé sur l'année civile : régularisation ${N} attendue constatée à la clôture et extournée à l'ouverture (${frDate(addDays(e.finExercice, 1))}) ; pas de CCA.`}</p>` : '<div class="alert warn">Renseignez les dates d\'exercice (onglet Dossier).</div>'}
  </div>
  <div class="card"><h2>Mode de comptabilisation des cotisations</h2>
    <div class="grid">${fld('Mode', modeSelect(e, r), r.tresorerie ? 'Comptabilité recettes-dépenses (onglet Dossier) : comptabilisation sur la base des paiements.' : 'Choix commun avec l\'onglet « Appel URSSAF ».')}</div>
    ${r.mode === 'charges' ? payBlock(d, e, r) : ''}
    <div class="formula">${r.mode === 'tiers' ? `Saisie dette / créance :
 1. Appel de l'année : régul. ${N - 1} + provisionnel ${N} → ${esc(d.comptes.tiers.n)}${r.LS.cnbf.length ? ' / ' + esc(d.comptes.cnbfTiers.n) : ''}, en date du document
 2. Régularisation ${N} attendue (définitif recalculé − provisionnel), année civile sans prorata → ${esc(d.comptes.cap.n)} / ${esc(d.comptes.par.n)}, en date de clôture + extourne à J+1
 3. ${pr.decale ? `Exercice décalé : CCA = cotisations ${N} (provisionnel + régularisation) × ${x}/12 → ${esc(d.comptes.cca.n)}, en date de clôture + extourne à J+1` : 'CCA : sans objet (exercice civil)'}`
      : r.tresorerie ? `Recettes-dépenses : reclassement des règlements selon les quotes-parts payées (CSG déductible, CSG/CRDS non déductible, CFP, autres) — pas de provision.`
      : `Paiements comptabilisés en charges :
 1. Reclassement des règlements selon les quotes-parts payées
 2. Régularisation ${N} attendue (définitif recalculé − provisionnel) → ${esc(d.comptes.cap.n)} / ${esc(d.comptes.par.n)}, en date de clôture + extourne à J+1
 3. ${pr.decale ? `Exercice décalé : provision des échéances ${N} restant dues après la clôture (${esc(d.comptes.cap.n)}) − CCA des cotisations ${N} × ${x}/12 (${esc(d.comptes.cca.n)}), en date de clôture + extourne à J+1` : 'Provision des échéances / CCA : sans objet (exercice civil)'}`}</div>
  </div>
  <div class="card"><h2>Reprises de l'exercice précédent</h2>
    ${prev ? `<p class="note">Exercice ${N - 1} présent dans l'outil : ses écritures de clôture (régularisation attendue, CCA) sont générées avec leur extourne au lendemain de la clôture ${N - 1}. Aucune reprise supplémentaire n'est générée ici.</p>` :
      `<p class="note">Pas d'exercice ${N - 1} dans l'outil : si les écritures de clôture ${N - 1} n'ont pas été extournées, saisissez-les ici (extourne en date d'ouverture).</p>
      <div class="grid">${fld('CCA constituée à la clôture précédente', inp('e.cloture.repriseManuelleCca', cl.repriseManuelleCca))}${fld('Régularisation provisionnée (+ charge à payer / − produit à recevoir)', inp('e.cloture.repriseManuelleProv', cl.repriseManuelleProv))}</div>`}
  </div>
  <div class="card"><h2>Écritures à importer dans Pennylane</h2>
    <div class="row"><label>Présentation des montants</label>${sel('ui.exportMode', ui.exportMode, { signe: 'Colonne « Débit et/ou Crédit » signée (comme le classeur)', dc: 'Débit / Crédit séparés' })}
    <button data-act="csvAll">Exporter toutes les écritures (CSV)</button><button class="sec" data-act="copyAll">Copier tout (Excel)</button></div>
    ${r.entries.length ? r.entries.map(en => `<h3>${en.extourne ? '↺ ' : ''}${esc(en.titre)}</h3>${entryTable(en)}`).join('') : '<p class="note">Aucune écriture : renseignez le courrier et les revenus.</p>'}
  </div>`;
  return h;
}
