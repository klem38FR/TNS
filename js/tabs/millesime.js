'use strict';
/* Onglet Millésime : sous-onglets Paramètres millésimés et Formules & sources */

/* ---------- Onglet Millésime (sous-onglets) ---------- */
function tabMillesime(d, e, r) {
  const nav = `<div class="subnav">${MIL_SUBS.map(([k, l]) => `<a data-sub="${k}" class="${ui.sub === k ? 'on' : ''}">${esc(l)}</a>`).join('')}</div>`;
  if (ui.sub === 'formules') return nav + (d && e && r ? tabFormules(d, e, r) : '<div class="card">Aucun dossier : les formules sont présentées pour l\'exercice sélectionné.</div>');
  return nav + tabParams();
}

/* ---------- Paramètres ---------- */
/* Statut d'un millésime : publié (dépôt) / version locale d'un millésime publié / créé localement */
function milStatus(y, p) {
  if (isPublished(y) && !p._local) return { cls: 'ok', lib: 'publié', txt: `Millésime publié avec l'application (données publiques du dépôt), rechargé à chaque ouverture.` };
  if (isPublished(y)) return { cls: 'warn', lib: 'version locale', txt: `Version locale du millésime publié ${y} : elle diffère de la version publiée${PUBLISHED[y].maj ? ' (mise à jour du ' + PUBLISHED[y].maj + ')' : ''} et n'est conservée que dans ce navigateur.` };
  return { cls: 'warn', lib: 'créé localement', txt: `Millésime créé dans l'application : il n'existe que dans ce navigateur (exportez-le si besoin). Un millésime ${y} publié ultérieurement ne le remplacera pas automatiquement.` };
}
function tabParams() {
  const ys = Object.keys(store.params).sort();
  if (!store.params[ui.paramYear]) ui.paramYear = Number(ys[ys.length - 1]);
  const p = store.params[ui.paramYear], y = ui.paramYear, ctl = isControlled(p), st = milStatus(y, p);
  const newer = isPublished(y) && p._local;
  let h = `<div class="card${ctl ? ' locked' : ''}" id="paramsCard"><h2>Paramètres millésimés ${milBadge(y)} ${ctl ? '<span class="badge ok">🔒 contrôlé</span>' : '<span class="badge warn">non vérifié</span>'} <span class="badge ${st.cls}">${esc(st.lib)}</span></h2>
    <div class="row">
      <label>Millésime</label><select data-b="ui.paramYear" data-t="int">${ys.map(v => `<option ${String(v) === String(y) ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <button class="sm" data-act="dupParams">Créer ${Math.max(...ys.map(Number)) + 1} à partir de ${Math.max(...ys.map(Number))}</button>
      <button class="sec sm" data-act="exportParams">Exporter les paramètres</button>
      <button class="sec sm" data-act="importParams">Importer des paramètres</button>
      ${newer ? `<button class="sec sm" data-act="resetPublished">Rétablir la version publiée ${y}</button>` : ''}
      ${isPublished(y) ? '' : '<button class="dang sm" data-act="delParams">Supprimer ce millésime</button>'}
    </div>
    <p class="note">${esc(st.txt)}</p>
    ${ctl ? `<div class="alert info">🔒 Valeurs contrôlées : elles ne sont pas modifiables. Pour les modifier, décochez « Valeurs contrôlées » (un avertissement est affiché) : le millésime devient alors une version locale non vérifiée.</div>` : `<div class="alert warn">Millésime non vérifié : les valeurs sont modifiables et les calculs qui l'utilisent sont signalés. Cochez « Valeurs contrôlées » une fois les valeurs contrôlées : elles seront verrouillées.</div>`}
    <p class="note">Chaque année possède son jeu complet de paramètres ; les années passées restent figées. Un exercice N utilise le millésime N (ou, à défaut, le plus récent antérieur, signalé « repli »). Les taux en % sont saisis en pourcentage (ex. 17,87).</p>
    <div class="grid">
      ${fld('Paramètres vérifiés', `<label class="row"><input type="checkbox" data-b="p.verifie" data-t="bool" ${ctl ? 'checked' : ''}> Valeurs contrôlées pour ${y}</label>`)}
      ${fld('Date de mise à jour', txt('p.maj', p.maj))}
      ${fld('Origine', txt('p.origine', p.origine))}
    </div>`;
  let grp = '';
  PSCHEMA.forEach(s => {
    if (s.g) { if (grp) h += '</div>'; h += `<h3>${s.g}</h3><div class="grid">`; grp = s.g; return; }
    const v = getPath(p, s.k);
    let c;
    if (s.t === 'pct') c = `<input class="num" data-b="p.${s.k}" data-t="pct" value="${v === null || v === undefined || v === '' ? '' : esc(showV(r6(v * 100)))}"> `;
    else if (s.t === 'arr') c = `<input data-b="p.${s.k}" data-t="arr" value="${esc((v || []).map(showV).join(' ; '))}">`;
    else c = inp('p.' + s.k, v);
    h += fld(s.l + (s.t === 'pct' ? ' (%)' : ''), c);
  });
  h += `</div><h3>Barèmes des sections professionnelles (format JSON, un bloc par caisse)</h3>
    <p class="note">t : prop (forfait + taux × assiette bornée : plancherPass / plafPass en multiples du PASS ou plancher / plafond en € ; tranche = part comprise entre plancher et plafond ; clampBas = assiette au moins égale au plancher), classes ([classe, revenu maximal, montant]), choix (classe choisie), forfait (montant), multiple (unité × classe). ref : N-1 / N-2 = revenu de l'année de référence, sans régularisation. Valeur vide (null) = barème non renseigné.</p>
    ${Object.keys(ACTIVITES_DEF).filter(k => (p.caisses || {})[k]).map(k => `<details><summary>${esc(ACTIVITES_DEF[k].l)}</summary><textarea data-b="p.caisses.${k}" data-t="json" style="min-height:160px;font-family:Consolas,monospace;font-size:12px">${esc(JSON.stringify(p.caisses[k], null, 1))}</textarea></details>`).join('')}
    <h3>MSA (format JSON)</h3><details><summary>Barème MSA ${ui.paramYear}</summary><textarea data-b="p.msa" data-t="json" style="min-height:200px;font-family:Consolas,monospace;font-size:12px">${esc(JSON.stringify(p.msa || {}, null, 1))}</textarea></details>
    <div class="grid" style="margin-top:8px">${fld('Provisionnel de l\'année appelé selon l\'ancien régime d\'assiette', `<label class="row"><input type="checkbox" data-b="p.provAncienRegime" data-t="bool" ${p.provAncienRegime ? 'checked' : ''}> Ne pas recalculer le provisionnel ${ui.paramYear}</label>`)}</div>
    <h3>Sources du millésime (une par ligne)</h3><textarea data-b="p.sources" data-t="lines">${esc((p.sources || []).join('\n'))}</textarea>
    <h3>Points non vérifiés / à surveiller</h3><textarea data-b="p.aVerifier" data-t="lines">${esc((p.aVerifier || []).join('\n'))}</textarea></div>`;
  return h;
}
const r6 = x => Math.round(x * 1e6) / 1e6;
/* Millésime contrôlé : tous les champs du millésime sont verrouillés, sauf la case « Valeurs contrôlées » */
function lockControlledParams(main) {
  if (!(ui.tab === 'millesime' && ui.sub === 'params')) return;
  const p = store.params[ui.paramYear];
  if (!isControlled(p)) return;
  main.querySelectorAll('[data-b^="p."]').forEach(el => { if (el.dataset.b !== 'p.verifie') { el.disabled = true; el.title = 'Valeur contrôlée : décochez « Valeurs contrôlées » pour la modifier'; } });
}

/* ---------- Formules ---------- */
function formulas(p, y) {
  const P = p.pass, mb = p.maladie.bornes, mt = p.maladie.taux;
  const L = [];
  L.push(['Année incomplète', 'Début ou cessation en cours d\'année (dates de l\'onglet Dossier) : PASS proratisé au jour = PASS × jours d\'activité dans l\'année / jours de l\'année, appliqué aux seuils du taux maladie, aux bornes IJ, aux seuils AF, aux plafonds retraite de base, RCI tranche 1 et invalidité-décès (et à son assiette minimale). Non proratisés : minimum retraite de base, RCI tranche 2, CFP, bornes de l\'abattement, caisses libérales, CNBF, MSA. Source : règles du simulateur Urssaf mon-entreprise (modele-social) ; D131-1 CSS (version 2017 : plafond réduit au prorata de la durée d\'affiliation).']);
  L.push(['Assiette', `Abattement = MIN( MAX( ${pc(p.abatt.taux, 0)} × brut ; ${pc(p.abatt.minPct)} × PASS ) ; ${pc(p.abatt.maxPct, 0)} × PASS ) ; brut (assiette super brute) = éléments saisis − revenus de remplacement (fiscalisé CPAM, organisme privé, ALD) ; base CSG = brut − abattement ; R = base CSG − chèques vacances ≤ ${pc(p.chqvac.pctSmicMens, 0)} SMIC mensuel − ${fmt(1 - p.abatt.taux, 2)} × (abondements + intéressement) + ${fmt(1 - p.abatt.taux, 2)} × (revenu de remplacement fiscalisé + IJ organisme privé) ; CSG-CRDS au taux réduit des revenus de remplacement sur ${fmt(1 - p.abatt.taux, 2)} × (revenus non précomptés + ALD)`]);
  L.push(['Arrondi des taux', `Taux progressifs (maladie-maternité, AMEXA, allocations familiales) arrondis à ${Math.max(0, arrT(p) - 2)} décimale(s) en % avant application (ex. 6,163 % → 6,16 %)`]);
  L.push(['Maladie-maternité', mb.map((b, i) => i === 0 ? `R < ${b} PASS : ${mt[0]} %` : `${mb[i - 1]}–${b} PASS : ${mt[i - 1]} % → ${mt[i]} % (linéaire)`).join(' ; ') + ` ; au-delà de ${mb[mb.length - 1]} PASS : ${mt[mt.length - 1]} % × ${mb[mb.length - 1]} PASS + ${p.maladie.tauxSup} % × fraction excédentaire`]);
  L.push(['Indemnités journalières', `${pc(p.ij.taux)} × MIN( MAX(R ; ${p.ij.minPct} PASS) ; ${p.ij.maxPct} PASS ) — avocat : ${pc(p.cnbf.ij_taux)} × MIN(R ; ${p.cnbf.ij_plafPass} PASS)`]);
  L.push(['Allocations familiales', `taux = MIN( ${pc(p.af.taux)} ; MAX(0 ; ${pc(p.af.taux)} / (${fmt(p.af.haut - p.af.seuil, 1)} PASS) × (R − ${p.af.seuil} PASS)) ) × R`]);
  L.push(['Retraite de base', `${pc(p.rb.t1)} × MIN(R ; PASS), minimum ${pc(p.rb.t1)} × ${p.rb.minHeures} h × SMIC (${fmt(p.rb.t1 * p.rb.minHeures * p.smic_h)}) ; + ${pc(p.rb.t2)} × (R − PASS)`]);
  L.push(['Retraite complémentaire', `${pc(p.rc.t1)} × MIN(R ; ${p.rc.plafT1} PASS) + ${pc(p.rc.t2)} × (MIN(R ; ${p.rc.plafT2} PASS) − ${p.rc.plafT1} PASS)`]);
  L.push(['Invalidité-décès', `${pc(p.id.taux)} × MIN(R ; PASS), minimum ${pc(p.id.taux)} × ${pc(p.id.minPct, 1)} PASS (${fmt(p.id.taux * p.id.minPct * P)})`]);
  L.push(['CSG / CRDS', `${pc(p.csg.total)} × base CSG, dont ${pc(p.csg.ded)} déductible et ${pc(p.csg.nd)} non déductible`]);
  L.push(['Professions libérales (Urssaf)', `IJ ${pc(p.pl.ij.taux)} × MIN( MAX(R ; ${p.pl.ij.minPct} PASS) ; ${p.pl.ij.maxPct} PASS ) ; CURPS : médecins ${pc(p.pl.curps.carmf)}, dentistes ${pc(p.pl.curps.carcdsf_cd)}, sages-femmes ${pc(p.pl.curps.carcdsf_sf)}, auxiliaires ${pc(p.pl.curps.carpimko)} × R, plafond ${fmt0(p.pl.curpsPlaf)} € ; PAMC : + ${pc(p.pl.pamcSupp)} sur la part non conventionnée, participation de l'Assurance maladie saisie`]);
  L.push(['Retraite de base CNAVPL', `${pc(p.cnavpl.t1)} × MIN(R ; PASS) + ${pc(p.cnavpl.t2)} × MIN(R ; ${p.cnavpl.plafT2} PASS), minimum (${pc(p.cnavpl.t1)} + ${pc(p.cnavpl.t2)}) × ${p.cnavpl.minHeures} × SMIC = ${fmt0(rnd(p.cnavpl.minHeures * p.smic_h * (p.cnavpl.t1 + p.cnavpl.t2)))} €`]);
  L.push(['Cipav', `Complémentaire ${pc(p.cipav.rc.t1)} × MIN(R ; ${p.cipav.rc.plafT1} PASS) + ${pc(p.cipav.rc.t2)} × (MIN(R ; ${p.cipav.rc.plafT2} PASS) − ${p.cipav.rc.plafT1} PASS) ; invalidité-décès ${pc(p.cipav.id.taux)} × MIN( MAX(R ; ${p.cipav.id.minPct} PASS) ; ${p.cipav.id.plafPass} PASS )`]);
  Object.entries(p.caisses || {}).forEach(([k, comps]) => L.push([ACTIVITES_DEF[k] ? ACTIVITES_DEF[k].l : k, comps.map(c => `${c.l} : ` + (c.t === 'forfait' ? (c.montant == null ? 'non renseigné' : fmt(c.montant) + ' €') : c.t === 'prop' ? (c.secteur ? `S1 ${fmt(c.s1.forfait)} € + ${pc(c.s1.taux, 4)} / S2 ${fmt(c.s2.forfait)} € + ${pc(c.s2.taux, 4)}` : `${c.forfait ? fmt(c.forfait) + ' € + ' : ''}${c.taux == null ? '?' : pc(c.taux, 4)} × ${c.tranche ? 'part du revenu' : 'revenu'}${c.plancherPass !== undefined ? ' de ' + c.plancherPass + ' PASS' : c.plancher ? ' de ' + fmt0(c.plancher) + ' €' : ''}${c.plafPass !== undefined ? ' à ' + c.plafPass + ' PASS' : c.plafond ? ' à ' + fmt0(c.plafond) + ' €' : ''}${c.minPass ? ', minimum sur ' + c.minPass + ' PASS' : ''}`) : c.t === 'classes' ? (c.classes || []).map(x => `${x[0]} ${x[1] == null ? '>' : '≤ ' + fmt0(x[1])} : ${fmt(x[2])} €`).join(' ; ') || 'non renseigné' : c.t === 'choix' ? Object.values(c.choix).map(v => `${v[0]} ${fmt(v[1])} €`).join(' ; ') : c.t === 'multiple' ? (c.unite == null ? 'non renseigné' : `classe × ${fmt(c.unite)} €`) : '') + (c.ref && c.ref.startsWith('N') ? ` [revenu ${c.ref}]` : '')).join(' | ')]));
  L.push(['CFP', `PASS × taux : commerçant ${pc(p.cfp.commercant)}, artisan ${pc(p.cfp.artisan)}, PL SSI ${pc(p.cfp.pl_ssi)}, avocat ${pc(p.cfp.avocat)}, avec conjoint ${pc(p.cfp.conj_commercant)} (artisan avec conjoint : ${p.cfp.conj_artisan == null ? 'non renseigné' : pc(p.cfp.conj_artisan)})`]);
  L.push(['ACRE', `R ≤ ${p.acre.seuilBas} PASS : ${pc(p.acre.taux, 0)} × cotisations éligibles ; ${p.acre.seuilBas}–${p.acre.seuilHaut} PASS : MIN(${pc(p.acre.taux, 0)} × dues ; 0,25 E / (0,25 PASS) × (PASS − R)) ; ≥ PASS : 0 ; × mois/12`]);
  L.push(['CNBF', `RB forfaitaire ${p.cnbf.rb_forf.join(' / ')} € ; RB proportionnelle ${pc(p.cnbf.rb_taux)} × MIN(R ; ${fmt0(p.cnbf.rb_plaf)}) (début : ${pc(p.cnbf.debutPctPass, 0)} PASS) ; droits de plaidoirie = ARRONDI(MIN(R ; ${fmt0(p.cnbf.dp_plaf)}) / ${p.cnbf.dp_valeur}) × ${p.cnbf.dp_montant} € − droits versés ; RC par tranches et classe ; ID ${p.cnbf.id_debut} / ${p.cnbf.id_plein} / ${p.cnbf.id_retraite} €`]);
  L.push(['Madelin', 'Voir onglet Madelin (prévoyance, perte d\'emploi, retraite) — PASS ' + y]);
  L.push(['Trimestres de retraite de base', `MIN( ${(p.trim || {}).max || 4} ; ENT( MAX(revenu retraite ; ${p.rb.minHeures} × SMIC) / (${(p.trim || {}).heures || 150} × SMIC horaire au 01/01 = ${fmt(((p.trim || {}).heures || 150) * p.smic_h)}) ) )`]);
  L.push(['Majorations de retard', `${pc(p.retard.initiale)} du reste dû + ${pc(p.retard.mensuelle)} par mois ou fraction`]);
  L.push(['Clôture', 'Régularisation N attendue = définitif N recalculé − provisionnel N (année civile, sans prorata), en date de clôture, extournée à J+1 ; exercice décalé : CCA = cotisations N (provisionnel + régularisation) × x/12, x = mois entre la clôture et le 31/12, extournée à J+1 ; paiements en charges : + provision des échéances N restant dues après la clôture − CCA ; recettes-dépenses : reclassement des quotes-parts payées uniquement']);
  return L;
}
function tabFormules(d, e, r) {
  const p = r.p;
  return `<div class="card"><h2>Formules appliquées à l'${esc(vueLib(e))} ${milBadge(r.pYear)}</h2>
    ${formulas(p, r.pYear).map(([t, f]) => `<div><b>${t}</b><div class="formula">[Barème ${r.pYear}] ${esc(f)}</div></div>`).join('')}
  </div>
  <div class="card"><h2>Sources du millésime ${r.pYear}</h2><ul>${(p.sources || []).map(s => `<li>${esc(s)}</li>`).join('')}</ul>
    <h3>Points non vérifiés</h3><ul>${(p.aVerifier || []).map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>
  <div class="card"><h2>Écarts volontaires par rapport au classeur Excel</h2><ul>
    <li>Maladie-maternité au-delà de 3 PASS : le classeur applique 6,5 % à la totalité du revenu ; l'application applique 8,5 % jusqu'à 3 PASS puis 6,5 % sur la fraction excédentaire (décret du 5/07/2024, cf. sources).</li>
    <li>Base Madelin : le classeur additionne deux fois « Autres revenus » (D6) et inclut les dividendes alors que sa note les exclut ; l'application compte « Autres revenus » une fois et exclut les dividendes.</li>
    <li>Taux progressifs arrondis à 2 décimales en % (ex. base 49 627 € : 6,163 % → 6,16 %, soit 3 057 € comme l'Urssaf, au lieu de 3 059 €).</li>
    <li>Régularisation N-1 : saisie « définitif » et « déjà appelé » distinctes (régularisation = différence) ; si seule la régularisation est connue, la saisir en « définitif ».</li>
  </ul></div>`;
}
