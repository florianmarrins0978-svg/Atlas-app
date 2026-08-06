import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "fixtures", "test-photo.jpg");

async function main() {
  const browser = await lancerNavigateur();
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3 });
  const page = await context.newPage();

  // Connexion réelle (Auth.js) — toutes les routes applicatives sont
  // désormais protégées par le middleware d'authentification.
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL("http://localhost:3000/", { timeout: 10000 });

  // Crée un chantier dédié pour ce test, pour ne pas dépendre du contenu du seed.
  const nomUnique = `Chantier photos e2e ${Date.now()}`;
  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="M. Bernard"]', nomUnique);
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 5000 });
  const chantierUrl = page.url();
  const photosUrl = `${chantierUrl}/photos`;

  await page.goto(photosUrl, { waitUntil: "networkidle" });
  assert.ok(await page.locator("text=Aucune photo pour l'instant").isVisible(), "État vide attendu au départ");

  // --- Ajout réel d'une photo ---
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    // Renommé le 6 août 2026 : deux boutons désormais, chacun disant ce qu'il
    // fait. Celui-ci ouvre l'appareil photo.
    page.click('button:has-text("Prendre une photo")'),
  ]);
  await fileChooser.setFiles(FIXTURE);
  await page.waitForSelector("text=1 photo", { timeout: 5000 });
  assert.ok(await page.locator('img[src^="/api/fichiers/"]').first().isVisible(), "La vignette doit afficher la vraie image");

  // Vérifie que l'image servie répond bien (contenu réel, pas un placeholder).
  const src = await page.locator('img[src^="/api/fichiers/"]').first().getAttribute("src");
  const reponse = await page.request.get(`http://localhost:3000${src}`);
  assert.equal(reponse.status(), 200);
  assert.equal(reponse.headers()["content-type"], "image/jpeg");

  // --- Ouverture de la visionneuse ---
  await page.locator('button[aria-label="Voir la photo"]').first().click();
  await page.waitForSelector('button[aria-label="Fermer"]', { timeout: 5000 });
  assert.ok(await page.locator(`img[src="${src}"]`).last().isVisible(), "La visionneuse doit afficher la même image");

  // --- Suppression réelle avec confirmation ---
  await page.click('button[aria-label="Supprimer cette photo"]');
  await page.waitForSelector("text=Supprimer cette photo ?", { timeout: 5000 });
  await page.click('button:has-text("Supprimer")');
  await page.waitForSelector("text=Aucune photo pour l'instant", { timeout: 5000 });

  // Le fichier ne doit plus être accessible immédiatement après confirmation
  // côté liste (suppression douce actée), même si la purge physique est différée.
  const encoreDesPhotos = await page.locator('img[src^="/api/fichiers/"]').count();
  assert.equal(encoreDesPhotos, 0, "Plus aucune vignette ne doit rester affichée");

  // --- Les DEUX chemins vers une photo ------------------------------------
  //
  // Le patron, le 6 août 2026 : « lorsque je clique sur ajouter des photos, je
  // peux simplement prendre une photo. J'ai besoin de pouvoir accéder aux
  // photos que j'ai déjà prises. Il faut bien évidemment pouvoir faire les
  // deux. » L'attribut `capture` n'est pas une préférence : sur un iPhone, il
  // IMPOSE l'appareil photo et retire l'accès à la pellicule. Un artisan qui a
  // photographié le chantier le matin ne pouvait rien joindre l'après-midi.
  const appareil = page.locator('input[type="file"][capture]');
  const pellicule = page.locator('input[type="file"]:not([capture])');
  assert.equal(await appareil.count(), 1, "Le chemin « prendre une photo » a disparu.");
  assert.equal(
    await pellicule.count(),
    1,
    "Aucun champ sans `capture` : la pellicule du téléphone reste inaccessible."
  );
  assert.ok(
    await page.getByRole("button", { name: /Choisir dans mes photos/i }).isVisible(),
    "Rien ne propose d'aller chercher une photo déjà prise."
  );
  assert.ok(
    await page.getByRole("button", { name: /Prendre une photo/i }).isVisible(),
    "Le bouton de prise de vue doit rester, et dire ce qu'il fait."
  );
  console.log("  ✓ prendre une photo ET en choisir une déjà prise");

  await browser.close();
  console.log("✅ Test bout-en-bout Photos réussi.");
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
