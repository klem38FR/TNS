'use strict';
/* Onglet Dossier */

/* ---------- Dossier ---------- */
function tabDossier(d, e, r) {
  const A = actDef(e.activite);
  const accRows = Object.keys(ACC_LABELS).map(k => `<tr><td>${ACC_LABELS[k]}</td><td>${txt(`d.comptes.${k}.n`, (d.comptes[k] || {}).n)}</td><td>${txt(`d.comptes.${k}.l`, (d.comptes[k] || {}).l, 'style="width:100%"')}</td></tr>`).join('');
  return `
  <div class="card"><h2>Identité du dossier</h2>
    <div class="grid">
      ${fld('Prénom', txt('d.prenom', d.prenom))}
      ${fld('Nom', txt('d.nom', d.nom))}
      ${(() => { const c = nirCheck(d.nir); const b = { vide: '', ok: '<span class="badge ok">Clé valide</span>', sansCle: `<span class="badge warn">Clé manquante (calculée : ${c.attendu})</span>`, cle: `<span class="badge err">Clé incorrecte (attendue : ${c.attendu})</span>`, format: `<span class="badge err">${esc(c.msg || '')}</span>` }[c.etat];
        return fld('N° de sécurité sociale (NIR)', `<input data-b="d.nir" data-t="nir" value="${esc(nirFmt(d.nir))}" maxlength="21" placeholder="1 85 05 78 006 084 91">`, b); })()}
      ${fld('Code journal (Pennylane)', txt('d.journal', d.journal))}
      ${fld('Préfixe n° de pièce', txt('d.prefixe', d.prefixe))}
    </div>
    ${cardIdentiteComplement(d, e)}
    <p class="note">Chaque dossier conserve tous ses exercices (historique). Le changement de dossier, de catégorie ou d'activité ne réinitialise aucune saisie : les champs propres à l'ancien régime restent stockés et réapparaissent si vous y revenez.</p>
  </div>
  <div class="card"><h2>${esc(vueLib(e, true))} ${milBadge(r.pYear)}</h2>
    ${warnList(r.W)}
    <div class="grid">
      ${fld('Activité (caisse et taux)', sel('e.activite', OLD_ACT[e.activite] || e.activite, actOptions(e.activite)), A.mode === 'ssi' ? 'Tout est appelé par l\'Urssaf (SSI).' : A.mode === 'cipav' ? 'Tout est appelé par l\'Urssaf (y compris la retraite Cipav).' : A.mode === 'msa' ? 'Cotisations appelées par la MSA.' : `Urssaf : maladie, IJ, AF, CSG-CRDS, CFP${A.pamc ? ', CURPS' : ''} ; ${A.caisse} : retraite et invalidité-décès.`)}
      ${fld('Catégorie', sel('e.statut', OLD_STATUT[e.statut] || e.statut, STATUTS))}
      ${fld('Régime', sel('e.regime', e.regime || defaultRegime(e.activite, e.statut), REGIMES))}
      ${e._civ ? fld('Période (année civile)', `<b>01/01/${e.annee} → 31/12/${e.annee}</b>`, `Exercice comptable : ${frDate(e._exDeb)} → ${frDate(e._exFin)} (dates modifiables dans la vue « Bilan »).`)
        : fld('Début de l\'exercice comptable', dateI('e.debutExercice', e.debutExercice)) + fld('Clôture de l\'exercice (année N = année de clôture)', dateI('e.finExercice', e.finExercice))}
    </div>
    <div class="row" style="margin-top:8px"><button class="sec sm" data-act="resetAcc">Appliquer les comptes par défaut de la catégorie « ${esc(STATUTS[e.statut] || '')} »</button></div>
    ${fld('Notes de l\'exercice', `<textarea data-b="e.notes" data-t="text">${esc(e.notes || '')}</textarea>`)}
  </div>
  ${cardHisto(d, e)}
  ${cardParametres(d, e, r)}
  ${PRINTING && !(e.conjoint && e.conjoint.actif) ? '<div class="card"><p style="margin:0"><b>Conjoint collaborateur :</b> non</p></div>' : `<div class="card"><h2>Conjoint collaborateur ${milBadge(r.pYear)}</h2>
    ${A.mode !== 'ssi' ? `<div class="alert warn">${esc(A.caisse)} : cotisations du conjoint non calculées par l'outil (règles propres à la caisse) — saisissez-les dans l'appel.</div>` : ''}
    <div class="grid">
      ${fld('Statut', chk('e.conjoint.actif', e.conjoint.actif, 'Conjoint collaborateur déclaré'))}
      ${fld('Option d\'assiette notifiée', sel('e.conjoint.option', e.conjoint.option, { tiers_pass: '1/3 du PASS (forfait, option par défaut)', tiers_rev: '1/3 du revenu du chef, sans partage', moitie_rev: '1/2 du revenu du chef, sans partage', partage_tiers: 'Partage : 1/3 au conjoint (chef : 2/3 pour la retraite)', partage_moitie: 'Partage : 1/2 au conjoint (chef : 1/2 pour la retraite)' }))}
    </div>
    <p class="note">SSI : cotisations du conjoint calculées (retraite de base, complémentaire, invalidité-décès, sans minimum). Pas de maladie, AF ni CSG-CRDS. Taux CFP majoré « avec conjoint » si renseigné dans les paramètres.</p>
  </div>`}
  <div class="card"><h2>Comptes comptables du dossier</h2>
    <p class="note">Défauts : gérant IS 6418 / 63781 / 641701 / 6333 / 4377 (repris du classeur) ; gérant IR et EI 646 (CSG/CRDS non déductible : 455 pour le gérant IR — à vérifier, 108 pour l'EI). Vérifiez-les avec votre plan de comptes Pennylane.</p>
    <div class="scroll"><table><tr><th>Usage</th><th>N° de compte</th><th>Libellé de compte</th></tr>${accRows}</table></div>
  </div>`;
}

function cardIdentiteComplement(d, e) {
  let age = '';
  const bd = parseD(d.dateNaissance);
  if (bd) { let a = e.annee - bd.y - 1; if (bd.m === 1 && bd.d === 1) a++; age = `Âge au 01/01/${e.annee} : ${a} ans`; }
  return `<h3>État civil et situation</h3>
    <div class="grid">
      ${fld('Titre', sel('d.titre', d.titre || '', { '': '—', 'M.': 'M.', 'Mme': 'Mme' }))}
      ${fld('Date de naissance', dateI('d.dateNaissance', d.dateNaissance), age)}
      ${fld('Date de début d\'activité', dateI('d.debutActivite', d.debutActivite), 'Début en cours d\'année : seuils et plafonds Urssaf proratisés au jour')}
      ${fld('Date de fin d\'activité (cessation)', dateI('d.finActivite', d.finActivite), 'Cessation en cours d\'année : seuils et plafonds Urssaf proratisés au jour')}
      ${fld('Comptabilité', sel('d.comptabilite', d.comptabilite || 'commerciale', { commerciale: 'Comptabilité d\'engagement (commerciale)', tresorerie: 'Recettes-dépenses (trésorerie)' }), 'Recettes-dépenses : seules les écritures de reclassement des règlements sont proposées.')}
    </div>
    ${fld('Adresse', `<textarea data-b="d.adresse" data-t="text" style="min-height:60px">${esc(d.adresse || '')}</textarea>`)}`;
}
function cardParametres(d, e, r) {
  const dv = d.divers = d.divers || { dom: false, cfp: true, ijAC: true, ijPL: true, zfu: false };
  const yn = (path, v) => sel(path, v === false ? 'false' : 'true', { true: 'Oui', false: 'Non' }, 'bool2');
  const nb = (path, v) => sel(path, v ? 'true' : 'false', { false: 'Non', true: 'Oui' }, 'bool2');
  const A = actDef(e.activite), pl = A.mode === 'pl' || A.mode === 'cipav';
  return `<div class="card"><h2>Paramètres (DOM, ACRE) ${milBadge(r.pYear)}</h2>
    <h3>DOM · Divers</h3>
    <div class="grid">
      ${fld('Domiciliation dans les DOM ?', nb('d.divers.dom', dv.dom))}
      ${fld('Assujettissement à la CFP ?', yn('d.divers.cfp', dv.cfp))}
      ${pl ? fld('Assujettissement aux IJ des professions libérales ?', yn('d.divers.ijPL', dv.ijPL)) : fld('Assujettissement aux IJ des artisans et commerçants ?', yn('d.divers.ijAC', dv.ijAC))}
      ${fld('Exonération de cotisation maladie pour activité en ZFU ou ZRU ?', nb('d.divers.zfu', dv.zfu))}
      ${fld('Taxe pour frais de chambre consulaire (CMA / CCI) appelée ?', nb('d.divers.taxeConsulaire', dv.taxeConsulaire))}
    </div>
    ${PRINTING && !(e.acre && e.acre.actif) ? '<p><b>ACRE :</b> non</p>' : `<h3>ACRE</h3>
    <div class="grid">
      ${fld('Bénéficiaire', chk('e.acre.actif', e.acre.actif, 'Exonération ACRE applicable sur l\'année N'))}
      ${fld('Nombre de mois d\'application sur l\'année civile N (0 à 12)', inp('e.acre.mois', e.acre.mois, 'num', 'int'))}
      ${fld('Revenu retenu pour le seuil', sel('e.acre.base', e.acre.base, { abattue: 'Assiette abattue (base cotisations)', brut: 'Revenu brut social' }), 'Point non tranché par les sources : à choisir.')}
    </div>
    <p class="note">Régime 2026 : exonération plafonnée à 25 % des cotisations éligibles (maladie, IJ, AF, retraite de base, invalidité-décès), dégressive entre 75 % et 100 % du PASS, sur 12 mois. Non exonérées : retraite complémentaire, CSG-CRDS, CFP. Professions libérales hors Cipav : seule la part Urssaf est traitée.</p>`}
  </div>`;
}
function cardHisto(d, e) {
  d.histo = d.histo || {};
  const ys = [1, 2, 3, 4, 5].map(k => e.annee - k);
  const autos = {}; ys.forEach(y => { autos[y] = histoAuto(d, y) || {}; const c = histoCumul(d, y); autos[y].trimestres = c && c.v !== null ? c.v : undefined; autos[y]._cumul = c; });
  const head = `<tr><th>Revenus</th>${ys.map(y => `<th class="n">${y}${d.exercices[y] ? ' <span class="badge ok" title="Exercice créé : valeurs reprises automatiquement">exercice</span>' : ''}</th>`).join('')}</tr>`;
  const rows = HISTO_ROWS.map(R => `<tr><td style="padding-left:${6 + 14 * (R.ind || 0)}px">${R.l}</td>${ys.map(y => {
    const man = (d.histo[y] || {})[R.k];
    const au = R.auto && autos[y] ? autos[y][R.k] : undefined;
    if (R.k === 'trimestres' && au === undefined && autos[y]._cumul && (man === undefined || man === '')) return `<td class="n" title="Renseignez le cumul de ${y - 1} pour calculer le cumul ${y} (+${autos[y]._cumul.add})">${inp(`d.histo.${y}.${R.k}`, '', 'num', 'int', `placeholder="? +${autos[y]._cumul.add}" style="background:#fff3df"`)}</td>`;
    if (au !== undefined && (man === undefined || man === '')) return `<td class="n" title="Repris de l'exercice ${y} (saisir pour remplacer)">${inp(`d.histo.${y}.${R.k}`, '', 'num', R.int ? 'int' : 'num', `placeholder="${fmt0(au)}" style="background:#eef6ff"`)}</td>`;
    return `<td class="n">${inp(`d.histo.${y}.${R.k}`, man, 'num', R.int ? 'int' : 'num')}</td>`;
  }).join('')}</tr>`).join('');
  return `<div class="card"><h2>Données historiques (années civiles ${ys[4]} à ${ys[0]})</h2>
    <div class="scroll"><table>${head}${rows}</table></div>
    <p class="note">Cellules bleutées : valeurs calculées à partir de l'exercice de l'année. Une saisie remplace la valeur reprise ; videz la cellule pour revenir au calcul. Le revenu social, la base sociale et la base CSG de ${e.annee - 1} pré-remplissent le courrier (définitif ${e.annee - 1} et provisionnel ${e.annee}) ; ceux de ${e.annee - 1} et ${e.annee - 2} servent aux cotisations des caisses calculées sur un revenu antérieur. Trimestres : MIN(4 ; ENT(assiette retraite de base / (150 × SMIC horaire au 1er janvier))), assiette au moins égale au plancher de 450 SMIC horaires. Cumul = cumul de l'année précédente + trimestres de l'année ; une valeur saisie fait foi.</p>
  </div>`;
}
