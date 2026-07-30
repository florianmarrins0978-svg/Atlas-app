import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page, Locator } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FAKE_MIC = path.join(__dirname, "fixtures", "fake-mic.wav");

// Repère les listes de données validées de l'écran Informations. Les
// conteneurs du brouillon n'utilisent volontairement pas cette signature de
// classes, pour qu'une proposition ne puisse jamais être prise pour une
// donnée confirmée.
function section(page: Page, label: string): Locator {
  return page.locator("div.flex.flex-col.gap-2", { has: page.locator("span", { hasText: label }) });
}

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

  // --- Brouillon structuré, produit depuis la transcription réelle ---
  // Le texte analysé n'est plus saisi à la main : c'est bien la dictée
  // enregistrée ci-dessus, transcrite, qui alimente le brouillon.
  await page.goto(`${chantierUrl}/informations`, { waitUntil: "networkidle" });
  await page.click("text=Générer le brouillon");
  await page.waitForSelector("text=Confirmer et ajouter au chantier", { timeout: 10000 });
  // Le contenu transcrit alimente des champs éditables : c'est leur valeur
  // qu'il faut lire, pas le texte de la page.
  assert.match(
    await page.getByLabel("Prestations 1", { exact: true }).inputValue(),
    /simulée/,
    "Le brouillon doit reprendre le contenu réellement transcrit"
  );

  assert.equal(
    await section(page, "Prestations").locator("input").count(),
    0,
    "Aucune prestation réelle ne doit exister tant que le brouillon n'est pas confirmé"
  );

  // --- Confirmation explicite : application via repositories ---
  await page.click('button:has-text("Confirmer et ajouter au chantier")');
  await page.waitForTimeout(800);
  assert.ok(
    (await section(page, "Prestations").locator("input").count()) > 0,
    "La confirmation doit créer de vraies prestations persistées"
  );

  // --- Persistance après rechargement ---
  await page.reload({ waitUntil: "networkidle" });
  assert.ok(
    (await section(page, "Prestations").locator("input").count()) > 0,
    "Les prestations appliquées doivent persister après rechargement"
  );

  await browser.close();
  console.log("✅ Test bout-en-bout IA-01 réussi.");
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
