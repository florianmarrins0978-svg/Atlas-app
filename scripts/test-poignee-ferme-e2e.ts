// La poignée d'une feuille la referme-t-elle vraiment ?
//
// **Le patron, le 13 août 2026, capture à l'appui :** *« si j'appuie sur le
// petit trait gris au-dessus de "y aller", c'est censé refermer la page, sauf
// que ça ne marche pas. »*
//
// **La feuille éprouvée a changé le 21 août 2026, la poignée n'a pas bougé.**
// « Y aller » a disparu avec la refonte du planning (planche 84) : la feuille de
// chantier y est posée dans la page, plus dans un panneau qui remonte. La
// poignée, elle, vit dans `BottomSheet` — partagée par une dizaine d'écrans —
// et c'est ELLE que ce contrôle défend. Il passe donc par « Noter une absence »
// (Réglages → Équipe), qui ouvre la même feuille. Suivre la poignée là où elle
// vit plutôt que là où elle vivait, c'est la seule façon de ne pas perdre le
// contrôle avec l'écran (`CLAUDE.md` §5 bis).
//
// Elle n'était qu'un trait dessiné — et pire : posée dans le panneau qui arrête
// les appuis pour que le fond ne se ferme pas sous les doigts, elle ABSORBAIT
// le geste sans rien en faire. Toucher la poignée pour refermer est ce que tout
// téléphone enseigne ; la refuser ici n'apprenait rien, cela donnait une feuille
// qui ignore le doigt.
//
// **Aucun contrôle ne pouvait le voir**, et c'est le point : les suites
// existantes ouvrent la feuille et vérifient ce qu'elle contient. Aucune
// n'essayait de la refermer par où le patron la referme.
//
// Ce qui est tenu ici :
//   1. la poignée existe, et c'est un vrai bouton — pas un trait ;
//   2. l'appuyer referme la feuille ;
//   3. **elle est atteignable au doigt** — le trait fait quatre pixels de haut,
//      la zone touchable doit être bien plus grande, sinon le geste rate et le
//      patron conclut que « ça ne marche pas » alors que le code est juste ;
//   4. le fond continue de fermer, et le contenu de NE PAS fermer — sans quoi
//      on répare la poignée en cassant la feuille.

import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";

const BASE = "http://localhost:3000";

/** Ce qu'un doigt atteint sans viser : la recommandation d'Apple comme d'Android. */
const DOIGT_MINIMUM_PX = 24;

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
  console.log("=== La poignée referme la feuille ===\n");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`);

  // **Aucun décor à fabriquer** : « Noter une absence » est toujours là, sur un
  // écran de réglages qui ne dépend d'aucune donnée. La version d'avant posait
  // un chantier en base pour atteindre « Y aller » — deux minutes de montage
  // pour n'apprendre rien de plus sur la poignée.
  async function ouvrirLaFeuille() {
    await page.goto(`${BASE}/reglages/equipe`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=+ Noter une absence", { timeout: 30_000 });
    await page.getByText("+ Noter une absence").first().click();
    await page.getByLabel("Refermer").waitFor({ state: "visible", timeout: 20_000 });
  }

  await cas("la poignée est un vrai bouton, pas un trait décoratif", async () => {
    await ouvrirLaFeuille();
    const poignee = page.getByLabel("Refermer");
    assert.equal(
      await poignee.evaluate((e) => e.tagName),
      "BUTTON",
      "la poignée n'est pas un bouton : elle ne répondra ni au clavier, ni aux outils d'accessibilité"
    );
  });

  await cas("elle est ATTEIGNABLE au doigt, pas seulement dessinée", async () => {
    const boite = await page.getByLabel("Refermer").boundingBox();
    assert.ok(boite, "la poignée n'a pas de boîte : elle n'est pas à l'écran");
    assert.ok(
      boite!.height >= DOIGT_MINIMUM_PX,
      `la poignée ne fait que ${Math.round(boite!.height)} px de haut : le doigt la ratera, ` +
        "et le patron conclura que « ça ne marche pas » alors que le code répond"
    );
  });

  await cas("l'appuyer REFERME la feuille", async () => {
    await page.getByLabel("Refermer").click();
    await page
      .getByLabel("Refermer")
      .waitFor({ state: "hidden", timeout: 10_000 })
      .catch(() => {
        throw new Error("la feuille est toujours ouverte après l'appui sur la poignée");
      });
  });

  await cas("le contenu de la feuille, lui, ne la ferme PAS", async () => {
    // **Le garde-fou du correctif.** Refermer sur n'importe quel appui serait
    // pire que la poignée muette : le patron perdrait la feuille en visant
    // « Waze ». C'est ce que `stopPropagation` protège, et il doit survivre.
    await ouvrirLaFeuille();
    await page.getByLabel("Motif de l'absence").click();
    await page.waitForTimeout(400);
    assert.ok(
      await page.getByLabel("Refermer").isVisible(),
      "un appui sur le contenu referme la feuille : elle se dérobera sous le doigt"
    );
  });

  await cas("le fond continue de refermer", async () => {
    // Le geste historique doit survivre au nouveau.
    await page.mouse.click(10, 10);
    await page
      .getByLabel("Refermer")
      .waitFor({ state: "hidden", timeout: 10_000 })
      .catch(() => {
        throw new Error("l'appui sur le fond ne referme plus la feuille");
      });
  });

  await contexte.close();
  await navigateur.close();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Poignée — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
