'use strict';
/* Onglet Déclaration 2042 */

/* ---------- 2042 ---------- */
function tab2042(d, e, r) {
  const bI = r.b, P = r.p.pass;
  return `<div class="card"><h2>Déclaration des revenus ${e.annee} (souscrite en ${e.annee + 1}) – 2042 / volet social ${milBadge(r.pYear)}</h2>
    <div class="row" style="justify-content:flex-end;margin-bottom:6px"><button data-act="printClient" title="Impression A4 d'une page : cases à déclarer, détail de la rémunération, plafonds Madelin">🖨 Récapitulatif client</button></div>
    <div class="grid">${fld('Déclarant', sel('e.cloture.declarant', r.d42.dc, { 1: 'Déclarant 1', 2: 'Déclarant 2' }, 'int'))}
      ${fld('Nature du contrat retraite (Madelin / PER – retraite)', sel('e.perType', e.perType || 'per', { per: 'PER individuel (6OS / 6OT)', madelin: 'Ancien contrat Madelin (6QS / 6QT)' }))}</div>
    ${vueNote2042(e)}
    <div class="scroll"><table><tr><th>Zone</th><th>Case</th><th>Libellé</th><th class="n">Montant</th><th>Détail</th></tr>
    ${r.d42.rows.map(x => `<tr><td>${esc(x.zone)}</td><td><b>${esc(x.code)}</b></td><td>${esc(x.lib)}</td>${money(rnd(x.v))}<td class="note">${esc(x.det || '')}</td></tr>`).join('')}</table></div>
    <h3>Épargne retraite – détail ${milBadge(r.pYear)}</h3>
    <table><tr><th>Élément</th><th class="n">Montant</th></tr>
      <tr><td>Madelin / PER retraite versé</td>${money(bI.madRet)}</tr>
      <tr><td>− excédent réintégré (au-delà du plafond Madelin retraite)</td>${money(r.m.reintRet)}</tr>
      <tr class="sub"><td>= montant déduit du revenu professionnel</td>${money(r.m.dedRet)}</tr>
      <tr><td>− fraction de 15 % du revenu compris entre 1 et ${r.p.madelin.ret.plafMult} PASS (non déclarée)</td>${money(Math.min(r.m.part15, r.m.dedRet))}</tr>
      <tr class="tot"><td>= montant à déclarer case ${esc(r.d42.rows.find(x => x.per).code)}</td>${money(r.m.perDecl)}</tr></table>
    <div class="formula">[Barème ${r.pYear}] Case ${esc(r.d42.rows.find(x => x.per).code)} = MAX( 0 ; (versé − excédent réintégré) − ${pc(r.p.madelin.ret.taux2, 0)} × MAX( 0 ; MIN(base Madelin ${fmt0(r.m.base)} ; ${r.p.madelin.ret.plafMult} × PASS) − PASS ${fmt0(P)} ) )</div>
    <div class="alert warn">Épargne retraite : selon l'art. 163 quatervicies du CGI, le plafond « épargne retraite » est diminué des cotisations déduites du revenu professionnel (art. 154 bis), sauf la fraction correspondant aux 15 % du revenu compris entre 1 et 8 PASS, qui n'est donc pas déclarée. Versements sur un PER individuel déduits du revenu professionnel : cases 6OS (déclarant 1) / 6OT (déclarant 2) ; anciens contrats Madelin et abondement de l'employeur sur un PER d'entreprise / PERCO : cases 6QS / 6QT. Ces versements, déjà déduits du revenu professionnel, ne doivent pas figurer aussi en case 6NS / 6NT (déduction du revenu global) : corrigez la case si elle est préremplie. Cases et règles à vérifier chaque année avec la notice 2042 et l'attestation fiscale de l'assureur.</div>
    <div class="alert warn">Codes du volet social issus de la note Angak (04/2026) relative aux revenus 2025 ; la case 1GB/1HB et sa composition reposent sur le BOI-RSA-GER-20 (déduction des cotisations obligatoires, de la CSG déductible et des cotisations Madelin dans les limites). Vérifiez chaque année avec la notice officielle 2042 / 2042-C-PRO du millésime, les codes pouvant changer. La déduction forfaitaire de 10 % ou les frais réels ne sont pas traités ici.</div>
    ${r.b.isG ? `<p class="note">Contrôle : DSEC/DSED + DSEM + DSAA + DSCN = ${fmt(sum(r.d42.rows.filter(x => x.zone === 'Volet social').map(x => x.v)))} ; revenu brut social calculé = ${fmt(bI.brut)}.</p>` : ''}
  </div>`;
}
