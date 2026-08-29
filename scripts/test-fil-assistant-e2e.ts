import { lancerNavigateur } from "./e2e-browser";
import { Pool } from "pg";

/*
  LE FIL DE L'ASSISTANT SURVIT AU RECHARGEMENT.

  **Sa demande du 27 août 2026 : « qu'il se souvienne ».** Le fil vivait dans
  l'état d'un composant React et disparaissait au premier rechargement — or son
  onglet reste ouvert des heures et son banc redémarre plusieurs fois par
  soirée (`HANDOVER.md`, piège 0). « Et celui d'avant ? » ne trouvait plus rien.

  **Pourquoi un navigateur, alors que `test-fil-assistant.ts` éprouve déjà la
  base.** La suite base tient le cloisonnement — ce qu'aucun écran ne peut
  tenir, puisque le serveur des suites navigateur traverse la RLS. Celle-ci
  tient l'autre moitié, que la base ne peut pas tenir : que la page RELISE
  vraiment le fil à l'ouverture du panneau. Un dépôt juste derrière un écran qui
  ne l'appelle pas serait vert des deux côtés et faux à l'usage.

  Elle sait échouer, et c'est vérifié : retirer l'appel à `lireFilAction` dans
  `AssistantSidebar` rougit les deux derniers cas. **Les deux, pas un seul** —
  le troisième s'appuie sur le fil relu par le second, et « Oublier » ne
  s'affiche que s'il y a quelque chose à oublier. C'est une dépendance assumée :
  l'écrire vaut mieux que de la découvrir en lisant un rouge de trop.
*/

const BASE = "http://localhost:3000";
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

async function main() {
  console.log("=== Le fil de l'assistant survit au rechargement ===\n");

  const navigateur = await lancerNavigateur();
  const page = await (await navigateur.newContext()).newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  // **On repart d'un fil vide**, sinon un reliquat d'une exécution précédente
  // ferait passer le deuxième cas sans que rien n'ait été enregistré ce coup-ci.
  await pool.query(
    `DELETE FROM messages_assistant WHERE utilisateur_id = (SELECT id FROM users WHERE email = 'demo@atlas.local')`
  );

  const question = `Comment je supprime un chantier ${Date.now()}`;

  await cas("il pose une question, l'assistant répond", async () => {
    await page.click('button[aria-label="Ouvrir l\'assistant"]');
    await page.waitForSelector('input[placeholder="Votre question…"]', { timeout: 20_000 });
    await page.fill('input[placeholder="Votre question…"]', question);
    await page.keyboard.press("Enter");
    // On attend la RÉPONSE, pas un délai : c'est elle qui déclenche l'écriture.
    await page.waitForSelector('[data-atlas="bulle-assistant"]', { timeout: 40_000 });
  });

  await cas("APRÈS RECHARGEMENT, le fil est toujours là", async () => {
    await page.reload({ waitUntil: "networkidle" });
    await page.click('button[aria-label="Ouvrir l\'assistant"]');
    // Le fil revient du serveur : attendre la bulle, jamais un délai.
    await page.waitForSelector(`text=${question}`, { timeout: 20_000 });
    const reponses = await page.locator('[data-atlas="bulle-assistant"]').count();
    if (reponses < 1) throw new Error("la question est revenue, mais pas la réponse");
  });

  await cas("« Oublier » le vide, et il reste vide après rechargement", async () => {
    await page.click('[data-atlas="oublier-le-fil"]');
    await page.locator(`text=${question}`).waitFor({ state: "detached", timeout: 10_000 });
    await page.reload({ waitUntil: "networkidle" });
    await page.click('button[aria-label="Ouvrir l\'assistant"]');
    // **On attend que le panneau soit VRAIMENT ouvert avant de conclure.**
    // Conclure sur un panneau pas encore peint rendrait « rien à l'écran »,
    // c'est-à-dire un vert qui ne mesure rien (`CLAUDE.md` §5).
    await page.waitForSelector('input[placeholder="Votre question…"]', { timeout: 20_000 });
    await page.waitForTimeout(800);
    const reste = await page.locator(`text=${question}`).count();
    if (reste > 0) throw new Error("la question effacée est revenue du serveur");
  });

  await cas("LE MICRO ET L'APPAREIL PHOTO sont là, et le champ garde sa place", async () => {
    /**
     * Sa demande du 27 août 2026 : *« fais la 1 et la 4 »* — lui parler, et lui
     * montrer une photo.
     *
     * **Ce que ce cas défend, et qu'aucun test de logique ne peut défendre :**
     * que les deux boutons tiennent SANS écraser le champ. Trois boutons dans
     * une barre de 390 px, c'est exactement la situation où un champ se réduit
     * à rien — et le patron ne pourrait plus écrire sa question.
     */
    // **Le panneau est déjà ouvert par le cas précédent.** Cliquer « Ouvrir »
    // attendait alors quarante-cinq secondes un bouton qui dit « Fermer » —
    // un rouge qui accusait la barre de saisie d'un défaut qu'elle n'avait pas.
    const ouvrir = page.locator('button[aria-label="Ouvrir l\'assistant"]');
    if ((await ouvrir.count()) > 0) await ouvrir.first().click();
    const micro = page.locator('[data-atlas="micro-assistant"]');
    const photo = page.locator('[data-atlas="photo-assistant"]');
    await micro.waitFor({ state: "visible", timeout: 20_000 });
    if (!(await photo.isVisible())) throw new Error("l'appareil photo n'est pas là");

    const champ = await page.locator('input[placeholder="Votre question…"]').boundingBox();
    // **Refuser de conclure sur une boîte de zéro pixel** (`CLAUDE.md` §5) :
    // une mise en page pas encore appliquée rendrait 0, et « 0 ≥ 0 » passerait
    // au vert sur un champ écrasé.
    if (!champ || champ.width === 0) throw new Error("le champ n'a pas de largeur mesurable");
    if (champ.width < 140) {
      throw new Error(`le champ de la question est écrasé à ${Math.round(champ.width)} px par les deux boutons`);
    }
  });

  await navigateur.close();
  await pool.end();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Le fil survit au rechargement — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
