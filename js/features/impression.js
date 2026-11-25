'use strict';
/* Récapitulatif PDF et récapitulatif client (impression) */

/* Remplace les champs de saisie par du texte imprimable ; les montants calculés / pré-remplis (sans saisie) sont marqués « calc. » */
function printableInputs(pa) {
  pa.querySelectorAll('button, #tresoTotal').forEach(b => b.remove());
  pa.querySelectorAll('input, select, textarea').forEach(el => {
    let t, calc = false;
    if (el.type === 'date') t = frDate(el.value);
    else if (el.type === 'checkbox') t = el.checked || el.hasAttribute('checked') ? '☑' : '☐';
    else if (el.tagName === 'SELECT') t = el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : '';
    else {
      t = el.value || el.textContent || '';
      const ph = el.placeholder || '';
      if (!t && ph && !/^\?|inconnu|jjmm/.test(ph)) {
        if (el.classList.contains('num')) { t = ph; calc = true; }
      }
    }
    const s = document.createElement('span'); s.textContent = t;
    if (el.classList.contains('num')) s.style.cssText = 'display:inline-block;min-width:60px;text-align:right';
    if (calc) { const c = document.createElement('span'); c.className = 'calc'; c.textContent = 'calc.'; s.appendChild(c); }
    el.replaceWith(s);
  });
}
/* En-tête et pied d'impression : logo et dénomination de l'onglet « Style » (aucun si non renseignés) */
const printHeadHtml = (d, e, sous) => `<div class="printHead">${STYLE.logo ? `<img src="${esc(STYLE.logo)}" alt="${esc(STYLE.denomination)}">` : ''}<div><div class="t1">${esc(STYLE.denomination || APP_NAME)}</div><div class="t2">${sous} — dossier ${esc(d.prenom)} ${esc(d.nom)} — ${esc(vueLib(e))}</div></div></div>`;
const footDoc = () => STYLE.denomination ? `${esc(STYLE.denomination)} — document` : 'Document';
function launchPrint(html, cls) {
  const pa = document.getElementById('printArea'); pa.className = cls || ''; pa.innerHTML = html;
  printableInputs(pa);
  const imgs = [...pa.querySelectorAll('img')];
  Promise.all(imgs.map(i => i.decode ? i.decode().catch(() => {}) : null)).then(() => setTimeout(() => window.print(), 50));
}

async function printRecap() {
  const d = curD(), e = curE(); if (!d || !e) return;
  const A0 = actDef(e.activite);
  /* Pages des PDF archivés, insérées à la suite de la section où ils ont été chargés */
  const btn = document.getElementById('btnPdf'), lib0 = btn.textContent;
  const pages = { appel: '', caisse: '' };
  if (docList(baseE(), 'appel').length || (A0.mode === 'pl' && docList(baseE(), 'caisse').length)) {
    btn.disabled = true; btn.textContent = 'Préparation des PDF…';
    try {
      pages.appel = await docPagesHtml('appel', A0.mode === 'msa' ? 'Appel MSA' : 'Appel Urssaf');
      if (A0.mode === 'pl') pages.caisse = await docPagesHtml('caisse', 'Appel ' + A0.caisse);
    } finally { btn.disabled = false; btn.textContent = lib0; }
  }
  const r = compute(d, e);
  const keepTab = ui.tab;
  PRINTING = true;
  let html;
  try {
    html = `${printHeadHtml(d, e, 'Cotisations sociales des travailleurs indépendants')}
    <h1>Récapitulatif des cotisations ${e.annee} — ${esc(d.prenom)} ${esc(d.nom)}${isDecale(baseE()) ? ' — ' + esc(vueLib(e)) : ''}</h1>
    <p>${d.nir ? `N° de sécurité sociale : ${esc(nirFmt(e.fige && e.fige.ident && e.fige.ident.nir !== undefined ? e.fige.ident.nir : d.nir))} · ` : ''}${esc(STATUTS[e.statut] || '')} · ${esc(actDef(e.activite).l)} · régime ${esc(REGIMES[e.regime] || '')} · ${e._civ ? 'période' : 'exercice'} du ${frDate(e.debutExercice)} au ${frDate(e.finExercice)} · édité le ${new Date().toLocaleDateString('fr-FR')} · ${milBadge(r.pYear, r.fallback ? ' (repli)' : '')} ${r.p.verifie === false ? '<span class="badge warn">paramètres non vérifiés</span>' : ''} ${e.fige ? `<span class="badge err">🔒 Exercice figé le ${new Date(e.fige.le).toLocaleDateString('fr-FR')}</span>` : ''}</p>
    ${warnList(r.W)}
    <table><tr><th>Indicateur</th><th class="n">Montant</th></tr>
    <tr><td>Revenu brut social ${e.annee}</td>${money(r.b.brut)}</tr><tr><td>Base cotisations (R)</td>${money(r.b.R)}</tr><tr><td>Base CSG/CRDS</td>${money(r.b.baseCSG)}</tr>
    <tr><td>Régularisation ${e.annee - 1} (courrier)</td>${money(r.tot.regul + r.tot.cnbf_regul)}</tr>
    <tr><td>Provisionnel ${e.annee} retenu</td>${money(r.totProv)}</tr><tr><td>Définitif ${e.annee} recalculé</td>${money(r.totCalc)}</tr>
    <tr class="tot"><td>Régularisation ${e.annee} attendue (année civile)</td>${money(r.totCalc - r.totProv)}</tr>
    ${r.pr.decale ? `<tr><td>CCA des cotisations ${e.annee} (${r.pr.moisApres}/12)</td>${money(r.totCalc * r.pr.moisApres / 12)}</tr>` : ''}
    <tr><td>Madelin à réintégrer</td>${money(r.m.reint)}</tr></table>
    <p class="note"><span class="calc">calc.</span> = montant calculé ou pré-rempli par l'outil (aucune saisie manuelle).</p>`;
    const A = actDef(e.activite);
    const S = [
      ['Dossier et options', tabDossier(d, e, r)],
      [A.mode === 'msa' ? 'Appel MSA' : 'Appel URSSAF', tabUrssaf(d, e, r) + pages.appel],
      ['Retraite – ' + A.caisse, tabCaisse(d, e, r) + pages.caisse],
      r.ech.actif ? ['Impayés', tabImpayes(d, e, r)] : null,
      ['Rémunération', tabRevenus(d, e, r)],
      ['Madelin', tabMadelin(d, e, r)],
      ['Cotisations ' + e.annee + ' calculées', tabCotis(d, e, r)],
      e._civ ? null : ['Clôture et écritures Pennylane', tabCloture(d, e, r)],
      ['Déclaration 2042', tab2042(d, e, r)],
      ['Formules, millésime et sources', tabFormules(d, e, r)]
    ].filter(Boolean);
    /* Chaque section (après la première, qui suit la synthèse) commence sur une nouvelle page */
    html += S.map(([t, c], i) => `${i ? '<div class="pb"></div>' : ''}<h2>${i + 1}. ${esc(t)}</h2>${c}`).join('');
    html += `<div class="printFoot">${footDoc()} édité le ${new Date().toLocaleDateString('fr-FR')} — calculs indicatifs à rapprocher des appels des organismes.</div>`;
  } finally { PRINTING = false; ui.tab = keepTab; }
  launchPrint(html, '');
}

/* Récapitulatif client : une page A4, sans formule — cases à déclarer, détail de la rémunération, plafonds Madelin */
function printClient() {
  const d = curD(), e = curE(); if (!d || !e) return;
  const r = compute(d, e), N = e.annee, dc = r.d42.dc;
  const lignes = r.d42.rows.filter(x => rnd(x.v) !== 0);
  const rem = remRows(e, r).filter(x => Math.abs(x.v) >= 0.005);
  const srcRem = `Rémunération ${vueShort(e)}`;
  const html = `${printHeadHtml(d, e, 'Déclaration des revenus')}
    <div class="client-page">
    <h1>Récapitulatif client — revenus ${N} (déclaration ${N + 1})</h1>
    <p>${esc(d.titre ? d.titre + ' ' : '')}${esc(d.prenom)} ${esc(d.nom)} · ${esc(STATUTS[e.statut] || '')} · déclarant ${dc} · ${e._civ ? 'année civile' : 'exercice'} du ${frDate(e.debutExercice)} au ${frDate(e.finExercice)} · édité le ${new Date().toLocaleDateString('fr-FR')}</p>
    <h2>1. Montants à reporter sur la déclaration des revenus ${N}</h2>
    ${lignes.length ? `<table><tr><th>Zone</th><th>Case</th><th>Libellé</th><th class="n">Montant (€)</th></tr>
      ${lignes.map(x => `<tr><td>${esc(x.zone)}</td><td><b>${esc(x.code)}</b></td><td>${esc(x.lib)}</td><td class="n"><b>${fmt0(rnd(x.v))}</b></td></tr>`).join('')}</table>` : '<p>Aucun montant à déclarer.</p>'}
    <p class="note">Montants arrondis à l'euro. Les versements retraite déduits du revenu professionnel ne doivent pas être déclarés une seconde fois en case 6NS / 6NT.</p>
    <h2>2. Détail de la rémunération à déclarer — ${esc(srcRem)}</h2>
    <table><tr><th>Élément</th><th class="n">Montant (€)</th><th>Commentaire</th></tr>
      ${rem.map(x => `<tr><td>${esc(x.l)}</td>${money(x.v)}<td>${esc(x.com || '')}</td></tr>`).join('') || '<tr><td colspan="3">Aucun élément saisi.</td></tr>'}
      <tr class="tot"><td>Revenu brut social (assiette super brute)</td>${money(r.b.brut)}<td></td></tr>
      <tr><td>Base CSG / CRDS</td>${money(r.b.baseCSG)}<td></td></tr><tr><td>Base sociale (R)</td>${money(r.b.R)}<td></td></tr></table>
    <h2>3. Plafonds de déduction Madelin ${N}</h2>
    <p style="margin:2px 0">Base retenue : <b>${fmt(r.m.base)} €</b> · PASS ${r.pYear} : ${fmt0(r.p.pass)} €</p>
    ${madTable(r.b, r.m)}
    <p class="note">Le montant « à réintégrer » excède le plafond de déduction : il n'est pas déductible du revenu imposable.</p>
    <div class="printFoot">${footDoc()} établi le ${new Date().toLocaleDateString('fr-FR')} à partir des éléments communiqués ; à vérifier avec la notice officielle de la déclaration ${N + 1}.</div>
    </div>`;
  launchPrint(html, 'client');
}
