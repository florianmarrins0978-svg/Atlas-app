import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ConfirmerLeChangement from "../src/app/reglages/abonnement/ConfirmerLeChangement";
import AbonnementClient from "../src/app/reglages/abonnement/AbonnementClient";

// ═══════════════════════════════════════════════════════════════════════════
// LA FEUILLE QUI DIT LE MONTANT AVANT DE VALIDER, ET LA DESCENTE PRÉVUE
// ═══════════════════════════════════════════════════════════════════════════
//
// Sa planche du 23 novembre 2026 (`appli/soignee/changer-de-formule.html`) et
// ses décisions du même soir. Les composants se rendent en texte, sans
// serveur ni base ; il leur faut les variables de `npm test`, l'écran
// important ses actions serveur. Ce qu'elle lit : les montants et les
// repères, ceux que la planche montrait.
//
// Ce qu'elle NE prouve PAS : qu'un appui débite ce montant chez le
// prestataire. Cela se joue sur son espace, avec sa clé de test (`TODO.md`).

let passed = 0;
let failed = 0;
function test(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}\n   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

const N = " ";
const LE_23_DEC = "2026-12-23T12:00:00.000Z";
const rien = () => {};

function feuille(props: Partial<React.ComponentProps<typeof ConfirmerLeChangement>>): string {
  return renderToStaticMarkup(
    React.createElement(ConfirmerLeChangement, {
      actuel: { formule: "artisan", periodicite: "mensuelle" },
      voulu: { formule: "entreprise", periodicite: "mensuelle" },
      echeance: LE_23_DEC,
      comptesQuiPartent: 0,
      fermer: rien,
      changerDeCarte: rien,
      ...props,
    })
  );
}

test("MONTER : 59 € HT débités aujourd'hui, 70,80 € TTC, avant tout geste", () => {
  const html = feuille({});
  assert.match(html, />Passer à Entreprise</);
  assert.match(html, /Débité aujourd’hui/);
  assert.ok(html.includes(`>59${N}€<`), "le montant HT n'est pas celui de la grille");
  assert.ok(html.includes(`70,80${N}€ TTC`), "le TTC manque");
  assert.match(html, /Les jours restants d’Artisan ne sont pas remboursés\./);
  assert.match(html, />Prochain paiement</);
  assert.match(html, /data-atlas="confirmer"[^>]*>Confirmer</);
  assert.match(html, />Annuler</);
  assert.ok(!html.includes("comptes-supprimes"), "une montée annonce des comptes supprimés");
});

test("MONTER À L'ANNÉE : la différence, 200 € HT, et la phrase qui le dit", () => {
  const html = feuille({
    actuel: { formule: "artisan", periodicite: "annuelle" },
    voulu: { formule: "entreprise", periodicite: "annuelle" },
  });
  assert.ok(html.includes(`>200${N}€<`), "ce n'est pas la différence des deux années");
  assert.match(html, /La différence avec Artisan, pour l’année en cours\./);
  assert.ok(html.includes(`590${N}€ HT par an`), "le prochain paiement n'est pas l'année d'Entreprise");
  // L'échéance ne bouge pas : le carré porte le 23 décembre.
  assert.match(html, />23<\/span><span[^>]*>déc\.</);
});

test("DESCENDRE : 0 € aujourd'hui, Artisan commence le 23 décembre, il garde Entreprise", () => {
  const html = feuille({
    actuel: { formule: "entreprise", periodicite: "mensuelle" },
    voulu: { formule: "artisan", periodicite: "mensuelle" },
  });
  assert.match(html, />Passer à Artisan</);
  assert.ok(html.includes(`>0${N}€<`), "la descente annonce un débit");
  assert.ok(!html.includes("TTC"), "un TTC s'affiche sur rien");
  assert.match(html, />Artisan commence</);
  assert.ok(html.includes(`39${N}€ HT par mois`));
  assert.match(html, /Jusque-là, vous gardez Entreprise\./);
  assert.match(html, />23<\/span><span[^>]*>déc\.</);
});

test("AVEC DES SALARIÉS : la plage ambre dit combien de comptes partent, et quand", () => {
  const html = feuille({
    actuel: { formule: "entreprise", periodicite: "mensuelle" },
    voulu: { formule: "artisan", periodicite: "mensuelle" },
    comptesQuiPartent: 2,
  });
  assert.match(html, /data-atlas="comptes-supprimes"/);
  assert.match(html, /Le 23 décembre 2026, les 2 autres comptes de l’entreprise seront supprimés\./);
  assert.match(html, /Leurs devis et factures restent dans l’entreprise\./);
});

test("un seul compte se dit au singulier", () => {
  const html = feuille({
    actuel: { formule: "entreprise", periodicite: "mensuelle" },
    voulu: { formule: "artisan", periodicite: "mensuelle" },
    comptesQuiPartent: 1,
  });
  assert.match(html, /l’autre compte de l’entreprise sera supprimé\./);
  assert.match(html, /Ses devis et factures restent/);
});

test("une montée n'annonce jamais de comptes supprimés, même si la liste en compte", () => {
  assert.ok(!feuille({ comptesQuiPartent: 3 }).includes("comptes-supprimes"));
});

test("DE L'ANNÉE AU MOIS : rien aujourd'hui, le mois commence à l'échéance", () => {
  const html = feuille({
    actuel: { formule: "entreprise", periodicite: "annuelle" },
    voulu: { formule: "entreprise", periodicite: "mensuelle" },
  });
  assert.match(html, />Passer au mois</);
  assert.ok(html.includes(`>0${N}€<`));
  assert.match(html, />Le paiement au mois commence</);
});

test("LA DESCENTE PRÉVUE : « Garder Entreprise » en bas, la date sur la carte d'Artisan", () => {
  const html = renderToStaticMarkup(
    React.createElement(AbonnementClient, {
      formuleActuelle: "entreprise",
      periodiciteActuelle: "mensuelle",
      annulationDemandee: false,
      paiementBranche: true,
      echeance: LE_23_DEC,
      prevu: { formule: "artisan", periodicite: "mensuelle" },
      comptesQuiPartent: { artisan: 0, entreprise: 0, illimite: 0 },
    })
  );
  assert.match(html, /data-atlas="garder-la-formule"[^>]*>Garder Entreprise</);
  const carte = html.slice(html.indexOf('data-atlas="formule-artisan"'), html.indexOf('data-atlas="formule-entreprise"'));
  assert.match(carte, /À partir du 23 décembre 2026/, "la carte d'Artisan ne porte pas sa date");
  assert.ok(!html.includes(">Passer à"), "un bouton propose encore de changer par-dessus la descente prévue");
});

test("sans descente prévue, aucun « Garder »", () => {
  const html = renderToStaticMarkup(
    React.createElement(AbonnementClient, {
      formuleActuelle: "entreprise",
      periodiciteActuelle: "mensuelle",
      annulationDemandee: false,
      paiementBranche: true,
      echeance: LE_23_DEC,
      prevu: null,
      comptesQuiPartent: { artisan: 0, entreprise: 0, illimite: 0 },
    })
  );
  assert.ok(!html.includes("garder-la-formule"));
  assert.ok(!html.includes("formule-prevue"));
});

console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
if (failed > 0) process.exit(1);
