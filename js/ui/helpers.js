'use strict';
/* Aides d'affichage (champs liés, tableaux) */

/* ------------------------------------------------------------------ */
/* 7. AIDES D'AFFICHAGE                                                */
/* ------------------------------------------------------------------ */
const showV = v => (v === undefined || v === null || v === '') ? '' : String(v).replace('.', ',');
const inp = (path, v, cls = 'num', t = 'num', extra = '') => `<input class="${cls}" data-b="${path}" data-t="${t}" value="${esc(showV(v))}" ${extra}>`;
const txt = (path, v, extra = '') => `<input data-b="${path}" data-t="text" value="${esc(v ?? '')}" ${extra}>`;
const dateI = (path, v) => `<input class="date" data-b="${path}" data-t="date" value="${esc(frDate(v))}" placeholder="jjmmaaaa" maxlength="10" title="Saisie libre : 31082026, 310826, 31/08/2026, 31.08.26…">`;
const chk = (path, v, lab) => `<label class="row" style="gap:6px"><input type="checkbox" data-b="${path}" data-t="bool" ${v ? 'checked' : ''}> ${lab}</label>`;
const sel = (path, v, opts, t = 'text') => `<select data-b="${path}" data-t="${t}">${Object.entries(opts).map(([k, l]) => `<option value="${esc(k)}" ${String(k) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
const fld = (lab, html, note = '') => `<div class="f"><label>${lab}</label>${html}${note ? `<span class="note">${note}</span>` : ''}</div>`;
const money = (x, cls = '') => `<td class="n ${cls}">${fmt(x)}</td>`;
const sgnCls = x => x > 0.004 ? 'negv' : (x < -0.004 ? 'pos' : '');
const warnList = W => W.map(w => `<div class="alert ${w.t === 'info' ? 'info' : w.t}">${esc(w.m)}</div>`).join('');
