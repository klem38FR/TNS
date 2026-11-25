'use strict';
/* Onglet Impayés */

/* ---------- Impayés ---------- */
function tabImpayes(d, e, r) {
  const x = r.ech;
  const months = echMonths(e);
  const rows = e.ech.rows.map((row, i) => {
    if (!months.includes(i)) return '';
    const c = x.actif ? x.rows[i] : null;
    return `<tr><td>${MOIS[i]}</td><td class="n">${inp(`e.ech.rows.${i}.appele`, row.appele)}</td><td class="n">${inp(`e.ech.rows.${i}.verse`, row.verse)}</td>
    ${c ? `${money(c.F)}${money(c.G)}${money(c.I)}${money(c.J)}${money(c.K, sgnCls(c.K))}` : '<td></td><td></td><td></td><td></td><td></td>'}<td>${txt(`e.ech.rows.${i}.obs`, row.obs)}</td></tr>`;
  }).join('');
  let h = `<div class="card"><h2>Échéancier ${e.annee} et versements ${milBadge(r.pYear)}</h2>
    <p class="note">Imputation échéance par échéance (CSS art. D.133-4 II) : un versement s'impute d'abord sur l'échéance du mois ; l'excédent est affecté aux échéances impayées les plus anciennes ; à l'intérieur d'une échéance, l'ordre légal est : CSG-CRDS, maladie, retraite de base, invalidité-décès, retraite complémentaire, AF, CFP, taxe consulaire. NON VÉRIFIÉ : ordre entre part « régul. N-1 » et « provisionnel N » d'une même nature (répartition proportionnelle).</p>
    <div class="grid">${fld('Périodicité des échéances', sel('e.ech.periodicite', e.ech.periodicite || 'mensuel', { mensuel: 'Mensuelle (12 échéances)', trimestriel: 'Trimestrielle (février, mai, août, novembre)' }))}${fld('Jour de prélèvement', inp('e.ech.jour', e.ech.jour, 'num', 'int'))}${fld('Assiette (gérant)', chk('e.ech.integrer', e.ech.integrer, 'Retenir les cotisations réellement réglées dans l\'assiette sociale'))}</div>
    <div class="scroll"><table><tr><th>Mois</th><th class="n">Appelé</th><th class="n">Versé</th><th class="n">Imputé sur le mois</th><th class="n">Excédent</th><th class="n">Affecté aux arriérés</th><th class="n">Total imputé</th><th class="n">Reste dû</th><th>Observations</th></tr>${rows}
    ${x.actif ? `<tr class="tot"><td>Total</td>${money(x.Dtot)}${money(x.Etot)}<td></td><td></td><td></td>${money(x.Jtot)}${money(x.Ktot)}<td></td></tr>` : ''}</table></div>`;
  if (x.actif) {
    h += `<p>Contrôle : total appelé échéancier − total courrier (régul. + provisionnel) = <b>${fmt(x.controle)}</b> ${Math.abs(x.controle) < 1 ? '<span class="badge ok">OK</span>' : '<span class="badge warn">échéancier incomplet ou éléments étrangers à l\'appel</span>'}</p>
    <h3>Synthèse par nature</h3><table><tr><th>Nature</th><th class="n">Appelé</th><th class="n">Réglé</th><th class="n">Non réglé</th></tr>
    ${NATURES.map(nt => `<tr><td>${nt.l}</td>${money(x.natTot[nt.k])}${money(x.regleNat[nt.k])}${money(x.natTot[nt.k] - x.regleNat[nt.k], sgnCls(x.natTot[nt.k] - x.regleNat[nt.k]))}</tr>`).join('')}
    <tr class="sub"><td>&nbsp;&nbsp;dont CSG déductible (proportions identiques)</td>${money(x.appCsgD)}${money(x.regleCsgD)}${money(x.appCsgD - x.regleCsgD)}</tr>
    <tr class="sub"><td>&nbsp;&nbsp;dont CSG/CRDS non déductible</td>${money(x.appCsgND)}${money(x.regleCsgND)}${money(x.appCsgND - x.regleCsgND)}</tr></table>
    <h3>Impact sur l'assiette du gérant</h3><table><tr><th>Élément</th><th class="n">Écart réglé − appelé</th></tr>
    <tr><td>CSG/CRDS non déductible</td>${money(x.adjND)}</tr><tr><td>Cotisations obligatoires (y c. CFP)</td>${money(x.adjCotis)}</tr><tr><td>CSG déductible</td>${money(x.adjD)}</tr></table>
    <p class="note">${isArt62(e.statut) ? (e.ech.integrer ? 'Ces écarts sont repris automatiquement dans l\'onglet « Rémunération ».' : 'Non repris (case décochée).') : 'EI / gérant IR : l\'assiette repose sur le résultat ; écarts donnés pour information.'} La charge comptabilisée (appel) reste inchangée : le reste dû apparaît au solde du compte ${esc(d.comptes.tiers.n)}.</p>
    <h3>Majorations de retard (indicatif, hors assiette) ${milBadge(r.pYear)}</h3>
    <div class="grid">${fld('Nombre de mois (ou fractions) de retard', inp('e.ech.majMois', e.ech.majMois, 'num', 'int'))}</div>
    <table><tr><td>Reste dû</td>${money(x.Ktot)}</tr><tr><td>Majoration initiale ${pc(r.p.retard.initiale)}</td>${money(x.majInit)}</tr><tr><td>Majoration complémentaire ${pc(r.p.retard.mensuelle)} × ${n(e.ech.majMois)} mois</td>${money(x.majCompl)}</tr><tr class="tot"><td>Total indicatif</td>${money(x.majTot)}</tr></table>
    <p class="note">CSS art. R.243-18 ; calcul définitif par l'Urssaf après paiement intégral ; remise possible (art. R.243-20).</p>`;
  } else h += '<p class="note">Saisissez les montants appelés par l\'échéancier pour activer le suivi.</p>';
  return h + '</div>';
}
