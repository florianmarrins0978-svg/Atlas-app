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

  const nomUnique = `Chantier note e2e ${Date.now()}`;
  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="M. Bernard"]', nomUnique);
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 5000 });
  const noteUrl = `${page.url()}/note-vocale`;

  // --- État vide ---
  await page.goto(noteUrl, { waitUntil: "networkidle" });
  assert.ok(await page.locator('button:has-text("Enregistrer une note vocale")').isVisible());

  // --- Enregistrement réel (micro simulé par Chromium) ---
  await page.click('button:has-text("Enregistrer une note vocale")');
  await page.waitForSelector("text=Enregistrement en cours", { timeout: 5000 });
  await page.waitForTimeout(2200); // laisse le minuteur avancer, capture ~2s d'audio simulé
  await page.click('button:has-text("Arrêter l\'enregistrement")');

  await page.waitForSelector("text=Enregistrée à l'instant", { timeout: 5000 });
  const audioSrc1 = await page.locator("audio").getAttribute("src");
  assert.ok(audioSrc1?.startsWith("/api/fichiers/"), "La note doit pointer vers un vrai fichier stocké");

  const reponse1 = await page.request.get(`http://localhost:3000${audioSrc1}`);
  assert.equal(reponse1.status(), 200);
  assert.ok(reponse1.headers()["content-type"]?.startsWith("audio/"), "Le fichier servi doit être un vrai audio");
  const octets1 = await reponse1.body();
  assert.ok(octets1.length > 0, "Le fichier audio enregistré ne doit pas être vide");

  // --- Lecture ---
  await page.click('button[aria-label="Écouter la note"]');
  await page.waitForSelector('button[aria-label="Mettre en pause"]', { timeout: 5000 });

  // --- Remplacement : confirmation puis nouvel enregistrement ---
  await page.click("text=Remplacer la note");
  await page.waitForSelector("text=Remplacer cette note vocale ?", { timeout: 5000 });
  await page.getByRole("button", { name: "Remplacer", exact: true }).click();
  await page.waitForSelector('button:has-text("Enregistrer une note vocale")', { timeout: 5000 });

  await page.click('button:has-text("Enregistrer une note vocale")');
  await page.waitForSelector("text=Enregistrement en cours", { timeout: 5000 });
  await page.waitForTimeout(1200);
  await page.click('button:has-text("Arrêter l\'enregistrement")');
  await page.waitForSelector("text=Enregistrée à l'instant", { timeout: 5000 });

  const audioSrc2 = await page.locator("audio").getAttribute("src");
  assert.notEqual(audioSrc2, audioSrc1, "Le remplacement doit produire une nouvelle clé de stockage");

  // Note : la persistance physique de l'ancienne clé jusqu'à la purge est déjà
  // vérifiée au niveau stockage dans test-note-vocale-repo.ts. La route de
  // service, elle, vérifie l'appartenance à un enregistrement actif — une clé
  // remplacée n'est donc plus servie via l'API dès que la base pointe sur la
  // nouvelle, ce qui est le comportement correct (pas d'exposition d'un fichier
  // orphelin en attente de purge).

  await browser.close();
  console.log("✅ Test bout-en-bout Note vocale réussi.");
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
