import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page, Locator } from "playwright";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { ADRESSE } from "./_adresse";
import { TEXTE_DE_LESSAI } from "../src/server/ai/providers/transcription/essai";

const BASE = ADRESSE;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FAKE_MIC = path.join(__dirname, "fixtures", "fake-mic.wav");

// Repère les listes de données validées de l'écran Informations. Les
// conteneurs du brouillon n'utilisent volontairement pas cette signature de
// classes, pour qu'une proposition ne puisse jamais être prise pour une
// donnée confirmée.
function section(page: Page, label: string): Locator {
  return page.locator("div.flex.flex-col.gap-2", { has: page.locator("span", { hasText: label }) });
}

// Ce que le patron aurait dicté, écrit à la main : ses mots de métier, pas un
// exemple choisi par nous.
const DICTEE_ECRITE =
  "Élagage du grand chêne au fond du jardin, rabattre les branches côté rue, deux jours à deux hommes, broyage sur place";

async function main() {
  const browser = await lancerNavigateur({
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      `--use-file-for-fake-audio-capture=${FAKE_MIC}`,
    ],
  });
  const context = await browser.newContext({
    deviceScaleFactor: 3,
    permissions: ["microphone"],
  });
  const page = await context.newPage();

  // Connexion réelle (Auth.js) — toutes les routes applicatives sont
  // désormais protégées par le middleware d'authentification.
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 10000 });

  const nomUnique = `Chantier IA-01 e2e ${Date.now()}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', nomUnique);
  const idChantier = await creerPuisFiche(page);
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 5000 });
  const chantierUrl = `${BASE}/chantiers/${idChantier}`;

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

  // --- SES MOTS SONT LÀ, ET L'ÉCRAN LES MONTRE ---
  //
  // ═══════════════════════════════════════════════════════════════════════
  // **CETTE SUITE RÉCLAMAIT « n'a pas été transcrite » — et elle rougissait
  // depuis le 9 septembre 2026 sur du code juste.**
  //
  // Ce jour-là, le fournisseur des suites est passé de `dev` — qui MARQUE son
  // texte de remplacement — à `essai`, qui rend un texte ordinaire
  // (`providers/transcription/essai.ts`). C'était le but : avec `dev`, la
  // chaîne dictée → devis s'arrêtait chez toutes les suites sur « aucun
  // prestataire n'est raccordé », et quatorze d'entre elles rougissaient.
  //
  // **La règle que ces trois assertions défendaient n'est pas perdue** — elle
  // est tenue là où elle ne dépend d'aucun fournisseur :
  // `test-etat-transcription.ts` exige `non_transcrite` sur un texte marqué.
  // La redemander ICI revenait à réclamer le fournisseur qu'on a remplacé
  // (`CLAUDE.md` §5 bis).
  //
  // Ce que cette suite éprouve désormais est ce qu'elle seule peut éprouver :
  // la CHAÎNE ENTIÈRE, du micro aux prestations en base.
  // ═══════════════════════════════════════════════════════════════════════
  await page.goto(`${chantierUrl}/transcription`, { waitUntil: "networkidle" });
  assert.ok(
    await page.locator(`text=${TEXTE_DE_LESSAI.slice(0, 40)}`).first().isVisible(),
    "L'écran de transcription ne montre pas les mots rendus par le fournisseur"
  );

  // --- Le patron corrige ce qu'il a dit : tout le reste s'enchaîne ---
  //
  // **Le geste passe par la porte fermée**, celle qu'il voit lui : une
  // transcription lue se corrige derrière « Corriger le texte à la main ».
  // Remplir le champ sans l'ouvrir éprouverait un écran que personne n'a
  // (`CLAUDE.md` §5 quater).
  await page.getByRole("button", { name: "Corriger le texte à la main" }).click();
  await page.fill("#texte-dicte", DICTEE_ECRITE);
  await page.click('button:has-text("Enregistrer le texte")');
  await page.waitForSelector("text=Texte enregistré", { timeout: 10000 });

  await page.goto(`${chantierUrl}/informations`, { waitUntil: "networkidle" });
  await page.click("text=Générer le brouillon");
  await page.waitForSelector("text=Confirmer et ajouter au chantier", { timeout: 10000 });
  // Le contenu transcrit alimente des champs éditables : c'est leur valeur
  // qu'il faut lire, pas le texte de la page.
  assert.match(
    await page.getByLabel("Prestations 1", { exact: true }).inputValue(),
    /[Éé]lagage/,
    "Le brouillon doit reprendre ce que le patron a réellement écrit"
  );
  // **ET IL NE DOIT RIEN GARDER DU TEXTE D'AVANT.** L'assertion du dessus
  // passerait toute seule : le fournisseur d'essai parle lui aussi d'élagage.
  // « Thuyas » n'est dit que par lui — le trouver ici voudrait dire que la
  // correction du patron n'a pas pris, et que son devis se remplit de ce
  // qu'il n'a jamais dicté.
  assert.doesNotMatch(
    await page.locator("body").innerText(),
    /thuyas/i,
    "le brouillon parle encore du texte transcrit, alors que le patron l'a corrigé"
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
