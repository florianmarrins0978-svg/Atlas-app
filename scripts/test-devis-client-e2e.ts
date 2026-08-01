import assert from "node:assert";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as devisRepo from "../src/server/repositories/devis";
import { creerEnvoi, lireParJeton, genererJeton } from "../src/server/repositories/envois-devis";
import { fenetreProposition, versJourIso, ajouterJours } from "../src/server/disponibilites";

// Parcours réel de la page publique de réponse au devis (docs/AGENT.md §2.2 bis).
// Exercée dans un navigateur, SANS session : c'est tout l'intérêt de cette page,
// et c'est ce qui la rend sensible.

const BASE = "http://localhost:3000";

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

async function preparerEnvoi(suffixe: string, datesDansNJours: number[]) {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Atelier du Test" },
    { email: `client-e2e-${suffixe}-${Date.now()}@atlas.test` }
  );
  const ctx = { utilisateurId, entrepriseId: entreprise.id };
  const chantier = await chantiersRepo.creerChantier(ctx, {
    nom: "Élagage du grand chêne",
    adresseChantier: "5 avenue de la République",
  });
  const d = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  const maintenant = new Date();
  const envoi = await creerEnvoi(
    ctx,
    {
      chantierId: chantier.id,
      devisId: d.id,
      canal: "sms",
      datesProposees: datesDansNJours.map((n) => versJourIso(ajouterJours(maintenant, n))),
      contenuDevis: `devis-${suffixe}`,
    },
    maintenant
  );
  return { ctx, chantierId: chantier.id, envoi, maintenant };
}

async function main() {
  const browser = await lancerNavigateur();
  const context = await browser.newContext({ viewport: { width: 393, height: 852 } });

  await test("un jeton inconnu ne révèle rien au visiteur", async () => {
    const page = await context.newPage();
    await page.goto(`${BASE}/devis/${genererJeton()}`, { waitUntil: "networkidle" });
    assert.ok(
      await page.locator("text=Ce lien n'est plus valable").isVisible(),
      "le message générique n'est pas affiché"
    );
    await page.close();
  });

  await test("le client voit son devis sans être connecté", async () => {
    const { envoi } = await preparerEnvoi("vue", [10, 14]);
    const page = await context.newPage();
    const erreurs: string[] = [];
    page.on("pageerror", (e) => erreurs.push(e.message));

    await page.goto(`${BASE}/devis/${envoi.jeton}`, { waitUntil: "networkidle" });

    assert.ok(await page.locator("text=Atelier du Test").isVisible(), "émetteur absent");
    assert.ok(await page.locator("text=Quelle date vous arrange").isVisible(), "choix de date absent");
    assert.ok(await page.locator('button:has-text("J\'accepte ce devis")').isVisible());
    assert.ok(await page.locator('button:has-text("Je ne donne pas suite")').isVisible());
    assert.strictEqual(erreurs.length, 0, `erreurs JS : ${erreurs.join(", ")}`);
    await page.close();
  });

  await test("aucune redirection vers la connexion ni vers l'acceptation", async () => {
    const { envoi } = await preparerEnvoi("public", [10]);
    const page = await context.newPage();
    await page.goto(`${BASE}/devis/${envoi.jeton}`, { waitUntil: "networkidle" });
    assert.ok(page.url().includes(`/devis/${envoi.jeton}`), `redirigé vers ${page.url()}`);
    await page.close();
  });

  await test("le client ne voit pas la navigation de l'application", async () => {
    const { envoi } = await preparerEnvoi("chrome", [10]);
    const page = await context.newPage();
    await page.goto(`${BASE}/devis/${envoi.jeton}`, { waitUntil: "networkidle" });

    // La barre « Chantiers / Planning / Tarifs » appartient à l'espace de
    // travail du patron. Chez le client, ses liens ne mèneraient qu'à une page
    // de connexion : une navigation inopérante est pire qu'absente.
    for (const libelle of ["Chantiers", "Planning", "Tarifs"]) {
      assert.strictEqual(
        await page.locator(`nav >> text=${libelle}`).count(),
        0,
        `« ${libelle} » est visible sur la page du client`
      );
    }
    await page.close();
  });

  await test("le calendrier est borné à la fenêtre de proposition", async () => {
    const { envoi, maintenant } = await preparerEnvoi("bornes", [10]);
    const page = await context.newPage();
    await page.goto(`${BASE}/devis/${envoi.jeton}`, { waitUntil: "networkidle" });

    await page.locator('input[name="choixDate"][value="autre"]').check();
    const champ = page.locator('input[name="dateAutre"]');
    const f = fenetreProposition(maintenant);
    assert.strictEqual(await champ.getAttribute("min"), f.debut, "borne basse absente");
    assert.strictEqual(await champ.getAttribute("max"), f.fin, "borne haute absente");
    await page.close();
  });

  await test("accepter une date proposée planifie le chantier", async () => {
    const { ctx, chantierId, envoi, maintenant } = await preparerEnvoi("accepte", [20, 24]);
    const page = await context.newPage();
    await page.goto(`${BASE}/devis/${envoi.jeton}`, { waitUntil: "networkidle" });

    const dateVoulue = versJourIso(ajouterJours(maintenant, 24));
    await page.locator(`input[name="choixDate"][value="${dateVoulue}"]`).check();
    await page.click('button:has-text("J\'accepte ce devis")');
    await page.waitForSelector("text=Votre artisan est prévenu", { timeout: 10000 });

    const chantier = await chantiersRepo.getChantier(ctx, chantierId);
    assert.strictEqual(chantier?.datePlanifiee, dateVoulue, "le chantier n'est pas planifié");

    const relu = await lireParJeton(envoi.jeton);
    assert.strictEqual(relu?.reponse, "acceptee");
    await page.close();
  });

  await test("la case de rétractation n'apparaît que pour une date proche", async () => {
    const { envoi, maintenant } = await preparerEnvoi("retract", [5, 40]);
    const page = await context.newPage();
    await page.goto(`${BASE}/devis/${envoi.jeton}`, { waitUntil: "networkidle" });

    const proche = versJourIso(ajouterJours(maintenant, 5));
    const lointaine = versJourIso(ajouterJours(maintenant, 40));
    const caseRetract = page.locator('input[name="demarrageAnticipe"]');

    await page.locator(`input[name="choixDate"][value="${lointaine}"]`).check();
    assert.strictEqual(await caseRetract.count(), 0, "affichée alors que la date est lointaine");

    await page.locator(`input[name="choixDate"][value="${proche}"]`).check();
    assert.strictEqual(await caseRetract.count(), 1, "absente alors que la date est proche");
    assert.strictEqual(await caseRetract.isChecked(), false, "elle ne doit jamais être pré-cochée");
    await page.close();
  });

  await test("un refus est enregistré sans rien planifier", async () => {
    const { ctx, chantierId, envoi } = await preparerEnvoi("refus", [12]);
    const page = await context.newPage();
    await page.goto(`${BASE}/devis/${envoi.jeton}`, { waitUntil: "networkidle" });

    await page.click('button:has-text("Je ne donne pas suite")');
    await page.waitForSelector("text=Votre réponse a bien été transmise", { timeout: 10000 });

    const chantier = await chantiersRepo.getChantier(ctx, chantierId);
    assert.strictEqual(chantier?.datePlanifiee, null, "un refus ne doit rien planifier");
    const relu = await lireParJeton(envoi.jeton);
    assert.strictEqual(relu?.reponse, "refusee");
    await page.close();
  });

  await test("accepter sans choisir de date est refusé avec un message clair", async () => {
    const { envoi } = await preparerEnvoi("sansdate", [12]);
    const page = await context.newPage();
    await page.goto(`${BASE}/devis/${envoi.jeton}`, { waitUntil: "networkidle" });

    await page.click('button:has-text("J\'accepte ce devis")');
    // Sélecteur restreint au paragraphe : Next.js injecte son propre élément
    // role="alert" (l'annonceur de route), qui rendrait le sélecteur ambigu.
    await page.waitForSelector('p[role="alert"]', { timeout: 10000 });
    assert.ok(
      (await page.locator('p[role="alert"]').innerText()).includes("date"),
      "le message ne parle pas de la date"
    );
    await page.close();
  });

  await test("un devis déjà accepté ne peut plus être répondu", async () => {
    const { envoi, maintenant } = await preparerEnvoi("rejoue", [15]);
    const page = await context.newPage();
    await page.goto(`${BASE}/devis/${envoi.jeton}`, { waitUntil: "networkidle" });
    await page
      .locator(`input[name="choixDate"][value="${versJourIso(ajouterJours(maintenant, 15))}"]`)
      .check();
    await page.click('button:has-text("J\'accepte ce devis")');
    await page.waitForSelector("text=Votre artisan est prévenu", { timeout: 10000 });

    await page.goto(`${BASE}/devis/${envoi.jeton}`, { waitUntil: "networkidle" });
    assert.ok(await page.locator("text=Devis accepté").isVisible());
    // L'écran de retour redonne la date retenue : c'est ce que le client vient
    // y chercher, et ça lui évite de rappeler son artisan pour la vérifier.
    assert.ok(
      await page.locator("text=Intervention prévue le").isVisible(),
      "la date retenue n'est pas rappelée"
    );
    await page.close();
  });

  await context.close();
  await browser.close();
  console.log(`\n${passed} réussis, ${failed} échoués`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
