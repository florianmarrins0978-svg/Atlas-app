import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "fixtures", "test-photo.jpg");

/**
 * **Ajouter une photo ne fait plus changer de page.**
 *
 * Le patron, le 11 août 2026, capture à l'appui : *« quand je clique sur
 * l'encadré doré avec le petit plus, que ça arrête de me faire changer de page,
 * je veux voir apparaître directement le menu photo, et supprime toutes les
 * autres étapes »*.
 *
 * Ce que cette suite tient, et qu'un contrôle d'affichage ne verrait pas :
 *
 *   1. l'adresse **ne bouge pas** entre le premier appui et la photo affichée ;
 *   2. il n'y a **qu'un seul** champ de fichier, et il n'a **pas** `capture` —
 *      c'est exactement ce qui fait apparaître le menu iOS à trois entrées
 *      (Photothèque · Prendre une photo · Choisir les fichiers) plutôt que
 *      d'imposer l'appareil photo ;
 *   3. notre ancienne feuille maison n'existe plus nulle part ;
 *   4. l'écran `/photos` répond **404** : il ne survit pas en douce.
 */
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

  // Crée un chantier dédié pour ce test, pour ne pas dépendre du contenu du seed.
  const nomUnique = `Chantier photos e2e ${Date.now()}`;
  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="M. Bernard"]', nomUnique);
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 5000 });
  const chantierUrl = page.url();

  // La pellicule vit dans le tiroir : au repos, seule sa prise dépasse.
  const tiroir = page.locator('[data-atlas="tiroir-fiche"]');
  await tiroir.waitFor({ state: "visible", timeout: 10000 });
  await page.click('button[aria-label="Ouvrir le détail du chantier"]');
  await tiroir.locator('button[aria-label="Ajouter des photos"]').waitFor({ state: "visible", timeout: 10000 });

  // --- Ce qui est demandé : le « + » n'emmène nulle part ------------------
  assert.equal(
    await tiroir.locator("a[href*='/photos']").count(),
    0,
    "La pellicule porte encore un lien vers un écran Photos : le « + » ferait changer de page."
  );

  // --- Ajout réel d'une photo, sur place ---------------------------------
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    // Un seul appui, et le menu du téléphone. Playwright rend l'événement
    // `filechooser` là où l'iPhone affiche « Photothèque / Prendre une photo /
    // Choisir les fichiers » : c'est le même champ qui les ouvre.
    tiroir.locator('button[aria-label="Ajouter des photos"]').click(),
  ]);
  await fileChooser.setFiles(FIXTURE);

  await tiroir.locator('img[src^="/api/fichiers/"]').first().waitFor({ state: "visible", timeout: 15000 });
  assert.equal(
    page.url(),
    chantierUrl,
    `L'adresse a changé pendant l'ajout (${page.url()}) : le patron a été emmené ailleurs.`
  );
  console.log("  ✓ la photo s'ajoute sans quitter la fiche");

  // Vérifie que l'image servie répond bien (contenu réel, pas un placeholder).
  const src = await tiroir.locator('img[src^="/api/fichiers/"]').first().getAttribute("src");
  const reponse = await page.request.get(`http://localhost:3000${src}`);
  assert.equal(reponse.status(), 200);
  assert.equal(reponse.headers()["content-type"], "image/jpeg");

  // --- Le menu du téléphone, et rien d'autre -----------------------------
  //
  // `capture` n'est pas une préférence : sur un iPhone, il IMPOSE l'appareil
  // photo, retire l'accès à la photothèque — et le menu à trois entrées
  // n'apparaît jamais. Un seul champ, sans lui : les deux chemins sont dans le
  // menu du système.
  assert.equal(
    await page.locator('input[type="file"][capture]').count(),
    0,
    "Un champ impose l'appareil photo : le menu du téléphone ne s'ouvrira pas, et la photothèque devient inaccessible."
  );
  assert.equal(
    await page.locator('input[type="file"]').count(),
    1,
    "La fiche porte plusieurs champs de fichier : une seule entrée est attendue depuis que le menu du système fait le choix."
  );

  // Notre feuille maison a disparu : c'était l'étape en trop.
  for (const libelle of [/Choisir dans ma bibliothèque/i, /Prendre une photo/i]) {
    assert.equal(
      await page.getByRole("button", { name: libelle }).count(),
      0,
      `La feuille maison est toujours là (« ${libelle.source} ») : c'est l'étape que le patron a demandé de supprimer.`
    );
  }
  console.log("  ✓ un seul champ, sans `capture`, et plus aucune étape maison");

  // --- Regarder, puis retirer, toujours sans changer de page -------------
  await tiroir.getByRole("button", { name: "Voir la photo" }).first().click();
  await page.waitForSelector('button[aria-label="Fermer"]', { timeout: 5000 });
  assert.ok(await page.locator(`img[src="${src}"]`).last().isVisible(), "La visionneuse doit afficher la même image");

  // **La visionneuse doit couvrir la barre de navigation.** Rendue dans le
  // tiroir — qui ouvre son propre contexte d'empilement —, elle passait sous
  // « Chantiers / Planning », en travers de la photo. D'où le portail.
  const barreCouverte = await page.evaluate(() => {
    const barre = document.querySelector(".atlas-nav-basse");
    if (!barre) return "aucune barre";
    const r = barre.getBoundingClientRect();
    const dessus = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return dessus && (barre === dessus || barre.contains(dessus)) ? "barre visible" : "couverte";
  });
  assert.equal(
    barreCouverte,
    "couverte",
    "La barre de navigation se peint par-dessus la visionneuse : la photo est traversée par les onglets."
  );

  // Retrait d'un seul geste — la sécurité est une réversibilité APRÈS.
  await page.click('button[aria-label="Retirer cette photo"]');
  assert.ok(
    await page.locator(".atlas-tiroir[data-ouvert='oui']").first().isVisible(),
    "Le tiroir des retirés ne s'est pas ouvert : le retrait n'est rattrapable nulle part."
  );
  assert.equal(
    await tiroir.locator('img[src^="/api/fichiers/"]').count(),
    0,
    "Plus aucune vignette ne doit rester affichée"
  );
  assert.equal(page.url(), chantierUrl, "Le retrait a changé de page.");
  console.log("  ✓ regarder et retirer se font depuis la fiche");

  // --- L'écran Photos n'existe plus --------------------------------------
  const disparu = await page.request.get(`${chantierUrl}/photos`);
  assert.equal(
    disparu.status(),
    404,
    "L'écran Photos répond encore : il devait disparaître avec le parcours qu'il portait."
  );
  console.log("  ✓ /photos répond 404");

  await browser.close();
  console.log("✅ Test bout-en-bout Photos réussi.");
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
