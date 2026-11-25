'use strict';
/* Onglet Historique */

/* ---------- Historique ---------- */
function tabHisto(d) {
  const ys = Object.keys(d.exercices).sort();
  const row = (y, e, vue) => {
    let r; try { r = compute(d, e); } catch (err) { return `<tr><td>${y}</td><td colspan="10">Erreur : ${esc(err.message)}</td></tr>`; }
    const tag = vue === 'civ' ? '<span class="badge" title="Année civile">civ</span>' : isDecale(e) ? `<span class="badge" title="Exercice clos ${mm(e.finExercice)}/${y}">exr ${mm(e.finExercice)}</span>` : '';
    return `<tr><td><a href="#" data-act="goExo" data-y="${y}" data-vue="${vue}">${y}</a> ${tag}${e.fige ? ' 🔒' : ''}</td><td>${esc(actDef(e.activite).l)}</td><td>${esc(STATUTS[e.statut] || e.statut)}</td><td>${milBadge(r.pYear)}</td>${money(r.b.brut)}${money(r.b.R)}${money(r.tot.regul + r.tot.cnbf_regul)}${money(r.totProv)}${money(r.totCalc)}${money(r.totCalc - r.totProv, sgnCls(r.totCalc - r.totProv))}</tr>`;
  };
  const rows = ys.map(y => { const e = d.exercices[y]; return row(y, e, 'bilan') + (isDecale(e) ? row(y, civView(e), 'civ') : ''); }).join('');
  return `<div class="card"><h2>Historique de ${esc(d.prenom)} ${esc(d.nom)}</h2>
    <div class="scroll"><table><tr><th>Année N</th><th>Activité</th><th>Statut</th><th>Paramètres</th><th class="n">Brut social</th><th class="n">Base R</th><th class="n">Régul. N-1 (courrier)</th><th class="n">Provisionnel N</th><th class="n">Définitif N estimé</th><th class="n">Régul. N attendue</th></tr>${rows}</table></div>
    <p class="note">exr mm = exercice clos le mois mm (bilan) ; civ = année civile (exercice décalé). Chaque exercice garde son activité, son statut et ses saisies ; chaque calcul utilise les paramètres du millésime de son année. Pour un exercice décalé, les revenus de l'année civile alimentent l'historique et les revenus N-1 / N-2 des années suivantes. « + Exercice N+1 » reprend le paramétrage (activité, conjoint, ACRE restant, ancienneté CNBF) et les dates décalées d'un an.</p></div>`;
}
