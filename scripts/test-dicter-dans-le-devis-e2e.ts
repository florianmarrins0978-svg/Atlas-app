import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import path from "node:path";
import { Pool } from "pg";
import { fileURLToPath } from "node:url";
import { creerPuisFiche } from "./_creer-chantier-e2e";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MICRO_SIMULE = path.join(__dirname, "fixtures", "fake-mic.wav");
const BASE = "http://localhost:3000";

// **Le micro dans le devis, et sa place.**
//
// Le patron, le 15 août 2026 : *« Rajoutes-moi un petit dictaphone en haut à
// droite comme il y a pour les infos clients quand tu fais un nouveau chantier,
// pour pouvoir dicter à l'intérieur du devis s'il y a des choses à reprendre ou
// à modifier. Et je veux que tu mettes exactement les mêmes trois petits points
// quand ils chargent. »*
//
// Ce que cette suite tient — et ce qu'elle ne tient PAS :
//
//   1. **le micro est là, et à droite** — mesuré sur sa position réelle, pas sur
//      une classe. « En haut à droite » est la moitié de sa demande, et une
//      règle de mise en page qui casserait le rendrait muet sans rien casser
//      d'autre ;
//   2. **il a la taille et le dessin du micro de la fiche client** : 44 px, le
//      même rond. Deux micros différents dans la même application se liraient
//      comme deux fonctions différentes ;
//   3. **un devis parti n'en a pas.** Cet écran ne se modifie plus : un micro
//      qui écouterait pour ne rien pouvoir changer serait une promesse fausse ;
//   4. **la dictée ne touche à rien toute seule.** Le geste complet est joué —
//      appuyer, parler, arrêter — et le devis doit être identique après.
//
// **Ce qu'aucune suite ne peut tenir ici** : la feuille de confirmation
// REMPLIE. Cet environnement n'a ni service de transcription ni modèle
// (`providers/transcription/dev.ts`), et la dictée s'y arrête donc avant d'avoir
// pu être comprise. Les phrases affichées pour chaque changement sont éprouvées
// sans navigateur, dans `scripts/test-retouches-devis.ts` — le raccord entre
// les deux, lui, n'aura été parcouru qu'avec une clé.

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const navigateur = await lancerNavigateur({
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      `--use-file-for-fake-audio-capture=${MICRO_SIMULE}`,
    ],
  });
  const contexte = await navigateur.newContext({ permissions: ["microphone"] });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 });

  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', `Mme Bracquemont ${Date.now()}`);
  await creerPuisFiche(page);
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 15_000 });
  const chantierUrl = page.url();
  const chantierId = chantierUrl.split("/").pop()!;

  await page.goto(`${chantierUrl}/devis-complet`, { waitUntil: "networkidle" });
  const micro = page.locator('button[aria-label="Dicter dans le devis"]');

  await cas("le micro est là, en haut, et À DROITE du retour", async () => {
    await micro.waitFor({ state: "visible", timeout: 10_000 });
    // **Le repère plutôt que le libellé** (`CLAUDE.md` §5 bis) : depuis le
    // 31 août 2026, la flèche annonce « Remplir la fiche client » quand aucun
    // client n'est rattaché. Ce qu'on éprouve ici est sa PLACE, pas son mot.
    const retour = page.locator('[data-atlas="retour-du-devis"]');
    const [bM, bR] = [await micro.boundingBox(), await retour.boundingBox()];
    assert.ok(bM && bR, "le micro ou le retour n'a pas de place à l'écran");
    assert.ok(
      bM.x > bR.x,
      `le micro est à gauche du retour (x=${Math.round(bM.x)} contre ${Math.round(bR.x)}) : ` +
        "« en haut à droite » n'est plus respecté",
    );
    // Sur la même rangée : un micro relégué sous le retour ne se lit plus comme
    // faisant partie de l'en-tête.
    assert.ok(
      Math.abs(bM.y - bR.y) < 40,
      `le micro a quitté la rangée du retour (${Math.round(bM.y)} contre ${Math.round(bR.y)})`,
    );
    // Et il touche vraiment le bord droit du document, pas le milieu.
    const largeur = page.viewportSize()!.width;
    assert.ok(
      bM.x + bM.width > largeur * 0.6,
      `le micro n'atteint pas la droite de l'écran (${Math.round(bM.x + bM.width)} sur ${largeur})`,
    );
  });

  await cas("il a le rond de 44 px de la fiche client, pas un autre", async () => {
    const b = (await micro.boundingBox())!;
    assert.equal(Math.round(b.width), 44, "la largeur du micro n'est plus celle de la fiche client");
    assert.equal(Math.round(b.height), 44, "la hauteur du micro n'est plus celle de la fiche client");
    // **Le rayon se compare en nombre, pas en texte.** `rounded-full` ne rend
    // ni « 9999px » ni « 50 % » : le navigateur écrit sa propre borne
    // (« 3.35544e+07px »), et un contrôle qui cherchait la chaîne accusait un
    // rond parfait d'avoir cessé d'en être un.
    const rayon = await micro.evaluate((el) => parseFloat(getComputedStyle(el).borderRadius));
    assert.ok(rayon >= b.height / 2, `le micro n'est plus un rond (rayon ${rayon} pour ${b.height} px de haut)`);
  });

  // --- Le geste complet, et ce qu'il ne fait pas -----------------------------
  const lignesAvant = await pool.query(
    "SELECT id, libelle, prix_unitaire FROM lignes_prix WHERE chantier_id = $1 ORDER BY ordre",
    [chantierId],
  );

  await cas("dicter n'écrit RIEN tout seul sur le devis", async () => {
    await micro.click();
    const arret = page.locator('button[aria-label="Arrêter la dictée"]');
    await arret.waitFor({ state: "visible", timeout: 10_000 });
    // Il parle, puis il arrête : son geste, dans son ordre.
    await attendre(700);
    await arret.click();

    // On attend que l'écran ait fini de répondre — quelle que soit sa réponse.
    await page
      .locator('[role="status"]')
      .filter({ hasNotText: "J'écoute" })
      .first()
      .waitFor({ state: "visible", timeout: 20_000 })
      .catch(() => {});
    await attendre(1_500);

    const apres = await pool.query(
      "SELECT id, libelle, prix_unitaire FROM lignes_prix WHERE chantier_id = $1 ORDER BY ordre",
      [chantierId],
    );
    assert.deepEqual(
      apres.rows,
      lignesAvant.rows,
      "le devis a bougé sans que personne n'ait coché : c'est le seul arrêt qui compte ici",
    );
  });

  await cas("l'écran DIT ce qui s'est passé, plutôt que de se taire", async () => {
    // Sans service de transcription, la seule bonne réponse est de le dire —
    // et surtout pas de présenter le texte de remplacement comme une dictée.
    const dit = await page.locator('[role="status"]').first().innerText();
    assert.ok(dit.trim().length > 0, "l'écran ne dit rien après une dictée : on ne sait pas si ça bug");
    assert.doesNotMatch(
      dit,
      /Transcription simulée/,
      "le texte de remplacement est montré comme une dictée : un devis ne se corrige pas d'après une phrase que personne n'a dite",
    );
  });

  // --- Un devis parti n'a pas de micro --------------------------------------
  await cas("un devis déjà envoyé n'a pas de micro", async () => {
    await pool.query("UPDATE devis SET statut = 'envoye' WHERE chantier_id = $1", [chantierId]);
    await page.goto(`${chantierUrl}/devis-complet`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=DEVIS", { timeout: 10_000 });
    assert.equal(
      await page.locator('button[aria-label="Dicter dans le devis"]').count(),
      0,
      "le micro survit à l'envoi : il écouterait pour ne rien pouvoir changer",
    );
    // Le retour, lui, reste : une page sans sortie est un piège sur un téléphone.
    assert.equal(await page.locator('[data-atlas="retour-du-devis"]').count(), 1);
  });

  await contexte.close();
  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Le micro du devis — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
