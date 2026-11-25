# Cotisations TNS — application web progressive (PWA)

Calcul et suivi des cotisations sociales des travailleurs non salariés (gérants majoritaires,
exploitants individuels) : appels Urssaf / SSI / MSA et caisses de retraite libérales,
rémunération et bases sociales, Madelin / PER, simulation, impayés, écritures de clôture
(format Pennylane), déclaration 2042 et récapitulatifs imprimables.

L'application fonctionne entièrement dans le navigateur : aucune donnée n'est envoyée sur un
serveur. Une fois ouverte en ligne, elle s'installe (« Installer l'application ») et fonctionne
hors connexion.

## Les trois types de données

| Données | Contenu | Où elles vivent | Dans le dépôt ? |
|---|---|---|---|
| **Clients** | Dossiers, exercices, saisies, PDF archivés | Navigateur (localStorage, IndexedDB pour les PDF) ; export / import `.json` (« Exporter sauvegarde », Ctrl+Maj+S pour tout) | **Non** (seul le dossier fictif « Jean Exemple » est créé au premier lancement) |
| **Cabinet** | Logo, dénomination, couleurs principale / secondaire / tertiaire | Navigateur, onglet **Style** ; export / import `TNS_Param_Style_(dénomination).json` | **Non** |
| **Publiques** | Code, formules, barèmes millésimés | Ce dépôt (`millesimes/AAAA.json`) | Oui |

Les données cabinet sont indépendantes des données clients : exporter ou importer un dossier ne
touche pas à la mise en page, et inversement. L'import d'un fichier de style remplace strictement
la mise en page (une valeur absente du fichier reprend la valeur neutre).

## Publication sur GitHub Pages

1. Pousser le contenu de ce dossier à la racine du dépôt (branche `main`).
2. *Settings › Pages* : « Deploy from a branch », branche `main`, dossier `/ (root)`.
3. Ouvrir l'adresse `https://<compte>.github.io/<dépôt>/`, puis installer l'application
   depuis le navigateur.

Le service worker exige HTTPS (fourni par GitHub Pages) ou `localhost`.

**Test en local** : `python3 -m http.server 8000` dans ce dossier, puis `http://localhost:8000/`.
L'ouverture directe du fichier `index.html` (`file://`) n'est pas prise en charge (les barèmes
sont chargés depuis `millesimes/`).

**Avant chaque publication** : `node tools/verifier.mjs` (aussi exécuté par GitHub Actions,
`.github/workflows/verifier.yml`).

## Mettre à jour les barèmes (nouveau millésime ou correction)

Chaque année est un fichier autonome `millesimes/AAAA.json`, déclaré dans
`millesimes/index.json`. Procédure détaillée : [`docs/MISE-A-JOUR-MILLESIME.md`](docs/MISE-A-JOUR-MILLESIME.md).

En bref :

```bash
node tools/millesime.mjs nouveau 2027      # copie de 2026, "verifie": false, ajout à index.json
# … actualiser millesimes/2027.json (valeurs, sources, points à vérifier), puis "verifie": true
node tools/verifier.mjs
git add millesimes && git commit -m "Millésime 2027" && git push
```

Les millésimes publiés et **contrôlés** (`"verifie": true`) ne sont pas modifiables dans
l'application et sont rechargés à chaque ouverture : une correction poussée sur le dépôt est
prise en compte automatiquement par tous les postes. Décocher « Valeurs contrôlées » (avec
avertissement) crée une **version locale** propre au navigateur, conservée jusqu'à
« Rétablir la version publiée ».

## Mettre à jour le code

Le service worker sert le code « réseau d'abord » : une modification poussée est chargée à la
prochaine ouverture en ligne. Si vous ajoutez, renommez ou supprimez un fichier chargé par
`index.html`, mettez à jour la liste `APP_SHELL` de `sw.js` et incrémentez `CACHE_VERSION`
(l'application propose alors « Mettre à jour »). `tools/verifier.mjs` contrôle cette liste.

## Structure

```
index.html                  page unique (en-tête, onglets, zone d'impression)
manifest.webmanifest        manifeste PWA
sw.js                       service worker (hors connexion)
css/app.css                 styles (couleurs du cabinet injectées en variables CSS)
millesimes/                 DONNÉES PUBLIQUES : barèmes millésimés
  index.json                liste des millésimes publiés
  2025.json, 2026.json      un fichier complet par année
js/
  core/config.js            constantes (nom de l'application, clés de stockage)
  core/utils.js             nombres, dates, NIR, calculette
  core/millesimes.js        chargement des millésimes publiés, versions locales
  core/store.js             état, persistance, migrations des dossiers
  data/referentiels.js      activités, statuts, lignes d'appel, comptes
  data/schema-parametres.js libellés et types des paramètres (sous-onglet Paramètres)
  engine/calculs.js         barèmes : Urssaf / SSI, CNAVPL, CNBF, caisses libérales, MSA
  engine/compute.js         calcul complet d'un exercice (assiette, cotisations, 2042…)
  engine/ecritures.js       écritures comptables (Pennylane)
  ui/                       rendu général, liaison des champs, actions
  tabs/                     un fichier par onglet (Millésime : paramètres + formules)
  features/style.js         onglet Style (mise en page du cabinet, contrôle des images)
  features/documents.js     PDF archivés (IndexedDB) et lecture pdf.js
  features/sauvegarde.js    export / import des sauvegardes clients
  features/impression.js    récapitulatif PDF et récapitulatif client
  main.js                   démarrage, enregistrement du service worker
vendor/pdfjs/               pdf.js 3.11.174 (Mozilla, Apache 2.0)
icons/                      icônes neutres de l'application
tools/                      millesime.mjs (maintenance), verifier.mjs (contrôles)
docs/                       procédures
```

## Sécurité

- Politique de sécurité du contenu (CSP) : seuls les scripts du dépôt sont exécutés, aucune
  connexion vers un autre site.
- Logo : PNG, JPEG ou WebP uniquement (SVG refusé), 2 Mo au plus ; signature et dimensions
  vérifiées avant décodage (protection contre les « bombes de décompression »), puis image
  décodée et **ré-encodée** en PNG via un canevas : seuls les pixels sont conservés.
- Fichier de style : format, couleurs `#rrvvbb`, dénomination (texte seul, 120 caractères) et
  logo contrôlés avant tout changement ; en cas d'anomalie, rien n'est modifié.
- Dénomination, noms de dossiers et libellés sont toujours échappés à l'affichage.

## Reprise des données de la version HTML autonome

Le stockage du navigateur est propre à chaque adresse : les dossiers de la version HTML ne sont
pas visibles automatiquement. Dans l'ancienne version, exporter les dossiers (« Exporter
sauvegarde », ou Ctrl+Maj+S pour une sauvegarde complète), puis les importer ici avec
« Importer sauvegarde ». Importer ensuite le fichier `TNS_Param_Style_(dénomination).json`
dans l'onglet Style.

## Licences tierces

pdf.js 3.11.174 — Mozilla Foundation, Apache License 2.0 (`vendor/pdfjs/LICENSE`).
