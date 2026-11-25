'use strict';
/* =====================================================================
   COTISATIONS TNS — application web progressive (PWA), fonctionnement local
   ---------------------------------------------------------------------
   • Données clients : dans le navigateur (localStorage ; IndexedDB pour les
     PDF archivés) et dans les fichiers .json exportés / réimportés.
   • Données cabinet (mise en page) : onglet « Style », persistées dans le
     navigateur, indépendantes des dossiers, exportables en
     TNS_Param_Style_(dénomination).json. Aucune donnée cabinet dans le dépôt.
   • Données publiques : le code, les formules et les barèmes millésimés
     (millesimes/AAAA.json, listés dans millesimes/index.json).
   Aucun appel réseau hors des fichiers de l'application (lecteur pdf.js de
   Mozilla, Apache 2.0, dans vendor/pdfjs/).
   ===================================================================== */
const APP_NAME = 'Cotisations TNS';
const APP_SUBTITLE = 'Cotisations sociales des travailleurs indépendants';
const APP_ID = 'cotisations-tns-pwa';
const LS_KEY = 'cotisTNS_store_v1';          // dossiers clients et millésimes locaux
const LS_STYLE_KEY = 'cotisTNS_style_v1';    // mise en page du cabinet (onglet Style)
const MILLESIMES_DIR = 'millesimes/';
const PDFJS_SRC = 'vendor/pdfjs/pdfjs-3.11.174.bundle.min.js';
