import assert from "node:assert/strict";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { creerPuisFiche } from "./_creer-chantier-e2e";

// **Le retour d'un devis sans client mène à la fiche client.**
//
// ─────────────────────────────────────────────────────────────────────────────
// Le patron, le 31 août 2026, deux captures à l'appui : *« j'ai oublié de
// renseigner la fiche client du chantier. Lorsque je fais retour, je dois
// arriver sur la page de la fiche client ! Pas sur la page que je te mets en
// deuxième photo. »* Sa première capture est un devis portant « Aucun client
// rattaché à ce chantier » ; sa seconde, la fiche du chantier — l'écran où le
// retour le déposait, et qui ne dit ni ce qui manque ni où le réparer.
//
// ─────────────────────────────────────────────────────────────────────────────
// **CE QUE CETTE SUITE TIENT, ET QUE `test-retour-du-devis` NE PEUT PAS VOIR.**
// La règle est éprouvée sans base à côté ; ici on éprouve qu'elle est BRANCHÉE :
// que la flèche mène là où la règle dit, que la fiche s'ouvre pour de bon, et
// que le chemin se REFERME — enregistrer ramène au devis, qui porte alors le
// client. Une règle juste et débranchée serait verte des deux côtés sauf ici.

const BASE = "http://localhost:3000";

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  console.log("=== Le retour d'un devis sans client ===\n");

  const navigateur = await lancerNavigateur();
  // L'écran du patron est déjà le défaut de `lancerNavigateur`.
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  // **Son chantier : créé sans un mot sur le client.** C'est ce qui produit
  // « Aucun client rattaché à ce chantier » sur le devis, et c'est exactement
  // ce qu'il a photographié. Poser un client puis le retirer en base
  // éprouverait un état que l'application ne fabrique pas.
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  const chantierId = await creerPuisFiche(page, BASE);

  const retour = page.locator('[data-atlas="retour-du-devis"]');
  const versLaFiche =
    `/chantiers/${chantierId}/coordonnees` +
    `?de=${encodeURIComponent(`/chantiers/${chantierId}/devis-complet`)}`;

  await cas("SON CAS : le devis dit qu'aucun client n'est rattaché", async () => {
    await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=DEVIS", { timeout: 30_000 });
    const ecran = await page.locator("body").innerText();
    assert.ok(
      ecran.includes("Aucun client rattaché"),
      "le devis ne montre pas le manque qu'il a photographié : ce n'est plus son cas"
    );
  });

  await cas("la flèche de retour mène à la fiche client de CE chantier", async () => {
    assert.equal(await retour.count(), 1, "le devis n'a plus de sortie : un piège sur un téléphone");
    assert.equal(
      await retour.getAttribute("href"),
      versLaFiche,
      "elle le repose sur la fiche du chantier — la page qu'il a dit ne pas vouloir"
    );
  });

  await cas("elle ouvre pour de bon la fiche client, et son champ est vide", async () => {
    await retour.click();
    await page.waitForURL(/\/coordonnees/, { timeout: 30_000 });
    const nom = page.locator('input[placeholder="Bernard"]');
    await nom.waitFor({ state: "visible", timeout: 30_000 });
    assert.equal(await nom.inputValue(), "", "un champ prérempli : ce n'est pas ce chantier-là");
  });

  await cas("ET C'EST LA FICHE ENTIÈRE : les photos et l'anneau y sont", async () => {
    // **Sa demande du 31 août 2026, deux captures à l'appui :** *« lorsque je
    // fais retour j'arrive sur la page 1re photo alors que je veux arriver sur
    // la 2e. Je sais pas d'où sort la 1re photo ? Si elle sert à rien il faut
    // la supprimer. »* La première était cet écran privé de ses photos et de
    // son anneau. Il n'y a plus qu'une fiche client, et c'est celle-là.
    const photos = page.locator('[aria-label="Photos du chantier"]');
    assert.equal(await photos.count(), 1, "la fiche rouverte n'a pas ses photos");
    const anneau = page.locator('button[aria-label="Dicter une note vocale"]');
    assert.ok(
      (await anneau.count()) > 0,
      "la fiche rouverte n'a pas son anneau : c'est l'écran amputé qu'il a refusé"
    );
    // Et le bouton qui la distingue encore : sans lui, ce qu'il TAPE ne part
    // nulle part sur un chantier qui existe déjà.
    assert.equal(await page.locator('[data-atlas="action-creation"]').count(), 1);
  });

  const NOM = `Luk ${Date.now()}`;

  await cas("enregistrée, la fiche RAMÈNE au devis — le chemin se referme", async () => {
    await page.fill('input[placeholder="Bernard"]', NOM);
    await page.click('[data-atlas="action-creation"]');
    await page.waitForURL(new RegExp(`/chantiers/${chantierId}/devis-complet`), { timeout: 30_000 });
  });

  await cas("et le devis porte enfin son client", async () => {
    await page.waitForSelector("text=DEVIS", { timeout: 30_000 });
    // **Le nom se lit dans le CHAMP, pas dans le texte de la page.** Sur ce
    // devis, le client est saisissable en place : `innerText` ne le voit pas,
    // et une assertion sur le texte serait rouge sur un écran juste.
    const nom = page.locator('input[aria-label="Nom du client"]');
    await nom.waitFor({ state: "visible", timeout: 30_000 });
    assert.equal(await nom.inputValue(), NOM, "le nom saisi n'est pas arrivé sur le devis");
    const ecran = await page.locator("body").innerText();
    assert.ok(!ecran.includes("Aucun client rattaché"), "le devis dit encore qu'il n'y a pas de client");
  });

  await cas("le client posé, la flèche retrouve la fiche du chantier", async () => {
    // Le détour ne se justifie que par le manque : renvoyer sur un formulaire
    // rempli lui poserait une question qu'il n'a pas.
    assert.equal(await retour.getAttribute("href"), `/chantiers/${chantierId}`);
  });

  await cas("la fiche ouverte SANS provenance garde sa sortie du 17 août 2026", async () => {
    // Le chemin de l'accueil (« Adresse non renseignée ») entre par la même
    // porte : sa flèche rend la liste, et rien de ce lot ne doit la détourner.
    await page.goto(`${BASE}/chantiers/${chantierId}/coordonnees`, { waitUntil: "networkidle" });
    const flecheFiche = page.locator('a[aria-label="Retour à la liste des chantiers"]');
    assert.equal(await flecheFiche.count(), 1, "la fiche client n'a plus sa sortie vers la liste");
    assert.equal(await flecheFiche.getAttribute("href"), "/");
  });

  await cas("UNE PROVENANCE ÉTRANGÈRE NE FAIT PAS SORTIR D'ATLAS", async () => {
    // La valeur vient de l'adresse : sans le contrôle, la flèche « retour »
    // deviendrait une porte de sortie vers un site étranger.
    await page.goto(
      `${BASE}/chantiers/${chantierId}/coordonnees?de=${encodeURIComponent("https://ailleurs.example")}`,
      { waitUntil: "networkidle" }
    );
    const cible = await page.locator('a[aria-label^="Retour"]').first().getAttribute("href");
    assert.equal(cible, "/", `la flèche pointe vers « ${cible} » : elle quitterait Atlas`);
  });

  await contexte.close();
  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Le retour d'un devis sans client — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main();
