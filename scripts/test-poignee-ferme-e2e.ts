// La poignée d'une feuille la referme-t-elle vraiment ?
//
// **Le patron, le 13 août 2026, capture à l'appui :** *« si j'appuie sur le
// petit trait gris au-dessus de "y aller", c'est censé refermer la page, sauf
// que ça ne marche pas. »*
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
import { Pool } from "pg";

const BASE = "http://localhost:3000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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

  // **Le décor est fabriqué ici, jamais emprunté au jeu de démonstration.**
  // Une première version cherchait un chantier déjà planifié : elle échouait
  // dès que les suites précédentes avaient consommé le décor, et son message
  // accusait alors le produit d'un manque qui n'existait pas. La date est
  // posée en base — le parcours complet du devis est éprouvé ailleurs, et le
  // rejouer ici ajouterait deux minutes pour ne rien apprendre sur la poignée.
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="M. Bernard"]', `M. Poignée ${Date.now()}`);
  await page.fill('input[placeholder="06 12 34 56 78"]', "05 56 00 00 12");
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const chantierId = page.url().split("/").pop()!;
  const pose = await pool.query(
    `UPDATE chantiers
        SET devis_envoye_at = now(),
            date_planifiee = CURRENT_DATE + 3,
            adresse_chantier = '19 Rue Denfert 30300 Beaucaire'
      WHERE id = $1`,
    [chantierId]
  );
  if (pose.rowCount !== 1) {
    throw new Error(
      "le décor n'a pas pu être posé : le rôle de test ne traverse probablement plus RLS " +
        "(voir CLAUDE.md §5). Ce n'est pas un défaut du produit."
    );
  }
  const nomChantier = (await pool.query(`SELECT nom FROM chantiers WHERE id = $1`, [chantierId]))
    .rows[0].nom as string;

  async function ouvrirLaFeuille() {
    await page.goto(`${BASE}/planning`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('h1:has-text("Planning")', { timeout: 30_000 });
    await page.getByRole("button", { name: `Y aller — ${nomChantier}` }).click();
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
    await page.getByText(/Y aller/i).first().click();
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
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Poignée — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
