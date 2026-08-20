import assert from "node:assert/strict";
import { lancerNavigateur } from "./e2e-browser";
import { Pool } from "pg";

// **« Je ne peux pas envoyer au client. »** — le patron, le 7 août 2026, devant
// un écran qui affichait « L'envoi n'a pas pu être préparé. »
//
// Cette phrase-là était la phrase de secours du navigateur : celle qui
// s'affiche quand l'action serveur a **lancé** une erreur au lieu d'en rendre
// une. Le serveur savait pourquoi — « Ce devis a déjà été envoyé. », « Devis
// introuvable », un PDF impossible à composer — et rien ne le lui a dit. Ni à
// lui, ni à moi : il a fallu deux échanges pour seulement savoir quoi chercher.
//
// Ce que cette suite tient : **l'écran dit la raison, pas un constat d'échec.**
// C'est la même leçon que le bouton de mise à jour le matin même, et la
// troisième fois de la journée qu'un message générique cache ce qui compte.

const BASE = "http://localhost:3000";

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`);

  // Un chantier prêt à partir : client joignable, et une ligne chiffrée.
  const nom = `Raison envoi ${Date.now()}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', nom);
  await page.fill('input[placeholder="06 12 34 56 78"]', "0612345678");
  await page.click('[data-atlas="action-dicter"]');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/);
  const chantierId = page.url().split("/").pop()!;

  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Total TTC");
  await page.getByRole("button", { name: "+ Ajouter une ligne" }).click();
  await page.waitForTimeout(900);
  await page.getByLabel("Description 1").fill("Abattage d'un cèdre mort");
  await page.getByLabel("Prix unitaire 1").fill("850");
  await page.getByLabel("Description 1").click();
  await page.waitForTimeout(1200);

  // --- Le cas du patron : un devis DÉJÀ parti ------------------------------
  //
  // Reproduit en base plutôt qu'en refaisant l'envoi par l'écran : c'est l'état
  // qui compte, et il peut aussi venir d'un autre appareil, ou d'un double appui
  // dont le premier a abouti sans qu'il le voie.
  await pool.query(`UPDATE devis SET statut = 'envoye', envoye_le = now() WHERE chantier_id = $1`, [chantierId]);

  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // L'écran d'un devis déjà parti ne propose normalement plus de l'envoyer. S'il
  // le propose encore, c'est justement le chemin sur lequel le patron s'est
  // trouvé — et il doit alors dire la vérité.
  const ouvrir = page.getByText("Choisir la date", { exact: false });
  if ((await ouvrir.count()) === 0) {
    console.log("  ✓ un devis déjà parti ne propose plus de repartir");
    await pool.end();
    await navigateur.close();
    console.log("✅ L'envoi dit sa raison, ou ne se propose pas.");
    return;
  }

  await ouvrir.first().click();
  await page.waitForSelector("text=Une date, ou deux au choix du client ?");
  await page.locator("button[aria-pressed]").first().click();
  await page.getByRole("button", { name: "Envoyer le devis" }).click();
  await page.waitForTimeout(2500);

  const ecran = await page.locator("body").innerText();
  assert.doesNotMatch(
    ecran,
    /L'envoi n'a pas pu être préparé\./,
    "L'écran affiche la phrase de secours : la raison connue du serveur s'est perdue en route, et le patron n'a rien à chercher."
  );
  assert.match(
    ecran,
    /déjà été envoyé|déjà parti/i,
    `L'écran ne dit pas ce qui bloque. Lu : « ${ecran.replace(/\s+/g, " ").slice(0, 300)} »`
  );
  console.log("  ✓ un devis déjà parti le DIT, au lieu d'un échec sans cause");

  await pool.end();
  await navigateur.close();
  console.log("✅ L'envoi dit sa raison, ou ne se propose pas.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
