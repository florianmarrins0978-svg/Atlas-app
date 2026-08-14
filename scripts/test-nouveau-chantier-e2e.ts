import { lancerNavigateur } from "./e2e-browser";
import { nomDuChantier } from "../src/lib/nom-chantier";
import { jourIso } from "../src/lib/jour";
import assert from "node:assert";

// Créer un chantier, et ce que cela demande au patron.
//
// **Le 5 août 2026 : « dans la catégorie chantier, retire la case nom du
// chantier ».** C'était le seul champ obligatoire, et le seul qui lui demandait
// d'inventer quelque chose : un élagueur ne baptise pas ses chantiers, il dit
// « chez M. Bernard ». Lui faire trouver un titre avant de pouvoir commencer,
// c'était une porte fermée à clé devant une maison ouverte.
//
// Ce que cette suite tient désormais :
//   1. le champ n'existe plus, et **plus rien n'est obligatoire** ;
//   2. le chantier porte quand même un nom, déduit de ce qu'il a donné ;
//   3. ce nom le suit — sur la fiche comme dans la liste.

async function main() {
  const browser = await lancerNavigateur();
  const context = await browser.newContext({ deviceScaleFactor: 3 });
  const page = await context.newPage();

  // Connexion réelle (Auth.js) — toutes les routes applicatives sont
  // désormais protégées par le middleware d'authentification.
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL("http://localhost:3000/", { timeout: 10000 });

  const client = `M. E2E ${Date.now()}`;
  // Le nom du chantier se DÉDUIT du client (`src/lib/nom-chantier.ts`) : on
  // applique la même règle que le produit plutôt que de la recomposer. Recopié
  // « Chez … » ici, ce contrôle est passé au rouge le 13 août 2026, le jour où
  // le patron a fait retirer ce mot.
  const nomAttendu = nomDuChantier({ nomClient: client, jour: jourIso(new Date()) });

  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });

  // Le champ retiré ne doit pas revenir par une autre porte.
  assert.equal(
    await page.locator('input[placeholder="Rénovation salle de bain"]').count(),
    0,
    "La case « Nom du chantier » est de retour : le patron a demandé qu'elle disparaisse."
  );

  // Et rien n'est obligatoire : le bouton est actif sur un formulaire vierge.
  assert.ok(
    await page.getByRole("button", { name: /Créer le chantier/ }).isEnabled(),
    "Le bouton reste inactif sur un formulaire vide : quelque chose est encore exigé."
  );

  await page.fill('input[placeholder="Bernard"]', client);
  await page.click('button:has-text("Créer le chantier")');

  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 5000 });
  const url = page.url();
  console.log("Redirigé vers:", url);
  assert.match(url, /\/chantiers\/[0-9a-f-]{36}$/, "Doit rediriger vers un vrai UUID");

  // La page hub relit le chantier depuis la base — si ces valeurs s'affichent,
  // la création a bien été persistée (pas de simulation restante).
  //
  // Le nom attendu est celui que déduit `src/lib/nom-chantier.ts`.
  //
  // **`.first()` et non le locator nu, depuis le 13 août 2026.** Le nom du
  // chantier ne porte plus « Chez » devant : quand le client s'appelle déjà
  // « M. … », le nom du chantier lui est IDENTIQUE, et le même texte se trouve
  // donc à deux endroits de la fiche. Playwright refusait alors d'agir —
  // « strict mode violation » — sur une page parfaitement juste. Ce qui est
  // éprouvé ici, c'est que le nom déduit est bien à l'écran, pas qu'il n'y
  // figure qu'une fois.
  await page.waitForSelector(`text=${nomAttendu}`, { timeout: 5000 });
  assert.ok(
    await page.locator(`text=${nomAttendu}`).first().isVisible(),
    "Le chantier n'a pas pris le nom de son client : il est devenu impossible à reconnaître."
  );
  assert.ok(await page.locator("text=Ajouter des photos").isVisible(), "Un chantier neuf doit proposer 'Ajouter des photos'");

  // Revérifie via la liste (autre écran, autre requête) que le chantier y figure aussi.
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  assert.ok(
    await page.locator(`text=${nomAttendu}`).first().isVisible(),
    "Le nouveau chantier doit apparaître dans la liste, sous son nom déduit"
  );

  // --- Sans rien du tout ---------------------------------------------------
  // Le cas qui rendait le champ obligatoire. Un chantier sans client ni adresse
  // doit exister quand même, et rester reconnaissable : la date est la seule
  // chose vraie qui reste, et elle vaut mieux qu'un « Sans titre ».
  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 5000 });
  const titre = await page.locator("h1").first().innerText();
  assert.ok(
    /^Chantier du /.test(titre.trim()),
    `Un chantier créé sans rien n'a pas de nom lisible : « ${titre} »`
  );

  await browser.close();
  console.log("✅ Test bout-en-bout de création réussi.");
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
