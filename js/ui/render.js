'use strict';
/* Rendu général : en-tête, onglets, carte active */

/* Onglets : « Style » (mise en page du cabinet) précède « Millésime » (dernier onglet),
   qui regroupe les sous-onglets « Paramètres millésimés » et « Formules & sources ». */
const MIL_SUBS = [['params', 'Paramètres millésimés'], ['formules', 'Formules & sources']];
function tabsFor(e) {
  const A = actDef(e ? e.activite : 'organic');
  return [
    ['dossier', 'Dossier'], ['urssaf', A.mode === 'msa' ? 'Appel MSA' : A.mode === 'ssi' ? 'Appel URSSAF / SSI' : 'Appel URSSAF'], ['caisse', 'Retraite – ' + A.caisse],
    ['impayes', 'Impayés'], ['revenus', 'Rémunération'], ['madelin', 'Madelin'], ['cotis', 'Cotisations N calculées'], ['simu', 'Simulation'],
    ...(e && e._civ ? [] : [['cloture', 'Clôture & écritures']]), ['d2042', 'Déclaration 2042'], ['histo', 'Historique'],
    ['style', 'Style'], ['millesime', 'Millésime']
  ];
}
/* Anciens identifiants d'onglets (versions précédentes) */
function normalizeTab() {
  if (ui.tab === 'appel') ui.tab = 'urssaf';
  if (ui.tab === 'params' || ui.tab === 'formules') { ui.sub = ui.tab; ui.tab = 'millesime'; }
  if (!MIL_SUBS.some(([k]) => k === ui.sub)) ui.sub = 'params';
}

function renderHeader() {
  const sd = document.getElementById('selDossier');
  const ds = Object.values(store.dossiers).sort((a, b) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom));
  sd.innerHTML = ds.map(d => `<option value="${d.id}" ${d.id === store.current ? 'selected' : ''}>${esc((d.nom || '').toUpperCase())} ${esc(d.prenom || '')}</option>`).join('');
  const d = curD(); const se = document.getElementById('selExo');
  se.innerHTML = d ? Object.keys(d.exercices).sort().reverse().map(y => `<option value="${y}" ${String(y) === String(d.current) ? 'selected' : ''}>${y}</option>`).join('') : '';
  const e = curE(); const mh = document.getElementById('milHeader');
  if (e) {
    if (e.fige) mh.innerHTML = milBadge(e.fige.pYear, ' (figé)') + ` <span class="badge err">🔒 ${esc(vueLib(e, true))} figé${e._civ ? 'e' : ''}</span>`;
    else { const { year, fallback, p } = paramsFor(e.annee); mh.innerHTML = milBadge(year, fallback ? ' (repli)' : '') + (p.verifie === false ? ' <span class="badge warn">non vérifié</span>' : '') + (p._local && isPublished(year) ? ' <span class="badge warn" title="Différente du millésime publié">version locale</span>' : ''); }
  } else mh.innerHTML = '';
  normalizeTab();
  if (ui.tab === 'cloture' && e && e._civ) ui.tab = 'revenus';
  const vb = document.getElementById('vueBox'), be = baseE();
  if (be && isDecale(be)) {
    vb.classList.remove('hide');
    vb.innerHTML = `<label>Version de l'année ${be.annee}</label><select id="selVue"><option value="bilan" ${curVue() === 'bilan' ? 'selected' : ''}>Bilan (${mm(be.finExercice)})</option><option value="civ" ${curVue() === 'civ' ? 'selected' : ''}>Année civile</option></select>${be.fige ? '<span class="note">bilan 🔒</span>' : ''}${be.civ && be.civ.fige ? '<span class="note">civile 🔒</span>' : ''}`;
  } else { vb.classList.add('hide'); vb.innerHTML = ''; }
  document.getElementById('tabs').innerHTML = tabsFor(e).map(([k, l]) => `<a data-tab="${k}" class="${ui.tab === k ? 'on' : ''}">${esc(l)}</a>`).join('');
}

const TAB_FN = () => ({ dossier: tabDossier, urssaf: tabUrssaf, caisse: tabCaisse, revenus: tabRevenus, cotis: tabCotis, simu: tabSimu, impayes: tabImpayes, madelin: tabMadelin, cloture: tabCloture, d2042: tab2042, histo: tabHisto, style: tabStyle, millesime: tabMillesime });
/* Onglets utilisables sans dossier ni calcul : Style, Millésime › Paramètres */
const isStandaloneTab = () => ui.tab === 'style' || (ui.tab === 'millesime' && ui.sub === 'params');

function render() {
  computeCache = new WeakMap(); civCache = new WeakMap();
  renderHeader();
  const d = curD(), e = curE(), main = document.getElementById('main');
  const storageMsg = storageOK ? '' : '<div class="alert warn">Le stockage local du navigateur est indisponible : pensez à exporter le dossier en .json avant de fermer la page.</div>';
  if (isStandaloneTab()) {
    main.innerHTML = storageMsg + TAB_FN()[ui.tab](d, e, null);
    decorateCards(main);
    lockControlledParams(main);
    return;
  }
  if (!d || !e) { main.innerHTML = '<div class="card">Aucun dossier. Créez-en un avec « + Nouveau ».</div>'; return; }
  let r;
  try { r = compute(d, e); } catch (err) { main.innerHTML = `<div class="alert err">Erreur de calcul : ${esc(err.message)}</div>`; console.error(err); return; }
  const fn = TAB_FN()[ui.tab] || tabDossier;
  const frozen = e.fige ? `<div class="alert err frozenBar"><b>🔒 ${esc(vueLib(e, true))} figé${e._civ ? 'e' : ''} le ${new Date(e.fige.le).toLocaleString('fr-FR')}.</b> Saisies verrouillées ; calculs basés sur l'instantané des paramètres (barème ${e.fige.pYear}), des comptes et de l'identité du dossier pris au moment du gel. <button class="sm dang" data-act="unfreeze">Défiger</button></div>`
    : `<div class="row" style="justify-content:flex-end;margin-bottom:6px"><button class="sec sm" data-act="freeze" title="Verrouille les saisies et fige paramètres et comptes">🔒 Figer l'${esc(vueLib(e))}</button></div>`;
  const be = baseE(), cd = be.civ && be.civ.data && Object.keys(be.civ.data).length;
  const civBar = e._civ ? `<div class="alert info"><b>Vue « Année civile ${e.annee} »</b> (01/01/${e.annee} → 31/12/${e.annee}), barème et taux ${r.pYear} : tous les éléments sont repris de l'exercice clos ${mm(be.finExercice)}/${e.annee}. Une saisie dans cette vue (bordure verte) ne concerne que l'année civile et ne modifie pas l'exercice.${cd && !e.fige ? ' <button class="sec sm" data-act="civReset">Reprendre tous les éléments de l\'exercice</button>' : ''}</div>` : '';
  const tools = `<div class="row" style="justify-content:space-between;margin-bottom:6px;gap:6px"><span class="note">🖩 Calculette : dans toute case numérique, saisissez une opération (ex. <b>1 200,50 + 350*2</b>, <b>48060/12</b>) — elle est calculée à la validation.</span><span class="row" style="gap:6px"><button class="sec sm" data-act="expandAll">Tout déplier</button><button class="sec sm" data-act="collapseAll">Tout replier</button></span></div>`;
  main.innerHTML = storageMsg + (ui.tab === 'histo' ? '' : frozen + civBar) + tools + fn(d, e, r);
  decorateCards(main);
  if (e._civ) {
    const cdata = civData(baseE());
    main.querySelectorAll('[data-b^="e."]').forEach(el => {
      if (getPath(cdata, el.dataset.b.slice(2)) === undefined) return;
      (el.type === 'checkbox' ? el.closest('label') || el : el).classList.add('civmod');
      el.title = (el.title ? el.title + ' — ' : '') + 'Modifié pour l\'année civile (videz pour revenir à la valeur de l\'exercice si elle est vide)';
    });
  }
  if (e.fige) {
    main.querySelectorAll('[data-b^="e."]').forEach(el => { el.disabled = true; });
  }
}
/* Cartes repliables (état mémorisé par onglet / sous-onglet) */
function decorateCards(main) {
  store.collapsed = store.collapsed || {};
  const tabKey = ui.tab === 'millesime' ? 'millesime-' + ui.sub : ui.tab;
  main.querySelectorAll('.card').forEach((c, i) => {
    const key = tabKey + ':' + i; c.dataset.ck = key;
    const h = c.querySelector(':scope > h2');
    if (h) { h.classList.add('tog'); h.insertAdjacentHTML('afterbegin', '<span class="chev">▾</span>'); }
    if (store.collapsed[key]) c.classList.add('collapsed');
  });
}
