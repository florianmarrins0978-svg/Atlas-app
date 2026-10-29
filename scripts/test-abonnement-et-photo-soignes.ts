import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { colors } from "../src/lib/design-tokens";
import CreditsIA from "../src/app/reglages/abonnement/CreditsIA";
import AbonnementClient from "../src/app/reglages/abonnement/AbonnementClient";
import FichePhoto from "../src/components/atlas/FichePhoto";

// ═══════════════════════════════════════════════════════════════════════════
// SES RÉPONSES DU 29 OCTOBRE 2026 SUR TROIS PLANCHES SOIGNÉES
// ═══════════════════════════════════════════════════════════════════════════
//
//   · `appli/soignee/reglages-abonnement.html`, « oui » : « Attention au mot »
//     perd son encadré bleu, une simple ligne à la même place ;
//   · `appli/soignee/abonnement-credits-ia.html`, « en rouge » : la barre des
//     crédits IA posée sur une plage, avec sa pastille (étincelle, puis pause
//     une fois épuisé), l'épuisé dans le rouge des cartes ;
//   · `appli/soignee/reglages-compte.html`, « oui » : la feuille de la photo
//     gagne « Annuler ».
//
// Les composants se rendent en texte, sans serveur et sans toucher la base.
// Elle demande pourtant les variables de `npm test` (ou `source
// scripts/monter-base-locale.sh`) : l'écran Abonnement importe ses actions
// serveur, qui lisent leur configuration au chargement. Ce qu'elle lit, ce
// sont les jetons et les repères, jamais un libellé seul.

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

const REPRISE = new Date("2026-11-01T00:00:00Z");
const credits = (etat: "normal" | "presque" | "epuise", pourcent: number) =>
  renderToStaticMarkup(React.createElement(CreditsIA, { credits: { plafonne: true, etat, pourcent, reprise: REPRISE } }));

/** Le trait du symbole pause et celui de l'étincelle, recopiés du kit des planches. */
const TRAIT_PAUSE = "M8.5 5.5v13M15.5 5.5v13";
const TRAIT_ETINCELLE = "M11 4l1.7 4.6";

/** Le fragment de balisage qui porte un repère `data-atlas`, jusqu'à sa fermeture. */
function pastille(html: string): string {
  const debut = html.indexOf('data-atlas="credits-ia-pastille"');
  assert.ok(debut >= 0, "la pastille des crédits est absente");
  return html.slice(debut, html.indexOf("</span>", debut));
}

test("les crédits tiennent sur une plage, au fond des cartes", () => {
  const html = credits("normal", 42);
  assert.match(html, new RegExp(`<section[^>]*background-color:${escape(colors.card)}[^>]*data-atlas="credits-ia"`));
});

test("normal : une pastille verte à l'étincelle", () => {
  const p = pastille(credits("normal", 42));
  assert.ok(p.includes(colors.carteVertFond) && p.includes(TRAIT_ETINCELLE), p);
});

test("presque épuisé : la pastille passe à l'ambre, l'étincelle reste", () => {
  const p = pastille(credits("presque", 88));
  assert.ok(p.includes(colors.carteAmbreFond) && p.includes(TRAIT_ETINCELLE), p);
});

test("épuisé : le symbole pause, la barre et le chiffre dans le rouge des cartes", () => {
  const html = credits("epuise", 100);
  const p = pastille(html);
  assert.ok(p.includes(TRAIT_PAUSE) && !p.includes(TRAIT_ETINCELLE), p);
  assert.ok(p.includes(`color:${colors.carteRougeTexte}`), "la pause n'est pas rouge");
  assert.ok(html.includes(`width:100%;background-color:${colors.carteRougeTexte}`), "la barre de l'épuisé n'est pas rouge");
  assert.ok(!html.includes(colors.alert), "l'épuisé prend le rouge de l'alerte, pas celui de la planche");
  assert.ok(!html.includes(colors.carteRougeFond), "un encadré rouge entoure l'épuisé");
  assert.match(html, /Crédits IA épuisés/);
});

test("la ligne sous la barre est à 15 px, comme la planche", () => {
  assert.match(credits("normal", 42), /<p class="[^"]*text-\[15px\][^"]*"[^>]*>Repart à zéro le/);
});

test("« Attention au mot » est une simple ligne, sans encadré bleu", () => {
  const html = renderToStaticMarkup(
    React.createElement(AbonnementClient, { formuleActuelle: "entreprise", periodiciteActuelle: "mensuelle", annulationDemandee: false, paiementBranche: true })
  );
  const i = html.indexOf("Attention au mot.");
  assert.ok(i >= 0, "la ligne a disparu");
  const avant = html.slice(html.lastIndexOf("<", html.lastIndexOf("<b", i) - 1), i);
  assert.ok(!avant.includes(colors.carteBleuFond), `la ligne est encore dans un encadré bleu : ${avant}`);
  assert.match(avant, /data-atlas="attention-au-mot"/);
});

test("la feuille de la photo porte « Annuler », dans les deux cas", () => {
  for (const photo of [null, "entreprises/x/photo.jpg"]) {
    const html = renderToStaticMarkup(
      React.createElement(FichePhoto, {
        repli: "PM",
        nom: "Paul Morel",
        photo,
        envoyer: async () => ({ ok: true as const, photo: "x" }),
        retirer: async () => ({ ok: true as const }),
        onPhoto: () => {},
        onFermer: () => {},
      })
    );
    assert.match(html, /<button[^>]*data-atlas="annuler-photo"[^>]*>Annuler<\/button>/, `sans « Annuler » (photo : ${photo})`);
  }
});

/** Les jetons portent des parenthèses : on les cherche tels quels. */
function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
if (failed > 0) process.exit(1);
