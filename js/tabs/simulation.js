'use strict';
/* Onglet Simulation */

/* ---------- Simulation ---------- */
const SIM_FIELDS_G = [
  { k: 'remVersee', l: 'Rémunération art. 62' },
  { k: 'aen', l: 'Avantages en nature' },
  { k: 'divid', l: 'RCM > 10 % (capital social, primes d\'émission, CCA)' },
  { k: 'chqVac', l: 'Chèques vacances (CV)' }
];
const SIM_FIELDS_EI = [{ k: 'resultat', l: 'Résultat fiscal' }];
const filledS = v => v !== undefined && v !== null && v !== '';
function simulate(d, e, mode, sc) {
  const e2 = JSON.parse(JSON.stringify(e));
  if (mode === 'brut') e2._sim = { brut: n(sc.brut) };
  else if (isArt62(e.statut)) { e2.rem = e2.rem || {}; SIM_FIELDS_G.forEach(f => { if (filledS(sc[f.k])) e2.rem[f.k] = n(sc[f.k]); }); }
  else { e2.eiRev = e2.eiRev || {}; if (filledS(sc.resultat)) e2.eiRev.resultat = n(sc.resultat); }
  return computeRaw(d, e2);
}
function tabSimu(d, e, r) {
  if (!ui.sim || !Array.isArray(ui.sim.s) || typeof ui.sim.s[0] !== 'object') ui.sim = { mode: 'detail', s: [{}, {}, {}] };
  const isG = isArt62(e.statut), mode = ui.sim.mode === 'brut' ? 'brut' : 'detail';
  const fields = mode === 'brut' ? [{ k: 'brut', l: 'Revenu brut social' }] : (isG ? SIM_FIELDS_G : SIM_FIELDS_EI);
  const curOf = k => k === 'brut' ? r.b.brut : (r.b[k] || 0);
  const active = ui.sim.s.map(sc => fields.some(f => filledS(sc[f.k])));
  const res = ui.sim.s.map((sc, i) => active[i] ? simulate(d, e, mode, sc) : null);
  const cols = res.map((x, i) => x ? i : -1).filter(i => i >= 0);
  const line = (lab, f, cls = '') => `<tr class="${cls}"><td>${lab}</td>${money(f(r))}${cols.map(i => { const v = f(res[i]), dlt = v - f(r); return `${money(v)}<td class="n ${sgnCls(dlt)}">${dlt >= 0 ? '+' : ''}${fmt(dlt)}</td>`; }).join('')}</tr>`;
  const lineK = (k, lab) => line(lab, x => { const c = x.cmp.find(z => z.k === k) || x.cmpC.find(z => z.k === k); return c ? c.calc : 0; });
  let rows = '';
  if (cols.length) {
    if (mode === 'detail') fields.forEach(f => rows += line(f.l, x => x.b[f.k] || 0, 'sub'));
    rows += line('Revenu brut social', x => x.b.brut) + line('Base cotisations (R)', x => x.b.R) + line('Base CSG / CRDS', x => x.b.baseCSG);
    r.cmp.forEach(c => rows += lineK(c.k, c.l));
    r.cmpC.forEach(c => rows += lineK(c.k, 'CNBF — ' + c.l));
    rows += line(`Définitif ${e.annee} (total)`, x => x.totCalc, 'tot');
    rows += line(`Régularisation attendue vs provisionnel ${e.annee}`, x => x.totCalc - x.totProv);
    if (isG) rows += line('Coût total (rémunération art. 62 + AEN + CV + cotisations définitives)', x => x.b.remVersee + x.b.aen + x.b.chqVac + x.totCalc, 'sub');
    if (r.trim && r.trim.applicable) rows += line('Trimestres validés', x => x.trim.nb);
    rows += line('Madelin à réintégrer', x => x.m.reint);
  }
  const grid = `<div class="scroll"><table><tr><th>Élément saisi</th><th class="n">Actuel</th>${[0, 1, 2].map(i => `<th class="n">Scénario ${i + 1}</th>`).join('')}</tr>
    ${fields.map(f => `<tr><td>${f.l}</td>${money(curOf(f.k))}${[0, 1, 2].map(i => `<td class="n">${inp(`ui.sim.s.${i}.${f.k}`, ui.sim.s[i][f.k], 'num', 'num', `placeholder="${fmt0(curOf(f.k))}"`)}</td>`).join('')}</tr>`).join('')}
    </table></div><div class="row" style="margin-top:6px"><button class="sec sm" data-act="simReset">Vider les scénarios</button></div>`;
  return `<div class="card"><h2>Simulation des cotisations définitives ${e.annee} ${milBadge(r.pYear)}</h2>
    <p class="note">Une cellule vide reprend la valeur actuelle de l'exercice (affichée en grisé). Toutes choses égales par ailleurs : mêmes cotisations réglées dans l'année, options et paramètres. Les simulations ne modifient pas l'exercice.</p>
    <div class="grid">${fld('Mode de simulation', sel('ui.sim.mode', mode, { detail: isG ? 'Éléments de rémunération' : 'Résultat fiscal', brut: 'Revenu brut social (saisie directe)' }))}</div>
    ${grid}
    ${cols.length ? `<h3>Résultats</h3><div class="scroll"><table><tr><th>Élément</th><th class="n">Définitif calculé</th>${cols.map(i => `<th class="n">Scénario ${i + 1}</th><th class="n">Écart</th>`).join('')}</tr>${rows}</table></div>` : '<p class="note">Saisissez au moins une valeur dans un scénario.</p>'}
  </div>`;
}
