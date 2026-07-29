import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FAKE_MIC = path.join(__dirname, "fixtures", "fake-mic.wav");

async function main() {
  const browser = await lancerNavigateur({
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      `--use-file-for-fake-audio-capture=${FAKE_MIC}`,
    ],
  });
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    permissions: ["microphone"],
  });
  const page = await context.newPage();

  // Connexion réelle (Auth.js) — toutes les routes applicatives sont
  // désormais protégées par le middleware d'authentification.
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL("http://localhost:3000/", { timeout: 10000 });

  const nomUnique = `Chantier IA-01 e2e ${Date.now()}`;
  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Rénovation salle de bain"]', nomUnique);
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 5000 });
  const chantierUrl = page.url();

  // --- Enregistrement réel puis transcription réelle (fournisseur dev) ---
  await page.goto(`${chantierUrl}/note-vocale`, { waitUntil: "networkidle" });
  await page.click('button:has-text("Enregistrer une note vocale")');
  await page.waitForSelector("text=Enregistrement en cours");
  await page.waitForTimeout(1200);
  await page.click("button:has-text(\"Arrêter l'enregistrement\")");
  await page.waitForSelector("text=Enregistrée à l'instant");

  assert.ok(await page.locator("text=Lancer la transcription").isVisible());
  await page.click("text=Lancer la transcription");
  await page.waitForSelector("text=Transcription disponible", { timeout: 10000 });

  // --- Non-régression : l'écran Transcription affiche le résultat réel ---
  await page.goto(`${chantierUrl}/transcription`, { waitUntil: "networkidle" });
  assert.ok(await page.locator("text=/simulée/").isVisible(), "Le texte transcrit réel (fournisseur dev) doit s'afficher");

  // --- Extraction depuis un texte libre, sans audio ---
  await page.goto(`${chantierUrl}/informations`, { waitUntil: "networkidle" });
  await page.fill(
    "textarea",
    "Chantier Dupont, deux jours, deux hommes, dix plaques de BA13, poser la cloison, évacuation des déchets"
  );
  await page.click('button:has-text("Analyser")');
  await page.waitForSelector("text=Informations détectées", { timeout: 10000 });
  assert.ok(await page.locator("text=/plaques/i").first().isVisible(), "Le matériel détecté doit être affiché pour revue");

  // --- Confirmation explicite : application via repositories ---
  await page.click('button:has-text("Confirmer et appliquer")');
  await page.waitForTimeout(500);

  assert.ok(
    !(await page.locator("text=Informations détectées").isVisible()),
    "La proposition doit disparaître une fois appliquée"
  );
  assert.ok(
    await page.locator('input[value="poser la cloison"]').isVisible(),
    "La prestation confirmée doit apparaître comme une vraie ligne persistée"
  );

  // --- Persistance après rechargement ---
  await page.reload({ waitUntil: "networkidle" });
  assert.ok(
    await page.locator('input[value="poser la cloison"]').isVisible(),
    "La prestation appliquée doit persister après rechargement"
  );

  await browser.close();
  console.log("✅ Test bout-en-bout IA-01 réussi.");
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
