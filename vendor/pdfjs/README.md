# pdf.js 3.11.174 (Mozilla Foundation)

Fichier `pdfjs-3.11.174.bundle.min.js` : concaténation de `pdf.min.js` et `pdf.worker.min.js`
(pdf.js 3.11.174, https://github.com/mozilla/pdf.js), licence Apache 2.0 (voir `LICENSE`).

Utilisé uniquement pour reproduire les pages des PDF archivés (appels Urssaf / caisse) dans le
« Récapitulatif PDF ». Le traitement a lieu dans la page (le module worker étant chargé dans le même
fichier, pdf.js n'ouvre pas de worker séparé) et le fichier n'est chargé qu'à la première impression.
