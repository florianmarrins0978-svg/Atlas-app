import assert from "node:assert/strict";
import { devices } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { ADRESSE } from "./_adresse";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import { ajouterLignePrix } from "../src/server/repositories/lignes-prix";

// LA MISE EN PAGE DU DEVIS, PAR SON GESTE — sa planche du 3 novembre 2026
// (`appli/soignee/devis-mise-en-page.html`), puis ses deux réponses du 4 sur
// `devis-mise-en-page-questions.html` : « dans la 1 oui la B » (des espaces,
// plusieurs « d'affilée ») et « B » (le saut se voit dans l'écran du devis).
//
// Les suites sans navigateur tiennent la règle (`test-mise-en-page-devis.ts`)
// et la base (`test-sauts-de-page-db.ts`). Celle-ci joue ce que LUI fait
// (`CLAUDE.md` §5 quater) : depuis l'écran du devis, « Aperçu du PDF », toucher
// une ligne, deux espaces, jusqu'à « Plus de place sur cette page. », la croix,
// « Nouvelle page », puis revenir à l'écran du devis et y voir le saut.
// Chaque geste se vérifie EN BASE : un écran qui montre une puce n'a rien
// prouvé si rien n'a été écrit.

const BASE = ADRESSE;
const LIBELLES = [
  "Taille de haie de laurier",
  "Élagage d'un frêne",
  "Camion d'évacuation",
  "Broyeur",
  "Abattage d'un thuya dépérissant en bordure de clôture, démontage par tronçons",
  "Dessouchage à la rogneuse",
  "Tonte de la pelouse arrière",
  "Scarification et regarnissage du gazon",
  "Apport de terre végétale criblée",
  "Fourniture et pose de paillage en écorces de pin",
];

async function main() {
  console.log("=== La mise en page du devis, par son geste ===\n");

  const [moi] = (
    await pool.query(
      `SELECT m.utilisateur_id, m.entreprise_id FROM membres_entreprise m JOIN users u ON u.id = m.utilisateur_id
        WHERE u.email = 'demo@atlas.local' AND m.role = 'proprietaire' LIMIT 1`
    )
  ).rows;
  if (!moi) throw new Error("le compte de démonstration est absent : la base n'est pas amorcée");
  const ctx = { utilisateurId: moi.utilisateur_id as string, entrepriseId: moi.entreprise_id as string };

  // Vingt lignes : la page 2 existe, et la sixième ligne est en page 1.
  const nom = `Mise en page ${Date.now()}`;
  const client = await clientsRepo.creerClient(ctx, { nom, telephone: "06 11 22 33 44" });
  const chantier = await chantiersRepo.creerChantier(ctx, { nom, clientId: client.id });
  const prix: string[] = [];
  for (let i = 0; i < 20; i++) {
    const l = await ajouterLignePrix(ctx, chantier.id, LIBELLES[i % LIBELLES.length], "120.00", { quantite: "1", prixUnitaire: "120.00" });
    prix.push(l.id);
  }
  const devisId = (await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id)).id;
  const cle = `ligne:${prix[5]}`;
  const enBase = async () =>
    (await pool.query(`SELECT sauts_de_page AS sauts, espaces_de_page AS espaces FROM devis WHERE id = $1`, [devisId])).rows[0] as {
      sauts: string[];
      espaces: Record<string, number>;
    };

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ ...devices["iPhone 13"] });
  const page = await contexte.newPage();
  const erreurs: string[] = [];
  page.on("pageerror", (e) => erreurs.push(String(e)));

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20000 });

  const ecranDuDevis = `${BASE}/chantiers/${chantier.id}/devis-complet`;
  await page.goto(ecranDuDevis, { waitUntil: "networkidle" });
  assert.equal(await page.locator('[data-atlas="saut-du-devis"]').count(), 0, "un saut se montre sur un devis qui n'en a aucun");

  // ─── L'aperçu : la phrase, et une zone par ligne ──────────────────────────
  await page.click('[data-atlas="apercu-pdf"]');
  await page.waitForSelector('[data-atlas="ligne-a-couper"]', { timeout: 60000 });
  assert.equal(await page.locator('[data-atlas="astuce-saut-de-page"]').count(), 1, "la phrase « Touchez une ligne… » ne s'affiche pas");
  const zone = page.locator(`[data-atlas="ligne-a-couper"][data-cle="${cle}"]`);
  assert.equal(await zone.count(), 1, "la sixième ligne n'a pas de zone à toucher");
  console.log("  ✓ l'aperçu ouvre la phrase et une zone par ligne");

  // ─── Toucher : deux boutons, qui ne débordent pas ─────────────────────────
  await zone.scrollIntoViewIfNeeded();
  await zone.click();
  const boutons = await page
    .locator('[data-atlas="nouvelle-page-ici"], [data-atlas="un-espace-ici"]')
    .evaluateAll((l) => l.map((e) => ({ texte: e.textContent, largeur: e.clientWidth, deborde: e.scrollWidth > e.clientWidth })));
  assert.deepEqual(boutons.map((b) => b.texte), ["Nouvelle page", "Un espace ici"]);
  assert.ok(boutons.every((b) => b.largeur > 0), "un bouton mesure zéro : la mesure ne prouve rien");
  assert.ok(boutons.every((b) => !b.deborde), `un libellé déborde de son bouton : ${JSON.stringify(boutons)}`);
  console.log("  ✓ une ligne touchée offre « Nouvelle page » et « Un espace ici »");

  // ─── Deux espaces d'affilée ───────────────────────────────────────────────
  for (const attendu of ["Espace", "2 espaces"]) {
    await page.click('[data-atlas="un-espace-ici"]');
    await page.waitForFunction(
      (t) => document.querySelector('[data-atlas="espace-pose"]')?.textContent?.trim() === t,
      attendu,
      { timeout: 60000 }
    );
  }
  assert.deepEqual((await enBase()).espaces, { [cle]: 2 }, "les deux espaces ne sont pas écrits avec le devis");
  assert.equal(await zone.getAttribute("aria-pressed"), "true", "la ligne n'est plus choisie : il faudrait la retoucher à chaque espace");
  assert.equal(await page.locator('[data-atlas="un-espace-ici"]').textContent(), "Encore un espace");
  assert.equal(await page.locator('[data-atlas="astuce-saut-de-page"]').count(), 0, "la phrase reste après le premier geste");
  console.log("  ✓ « Encore un espace » en ajoute un, la puce dit « 2 espaces », la base aussi");

  // ─── Jusqu'à « Plus de place sur cette page. » ────────────────────────────
  let poses = 2;
  while (poses < 30 && !(await page.locator('[data-atlas="plus-de-place"]').count())) {
    const avant = await page.locator('[data-atlas="espace-pose"]').textContent();
    await page.click('[data-atlas="un-espace-ici"]');
    await page.waitForFunction(
      (a) => !!document.querySelector('[data-atlas="plus-de-place"]') || document.querySelector('[data-atlas="espace-pose"]')?.textContent !== a,
      avant,
      { timeout: 60000 }
    );
    if (!(await page.locator('[data-atlas="plus-de-place"]').count())) poses++;
  }
  assert.equal(await page.locator('[data-atlas="plus-de-place"]').textContent(), "Plus de place sur cette page.");
  assert.equal((await enBase()).espaces[cle], poses, "l'espace refusé a été écrit quand même");
  assert.ok(poses > 2 && poses < 27, `la page a pris ${poses} espaces`);
  console.log(`  ✓ au ${poses + 1}e, « Plus de place sur cette page. », et rien ne s'écrit`);

  await page.click('[data-atlas="espace-pose"] button');
  await page.waitForFunction(() => !document.querySelector('[data-atlas="espace-pose"]'), null, { timeout: 60000 });
  assert.deepEqual((await enBase()).espaces, {}, "la croix n'a pas retiré les espaces");
  console.log("  ✓ la croix de la puce retire les espaces");

  // ─── Un saut, vu puis retiré dans l'écran du devis ────────────────────────
  if (!(await page.locator('[data-atlas="nouvelle-page-ici"]').count())) {
    await zone.scrollIntoViewIfNeeded();
    await zone.click();
  }
  await page.click('[data-atlas="nouvelle-page-ici"]');
  await page.waitForSelector('[data-atlas="saut-de-page"]', { timeout: 60000 });
  assert.deepEqual((await enBase()).sauts, [cle]);
  console.log("  ✓ « Nouvelle page » pose le saut, la puce se voit entre deux pages");

  await page.goto(ecranDuDevis, { waitUntil: "networkidle" });
  const saut = page.locator('[data-atlas="saut-du-devis"]');
  assert.equal(await saut.count(), 1, "l'écran du devis ne montre pas le saut posé dans l'aperçu");
  const devant = await saut.evaluate((e) => e.closest(".atlas-ligne")?.textContent ?? "");
  assert.ok(devant.includes(LIBELLES[5]), `le saut n'est pas devant « ${LIBELLES[5]} » : ${devant.slice(0, 60)}`);
  console.log("  ✓ l'écran du devis montre le saut, devant la bonne ligne");

  await saut.locator("button").click();
  await page.waitForFunction(() => !document.querySelector('[data-atlas="saut-du-devis"]'), null, { timeout: 30000 });
  assert.deepEqual((await enBase()).sauts, [], "la croix de l'écran du devis n'a pas retiré le saut");
  console.log("  ✓ sa croix le retire, en base aussi");

  // ─── « Tout remettre » ────────────────────────────────────────────────────
  await devisRepo.basculerSautDePage(ctx, devisId, "totaux");
  await devisRepo.ajouterUnEspaceDevant(ctx, devisId, `ligne:${prix[2]}`);
  await page.click('[data-atlas="apercu-pdf"]');
  await page.waitForSelector('[data-atlas="tout-remettre"]', { timeout: 60000 });
  await page.click('[data-atlas="tout-remettre"]');
  await page.waitForFunction(() => !document.querySelector('[data-atlas="tout-remettre"]'), null, { timeout: 60000 });
  assert.deepEqual(await enBase(), { sauts: [], espaces: {} }, "« Tout remettre » a laissé un saut ou un espace");
  console.log("  ✓ « Tout remettre » retire sauts et espaces");

  assert.deepEqual(erreurs, [], `erreurs dans la page : ${erreurs.join(" | ")}`);
  await navigateur.close();
  await pool.end();
  console.log("\nLa mise en page par son geste : tout est vert.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
