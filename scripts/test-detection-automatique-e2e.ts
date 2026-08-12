// Le navigateur du patron ne doit plus fabriquer de liens dans nos pages.
//
// **Le 12 août 2026, sur son iPhone**, la page publique d'une facture rend
// « Hydration failed ». Le diff de React désignait le coupable sans ambiguïté :
// le DOM portait `<a href="tel:2026-0003">` là où le composant ne rend que le
// texte `2026-0003`. Aucune page du dépôt n'écrit de `tel:` sur un numéro de
// facture — le lien venait donc du navigateur, qui reconnaît d'office ce qui
// ressemble à un téléphone et **réécrit le HTML avant que React ne s'installe
// dessus**.
//
// **La signature, obtenue le soir même.** Le patron renvoie l'erreur entière,
// depuis `/devis/<jeton>` cette fois : le lien inséré porte
// `x-apple-data-detectors="true"` et `x-apple-data-detectors-type="telephone"`.
// Ce n'est donc plus une déduction — c'est iOS, nommément, et sur les DEUX
// écrans que voit le client de l'artisan.
//
// Le remède est une seule ligne d'en-tête. Ce qui suit garde cette ligne, sur
// les deux écrans qui portent un numéro sous les yeux d'un client :
// `/factures/<jeton>` et `/devis/<jeton>`.
//
// ─── CE QUE CE CONTRÔLE NE PROUVE PAS, ET IL FAUT LE SAVOIR ──────────────────
// **La détection est propre à Safari. Cet environnement n'a que Chromium**, qui
// ne l'a jamais faite : impossible de reproduire ici la panne d'origine, et
// donc impossible de voir le correctif la faire disparaître. Ce qui est éprouvé
// est ce qui peut l'être — l'en-tête part bien, sur chaque écran concerné, et
// le jour où elle disparaîtra ce contrôle le dira. Le reste ne se vérifie que
// sur son téléphone.
// ─────────────────────────────────────────────────────────────────────────────

import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:3000";

// Ce que le navigateur doit lire pour cesser de fabriquer des liens. Next rend
// les trois refus dans un seul en-tête, séparés par des virgules.
const REFUS_ATTENDUS = ["telephone=no", "address=no", "email=no"];

let echecs = 0;
async function cas(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  console.log("=== Le navigateur ne fabrique plus de liens dans nos pages ===");

  // Les écrans du client passent en premier : ce sont eux qui portent un numéro
  // en titre, et ce sont les seuls qu'on ne peut pas rattraper après coup —
  // une fois le lien parti, le client ouvre ce qu'il ouvre.
  //
  // Un jeton inconnu suffit : la page de refus vit sous le même gabarit racine
  // que la vraie, et c'est ce gabarit qui porte l'en-tête. Fabriquer une
  // facture réelle ici n'éprouverait rien de plus et prendrait deux minutes.
  for (const chemin of ["/factures/jeton-inconnu", "/devis/jeton-inconnu", "/login"]) {
    await cas(`${chemin} refuse la détection automatique`, async () => {
      const reponse = await page.goto(`${BASE}${chemin}`, { waitUntil: "domcontentloaded" });
      assert.ok(reponse, `${chemin} n'a rien renvoyé`);

      const entete = await page
        .locator('head meta[name="format-detection"]')
        .getAttribute("content", { timeout: 10_000 })
        .catch(() => null);

      assert.ok(
        entete,
        `${chemin} ne porte plus \`<meta name="format-detection">\` : sur un iPhone, ` +
          "le numéro affiché redeviendra un lien d'appel, et React annoncera « Hydration " +
          "failed » au client de l'artisan"
      );
      for (const refus of REFUS_ATTENDUS) {
        assert.ok(
          entete!.includes(refus),
          `${chemin} : l'en-tête « ${entete} » ne contient pas « ${refus} »`
        );
      }
    });
  }

  // **Le témoin : ces pages affichent-elles encore un numéro nu ?**
  //
  // L'en-tête ne protège que ce qui est écrit en texte brut. Le jour où ces
  // deux pages entoureraient elles-mêmes leur numéro d'un lien — ou cesseraient
  // de l'afficher —, le contrôle ci-dessus resterait vert en ne gardant plus
  // rien. C'est la forme « 2026-0003 », posée nue dans un titre, que Safari
  // confondait avec un téléphone ; ce cas vérifie qu'elle est toujours là.
  await cas("le témoin : les deux pages du client posent encore un numéro nu", async () => {
    for (const fichier of ["src/app/factures/[jeton]/page.tsx", "src/app/devis/[jeton]/page.tsx"]) {
      const source = readFileSync(fichier, "utf8");
      assert.match(
        source,
        /<h1[\s\S]{0,300}?numeroCommercial[\s\S]{0,120}?<\/h1>/,
        `${fichier} n'affiche plus son numéro nu dans un titre : ` +
          "soit l'écran a changé, soit ce contrôle garde désormais le vide"
      );
      assert.ok(
        !/tel:/.test(source),
        `${fichier} écrit maintenant un \`tel:\` : si c'est voulu, ce contrôle doit être revu, ` +
          "car il affirme le contraire depuis le 12 août 2026"
      );
    }
  });

  // Et l'inverse : couper la détection ne doit pas avoir emporté les liens
  // qu'Atlas écrit LUI-MÊME. « telephone=no » n'éteint que la détection
  // automatique — mais rien ne remplace de le constater, et une régression ici
  // rendrait muet le bouton « appeler » de la fiche du client.
  await cas("les `tel:` écrits par Atlas restent des liens", async () => {
    // **Sur une page NEUVE, et c'est un correctif, pas une précaution.**
    //
    // Ce cas écrivait son témoin dans la page qui venait de servir `/login`.
    // Or `setContent` ne fait que réécrire le document : **l'application, elle,
    // tourne toujours**. Next.js réinjectait son `<title>Atlas</title>` dans le
    // `<head>` fraîchement écrit — on le voyait à l'œil dans le contenu rendu —
    // et emportait tantôt le témoin avec. Le contrôle échouait alors sur
    // « #temoin introuvable » pendant quarante-cinq secondes, en accusant la
    // détection automatique là où le fautif était son propre décor.
    //
    // Reproduit et compris avant d'être corrigé : le témoin passait seul, et
    // seulement après une visite de l'application. Une page neuve n'a aucune
    // application vivante dessus, et le cas ne dépend plus de rien d'autre que
    // de ce qu'il éprouve.
    const vierge = await contexte.newPage();
    try {
      await vierge.setContent(
        '<meta name="format-detection" content="telephone=no,address=no,email=no">' +
          '<a href="tel:0612345678" id="temoin">06 12 34 56 78</a>'
      );
      const href = await vierge.locator("#temoin").getAttribute("href", { timeout: 10_000 });
      assert.equal(href, "tel:0612345678", "un `tel:` explicite a été altéré par le refus");
    } finally {
      await vierge.close();
    }
  });

  await contexte.close();
  await navigateur.close();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Détection automatique — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
