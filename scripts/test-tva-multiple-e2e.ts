import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { mkdirSync } from "node:fs";

// Plusieurs TVA sur le devis — PAR LE CHEMIN QU'IL EMPRUNTE, LUI.
//
// **Sa demande du 1er septembre 2026**, après avoir écarté une première
// proposition qui mettait un taux sur chaque ligne : *« il ne faut pas la
// rajouter à chaque ligne, mais lorsque j'ai plusieurs choses à rajouter ou une
// seule en TVA à 10, j'appuie sur ajouter une TVA, une catégorie s'ajoute et là
// je mets toutes mes lignes qui seront en TVA à 10. Mais elles doivent avoir la
// possibilité d'être sur plusieurs lignes différentes. »*
//
// **POURQUOI CETTE SUITE ENTRE PAR LE BOUTON, ET NON PAR LE DÉPÔT** (`CLAUDE.md`
// §5 quater). Le 28 août 2026, six gestes de l'assistant ont été livrés avec
// leurs contrôles tous verts et AUCUN atteignable : les contrôles construisaient
// la demande à la main au lieu d'emprunter la porte d'entrée. Ici, la règle et
// le dépôt sont déjà tenus par `test-tva-multiple.ts` et
// `test-tva-multiple-db.ts` ; ce qui reste à prouver est qu'un doigt sur
// « + Ajouter une TVA » produit vraiment une catégorie.
//
// Ce qu'elle tient :
//
//   1. **sans son geste, l'écran est EXACTEMENT celui d'avant** — aucun titre
//      de catégorie, aucun sous-total. C'est la moitié qui compte : ses devis
//      ordinaires n'ont pas à changer d'allure ;
//   2. le bouton existe, et il ouvre une catégorie qui porte SON taux ;
//   3. une catégorie porte PLUSIEURS lignes — sa phrase exacte ;
//   4. les totaux montrent une ligne de TVA par catégorie, et le TTC tombe
//      juste ;
//   5. **la base porte ce que l'écran affiche.** Un total juste à l'écran et
//      faux en base, c'est le PDF qui part faux chez le client ;
//   6. retirer la catégorie NE SUPPRIME PAS ses lignes.

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = "http://localhost:3000";

let echecs = 0;
async function cas(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  mkdirSync("/tmp/atlas-captures", { recursive: true });
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 900 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 });

  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', `Mme TvaMultiple ${Date.now()}`);
  await creerPuisFiche(page);
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 15_000 });
  const url = page.url();
  const chantierId = url.split("/").pop()!;

  /** Écrit une ligne dans le rang donné — l'attente vaut mieux qu'un délai fixe. */
  async function ecrireLigne(rang: number, libelle: string, prix: string) {
    const zones = page.locator('textarea[aria-label*="escription"]');
    for (const essai of [1, 2, 3, 4, 5]) {
      if ((await zones.count()) > rang) break;
      await page.waitForTimeout(essai * 300);
    }
    await zones.nth(rang).fill(libelle);
    await page.locator('input[aria-label*="Prix unitaire"]').nth(rang).fill(prix);
    await page.keyboard.press("Tab");
    await page.waitForTimeout(400);
  }

  // La main d'œuvre : deux lignes, au taux du devis, comme n'importe quel devis.
  await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
  for (const [rang, [libelle, prix]] of [
    ["Taille de haie de charmille", "1400"],
    ["Évacuation des déchets verts", "180"],
  ].entries()) {
    await page.click('button:has-text("Ajouter une ligne")');
    await ecrireLigne(rang, libelle!, prix!);
  }

  for (const essai of [1, 2, 3, 4]) {
    await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
    if ((await page.locator("body").innerText()).includes("1 580,00")) break;
    await page.waitForTimeout(essai * 500);
  }

  const totaux = () => page.locator("section").filter({ hasText: "Total TTC" }).last();

  /**
   * Les libellés tels qu'ils sont RÉELLEMENT à l'écran.
   *
   * **`innerText` de la page ne les contient pas**, et c'est ce qui a fait
   * rougir ce contrôle sur du code juste : une description est une `<textarea>`,
   * dont le contenu vit dans `value` et jamais dans le texte rendu. Chercher le
   * libellé dans le corps de la page revenait à chercher ce qui ne s'y trouve
   * par construction pas.
   */
  const libellesAffiches = () =>
    page.locator('textarea[aria-label*="escription"]').evaluateAll((zones) =>
      zones.map((z) => (z as HTMLTextAreaElement).value)
    );

  await cas("sans son geste, l'écran est EXACTEMENT celui d'avant", async () => {
    const corps = await page.locator("body").innerText();
    assert.ok(!corps.includes("Sous-total HT"), "un sous-total s'affiche sur un devis à un seul taux");
    // Le champ du taux reste dans les totaux, modifiable, comme aujourd'hui.
    assert.equal(
      await page.locator('input[aria-label="Taux de TVA"]').count(),
      1,
      "le champ du taux a disparu d'un devis ordinaire"
    );
    assert.equal(
      await page.locator('input[aria-label*="Taux de TVA de la catégorie"]').count(),
      0,
      "un titre de catégorie s'affiche alors qu'il n'y a qu'un taux"
    );
    const t = (await totaux().innerText()).replace(/\s/g, " ");
    assert.match(t, /1 896,00/, `le TTC à un seul taux est faux :\n${t}`);
  });

  await cas("« Ajouter une TVA » ouvre une catégorie — LE GESTE QU'IL A DÉCRIT", async () => {
    const bouton = page.getByRole("button", { name: "+ Ajouter une TVA" });
    assert.equal(await bouton.count(), 1, "aucun moyen d'ajouter une TVA");
    await bouton.click();
    await page.waitForTimeout(1200);

    const titres = page.locator('input[aria-label*="Taux de TVA de la catégorie"]');
    assert.equal(await titres.count(), 2, "les deux catégories devaient apparaître");
    // 10 % : le taux qu'il a donné en exemple, celui de ses végétaux.
    assert.equal(await titres.nth(1).inputValue(), "10", "la catégorie neuve n'est pas à 10 %");

    // **La catégorie d'ACCUEIL ne porte pas de « − ».** C'est là que tout
    // retombe : le dépôt refuse de la retirer, donc un bouton sur elle serait un
    // bouton qui ne fait rien. Défaut vu à la capture — « 20 » comparé à
    // « 20.00 » — et invisible aux totaux, qui étaient justes.
    const retraits = page.getByRole("button", { name: /Retirer la TVA à/ });
    assert.equal(await retraits.count(), 1, "le « − » s'affiche sur la catégorie d'accueil");
    assert.match(
      (await retraits.first().getAttribute("aria-label")) ?? "",
      /10 %/,
      "le « − » ne vise pas la bonne catégorie"
    );
  });

  await cas("une catégorie porte PLUSIEURS lignes — sa phrase exacte", async () => {
    // La catégorie s'est ouverte avec sa première ligne ; on la remplit, puis on
    // en ajoute une seconde DANS elle.
    await ecrireLigne(2, "Charmille en motte", "990");

    // Le second « Ajouter une ligne » est celui de la seconde catégorie.
    const boutons = page.getByRole("button", { name: "+ Ajouter une ligne" });
    assert.equal(await boutons.count(), 2, "chaque catégorie doit avoir son bouton");
    await boutons.nth(1).click();
    await ecrireLigne(3, "Terreau de plantation", "106.80");

    for (const essai of [1, 2, 3, 4]) {
      await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
      if ((await page.locator("body").innerText()).includes("1 096,80")) break;
      await page.waitForTimeout(essai * 500);
    }
    // **Le contrôle DIT ce qu'il a trouvé.** « la ligne a disparu » envoie
    // chercher dans le groupement alors que le défaut peut être à l'écriture :
    // on lit donc la base, et le message porte les libellés réellement écrits.
    const { rows: enBase } = await pool.query(
      `SELECT libelle, montant, taux_tva FROM lignes_prix WHERE chantier_id = $1 ORDER BY ordre`,
      [chantierId]
    );
    const vu = JSON.stringify(enBase);
    const libelles = await libellesAffiches();
    assert.ok(libelles.includes("Charmille en motte"), `la première ligne de la catégorie a disparu — en base : ${vu}`);
    assert.ok(libelles.includes("Terreau de plantation"), `la seconde ligne n'a pas rejoint la catégorie — en base : ${vu}`);
    // **Et elles sont RANGÉES sous leur catégorie**, pas éparpillées : les deux
    // lignes à 10 % se suivent, après les deux au taux du devis.
    assert.deepEqual(libelles.slice(2), ["Charmille en motte", "Terreau de plantation"]);
  });

  // **REGARDER L'ÉCRAN FAIT PARTIE DU TRAVAIL** (`CLAUDE.md` §5) : six défauts
  // réels de ce dépôt sont sortis d'une image et d'aucun test. L'état est monté
  // ici, avec ses deux catégories remplies — c'est le moment de le photographier,
  // plutôt qu'un second parcours qui reconstruirait la même chose.
  await page.screenshot({ path: "/tmp/atlas-captures/devis-tva-deux-categories.png", fullPage: true });

  await cas("les totaux montrent une TVA par catégorie, et le TTC tombe juste", async () => {
    const t = (await totaux().innerText()).replace(/\s/g, " ");
    assert.match(t, /TVA \(20 %\)/, `la TVA à 20 % manque :\n${t}`);
    assert.match(t, /TVA \(10 %\)/, `la TVA à 10 % manque :\n${t}`);
    assert.match(t, /316,00/, "la TVA à 20 % est fausse");
    assert.match(t, /109,68/, "la TVA à 10 % est fausse");
    assert.match(t, /3 102,48/, `le TTC est faux :\n${t}`);
    // Tout à 20 % aurait donné 3 212,16 € : l'écart qu'on cherche à éviter.
    assert.ok(!t.includes("3 212,16"), "l'écran a tout compté à 20 %");
  });

  await cas("la BASE porte ce que l'écran affiche", async () => {
    // Un total juste à l'écran et faux en base, c'est le PDF qui part faux.
    const { rows } = await pool.query(
      `SELECT total_ht, total_tva, total_ttc FROM devis WHERE chantier_id = $1
       ORDER BY numero_version DESC LIMIT 1`,
      [chantierId]
    );
    assert.equal(rows.length, 1, "aucun devis en base");
    assert.equal(rows[0].total_ht, "2676.80");
    assert.equal(rows[0].total_tva, "425.68");
    assert.equal(rows[0].total_ttc, "3102.48");
  });

  await cas("RETIRER la catégorie ne supprime pas ses lignes", async () => {
    // La faute à ne pas commettre : il retire une TVA posée par erreur et perd
    // le travail qu'il venait de chiffrer, sans un mot.
    await page.getByRole("button", { name: /Retirer la TVA à 10 %/ }).click();
    await page.waitForTimeout(1200);
    await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });

    const libelles = await libellesAffiches();
    assert.ok(libelles.includes("Charmille en motte"), "une ligne a disparu avec la catégorie");
    assert.ok(libelles.includes("Terreau de plantation"), "une ligne a disparu avec la catégorie");
    const corps = await page.locator("body").innerText();
    assert.ok(!corps.includes("Sous-total HT"), "les sous-totaux restent après le retrait");

    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM lignes_prix WHERE chantier_id = $1`,
      [chantierId]
    );
    assert.equal(rows[0].n, 4, "des lignes ont été supprimées avec la catégorie");
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} ${echecs} échec(s).`);
  await contexte.close();
  await navigateur.close();
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

void main();
