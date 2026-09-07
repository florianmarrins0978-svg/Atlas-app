/**
 * LES DEUX ÉCRANS DE RELECTURE, PHOTOGRAPHIÉS — 390 × 664, Origine et Nuit.
 *
 * **Pourquoi ce script existe.** Quatre défauts réels de ce projet sont sortis
 * d'une image et d'aucun test vert (`CLAUDE.md` §5). Les cinq états de la
 * dictée ne s'atteignent pas en cliquant : ils dépendent de ce que la base
 * porte. Ce script les POSE, un par un, puis photographie.
 *
 * Il ne prouve rien tout seul — il donne à REGARDER.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { Pool } from "pg";
import { ADRESSE } from "./_adresse";
import { creerPuisFiche } from "./_creer-chantier-e2e";

const OUT = process.argv[2] ?? "artifacts/captures/relire-sa-dictee";
mkdirSync(OUT, { recursive: true });

const MARQUE = "[Transcription simulée — fournisseur de développement, 120 octets reçus]";
const DICTEE =
  "Élagage du grand chêne au fond du jardin, rabattre les branches côté rue, deux jours à deux hommes, broyage sur place";

/**
 * **Un rôle qui TRAVERSE la RLS**, et il en faut un : sous `atlas_app`, lire
 * l'entreprise d'un chantier sans avoir posé le contexte ne rend rien — pas une
 * erreur, RIEN (`CLAUDE.md` §3). Le premier essai s'est cassé exactement là, et
 * le message accusait une ligne absente plutôt que le rôle.
 */
const pool = new Pool({
  connectionString:
    process.env.ATLAS_BASE_SUPER ?? "postgresql://postgres:postgres_dev_pw@localhost:5432/atlas_dev",
});

async function poserNote(chantierId: string, champs: { transcription: string | null; statut: string | null; erreur?: string | null }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(`SELECT entreprise_id FROM chantiers WHERE id = $1`, [chantierId]);
    const entrepriseId = rows[0].entreprise_id;
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entrepriseId]);
    await client.query(`DELETE FROM notes_vocales WHERE chantier_id = $1`, [chantierId]);
    await client.query(
      `INSERT INTO notes_vocales (entreprise_id, chantier_id, storage_key, mime_type, taille_octets, checksum,
                                  transcription, transcription_statut, transcription_erreur)
       VALUES ($1, $2, 'capture/relire.webm', 'audio/webm', 120, 'chk', $3, $4, $5)`,
      [entrepriseId, chantierId, champs.transcription, champs.statut, champs.erreur ?? null]
    );
    await client.query("COMMIT");
  } finally {
    client.release();
  }
}

/**
 * Remettre le chantier à blanc entre deux apparences : sans cela, la seconde
 * passe trouverait un brouillon déjà confirmé et ne pourrait plus photographier
 * l'état qui nous intéresse — celui où quelque chose attend d'être confirmé.
 */
async function remettreABlanc(chantierId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(`SELECT entreprise_id FROM chantiers WHERE id = $1`, [chantierId]);
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [rows[0].entreprise_id]);
    await client.query(`DELETE FROM brouillons_informations WHERE chantier_id = $1`, [chantierId]);
    await client.query(`DELETE FROM prestations WHERE chantier_id = $1`, [chantierId]);
    await client.query(`DELETE FROM materiel WHERE chantier_id = $1`, [chantierId]);
    await client.query(
      `UPDATE chantiers SET duree_prevue = NULL, taille_equipe = NULL WHERE id = $1`,
      [chantierId]
    );
    await client.query("COMMIT");
  } finally {
    client.release();
  }
}

const navigateur = await chromium.launch();
const contexte = await navigateur.newContext({
  viewport: { width: 390, height: 664 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
const page = await contexte.newPage();

async function photo(nom: string) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${nom}.png`, fullPage: true });
  console.log(`  · ${nom}`);
}

async function choisirCharte(libelle: string) {
  await page.goto(`${ADRESSE}/reglages/apparence`, { waitUntil: "networkidle" });
  await page.locator(`text=${libelle}`).first().click();
  await page.waitForTimeout(900);
}

// --- Connexion -------------------------------------------------------------
await page.goto(`${ADRESSE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${ADRESSE}/`, { timeout: 45_000 });

// --- Un chantier à nous, dont on posera les cinq états ---------------------
await page.goto(`${ADRESSE}/chantiers/nouveau`, { waitUntil: "networkidle" });
await page.fill('input[placeholder="Bernard"]', `Capture relecture ${Date.now()}`);
const chantierId = await creerPuisFiche(page);
await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 45_000 });
const chantier = `${ADRESSE}/chantiers/${chantierId}`;

const ETATS: { nom: string; poser: () => Promise<void> }[] = [
  { nom: "1-aucune-note", poser: async () => { /* aucune note : rien à poser */ } },
  { nom: "2-en-cours", poser: () => poserNote(chantierId, { transcription: null, statut: "en_cours" }) },
  { nom: "3-echouee", poser: () => poserNote(chantierId, { transcription: null, statut: "echouee", erreur: "Délai dépassé" }) },
  { nom: "4-non-transcrite", poser: () => poserNote(chantierId, { transcription: MARQUE, statut: "reussie" }) },
  { nom: "5-jamais-lancee", poser: () => poserNote(chantierId, { transcription: null, statut: "non_demandee" }) },
  { nom: "6-ecoutee", poser: () => poserNote(chantierId, { transcription: DICTEE, statut: "reussie" }) },
];

for (const charte of ["Origine", "Nuit"] as const) {
  console.log(`\n=== ${charte} ===`);
  await choisirCharte(charte);
  const suffixe = charte.toLowerCase();

  for (const etat of ETATS) {
    await etat.poser();
    await page.goto(`${chantier}/transcription`, { waitUntil: "networkidle" });
    await photo(`transcription-${etat.nom}-${suffixe}`);
  }

  // --- Les informations : avant confirmation, puis après ------------------
  await remettreABlanc(chantierId);
  await page.goto(`${chantier}/informations`, { waitUntil: "networkidle" });
  await photo(`informations-0-sans-brouillon-${suffixe}`);

  await page.click("text=Générer le brouillon");
  await page.waitForSelector("text=Confirmer et ajouter au chantier", { timeout: 45_000 });
  await photo(`informations-1-en-attente-${suffixe}`);

  await page.click('button:has-text("Confirmer et ajouter au chantier")');
  await page.waitForTimeout(1600);
  await photo(`informations-2-confirme-${suffixe}`);

  // Le tiroir du conflit : la seule chose irréversible de l'écran, et le voile
  // qui était écrit en clair. Il faut une correction humaine pour l'ouvrir.
  await page.goto(`${chantier}/informations`, { waitUntil: "networkidle" });
}

// **On rend l'apparence comme on l'a trouvée.** La charte est enregistrée pour
// la PERSONNE, pas pour la session : partir en laissant « Nuit » posée, c'est
// changer l'application du patron pour prendre une photo.
await choisirCharte("Origine");

await navigateur.close();
await pool.end();
console.log(`\n✅ Captures dans ${OUT}`);
