'use strict';
/* Documents PDF archivés (IndexedDB) et lecteur pdf.js */

/* ------------------------------------------------------------------ */
/* 8 bis. DOCUMENTS PDF ARCHIVÉS (appel Urssaf / SSI, appel caisse)    */
/* ------------------------------------------------------------------ */
/* Métadonnées dans l'exercice (baseE().docs[slot] = [{ id, nom, taille, ajoute }]) ;
   contenu binaire dans IndexedDB (le localStorage est limité à quelques Mo). */
const DOC_DB = 'cotisTNS_docs', DOC_ST = 'pdf';
let docDbP = null, docIdbOK = true;
const docMem = new Map();   // repli en mémoire si IndexedDB est indisponible (perdu à la fermeture)
function docDb() {
  if (!docDbP) docDbP = new Promise((res, rej) => {
    try { const rq = indexedDB.open(DOC_DB, 1); rq.onupgradeneeded = () => rq.result.createObjectStore(DOC_ST); rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); }
    catch (err) { rej(err); }
  });
  return docDbP;
}
async function docPut(id, buf) {
  try {
    const db = await docDb();
    await new Promise((res, rej) => { const tx = db.transaction(DOC_ST, 'readwrite'); tx.objectStore(DOC_ST).put(buf, id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
  } catch (err) { docIdbOK = false; docMem.set(id, buf); }
}
async function docGet(id) {
  if (docMem.has(id)) return docMem.get(id);
  try {
    const db = await docDb();
    return await new Promise((res, rej) => { const rq = db.transaction(DOC_ST).objectStore(DOC_ST).get(id); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => rej(rq.error); });
  } catch (err) { return null; }
}
/* Supprime les contenus qui ne sont plus référencés par aucun exercice (un dossier importé en copie partage les mêmes identifiants) */
async function docPurge(ids) {
  const used = new Set(allDocRefs().map(x => x.id));
  const del = [...new Set(ids)].filter(id => !used.has(id));
  if (!del.length) return;
  del.forEach(id => docMem.delete(id));
  try { const db = await docDb(); await new Promise(res => { const tx = db.transaction(DOC_ST, 'readwrite'); del.forEach(id => tx.objectStore(DOC_ST).delete(id)); tx.oncomplete = res; tx.onerror = res; tx.onabort = res; }); } catch (err) { /* sans effet */ }
}
const DOC_SLOTS = ['appel', 'caisse'];
const docList = (ex, slot) => ((ex && ex.docs) || {})[slot] || [];
const exoDocRefs = ex => DOC_SLOTS.flatMap(s => docList(ex, s));
const dossierDocRefs = d => Object.values((d && d.exercices) || {}).flatMap(exoDocRefs);
const allDocRefs = () => Object.values(store.dossiers || {}).flatMap(dossierDocRefs);
const fmtSize = b => b >= 1048576 ? fmt(b / 1048576, 1) + ' Mo' : fmt(Math.max(1, Math.round(b / 1024)), 0) + ' Ko';

function docCard(e, slot, titre) {
  const L = docList(baseE(), slot), lock = !!e.fige;
  const rows = L.map(x => `<tr><td>📄 ${esc(x.nom)}</td><td class="n">${fmtSize(x.taille || 0)}</td><td>${x.ajoute ? new Date(x.ajoute).toLocaleDateString('fr-FR') : ''}</td>
    <td class="n"><button class="sec sm" data-act="docOpen" data-id="${esc(x.id)}">Ouvrir</button><button class="sec sm" data-act="docDl" data-id="${esc(x.id)}">Télécharger</button>${lock ? '' : `<button class="sm dang" data-act="docDel" data-slot="${slot}" data-id="${esc(x.id)}">Supprimer</button>`}</td></tr>`).join('');
  return `<div class="card docDrop" data-drop="${slot}"><h2>📎 ${esc(titre)}</h2>
    ${L.length ? `<table><tr><th>Document</th><th class="n">Taille</th><th>Ajouté le</th><th></th></tr>${rows}</table>` : '<p class="note">Aucun document archivé.</p>'}
    ${PRINTING ? (L.length ? '<p class="note">Les pages du document sont reproduites à la suite de cette section.</p>' : '') : `${lock ? '' : `<div class="row" style="margin-top:6px"><button class="sm" data-act="docAdd" data-slot="${slot}">Joindre un PDF</button><span class="note">ou glissez-déposez le fichier sur ce cadre</span></div>`}
    <p class="note">Le PDF est conservé dans ce navigateur (IndexedDB) et inclus dans « Exporter sauvegarde ». Ses pages sont reproduites dans le « Récapitulatif PDF », à la suite de cette section.${lock ? ' Exercice figé : ajout et suppression verrouillés.' : ''}</p>
    ${docIdbOK ? '' : '<div class="alert warn">Stockage IndexedDB indisponible : les PDF ne sont conservés que jusqu\'à la fermeture de la page. Exportez la sauvegarde.</div>'}`}
  </div>`;
}

async function addDocs(slot, files) {
  const e = curE(), be = baseE();
  if (!be || !DOC_SLOTS.includes(slot) || (e && e.fige)) return;
  const bad = [];
  for (const f of files) {
    const buf = await f.arrayBuffer();
    const head = new TextDecoder('latin1').decode(new Uint8Array(buf.slice(0, 1024)));
    if (!head.includes('%PDF-')) { bad.push(f.name); continue; }
    const id = 'pdf' + uid();
    await docPut(id, buf);
    be.docs = be.docs || {}; (be.docs[slot] = be.docs[slot] || []).push({ id, nom: f.name, taille: f.size, ajoute: new Date().toISOString() });
  }
  if (bad.length) alert(`Fichier(s) ignoré(s), ce ne sont pas des PDF :\n${bad.join('\n')}`);
  save(); render();
}
async function docBlob(id) {
  const buf = await docGet(id);
  if (!buf) { alert('Document introuvable dans le stockage de ce navigateur (réimportez la sauvegarde qui le contient).'); return null; }
  return new Blob([buf], { type: 'application/pdf' });
}
const docMeta = id => allDocRefs().find(x => x.id === id);

/* pdf.js 3.11.174 (Mozilla, Apache 2.0 — vendor/pdfjs/) : pdf.min.js + pdf.worker.min.js en un seul fichier
   (traitement dans la page, sans worker) ; chargé à la première impression. */
let pdfjsP = null;
function loadPdfJs() {
  if (!pdfjsP) pdfjsP = new Promise((res, rej) => {
    if (window.pdfjsLib) { res(window.pdfjsLib); return; }
    const sc = document.createElement('script'); sc.src = PDFJS_SRC; sc.async = true;
    sc.onload = () => window.pdfjsLib ? res(window.pdfjsLib) : rej(new Error('pdf.js non chargé'));
    sc.onerror = () => { sc.remove(); rej(new Error('pdf.js introuvable (' + PDFJS_SRC + ')')); };
    document.head.appendChild(sc);
  });
  pdfjsP.catch(() => { pdfjsP = null; });
  return pdfjsP;
}
/* Rend chaque page des PDF d'un emplacement en image (une page A4 imprimée par page de PDF) */
async function docPagesHtml(slot, label) {
  const L = docList(baseE(), slot);
  let out = '';
  for (const x of L) {
    const buf = await docGet(x.id);
    if (!buf) { out += `<div class="alert warn">Document « ${esc(x.nom)} » introuvable dans le stockage de ce navigateur : pages non reproduites.</div>`; continue; }
    try {
      const lib = await loadPdfJs();
      const pdf = await lib.getDocument({ data: new Uint8Array(buf.slice(0)), isEvalSupported: false }).promise;
      for (let i = 1; i <= pdf.numPages; i++) {
        const pg = await pdf.getPage(i);
        const w0 = pg.getViewport({ scale: 1 }).width;
        const vp = pg.getViewport({ scale: Math.min(3, 1650 / w0) });
        const c = document.createElement('canvas'); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
        const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        await pg.render({ canvasContext: ctx, viewport: vp }).promise;
        out += `<div class="pb"></div><div class="docPage"><div class="docCap">${esc(label)} — ${esc(x.nom)} — page ${i} / ${pdf.numPages}</div><img src="${c.toDataURL('image/jpeg', 0.88)}" alt=""></div>`;
        c.width = c.height = 0; pg.cleanup();
      }
      await pdf.destroy();
    } catch (err) {
      console.error(err);
      out += `<div class="alert warn">Document « ${esc(x.nom)} » : lecture impossible (${esc(err && err.message || err)}) — pages non reproduites.</div>`;
    }
  }
  return out;
}

/* Sauvegarde : contenus PDF encodés en base64 dans le .json */
function bufToB64(buf) { return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = () => rej(fr.error); fr.readAsDataURL(new Blob([buf])); }); }
async function docsPayload(refs) {
  const out = {}, miss = [];
  for (const x of refs) { if (out[x.id]) continue; const buf = await docGet(x.id); if (buf) out[x.id] = await bufToB64(buf); else miss.push(x.nom); }
  if (miss.length) alert(`PDF absents de ce navigateur, non inclus dans la sauvegarde :\n${miss.join('\n')}`);
  return out;
}
async function importDocs(docs) {
  for (const [id, b64] of Object.entries(docs || {})) { try { await docPut(id, Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer); } catch (err) { console.error(err); } }
}
