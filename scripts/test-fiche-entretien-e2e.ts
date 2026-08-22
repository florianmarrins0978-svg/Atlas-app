import assert from "node:assert/strict";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { MODELE_FOURNI } from "../src/lib/prestations-entretien";

// L'écran où la fiche d'entretien se compose — Réglages → Fiche d'entretien.
//
// **Sa demande du 16 août 2026** : *« dans les réglages […] un endroit où
// l'utilisateur pourra créer cette fiche […] retirer ou ajouter des cases s'il
// le souhaite »*.
//
// Ce que cette suite tient, et qu'aucune capture ne montrerait :
//
//   1. **la rubrique existe et se trouve** — un écran qu'il ne trouve pas
//      n'existe pas ;
//   2. le modèle ne se pose PAS tout seul : il est proposé, puis posé d'un
//      geste ;
//   3. **le retrait se défait** (sa règle du 10 août) — c'est le point le plus
//      coûteux de cet écran : une croix sans retour sur une liste composée à la
//      main ;
//   4. une prestation ajoutée se range dans SA famille, pas au bas de l'écran ;
//   5. un doublon est refusé **avec une phrase**, jamais avec un code.

const BASE = "http://localhost:3000";

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : e}`);
  }
}

async function main() {
  console.log("=== La fiche d'entretien, dans les Réglages ===");

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  // Le décor : une fiche vide, quel que soit l'état laissé par une autre suite.
  await pool.query(`delete from prestations_entretien`);

  await cas("la rubrique se trouve depuis les Réglages", async () => {
    await page.goto(`${BASE}/reglages`, { waitUntil: "networkidle" });
    const lien = page.getByRole("link", { name: /Fiche d'entretien/ });
    assert.equal(await lien.count(), 1, "la rubrique n'est pas dans le sommaire des réglages");
    await lien.first().click();
    await page.waitForURL(/\/reglages\/fiche-entretien/, { timeout: 20_000 });
  });

  await cas("une fiche vide PROPOSE le modèle, elle ne le pose pas", async () => {
    // Attendre l'écran lui-même : lire le corps à l'instant où l'adresse
    // change rendrait le contenu de la page PRÉCÉDENTE, et le contrôle
    // accuserait un écran qu'il n'a pas encore vu.
    await page.getByRole("button", { name: /Partir du modèle Atlas/ }).waitFor({ timeout: 20_000 });
    const corps = await page.locator("body").innerText();
    assert.match(corps, /vide/i, "l'écran ne dit pas que la fiche est vide");
    // Le contenu du modèle est montré AVANT d'appuyer : il choisit en sachant.
    assert.match(corps, /Tonte et ébarbage/, "le contenu du modèle n'est pas montré");
    const { rows } = await pool.query(`select count(*)::int as n from prestations_entretien`);
    assert.equal(rows[0].n, 0, "des prestations ont été écrites par le simple fait d'ouvrir l'écran");
  });

  await cas("« Partir du modèle Atlas » pose les prestations, une fois", async () => {
    await page.getByRole("button", { name: /Partir du modèle Atlas/ }).click();
    await page.waitForSelector("[data-prestation]", { timeout: 30_000 });
    const combien = await page.locator("[data-prestation]").count();
    assert.equal(
      combien,
      MODELE_FOURNI.length,
      `${combien} prestations à l'écran, ${MODELE_FOURNI.length} attendues`
    );
    // Les familles sont là, dans l'ordre du métier — pas dans l'alphabet.
    const familles = await page.locator("[data-famille]").evaluateAll((n) =>
      n.map((e) => (e as HTMLInputElement).value)
    );
    assert.deepEqual(familles, ["Pelouse", "Tailles", "Massifs", "Propreté"]);
  });

  await cas("LE RETRAIT SE DÉFAIT — et rien n'est écrit tant qu'on peut annuler", async () => {
    // **Le point le plus coûteux de cet écran.** Une croix nue sur une liste
    // composée à la main est le geste qu'il regretterait le plus.
    const avant = await page.locator("[data-prestation]").count();
    await page.getByRole("button", { name: "Retirer Scarification" }).click();
    await page.waitForTimeout(400);
    assert.equal(
      await page.locator("[data-prestation]").count(),
      avant - 1,
      "la ligne n'a pas disparu de l'écran"
    );
    // Rien en base tant que le tiroir est ouvert : sinon « Annuler » mentirait.
    const pendant = await pool.query(
      `select count(*)::int as n from prestations_entretien where libelle = 'Scarification'`
    );
    assert.equal(pendant.rows[0].n, 1, "la ligne a été supprimée AVANT la fin du délai d'annulation");

    await page.getByRole("button", { name: /Annuler/ }).click();
    await page.waitForTimeout(500);
    assert.equal(
      await page.locator("[data-prestation]").count(),
      avant,
      "« Annuler » n'a pas ramené la ligne"
    );
  });

  await cas("un retrait non annulé finit par s'écrire", async () => {
    await page.getByRole("button", { name: "Retirer Démoussage voirie" }).click();
    // Le tiroir se referme au bout de six secondes (`useRetraits`).
    await page.waitForTimeout(9_000);
    const { rows } = await pool.query(
      `select count(*)::int as n from prestations_entretien where libelle = 'Démoussage voirie'`
    );
    assert.equal(rows[0].n, 0, "la prestation retirée est toujours en base après le délai");
  });

  await cas("une prestation ajoutée se range dans SA famille", async () => {
    await page.reload({ waitUntil: "networkidle" });
    // Le bouton d'ajout de la première famille (Pelouse).
    await page.getByRole("button", { name: "+ Ajouter une prestation" }).first().click();
    await page.getByLabel(/Nouvelle prestation dans Pelouse/).fill("Aération du gazon");
    await page.getByRole("button", { name: /Ajouter à Pelouse/ }).click();
    await page.waitForTimeout(3_000);

    const { rows } = await pool.query(
      `select famille from prestations_entretien where libelle = 'Aération du gazon'`
    );
    assert.equal(rows.length, 1, "la prestation n'a pas été enregistrée");
    assert.equal(rows[0].famille, "Pelouse", "elle a atterri dans la mauvaise famille");
  });

  await cas("un doublon est refusé AVEC UNE PHRASE, jamais avec un code", async () => {
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: "+ Ajouter une prestation" }).first().click();
    await page.getByLabel(/Nouvelle prestation dans Pelouse/).fill("tonte et EBARBAGE");
    await page.getByRole("button", { name: /Ajouter à Pelouse/ }).click();
    await page.waitForTimeout(1_500);

    // `[data-refus]` et non `[role="alert"]` : la barre de développement de
    // Next porte elle aussi ce rôle, et le contrôle accusait alors l'écran.
    const alerte = page.locator("[data-refus]");
    assert.equal(await alerte.count(), 1, "aucun message n'explique le refus");
    const phrase = await alerte.innerText();
    assert.match(phrase, /déjà dans votre fiche/i, `phrase inattendue : « ${phrase} »`);
    // Ce que le patron ne doit JAMAIS lire.
    assert.doesNotMatch(phrase, /doublon|refus|error/i, `« ${phrase} » parle comme un programme`);
  });

  await contexte.close();
  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Fiche d'entretien (écran) — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
