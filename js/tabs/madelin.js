'use strict';
/* Onglet Madelin */

/* ---------- Madelin ---------- */
function madTable(b, m) {
  return `<table><tr><th>Contrat</th><th class="n">Versé</th><th class="n">Plafond</th><th class="n">À réintégrer</th></tr>
    <tr><td>Prévoyance</td>${money(b.madPrev)}${money(m.plafPrev)}${money(m.reintPrev, m.reintPrev ? 'negv' : '')}</tr>
    <tr><td>Perte d'emploi</td>${money(b.madChom)}${money(m.plafChom)}${money(m.reintChom, m.reintChom ? 'negv' : '')}</tr>
    <tr><td>Retraite (Madelin / PER)</td>${money(b.madRet)}${money(m.plafRet)}${money(m.reintRet, m.reintRet ? 'negv' : '')}</tr>
    <tr class="tot"><td>Total</td>${money(b.madPrev + b.madChom + b.madRet)}<td></td>${money(m.reint)}</tr></table>`;
}
function tabMadelin(d, e, r) {
  const m = r.m, b = r.b, p = r.p;
  return `<div class="card"><h2>Plafonds de déduction Madelin ${e.annee} ${milBadge(r.pYear)}</h2>
    <p>Base retenue : <b>${fmt(m.base)}</b> <span class="note">(${b.isG ? 'rémunération + CC + AEN + autres revenus + CSG/CRDS non déductible + cotisations Madelin versées ; dividendes exclus' : 'résultat fiscal + cotisations Madelin déduites'})</span></p>
    ${madTable(b, m)}
    <div class="formula">[Barème ${r.pYear}] Prévoyance = MIN( MAX( ${pc(p.madelin.prev.tauxBase)} × base + ${pc(p.madelin.prev.tauxPass)} × PASS ; ${pc(p.madelin.prev.tauxPass)} × PASS ) ; ${pc(p.madelin.prev.plafTaux)} × ${p.madelin.prev.plafMult} PASS )</div>
    <div class="formula">[Barème ${r.pYear}] Perte d'emploi = MAX( ${pc(p.madelin.chom.taux)} × MIN(base ; ${p.madelin.chom.plafMult} PASS) ; ${pc(p.madelin.chom.plancherPass)} × PASS )</div>
    <div class="formula">[Barème ${r.pYear}] Retraite = MAX( ${pc(p.madelin.ret.taux1)} × MIN(base ; ${p.madelin.ret.plafMult} PASS) + ${pc(p.madelin.ret.taux2)} × MAX(0 ; MIN(base ; ${p.madelin.ret.plafMult} PASS) − PASS) ; ${pc(p.madelin.ret.plancherPass)} × PASS ) − abondement (${fmt(b.abond)})</div>
    <p class="note">PASS ${r.pYear} = ${fmt0(p.pass)} €. L'excédent est à réintégrer fiscalement (il reste inclus dans l'assiette sociale).</p></div>`;
}
