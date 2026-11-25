'use strict';
/* Onglet Cotisations N calculées */

/* ---------- Cotisations ---------- */
function tabCotis(d, e, r) {
  const p = r.p, A = actDef(e.activite), org = A.mode === 'msa' ? 'MSA' : 'Urssaf';
  const rows = r.cmp.map(c => `<tr><td>${esc(c.l)}</td><td class="n">${c.base !== undefined && c.base !== null ? fmt0(c.base) : ''}</td><td class="n">${c.taux !== undefined && c.taux !== null ? pc(c.taux) : ''}</td>${money(c.calc)}${money(c.prov)}${money(c.ecart, sgnCls(c.ecart))}</tr>`).join('');
  let h = `<div class="card"><h2>Cotisations ${e.annee} recalculées sur la rémunération ${e.annee} ${milBadge(r.pYear)} <span class="badge">${esc(A.l)}</span></h2>
    ${warnList(r.W)}
    <div class="kpi">
      <div><span>Base R</span><b>${fmt(r.b.R)}</b></div>
      ${r.pro && r.pro.partiel ? `<div><span>PASS proratisé (${r.pro.jours} j / ${r.pro.joursAn})</span><b>${fmt0(r.p.pass * r.pro.k)}</b></div>` : ''}
      <div><span>Définitif ${e.annee} estimé (total)</span><b>${fmt(r.totCalc)}</b></div>
      <div><span>Provisionnel ${e.annee} retenu</span><b>${fmt(r.totProv)}</b></div>
      <div><span>Régularisation attendue (année civile)</span><b class="${sgnCls(r.totCalc - r.totProv)}">${fmt(r.totCalc - r.totProv)}</b></div>
    </div>
    <h3>${org}</h3>
    <div class="scroll"><table><tr><th>Cotisation</th><th class="n">Assiette</th><th class="n">Taux</th><th class="n">Calculé ${e.annee}</th><th class="n">Provisionnel ${e.annee}</th><th class="n">Régul. attendue en ${e.annee + 1}</th></tr>${rows}
    <tr class="tot"><td colspan="3">Total ${org}</td>${money(r.totCalcU)}${money(r.totProvU)}${money(r.totCalcU - r.totProvU)}</tr>
    <tr class="sub"><td colspan="3">dont CSG déductible / non déductible recalculées</td><td class="n">${fmt(r.calc.csgD)} / ${fmt(r.calc.csgND)}</td><td></td><td></td></tr></table></div>
    <p class="note">Écart positif (rouge) = complément à payer ; négatif (vert) = remboursement attendu. Taux progressifs (maladie, AF) arrondis à 2 décimales en %, comme l'Urssaf.</p>`;
  if (r.cmpC.length) {
    h += `<h3>${esc(A.caisse)} ${milBadge(r.pYear)}</h3><div class="scroll"><table><tr><th>Cotisation</th><th>Revenu</th><th class="n">Calculé ${e.annee}</th><th class="n">Provisionnel ${e.annee}</th><th class="n">Écart</th></tr>
      ${r.cmpC.map(c => `<tr><td>${esc(c.l)}</td><td>${refBadge(c.ref, e.annee)}</td>${money(c.calc)}${money(c.prov)}${money(c.ecart, sgnCls(c.ecart))}</tr>`).join('')}
      <tr class="tot"><td colspan="2">Total ${esc(A.caisse)}</td>${money(r.totCalcC)}${money(r.totProvC)}${money(r.totCalcC - r.totProvC)}</tr></table></div>
      <p class="note">Détail du calcul et options : onglet « Retraite – ${esc(A.caisse)} ».</p>`;
  }
  h += `</div>`;
  h += trimCard(d, e, r);
  if (r.acre.actif) {
    const Ac = r.acre;
    h += `<div class="card"><h2>ACRE ${milBadge(r.pYear)}</h2>
      <table><tr><th>Cotisation éligible</th><th class="n">Due</th><th class="n">Exonération imputée</th></tr>
      ${Ac.elig.map(k => `<tr><td>${esc((r.LS.urssaf.find(L => L.k === k) || {}).l || k)}</td>${money(r.calc[k])}${money(Ac.parLigne[k])}</tr>`).join('')}
      <tr class="tot"><td>Total</td>${money(Ac.dueTot)}${money(Ac.exo)}</tr></table>
      <div class="formula">[Barème ${r.pYear}] R retenu = ${fmt(Ac.R)} ; seuils ${fmt0(Ac.seuilBas)} (75 % PASS) / ${fmt0(Ac.seuilHaut)} (PASS)
E (cotisations éligibles pour R = 75 % PASS) = ${fmt(Ac.E)}
Exonération théorique = ${Ac.R <= Ac.seuilBas ? '25 % × cotisations éligibles dues' : Ac.R >= Ac.seuilHaut ? '0 (R ≥ PASS)' : 'MIN( 25 % × dues ; 0,25 × E / (0,25 × PASS) × (PASS − R) )'} = ${fmt(Ac.theo)}
Prorata ${Ac.mois}/12 ⇒ exonération retenue = ${fmt(Ac.exo)}</div></div>`;
  }
  if (r.cj.actif) {
    const c = r.cj;
    h += `<div class="card"><h2>Conjoint collaborateur ${milBadge(r.pYear)}</h2>
    <p>Assiette du conjoint : <b>${fmt(c.base)}</b> (${esc(c.option)})</p>
    <table><tr><th>Cotisation</th><th class="n">Montant</th></tr>
    <tr><td>Retraite de base ≤ PASS</td>${money(c.c.rb1)}</tr><tr><td>Retraite de base > PASS</td>${money(c.c.rb2)}</tr>
    <tr><td>Retraite complémentaire T1</td>${money(c.c.rc1)}</tr><tr><td>Retraite complémentaire T2</td>${money(c.c.rc2)}</tr>
    <tr><td>Invalidité-décès</td>${money(c.c.id)}</tr><tr class="tot"><td>Total</td>${money(c.total)}</tr></table></div>`;
  }
  return h;
}
