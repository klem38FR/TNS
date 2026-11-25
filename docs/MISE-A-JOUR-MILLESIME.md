# Mise à jour des barèmes millésimés

Les barèmes sont des **données publiques** : un fichier JSON complet par année dans
`millesimes/`, déclaré dans `millesimes/index.json`. L'application les charge à chaque
ouverture ; il n'y a aucun code à modifier pour publier une nouvelle année ou corriger une valeur.

Un exercice N utilise le millésime N ou, à défaut, le plus récent antérieur (signalé « repli »).

## 1. Nouvelle année

Deux méthodes, au choix.

### a) Directement dans le dépôt

```bash
node tools/millesime.mjs nouveau 2027
```

Crée `millesimes/2027.json` (copie du dernier millésime, `"verifie": false`,
`"origine": "Copie du millésime 2026 — À ACTUALISER"`) et l'ajoute à `millesimes/index.json`.
Éditez ensuite le fichier (voir § 3).

### b) Depuis l'application

1. Onglet **Millésime › Paramètres millésimés** : « Créer 2027 à partir de 2026 ».
2. Saisir les valeurs 2027 (le millésime créé est modifiable), puis cocher « Valeurs contrôlées ».
3. « Exporter les paramètres » ; puis, dans le dépôt :

```bash
node tools/millesime.mjs depuis-export parametres_cotisations_TNS_2025-2026-2027.json 2027
```

## 2. Correction d'une année publiée

Modifier la valeur dans `millesimes/AAAA.json`, compléter `"maj"` (date de mise à jour) et, le cas
échéant, `"sources"` / `"aVerifier"`. Les postes la recevront à la prochaine ouverture.

Les exercices **figés** conservent l'instantané de paramètres pris au moment du gel : une
correction ne modifie pas un exercice figé (il faut le défiger).

Un poste sur lequel l'utilisateur a dévalidé le millésime (version locale) conserve sa version :
l'onglet Millésime lui propose « Rétablir la version publiée ».

## 3. Contenu d'un fichier millésime

| Clé | Contenu |
|---|---|
| `annee` | année (doit correspondre au nom du fichier) |
| `verifie` | `true` = valeurs contrôlées (verrouillées dans l'application) ; `false` = signalé « non vérifié » |
| `maj`, `origine` | date de mise à jour, origine des valeurs |
| `pass`, `smic_h`, `duree_mens` | PASS, SMIC horaire au 1er janvier, durée mensuelle |
| `abatt` | abattement de 26 % (`taux`, `minPct`, `maxPct` en fraction du PASS) |
| `arrondiTaux` | décimales des taux progressifs (4 = 2 décimales en %) |
| `maladie` | barème progressif : `bornes` (× PASS), `taux` (en %), `tauxSup` (en %) |
| `ij`, `af`, `rb`, `rc`, `id`, `csg`, `cfp` | indemnités journalières, allocations familiales, retraite de base, RCI, invalidité-décès, CSG-CRDS, CFP |
| `pl` | professions libérales Urssaf : IJ, CURPS, PAMC |
| `cnavpl`, `cipav` | retraite de base CNAVPL ; Cipav |
| `chqvac`, `acre`, `madelin`, `retard`, `trim` | chèques vacances, ACRE, plafonds Madelin, majorations, trimestres |
| `cnbf` | barème CNBF (avocats) |
| `caisses` | sections professionnelles (CARMF, CARPIMKO, CARCDSF, CARPV, CAVEC, CAVP, CPRN, CAVAMAC, CAVOM) |
| `msa` | exploitants agricoles (`avi: null` si sans objet) |
| `sources` | une source par ligne (avec lien) |
| `aVerifier` | points non vérifiés / à surveiller |
| `provAncienRegime` | (facultatif) `true` : le provisionnel de l'année relevait de l'ancien régime d'assiette |

Conventions :

- **taux en fraction décimale** : 17,87 % s'écrit `0.1787` (sauf `maladie.taux` / `tauxSup` et les
  taux de classes CNBF, exprimés en %) ;
- `null` = valeur non renseignée (l'application l'indique et calcule 0) ;
- `caisses` : `t` = `prop` (forfait + taux × assiette bornée), `classes` (`[classe, revenu maximal, montant]`,
  `null` pour la dernière classe), `choix`, `forfait`, `multiple` ; `ref` = année du revenu (`N`, `N-1`, `N-2`).

Les libellés de chaque paramètre sont visibles dans le sous-onglet « Paramètres millésimés »
(`js/data/schema-parametres.js`).

## 4. Contrôler puis publier

```bash
node tools/millesime.mjs format    # mise en forme homogène (diffs lisibles)
node tools/verifier.mjs            # structure identique à l'année précédente, types, index, service worker
git add millesimes && git commit -m "Millésime 2027 : barèmes Urssaf / caisses" && git push
```

`tools/verifier.mjs` signale une clé absente ou d'un type différent par rapport à l'année
précédente : une **nouvelle** clé (nouvelle cotisation, nouveau dispositif) doit aussi être prise en
charge dans le moteur de calcul (`js/engine/`) et, pour être éditable, dans
`js/data/schema-parametres.js`.
