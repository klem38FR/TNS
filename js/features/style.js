'use strict';
/* =====================================================================
   Style du cabinet (onglet « Style ») — données cabinet
   ---------------------------------------------------------------------
   Logo, dénomination et couleurs (principale, secondaire, tertiaire).
   • Persistés dans ce navigateur (localStorage LS_STYLE_KEY), indépendamment
     des dossiers clients : ni l'export ni l'import d'un dossier ne les touche.
   • Export / import : TNS_Param_Style_(dénomination).json. L'import remplace
     strictement la mise en page (toute valeur absente reprend le style neutre).
   • Sécurité des images : seuls PNG, JPEG et WebP sont acceptés (SVG refusé),
     signature et dimensions vérifiées avant décodage, puis l'image est décodée
     et ré-encodée en PNG via un canevas : seul le dessin des pixels est conservé
     (métadonnées, contenu caché ou charge utile éventuels sont éliminés).
   Repris dans l'application, le récapitulatif PDF et le récapitulatif client.
   ===================================================================== */
const STYLE_FORMAT = 'cotis-tns-style';
const STYLE_DEFAULT = Object.freeze({ denomination: '', logo: '', couleurs: Object.freeze({ principale: '#3b5b7a', secondaire: '#2a4259', tertiaire: '#e6edf3' }) });
const STYLE_PRESETS = [
  ['Ardoise (neutre)', '#3b5b7a', '#2a4259', '#e6edf3'],
  ['Sarcelle', '#00796b', '#00564c', '#e0f2ef'],
  ['Marine', '#1f4e8c', '#163a69', '#e5edf8'],
  ['Bordeaux', '#8c1c3a', '#66142a', '#f7e6eb'],
  ['Forêt', '#2e6b3f', '#214d2d', '#e6f2e9'],
  ['Graphite', '#444b55', '#2b3038', '#eceef1']
];
const COULEURS = [['principale', 'Couleur principale', 'Boutons, onglet actif, bandeau, titres et filets du récapitulatif'], ['secondaire', 'Couleur secondaire', 'Survol des boutons, intertitres du récapitulatif PDF'], ['tertiaire', 'Couleur tertiaire', 'Fonds clairs : encadrés d\'information, survols, sous-onglet actif']];
const DENOM_MAX = 120;
const IMG_SRC_MAX = 2 * 1024 * 1024;         // fichier image source : 2 Mo
const IMG_MAX_SIDE = 6000, IMG_MAX_PIXELS = 24e6;
const LOGO_W = 600, LOGO_H = 240;             // dimensions maximales du logo ré-encodé
const LOGO_MAX_CHARS = 1.5 * 1024 * 1024;     // data URL du logo stocké
const STYLE_FILE_MAX = 5 * 1024 * 1024;

let STYLE = clone(STYLE_DEFAULT);

/* ---------- Couleurs ---------- */
const HEX_RE = /^#[0-9a-f]{6}$/;
const normHex = v => { const s = String(v ?? '').trim().toLowerCase(); const m = /^#?([0-9a-f]{3})$/.exec(s); if (m) return '#' + m[1].split('').map(c => c + c).join(''); const x = s.startsWith('#') ? s : '#' + s; return HEX_RE.test(x) ? x : null; };
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgbHex = a => '#' + a.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
const mixHex = (a, b, t) => { const x = hexRgb(a), y = hexRgb(b); return rgbHex(x.map((v, i) => v + (y[i] - v) * t)); };
const lum = h => { const c = hexRgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const rvbTxt = h => `RVB(${hexRgb(h).join(', ')})`;

/* ---------- Validation ---------- */
const CTRL_RE = new RegExp('[\\u0000-\\u001F\\u007F\\u2028\\u2029]', 'g');
const cleanDenom = v => String(v ?? '').replace(CTRL_RE, ' ').replace(/\s+/g, ' ').trim().slice(0, DENOM_MAX);
const LOGO_RE = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;
/* Style persisté (déjà assaini) : contrôle de forme, valeurs invalides remplacées par le neutre */
function normalizeStored(o) {
  const s = clone(STYLE_DEFAULT);
  if (!o || typeof o !== 'object') return s;
  if (typeof o.denomination === 'string') s.denomination = cleanDenom(o.denomination);
  if (typeof o.logo === 'string' && o.logo.length <= LOGO_MAX_CHARS && LOGO_RE.test(o.logo)) s.logo = o.logo;
  COULEURS.forEach(([k]) => { const h = normHex(o.couleurs && o.couleurs[k]); if (h) s.couleurs[k] = h; });
  return s;
}

/* ---------- Persistance et application ---------- */
function loadStyle() {
  let o = null;
  try { const raw = localStorage.getItem(LS_STYLE_KEY); if (raw) o = JSON.parse(raw); } catch (err) { o = null; }
  STYLE = normalizeStored(o);
  applyStyle();
}
function saveStyle() {
  try { localStorage.setItem(LS_STYLE_KEY, JSON.stringify(STYLE)); return true; }
  catch (err) { alert('Mise en page non enregistrée : stockage du navigateur indisponible ou plein.'); return false; }
}
function applyColors(c) {
  const rs = document.documentElement.style;
  rs.setProperty('--acc', c.principale);
  rs.setProperty('--accd', c.secondaire);
  rs.setProperty('--acc2', c.tertiaire);
  rs.setProperty('--acc-ink', mixHex(c.secondaire, '#000000', 0.2));
  rs.setProperty('--acc-line', mixHex(c.principale, '#ffffff', 0.664));
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', c.principale);
}
function applyStyle() {
  applyColors(STYLE.couleurs);
  const brand = document.getElementById('brand');
  if (brand) {
    const img = brand.querySelector('img');
    if (STYLE.logo) { const im = img || brand.insertBefore(document.createElement('img'), brand.firstChild); im.src = STYLE.logo; im.alt = STYLE.denomination || ''; }
    else if (img) img.remove();
    brand.querySelector('.t1').textContent = STYLE.denomination || APP_NAME;
    brand.querySelector('.t2').textContent = APP_SUBTITLE;
  }
  document.title = STYLE.denomination ? `${APP_NAME} – ${STYLE.denomination}` : APP_NAME;
}
function commitStyle() { saveStyle(); applyStyle(); render(); }

/* ---------- Images : contrôle et ré-encodage ---------- */
function sniffImage(u8) {
  const be16 = i => (u8[i] << 8) | u8[i + 1], be32 = i => ((u8[i] << 24) >>> 0) + (u8[i + 1] << 16) + (u8[i + 2] << 8) + u8[i + 3];
  const asc = (i, k) => String.fromCharCode(...u8.subarray(i, i + k));
  if (u8.length > 24 && [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A].every((b, i) => u8[i] === b) && asc(12, 4) === 'IHDR')
    return { type: 'png', w: be32(16), h: be32(20) };
  if (u8.length > 4 && u8[0] === 0xFF && u8[1] === 0xD8 && u8[2] === 0xFF) {
    let i = 2;
    while (i + 9 < u8.length) {
      if (u8[i] !== 0xFF) return null;
      const mk = u8[i + 1];
      if (mk === 0xFF) { i++; continue; }
      if (mk === 0xD8 || mk === 0x01 || (mk >= 0xD0 && mk <= 0xD7)) { i += 2; continue; }
      if (mk === 0xD9 || mk === 0xDA) return null;   // fin d'image ou données avant la taille : refus
      if ([0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF].includes(mk)) return { type: 'jpeg', h: be16(i + 5), w: be16(i + 7) };
      i += 2 + be16(i + 2);
    }
    return null;
  }
  if (u8.length > 30 && asc(0, 4) === 'RIFF' && asc(8, 4) === 'WEBP') {
    const ch = asc(12, 4);
    if (ch === 'VP8 ') return { type: 'webp', w: (u8[26] | (u8[27] << 8)) & 0x3FFF, h: (u8[28] | (u8[29] << 8)) & 0x3FFF };
    if (ch === 'VP8L') return { type: 'webp', w: 1 + (((u8[22] & 0x3F) << 8) | u8[21]), h: 1 + (((u8[24] & 0x0F) << 10) | (u8[23] << 2) | ((u8[22] & 0xC0) >> 6)) };
    if (ch === 'VP8X') return { type: 'webp', w: 1 + (u8[24] | (u8[25] << 8) | (u8[26] << 16)), h: 1 + (u8[27] | (u8[28] << 8) | (u8[29] << 16)) };
  }
  return null;
}
/* Retourne une data URL PNG ré-encodée, ou lève une erreur explicite */
async function sanitizeImage(u8) {
  if (!u8 || !u8.length) throw new Error('fichier vide');
  if (u8.length > IMG_SRC_MAX) throw new Error(`image trop lourde (${fmtSize(u8.length)} ; maximum ${fmtSize(IMG_SRC_MAX)})`);
  const s = sniffImage(u8);
  if (!s) throw new Error('format non reconnu : seules les images PNG, JPEG et WebP sont acceptées (SVG, GIF, BMP… refusés)');
  if (!(s.w > 0 && s.h > 0) || s.w > IMG_MAX_SIDE || s.h > IMG_MAX_SIDE || s.w * s.h > IMG_MAX_PIXELS) throw new Error(`dimensions refusées (${s.w} × ${s.h} px ; maximum ${IMG_MAX_SIDE} px de côté)`);
  let bmp;
  try { bmp = await createImageBitmap(new Blob([u8], { type: 'image/' + s.type })); }
  catch (err) { throw new Error('image illisible ou corrompue'); }
  try {
    const dimOK = (bmp.width === s.w && bmp.height === s.h) || (bmp.width === s.h && bmp.height === s.w);   // (rotation EXIF des JPEG)
    if (!dimOK) throw new Error('dimensions incohérentes avec l\'en-tête du fichier');
    const k = Math.min(1, LOGO_W / bmp.width, LOGO_H / bmp.height);
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
    const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/png');
    c.width = c.height = 0;
    if (!LOGO_RE.test(url) || url.length > LOGO_MAX_CHARS) throw new Error('ré-encodage impossible');
    return url;
  } finally { if (bmp.close) bmp.close(); }
}
function b64ToBytes(b64) { const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return u8; }

async function importLogoFile(f) {
  try {
    if (f.size > IMG_SRC_MAX) throw new Error(`image trop lourde (${fmtSize(f.size)} ; maximum ${fmtSize(IMG_SRC_MAX)})`);
    STYLE.logo = await sanitizeImage(new Uint8Array(await f.arrayBuffer()));
    commitStyle();
  } catch (err) { alert(`Image refusée : ${err.message}.`); }
}

/* ---------- Export / import du style ---------- */
function styleFileName() { return `TNS_Param_Style_${sanit(STYLE.denomination) || 'sans-denomination'}.json`; }
function exportStyle() {
  const o = { format: STYLE_FORMAT, schema: 1, appli: APP_ID, exporteLe: new Date().toISOString(), denomination: STYLE.denomination, couleurs: clone(STYLE.couleurs), logo: STYLE.logo || '' };
  download(styleFileName(), JSON.stringify(o, null, 2), 'application/json');
}
/* Validation stricte d'un fichier de style ; renvoie le nouveau style complet (remplacement intégral) */
async function parseStyleFile(text) {
  let o; try { o = JSON.parse(text); } catch (err) { throw new Error('fichier JSON illisible'); }
  if (!o || typeof o !== 'object' || Array.isArray(o) || o.format !== STYLE_FORMAT) throw new Error(`ce n'est pas un fichier de style (format « ${STYLE_FORMAT} » attendu)`);
  const s = clone(STYLE_DEFAULT);
  if (o.denomination !== undefined && o.denomination !== null) {
    if (typeof o.denomination !== 'string') throw new Error('dénomination invalide');
    s.denomination = cleanDenom(o.denomination);
  }
  if (o.couleurs !== undefined && o.couleurs !== null) {
    if (typeof o.couleurs !== 'object' || Array.isArray(o.couleurs)) throw new Error('couleurs invalides');
    COULEURS.forEach(([k, l]) => { if (o.couleurs[k] === undefined || o.couleurs[k] === null) return; const h = normHex(o.couleurs[k]); if (!h) throw new Error(`${l.toLowerCase()} invalide (format #rrvvbb attendu)`); s.couleurs[k] = h; });
  }
  if (o.logo !== undefined && o.logo !== null && o.logo !== '') {
    if (typeof o.logo !== 'string' || o.logo.length > Math.ceil(IMG_SRC_MAX * 4 / 3) + 64) throw new Error('logo invalide ou trop lourd');
    const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(o.logo);
    if (!m) throw new Error('logo invalide : image PNG, JPEG ou WebP encodée en base64 attendue');
    let u8; try { u8 = b64ToBytes(m[2]); } catch (err) { throw new Error('logo : encodage base64 invalide'); }
    const sn = sniffImage(u8);
    if (!sn || sn.type !== m[1]) throw new Error('logo : le contenu ne correspond pas au type d\'image déclaré');
    s.logo = await sanitizeImage(u8);
  }
  return s;
}
async function importStyleFile(f) {
  try {
    if (f.size > STYLE_FILE_MAX) throw new Error(`fichier trop lourd (${fmtSize(f.size)})`);
    const s = await parseStyleFile(await f.text());
    const lib = s.denomination ? `« ${s.denomination} »` : 'sans dénomination';
    if (!confirm(`Importer la mise en page ${lib} ?\n\nElle remplace intégralement la mise en page actuelle (logo, dénomination, couleurs). Les dossiers clients ne sont pas modifiés.`)) return;
    STYLE = s; commitStyle();
  } catch (err) { alert(`Import du style refusé : ${err.message}.`); }
}

/* ---------- Saisies et actions de l'onglet ---------- */
function onStyleBind(el) {
  const path = el.dataset.b;
  if (path === 's.denomination') { STYLE.denomination = cleanDenom(el.value); commitStyle(); return; }
  const m = /^s\.couleurs\.(principale|secondaire|tertiaire)$/.exec(path);
  if (m) {
    const h = normHex(el.value);
    if (!h) { el.classList.add('bad'); el.title = 'Couleur invalide : format #rrvvbb (ex. #3b5b7a)'; return; }
    el.classList.remove('bad'); STYLE.couleurs[m[1]] = h; commitStyle();
  }
}
/* Aperçu immédiat pendant le choix d'une couleur (sans enregistrement) */
document.addEventListener('input', ev => {
  const el = ev.target;
  if (!(el.type === 'color' && el.dataset && /^s\.couleurs\./.test(el.dataset.b || ''))) return;
  const k = el.dataset.b.split('.')[2], h = normHex(el.value); if (!h) return;
  applyColors(Object.assign({}, STYLE.couleurs, { [k]: h }));
});
function styleAct(a, el) {
  switch (a) {
    case 'logoAdd': document.getElementById('fileLogo').click(); return;
    case 'logoDel': if (STYLE.logo && confirm('Supprimer le logo de la mise en page ?')) { STYLE.logo = ''; commitStyle(); } return;
    case 'styleExport': exportStyle(); return;
    case 'styleImport': document.getElementById('fileStyle').click(); return;
    case 'styleReset': if (confirm('Rétablir la mise en page neutre ?\n\nLogo, dénomination et couleurs seront effacés de ce navigateur (exportez-les d\'abord si besoin).')) { STYLE = clone(STYLE_DEFAULT); commitStyle(); } return;
    case 'stylePreset': { const pz = STYLE_PRESETS[Number(el.dataset.i)]; if (!pz) return; STYLE.couleurs = { principale: pz[1], secondaire: pz[2], tertiaire: pz[3] }; commitStyle(); return; }
  }
}

/* ---------- Onglet Style ---------- */
function tabStyle() {
  const c = STYLE.couleurs;
  const sw = COULEURS.map(([k, l, use]) => fld(`${l}`, `<div class="swatch"><input type="color" data-b="s.couleurs.${k}" data-t="color" value="${esc(c[k])}" aria-label="${esc(l)}"><input class="hex" data-b="s.couleurs.${k}" data-t="hex" value="${esc(c[k])}" maxlength="7" spellcheck="false"><span class="note">${esc(rvbTxt(c[k]))}</span></div>`, esc(use))).join('');
  const cw = contrast(c.principale, '#ffffff'), cs = contrast(c.secondaire, '#ffffff'), ct = contrast(c.tertiaire, '#1a171b');
  const warns = [cw < 3 ? 'couleur principale trop claire : le texte blanc des boutons sera peu lisible' : '', cs < 3 ? 'couleur secondaire trop claire pour le survol des boutons (texte blanc)' : '', ct < 4.5 ? 'couleur tertiaire trop foncée : le texte des encadrés sera peu lisible' : ''].filter(Boolean);
  return `<div class="card"><h2>Mise en page du cabinet</h2>
    <p class="note">Logo, dénomination et couleurs repris dans l'application, le récapitulatif PDF et le récapitulatif client. Ces informations sont enregistrées dans ce navigateur, indépendamment des dossiers clients : l'export ou l'import d'un dossier ne les modifie pas. Exportez-les pour les installer sur un autre poste.</p>
    <div class="grid">
      ${fld('Dénomination du cabinet', `<input data-b="s.denomination" data-t="text" maxlength="${DENOM_MAX}" value="${esc(STYLE.denomination)}" placeholder="Ex. : Cabinet Exemple Expertise Comptable">`, 'Affichée dans l\'en-tête, le titre de la fenêtre et les récapitulatifs. Vide : « ' + esc(APP_NAME) + ' ».')}
    </div>
    <h3>Logo</h3>
    <div class="logoBox">
      <div class="logoPrev">${STYLE.logo ? `<img src="${esc(STYLE.logo)}" alt="Logo">` : '<span class="note">Aucune image</span>'}</div>
      <div><div class="row"><button class="sm" data-act="logoAdd">${STYLE.logo ? 'Remplacer l\'image' : 'Charger une image'}</button>${STYLE.logo ? '<button class="sm dang" data-act="logoDel">Supprimer l\'image</button>' : ''}</div>
        <p class="note">PNG, JPEG ou WebP, ${fmtSize(IMG_SRC_MAX)} maximum. Par sécurité, l'image est contrôlée (signature, dimensions), décodée puis ré-encodée en PNG (${LOGO_W} × ${LOGO_H} px au plus) : seuls les pixels sont conservés. Les SVG ne sont pas acceptés.</p></div>
    </div>
  </div>
  <div class="card"><h2>Couleurs (RVB)</h2>
    <div class="swatches">${sw}</div>
    ${warns.length ? `<div class="alert warn">Lisibilité : ${esc(warns.join(' ; '))}.</div>` : ''}
    <h3>Palettes prédéfinies</h3>
    <div class="presets">${STYLE_PRESETS.map((pz, i) => `<button class="preset sm" data-act="stylePreset" data-i="${i}" title="${esc(pz.slice(1).join(' / '))}"><i style="background:${pz[1]}"></i><i style="background:${pz[2]}"></i><i style="background:${pz[3]}"></i>${esc(pz[0])}</button>`).join('')}</div>
    <h3>Aperçu</h3>
    <div class="stylePrev"><div class="ph">${STYLE.logo ? `<img src="${esc(STYLE.logo)}" alt="">` : ''}<div><div class="t1">${esc(STYLE.denomination || APP_NAME)}</div><div class="t2">${esc(APP_SUBTITLE)}</div></div></div>
      <div class="pb2"><button class="sm">Bouton</button><button class="sec sm">Bouton secondaire</button><span class="badge mil">Barème</span><div class="alert info" style="margin:0">Encadré d'information</div></div></div>
  </div>
  <div class="card"><h2>Export / import de la mise en page</h2>
    <div class="row"><button data-act="styleExport">Exporter la mise en page</button><button class="sec" data-act="styleImport">Importer une mise en page</button><button class="sec" data-act="styleReset">Rétablir la mise en page neutre</button></div>
    <p class="note">Fichier « ${esc(styleFileName())} ». L'import remplace strictement la mise en page actuelle (logo, dénomination, couleurs ; une valeur absente du fichier reprend la valeur neutre). Le fichier est contrôlé avant tout changement : format, couleurs #rrvvbb, dénomination de ${DENOM_MAX} caractères au plus, logo PNG / JPEG / WebP vérifié puis ré-encodé. En cas d'anomalie, rien n'est modifié.</p>
  </div>`;
}
