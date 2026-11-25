'use strict';
/* Liaison des champs, calculette, dates, téléchargements, CSV */

/* ------------------------------------------------------------------ */
/* 9. ÉVÉNEMENTS & ACTIONS                                             */
/* ------------------------------------------------------------------ */
function rootFor(path) {
  const [root, ...rest] = path.split('.');
  const obj = root === 'd' ? curD() : root === 'e' ? (curVue() === 'civ' ? civData(baseE()) : baseE()) : root === 'p' ? store.params[ui.paramYear] : root === 'ui' ? ui : root === 's' ? STYLE : null;
  return { obj, sub: rest.join('.') };
}
function parseVal(el) {
  const t = el.dataset.t, v = el.value;
  if (t === 'bool') return el.checked;
  if (t === 'text') return v;
  if (t === 'date') return parseDateFlex(v);
  if (t === 'bool2') return v === 'true';
  if (t === 'nir') return nirClean(v);
  if (t === 'json') { try { return JSON.parse(v); } catch (err) { return undefined; } }
  if (NUM_T.includes(t)) {
    const x = calcEval(v);
    if (x === null) return undefined;
    if (x === '') return t === 'pct' ? null : '';
    return t === 'int' ? Math.round(x) : t === 'pct' ? r6(x / 100) : x;
  }
  if (t === 'arr') return v.split(';').map(s => s.trim()).filter(s => s !== '').map(n);
  if (t === 'lines') return v.split('\n').map(s => s.trim()).filter(Boolean);
  return v.trim() === '' ? '' : n(v);
}
const NUM_T = ['num', 'int', 'pct'];
function onBind(el) {
  const path = el.dataset.b; if (!path) return;
  const { obj, sub } = rootFor(path); if (!obj) return;
  if (path.startsWith('e.') && curE() && curE().fige) { scheduleRender(); return; }
  if (path.startsWith('s.')) { onStyleBind(el); return; }
  if (path === 'p.verifie') { onVerifieBind(el); return; }
  if (path.startsWith('p.') && isControlled(obj)) { scheduleRender(); return; }   // valeurs contrôlées : non modifiables
  const val = parseVal(el);
  if (el.dataset.t === 'date' && val === null) {
    el.classList.add('bad'); el.title = `Date non reconnue : « ${el.value} ». Formats : jjmmaaaa, jjmmaa, jj/mm/aaaa…`;
    return; // la saisie reste à corriger, sans bloquer
  }
  if (val === undefined) {
    el.classList.add('bad'); el.title = el.dataset.t === 'json' ? 'JSON invalide : corrigez la syntaxe (valeur non enregistrée).' : `Opération non reconnue : « ${el.value} ». Utilisez + − * / et des parenthèses (ex. 1 200,50 + 300*2).`;
    return;
  }
  el.classList.remove('bad');
  setPath(obj, sub, val);
  if (path.startsWith('p.') && isPublished(ui.paramYear)) obj._local = true;   // millésime publié modifié : version locale
  if (path === 'ui.paramYear') ui.paramYear = Number(el.value);
  save(); scheduleRender();
}
/* Case « Valeurs contrôlées » : dévalider affiche un avertissement ; revalider verrouille les valeurs
   (et rétablit la version publiée si les valeurs n'ont pas été modifiées). */
async function onVerifieBind(el) {
  const y = ui.paramYear, p = store.params[y]; if (!p) return;
  if (!el.checked) {
    if (!isControlled(p)) return;
    const ok = await confirmDialog({
      titre: `Dévalider le millésime ${y} ?`,
      html: `<p>Les paramètres ${y} sont des <b>valeurs contrôlées</b>${isPublished(y) ? ' (millésime publié avec l\'application)' : ''}. Les dévalider permet de les modifier :</p>
        <ul><li>le millésime ${y} sera signalé « non vérifié » dans tous les dossiers et calculs qui l'utilisent ;</li>
        ${isPublished(y) ? `<li>il deviendra une <b>version locale</b>, propre à ce navigateur, qui ne sera plus mise à jour avec l'application (bouton « Rétablir la version publiée ${y} » pour revenir en arrière) ;</li>` : ''}
        <li>les exercices figés conservent leur instantané de paramètres.</li></ul>
        <p>Ne dévalidez que si une valeur publiée est erronée ou manquante.</p>`,
      ok: 'Dévalider et modifier', danger: true });
    if (!ok) { el.checked = true; return; }
    p.verifie = false;
    if (isPublished(y)) p._local = true;
  } else {
    p.verifie = true;
    if (isPublished(y) && sameAsPublished(y, p)) store.params[y] = clone(PUBLISHED[y]);   // inchangé : retour à la version publiée
  }
  save(); scheduleRender();
}

/* Boîte de dialogue d'avertissement (Promise<boolean>) ; repli sur confirm() si <dialog> est indisponible */
function confirmDialog({ titre, html, ok = 'Confirmer', cancel = 'Annuler', danger = false }) {
  if (typeof HTMLDialogElement !== 'function') return Promise.resolve(confirm(titre + '\n\n' + html.replace(/<[^>]+>/g, '')));
  return new Promise(res => {
    const dlg = document.createElement('dialog');
    dlg.className = 'dlg warn';
    dlg.innerHTML = `<div class="dh">⚠ ${esc(titre)}</div><div class="db">${html}</div><div class="df"><button class="sec" value="0">${esc(cancel)}</button><button class="${danger ? 'dang' : ''}" value="1">${esc(ok)}</button></div>`;
    let val = false;
    dlg.addEventListener('click', ev => { const b = ev.target.closest('button'); if (b) { val = b.value === '1'; dlg.close(); } });
    dlg.addEventListener('close', () => { dlg.remove(); res(val); });
    document.body.appendChild(dlg);
    dlg.showModal();
    dlg.querySelector('button.sec').focus();
  });
}

/* Re-rendu différé : laisse le focus passer au champ suivant (Tab / clic) puis le restaure */
let pointerDown = false, pendingRender = false, renderTimer = null;
function scheduleRender() {
  if (pointerDown) { pendingRender = true; return; }
  clearTimeout(renderTimer); renderTimer = setTimeout(renderKeepFocus, 0);
}
function renderKeepFocus() {
  const a = document.activeElement;
  const key = a && a.dataset ? a.dataset.b : null;
  const scrollY = window.scrollY;
  render();
  window.scrollTo(0, scrollY);
  if (key) {
    const el = [...document.querySelectorAll('#main [data-b]')].find(x => x.dataset.b === key);
    if (el && !el.disabled) { el.focus({ preventScroll: true }); if (el.select && el.tagName === 'INPUT' && el.type !== 'checkbox') el.select(); }
  }
}
document.addEventListener('mousedown', () => { pointerDown = true; }, true);
document.addEventListener('mouseup', () => { pointerDown = false; if (pendingRender) { pendingRender = false; clearTimeout(renderTimer); renderTimer = setTimeout(renderKeepFocus, 0); } }, true);
/* Calculette : aperçu du résultat pendant la frappe */
function calcTip(el, show) {
  let t = document.getElementById('calcTip');
  if (!show) { if (t) t.style.display = 'none'; return; }
  if (!t) { t = document.createElement('div'); t.id = 'calcTip'; document.body.appendChild(t); }
  const x = calcEval(el.value);
  t.className = x === null ? 'bad' : '';
  t.textContent = x === null ? 'opération incomplète' : '= ' + fmt(el.dataset.t === 'int' ? Math.round(x) : x, el.dataset.t === 'int' ? 0 : 2) + (el.dataset.t === 'pct' ? ' %' : '');
  const rc = el.getBoundingClientRect();
  t.style.left = (rc.left + window.scrollX) + 'px'; t.style.top = (rc.bottom + window.scrollY + 2) + 'px'; t.style.display = 'block';
}
document.addEventListener('input', ev => {
  const el = ev.target;
  if (el.tagName === 'INPUT' && el.dataset && NUM_T.includes(el.dataset.t)) { el.classList.remove('bad'); calcTip(el, isExpr(el.value)); }
});
document.addEventListener('focusout', ev => { if (ev.target.dataset && NUM_T.includes(ev.target.dataset.t)) calcTip(ev.target, false); });
/* Masque de saisie des dates : 31082026 → 31/08/2026 au fil de la frappe */
document.addEventListener('input', ev => {
  const el = ev.target;
  if (!el.classList || !el.classList.contains('date')) return;
  el.classList.remove('bad');
  const v = el.value;
  if (/^[\d\/]*$/.test(v) && el.selectionStart === v.length && ev.inputType && ev.inputType.startsWith('insert')) {
    const g = v.replace(/\D/g, '').slice(0, 8);
    let f = g.slice(0, 2); if (g.length > 2) f += '/' + g.slice(2, 4); if (g.length > 4) f += '/' + g.slice(4);
    if (g.length === 2 || g.length === 4) f += '/';
    el.value = f;
  }
});
const sanit = s => String(s || '').trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-');
function download(name, content, mime) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); alert('Copié dans le presse-papiers : collez dans Excel / le modèle d\'import.'); }
  catch (err) { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); alert('Copié dans le presse-papiers.'); } catch (e2) { alert('Copie impossible : utilisez l\'export CSV.'); } ta.remove(); }
}
const PL_HEAD = ['Date', 'Code Journal', 'Numéro de compte', 'Libellé de compte', 'Libellé de ligne', 'Taux de TVA du compte', 'Code pays du compte', 'Libellé de pièce', 'Numéro de pièce', 'Débit et/ou Crédit', 'Crédit', 'Famille de catégories', 'Catégorie', 'Identifiant de ligne', 'Identifiant de lettrage'];
function plRows(entries) {
  const num = x => x === '' ? '' : r2(x).toFixed(2).replace('.', ',');
  const out = [];
  entries.forEach(en => en.rows.forEach(r => {
    const dc = ui.exportMode === 'dc';
    out.push([frDate(r.date), r.journal, r.compte, r.libCompte, r.libLigne, '', '', r.libPiece, r.piece, dc ? (r.v > 0 ? num(r.v) : '') : num(r.v), dc && r.v < 0 ? num(-r.v) : '', '', '', '', '']);
  }));
  return out;
}
const toCSV = rows => '﻿' + [PL_HEAD, ...rows].map(r => r.map(c => { const s = String(c ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';')).join('\r\n');
const toTSV = rows => [PL_HEAD, ...rows].map(r => r.join('\t')).join('\n');
