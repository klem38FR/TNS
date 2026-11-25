'use strict';
/* Outils : nombres, dates, NIR, calculette, formatage */

/* ------------------------------------------------------------------ */
/* 3. OUTILS                                                           */
/* ------------------------------------------------------------------ */
const clone = o => JSON.parse(JSON.stringify(o));
const n = v => { if (v === null || v === undefined || v === '') return 0; const x = typeof v === 'number' ? v : parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : 0; };
const rnd = x => Math.sign(x) * Math.round(Math.abs(x));            // = ARRONDI(x;0) Excel
const r2 = x => Math.sign(x) * Math.round(Math.abs(x) * 100 + 1e-9) / 100;
/* Arrondi d'un taux décimal (4 décimales = 2 décimales en %), comme l'Urssaf */
const rT = (x, d = 4) => { const f = Math.pow(10, d); return Math.round(x * f + 1e-9) / f; };
const addDays = (s, k) => { const x = parseD(s); if (!x) return ''; const dt = new Date(Date.UTC(x.y, x.m - 1, x.d + k)); return dt.toISOString().slice(0, 10); };
/* Calculette des champs numériques : + − × ÷ et parenthèses (sans eval).
   Accepte « 1 200,50 + 300 », « =12*450 », « 1500/12 », « 2x350 ». Retourne null si invalide. */
function calcEval(src) {
  let s = String(src ?? '').replace(/[\s  ]/g, '').replace(/^=/, '').replace(/[×xX]/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/,/g, '.');
  if (s === '') return '';
  if (!/^[0-9.+\-*/()]+$/.test(s)) return null;
  let i = 0;
  const peek = () => s[i];
  function num() { const m = /^\d*\.?\d+(?:[eE][+-]?\d+)?|^\d+\./.exec(s.slice(i)); if (!m) throw 0; i += m[0].length; return parseFloat(m[0]); }
  function fac() { const c = peek(); if (c === '+') { i++; return fac(); } if (c === '-') { i++; return -fac(); } if (c === '(') { i++; const v = expr(); if (peek() !== ')') throw 0; i++; return v; } return num(); }
  function term() { let v = fac(); while (peek() === '*' || peek() === '/') { const o = s[i++]; const w = fac(); if (o === '/') { if (w === 0) throw 0; v /= w; } else v *= w; } return v; }
  function expr() { let v = term(); while (peek() === '+' || peek() === '-') { const o = s[i++]; const w = term(); v = o === '+' ? v + w : v - w; } return v; }
  try { const v = expr(); if (i !== s.length || !isFinite(v)) return null; return Math.round(v * 1e6) / 1e6; } catch (e) { return null; }
}
const isExpr = s => /\d\s*[+\-*/×xX÷−]\s*[\d(]|^\s*=|[()]/.test(String(s || '').replace(/^\s*[-−]/, ''));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (x, d = 2) => (isFinite(x) ? x : 0).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmt0 = x => fmt(x, 0);
const pc = (x, d = 3) => (x === null || x === undefined) ? '—' : fmt(x * 100, d).replace(/(,\d*?)0+$/, '$1').replace(/,$/, '') + ' %';
const uid = () => 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
const setPath = (o, p, v) => { const ks = p.split('.'); let a = o; ks.slice(0, -1).forEach(k => { if (a[k] == null || typeof a[k] !== 'object') a[k] = {}; a = a[k]; }); a[ks[ks.length - 1]] = v; };
const parseD = s => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return { y, m, d }; };
const frDate = s => { const x = parseD(s); return x ? String(x.d).padStart(2, '0') + '/' + String(x.m).padStart(2, '0') + '/' + x.y : ''; };
/* Saisie de date souple : jjmmaaaa, jjmmaa, jj/mm/aaaa, jj.mm.aa, jj-mm-aaaa, aaaa-mm-jj */
function parseDateFlex(s) {
  s = String(s || '').trim(); if (!s) return '';
  let d, m, y;
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) [y, m, d] = s.split('-').map(Number);
  else if (/[\/.\-\s]/.test(s)) { const p = s.split(/[\/.\-\s]+/).filter(Boolean); if (p.length !== 3) return null; [d, m, y] = p.map(Number); if (p[2].length <= 2) y += 2000; }
  else { const g = s.replace(/\D/g, ''); if (g.length === 8) { d = +g.slice(0, 2); m = +g.slice(2, 4); y = +g.slice(4); } else if (g.length === 6) { d = +g.slice(0, 2); m = +g.slice(2, 4); y = 2000 + +g.slice(4); } else return null; }
  const dt = new Date(y, m - 1, d);
  if (!y || dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
/* Numéro de sécurité sociale (NIR) : 13 caractères + clé de 2 chiffres.
   Clé = 97 − (NIR mod 97) ; Corse : 2A → 19, 2B → 18 pour le calcul. */
const nirClean = s => String(s || '').toUpperCase().replace(/[\s.\-]/g, '');
function nirCheck(s) {
  const v = nirClean(s);
  if (!v) return { etat: 'vide' };
  if (!/^[12378]\d{4}(\d{2}|2A|2B)\d{6}(\d{2})?$/.test(v)) return { etat: 'format', msg: 'Format attendu : 13 caractères (15 avec la clé), ex. 1 85 05 78 006 084 91' };
  const corps = v.slice(0, 13), cle = v.slice(13);
  const num = BigInt(corps.replace('2A', '19').replace('2B', '18'));
  const attendu = String(97n - (num % 97n)).padStart(2, '0');
  if (!cle) return { etat: 'sansCle', attendu };
  return cle === attendu ? { etat: 'ok' } : { etat: 'cle', attendu };
}
const nirFmt = s => { const v = nirClean(s); if (v.length < 13) return v; return [v.slice(0, 1), v.slice(1, 3), v.slice(3, 5), v.slice(5, 7), v.slice(7, 10), v.slice(10, 13), v.slice(13)].filter(Boolean).join(' '); };
const cmpD = (a, b) => (a || '').localeCompare(b || '');
const monthsSpan = (a, b) => (b.y - a.y) * 12 + (b.m - a.m) + 1;   // mois civils entamés de a à b inclus
const sum = arr => arr.reduce((s, x) => s + n(x), 0);
const milBadge = (y, extra = '') => `<span class="badge mil" title="Millésime des paramètres utilisés">Barème ${esc(y)}${extra}</span>`;
