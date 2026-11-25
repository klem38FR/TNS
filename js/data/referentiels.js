'use strict';
/* Référentiels : activités, statuts, lignes d'appel, natures, comptes */

/* ------------------------------------------------------------------ */
/* 2. RÉFÉRENTIELS                                                     */
/* ------------------------------------------------------------------ */
/* Activités (caisse) : mode Urssaf = ssi (tout l'appel Urssaf), pl (Urssaf hors retraite + caisse), cipav (tout Urssaf), msa */
const ACTIVITES_DEF = {
  ava:        { l: 'AVA - Artisan', caisse: 'SSI', mode: 'ssi', cfp: 'artisan' },
  organic:    { l: 'ORGANIC - Commerçant', caisse: 'SSI', mode: 'ssi', cfp: 'commercant' },
  carcdsf_cd: { l: 'CARCDSF - Chirurgien-dentiste', caisse: 'CARCDSF', mode: 'pl', cfp: 'pl', pamc: true },
  carcdsf_sf: { l: 'CARCDSF - Sage-femme', caisse: 'CARCDSF', mode: 'pl', cfp: 'pl', pamc: true },
  carmf:      { l: 'CARMF - Médecin', caisse: 'CARMF', mode: 'pl', cfp: 'pl', pamc: true },
  carpimko:   { l: 'CARPIMKO - Auxiliaire médical', caisse: 'CARPIMKO', mode: 'pl', cfp: 'pl', pamc: true },
  carpv:      { l: 'CARPV - Vétérinaire', caisse: 'CARPV', mode: 'pl', cfp: 'pl' },
  cavec:      { l: 'CAVEC - Expert-comptable', caisse: 'CAVEC', mode: 'pl', cfp: 'pl' },
  cavp_ph:    { l: 'CAVP - Pharmacien', caisse: 'CAVP', mode: 'pl', cfp: 'pl' },
  cavp_bio:   { l: 'CAVP - Biologiste', caisse: 'CAVP', mode: 'pl', cfp: 'pl' },
  cipav:      { l: 'CIPAV - Libéral', caisse: 'CIPAV', mode: 'cipav', cfp: 'pl' },
  cnbf:       { l: 'CNBF - Avocat', caisse: 'CNBF', mode: 'pl', cfp: 'avocat' },
  crn:        { l: 'CRN - Notaire', caisse: 'CPRN', mode: 'pl', cfp: 'pl' },
  cavamac:    { l: 'CAVAMAC - Agent d\'assurance', caisse: 'CAVAMAC', mode: 'pl', cfp: 'pl' },
  cavom:      { l: 'CAVOM - Officier ministériel', caisse: 'CAVOM', mode: 'pl', cfp: 'pl' },
  msa:        { l: 'MSA', caisse: 'MSA', mode: 'msa', cfp: null },
  pl_ssi:     { l: '(ancien) Profession libérale non réglementée - SSI', caisse: 'SSI', mode: 'ssi', cfp: 'pl_ssi', legacy: true }
};
const ACTIVITES = Object.fromEntries(Object.entries(ACTIVITES_DEF).map(([k, v]) => [k, v.l]));
const OLD_ACT = { commercant: 'organic', artisan: 'ava', avocat: 'cnbf' };
const actDef = a => ACTIVITES_DEF[OLD_ACT[a] || a] || ACTIVITES_DEF.organic;
const actOptions = cur => Object.fromEntries(Object.entries(ACTIVITES_DEF).filter(([k, v]) => !v.legacy || k === cur).map(([k, v]) => [k, v.l]));
const STATUTS = { ei: 'Entreprise Individuelle', gerant_is: 'Gérant Majoritaire (IS)', gerant_ir: 'Gérant Majoritaire (IR)' };
const OLD_STATUT = { gerant: 'gerant_is' };
const REGIMES = { bnc: 'BNC', bic: 'BIC', lg: 'Location gérance', ba: 'BA' };
const isArt62 = st => st === 'gerant_is';
const MSA_ATEXA = { A: 'A', B: 'B', C: 'C', D: 'D', E: 'E' };

/* nat = nature pour l'ordre légal d'imputation (art. D.133-4 CSS) ; acc = compte */
const SSI_LINES = [
  { k: 'maladie', l: 'Maladie-maternité', nat: 'maladie', acc: 'cotis', acre: true },
  { k: 'ij', l: 'Indemnités journalières', nat: 'maladie', acc: 'cotis', acre: true },
  { k: 'af', l: 'Allocations familiales', nat: 'af', acc: 'cotis', acre: true },
  { k: 'rb1', l: 'Retraite de base dans la limite du PASS', nat: 'rb', acc: 'cotis', acre: true },
  { k: 'rb2', l: 'Retraite de base au-delà du PASS', nat: 'rb', acc: 'cotis', acre: true },
  { k: 'rc1', l: 'Retraite complémentaire 1re tranche', nat: 'rc', acc: 'cotis' },
  { k: 'rc2', l: 'Retraite complémentaire 2e tranche', nat: 'rc', acc: 'cotis' },
  { k: 'id', l: 'Invalidité-décès', nat: 'id', acc: 'cotis', acre: true },
  { k: 'conj', l: 'Conjoint collaborateur (RB + RCI + ID)', nat: 'rb', acc: 'cotis' },
  { k: 'cfp', l: 'Contribution formation professionnelle (CFP)', nat: 'cfp', acc: 'cfp' },
  { k: 'autre', l: 'Autres (taxe CMA / CCI…)', nat: 'autre', acc: 'autre' },
  { k: 'csg', l: 'CSG / CRDS sur revenus d\'activité', nat: 'csg', acc: 'csg' }
];
const LK = k => SSI_LINES.find(L => L.k === k);
/* Professions libérales hors Cipav : l'Urssaf n'appelle ni la retraite ni l'invalidité-décès */
const PL_URSSAF_LINES = [LK('maladie'), { k: 'pamc', l: 'Participation de l\'Assurance maladie (PAMC, saisie)', nat: 'maladie', acc: 'cotis' }, LK('ij'), LK('af'),
  { k: 'curps', l: 'Contribution aux URPS (CURPS)', nat: 'autre', acc: 'autre' }, LK('cfp'), LK('autre'), LK('csg')];
const CIPAV_LINES = [LK('maladie'), LK('ij'), LK('af'),
  { k: 'rb1', l: 'Retraite de base CNAVPL – tranche 1 (≤ 1 PASS)', nat: 'rb', acc: 'cotis', acre: true },
  { k: 'rb2', l: 'Retraite de base CNAVPL – tranche 2 (≤ 5 PASS)', nat: 'rb', acc: 'cotis', acre: true },
  { k: 'rc1', l: 'Retraite complémentaire Cipav – tranche 1', nat: 'rc', acc: 'cotis' },
  { k: 'rc2', l: 'Retraite complémentaire Cipav – tranche 2', nat: 'rc', acc: 'cotis' },
  { k: 'id', l: 'Invalidité-décès Cipav', nat: 'id', acc: 'cotis', acre: true },
  LK('conj'), LK('cfp'), LK('autre'), LK('csg')];
const MSA_LINES = [
  { k: 'maladie', l: 'AMEXA (maladie-maternité)', nat: 'maladie', acc: 'cotis' },
  { k: 'ij', l: 'Indemnités journalières AMEXA (forfait)', nat: 'maladie', acc: 'cotis' },
  { k: 'inval', l: 'Invalidité', nat: 'id', acc: 'cotis' },
  { k: 'avi', l: 'Assurance vieillesse individuelle (AVI)', nat: 'rb', acc: 'cotis' },
  { k: 'avaP', l: 'Retraite de base plafonnée (AVA)', nat: 'rb', acc: 'cotis' },
  { k: 'avaD', l: 'Retraite de base déplafonnée (AVA)', nat: 'rb', acc: 'cotis' },
  { k: 'rco', l: 'Retraite complémentaire obligatoire (RCO)', nat: 'rc', acc: 'cotis' },
  { k: 'af', l: 'Prestations familiales (PFA)', nat: 'af', acc: 'cotis' },
  { k: 'atexa', l: 'ATEXA (accidents du travail)', nat: 'maladie', acc: 'cotis' },
  { k: 'cfp', l: 'Formation professionnelle (VIVEA)', nat: 'cfp', acc: 'cfp' },
  LK('autre'), LK('csg')];
const CNBF_LINES = [
  { k: 'rb_forf', l: 'Retraite de base — forfaitaire (ancienneté)', nat: 'rb', acc: 'cnbf' },
  { k: 'rb_prop', l: 'Retraite de base — proportionnelle', nat: 'rb', acc: 'cnbf' },
  { k: 'dp', l: 'Contribution équivalente aux droits de plaidoirie', nat: 'rb', acc: 'cnbf' },
  { k: 'rc', l: 'Retraite complémentaire (classe choisie)', nat: 'rc', acc: 'cnbf' },
  { k: 'id', l: 'Invalidité-décès — forfaitaire', nat: 'id', acc: 'cnbf' }
];
const CNAVPL_LINES = [
  { k: 'rb1', l: 'Retraite de base CNAVPL – tranche 1 (≤ 1 PASS)', nat: 'rb', acc: 'cnbf', ref: 'N' },
  { k: 'rb2', l: 'Retraite de base CNAVPL – tranche 2 (≤ 5 PASS)', nat: 'rb', acc: 'cnbf', ref: 'N' }
];
/* Lignes de la caisse de retraite (section professionnelle) selon l'activité */
function caisseLines(act, p) {
  if (act === 'cnbf') return CNBF_LINES;
  const def = (p.caisses || {})[act];
  if (!def) return [];
  return [...CNAVPL_LINES, ...def.map(c => ({ k: c.k, l: c.l, nat: c.nat || 'rc', acc: 'cnbf', ref: c.ref, comp: c }))];
}
const NATURES = [
  { k: 'csg', l: '1° CSG / CRDS' }, { k: 'maladie', l: '2° Maladie-maternité (y c. IJ)' },
  { k: 'rb', l: '3° Retraite de base (y c. conjoint)' }, { k: 'id', l: '4° Invalidité-décès' },
  { k: 'rc', l: '5° Retraite complémentaire' }, { k: 'af', l: '6° Allocations familiales' },
  { k: 'cfp', l: '7° CFP' }, { k: 'autre', l: '8° Taxe chambre consulaire / autres' }
];
const ACC_COMMON = {
  cca: { n: '486', l: 'Charges constatées d\'avance' },
  cap: { n: '4386', l: 'Organismes sociaux – charges à payer' },
  par: { n: '4387', l: 'Organismes sociaux – produits à recevoir' }
};
const DEFAULT_ACCOUNTS = {
  gerant_is: Object.assign({
    cotis: { n: '6418', l: 'Cotisations sociales obligatoires gérant' },
    csgD: { n: '63781', l: 'CSG déductible gérant' },
    csgND: { n: '641701', l: 'CSG CRDS non déductible gérant' },
    cfp: { n: '6333', l: 'Contribution formation professionnelle' },
    autre: { n: '6358', l: 'Autres droits (taxe consulaire, CURPS)' },
    tiers: { n: '4377', l: 'Urssaf gérant' },
    cnbf: { n: '6418', l: 'Cotisations caisse de retraite gérant' },
    cnbfTiers: { n: '4378', l: 'Caisse de retraite (section professionnelle)' }
  }, JSON.parse(JSON.stringify(ACC_COMMON))),
  gerant_ir: Object.assign({
    cotis: { n: '646', l: 'Cotisations sociales personnelles du gérant' },
    csgD: { n: '646', l: 'CSG déductible gérant' },
    csgND: { n: '455', l: 'Associé – compte courant (CSG CRDS non déductible)' },
    cfp: { n: '646', l: 'CFP gérant' },
    autre: { n: '6358', l: 'Autres droits (taxe consulaire, CURPS)' },
    tiers: { n: '4377', l: 'Urssaf gérant' },
    cnbf: { n: '646', l: 'Cotisations caisse de retraite gérant' },
    cnbfTiers: { n: '4378', l: 'Caisse de retraite (section professionnelle)' }
  }, JSON.parse(JSON.stringify(ACC_COMMON))),
  ei: Object.assign({
    cotis: { n: '646', l: 'Cotisations sociales personnelles de l\'exploitant' },
    csgD: { n: '646', l: 'CSG déductible exploitant' },
    csgND: { n: '108', l: 'Compte de l\'exploitant (CSG CRDS non déductible)' },
    cfp: { n: '646', l: 'CFP exploitant' },
    autre: { n: '6358', l: 'Autres droits (taxe consulaire, CURPS)' },
    tiers: { n: '4377', l: 'Urssaf exploitant' },
    cnbf: { n: '646', l: 'Cotisations caisse de retraite' },
    cnbfTiers: { n: '4378', l: 'Caisse de retraite (section professionnelle)' }
  }, JSON.parse(JSON.stringify(ACC_COMMON)))
};
DEFAULT_ACCOUNTS.gerant = DEFAULT_ACCOUNTS.gerant_is;
const ACC_LABELS = { cotis: 'Cotisations obligatoires (Urssaf / MSA)', csgD: 'CSG déductible', csgND: 'CSG/CRDS non déductible', cfp: 'CFP', autre: 'Autres taxes (CMA / CCI, CURPS)', tiers: 'Tiers Urssaf / MSA', cnbf: 'Cotisations caisse de retraite', cnbfTiers: 'Tiers caisse de retraite', cca: 'Charges constatées d\'avance', cap: 'Charges à payer', par: 'Produits à recevoir' };
const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
