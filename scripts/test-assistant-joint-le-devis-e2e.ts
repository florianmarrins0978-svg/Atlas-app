import { lancerNavigateur } from "./e2e-browser";
import { Pool } from "pg";
import { ADRESSE } from "./_adresse";

/*
  LA LIGNE TROUVÉE PAR L'ASSISTANT OUVRE LE DEVIS.

  **Sa demande du 27 octobre 2026 :** *« quand je lui demande d'aller me
  chercher une ligne dans un devis, qu'il me sorte le PDF du devis dans la
  discussion, comme ça j'ai juste à cliquer »*. Planche B : la ligne est
  elle-même le bouton.

  Le chemin du patron, en entier : une phrase dans le panneau, la ligne qui
  s'affiche sous la réponse, le doigt dessus, le devis dans la visionneuse.
  `test-assistant-joint-les-pieces-db.ts` tient la règle sous la RLS ; celle-ci
  tient ce qu'aucune suite base ne voit : que l'écran montre la pièce, et que
  la toucher mène au bon document.

  Sans clé ici, c'est le fournisseur `dev` qui répond ; il cite la clé de la
  pièce comme le vrai modèle (`providers/llm/dev.ts`, « Retrouver une ligne
  d'un devis »). Elle sait échouer : retirer `PiecesDeLaReponse` du panneau
  rougit le premier cas, et une pièce qui viserait un autre devis le second.
*/

const BASE = ADRESSE;
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
  console.log("=== La ligne trouvée par l'assistant ouvre le devis ===\n");

  // La ligne cherchée, prise dans le jeu de démonstration : le test ne parie
  // pas sur un libellé qu'un autre lot pourrait renommer.
  const { rows } = await pool.query<{ libelle: string; devis_id: string; client_nom: string }>(
    `SELECT l.libelle, d.id AS devis_id, d.client_nom
       FROM lignes_devis l JOIN devis d ON d.id = l.devis_id
       JOIN users u ON u.email = 'demo@atlas.local'
       JOIN membres_entreprise m ON m.utilisateur_id = u.id AND m.entreprise_id = d.entreprise_id
      WHERE d.statut = 'envoye' AND l.libelle ~* '^forfait'
      LIMIT 1`
  );
  if (rows.length === 0) throw new Error("Le jeu de démonstration n'a aucune ligne « Forfait » sur un devis envoyé.");
  const { libelle, devis_id: devisId, client_nom: clientNom } = rows[0];
  const nomDuClient = clientNom.replace(/^(M\.|Mme)\s*/, "");

  const navigateur = await lancerNavigateur();
  const page = await (await navigateur.newContext()).newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  await cas("la ligne trouvée s'affiche sous la réponse, avec son montant", async () => {
    await page.click('button[aria-label="Ouvrir l\'assistant"]');
    await page.waitForSelector('input[placeholder="Votre question…"]', { timeout: 20_000 });
    await page.fill('input[placeholder="Votre question…"]', `Donne moi la ligne de forfait du devis de ${nomDuClient}`);
    await page.keyboard.press("Enter");
    const piece = page.locator('[data-atlas="piece-assistant"]').first();
    await piece.waitFor({ timeout: 40_000 });
    const texte = await piece.innerText();
    if (!texte.includes(libelle)) throw new Error(`la pièce porte « ${texte} », pas la ligne « ${libelle} »`);
    if (!/€/.test(texte)) throw new Error("le montant de la ligne n'est pas affiché");
    const bulle = await page.locator('[data-atlas="bulle-assistant"]').last().innerText();
    if (/\[\[/.test(bulle)) throw new Error("la clé de la pièce s'affiche dans la réponse");
  });

  await cas("la toucher ouvre CE devis dans la visionneuse", async () => {
    await page.locator('[data-atlas="piece-assistant"]').first().click();
    await page.waitForURL(/\/documents\/pdf\?/, { timeout: 30_000 });
    const fichier = new URL(page.url()).searchParams.get("fichier");
    if (fichier !== `/api/devis/${devisId}/pdf`) throw new Error(`la visionneuse ouvre ${fichier}`);
    const reponse = await page.request.get(`${BASE}${fichier}`);
    if (reponse.status() !== 200) throw new Error(`le PDF répond ${reponse.status()}`);
  });

  await cas("les PDF des fournisseurs et des véhicules ont leur adresse en /pdf, gardée comme l'autre", async () => {
    // Un identifiant qui n'existe pas : la ROUTE doit répondre « Introuvable »
    // en JSON. Une page 404 de Next voudrait dire que l'adresse n'existe pas,
    // et la visionneuse n'aurait rien à peindre.
    const zero = "00000000-0000-0000-0000-000000000000";
    for (const adresse of [`/reglages/fournisseurs/devis/${zero}/pdf`, `/reglages/vehicules/${zero}/document/carte_grise/pdf`]) {
      const r = await page.request.get(`${BASE}${adresse}`);
      const corps = await r.text();
      if (r.status() !== 404 || !corps.includes("Introuvable")) throw new Error(`${adresse} répond ${r.status()} : ${corps.slice(0, 80)}`);
    }
  });

  await navigateur.close();
  await pool.end();
  if (echecs > 0) {
    console.error(`\n${echecs} échec(s)`);
    process.exit(1);
  }
  console.log("\n✅ La ligne trouvée ouvre le devis, 0 échec(s).");
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
