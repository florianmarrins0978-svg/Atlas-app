import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import type { Page } from "playwright";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { ADRESSE } from "./_adresse";
import { TEXTE_DE_LESSAI } from "../src/server/ai/providers/transcription/essai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MICRO_SIMULE = path.join(__dirname, "fixtures", "fake-mic.wav");
const BASE = ADRESSE;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── REPRENDRE UNE DICTÉE QUI A ÉCHOUÉ, SANS L'ANCIEN ÉCRAN — 3 novembre 2026 ─
//
// **Sa réponse sur la planche « Le chantier »** (état « Échec, Réessayer ») :
// *« Oui, réessayer comme ça me va, tu peux coder »*. Et, le même jour, son
// accord pour retirer l'écran Note vocale (`/chantiers/[id]/note-vocale`).
//
// Ce que cette suite tient, PAR SON CHEMIN À LUI (`CLAUDE.md` §5 quater) :
//
//   1. sur la fiche client, une dictée dont la transcription échoue le DIT, et
//      « Réessayer » se pose sous la phrase rouge ;
//   2. « Réessayer » relance la transcription et le devis sur la MÊME note,
//      sans redicter ;
//   3. l'écran Transcription relance sur place, au lieu de renvoyer vers un
//      écran qui n'existe plus ;
//   4. les chemins qui menaient à l'ancien écran mènent à la fiche client, et
//      son adresse, qu'un signet porte encore, y renvoie.
//
// **L'échec se provoque, il ne s'attend pas.** Le fournisseur des suites
// transcrit toujours (`transcription/essai.ts`) : on égare donc le fichier de la
// note entre son rangement et le départ de la chaîne, exactement comme un
// stockage qui le perdrait. La réponse de l'envoi est retenue le temps de le
// faire, sans quoi la chaîne partirait avant et transcrirait le vrai son.

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

async function nouveauChantier(page: Page, nom: string): Promise<string> {
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', nom);
  return creerPuisFiche(page);
}

async function laNote(chantierId: string) {
  const { rows } = await pool.query(
    `select id, storage_key, transcription, transcription_statut
       from notes_vocales where chantier_id = $1`,
    [chantierId]
  );
  return rows as { id: string; storage_key: string | null; transcription: string | null; transcription_statut: string }[];
}

async function main() {
  console.log("=== Reprendre une dictée qui a échoué ===\n");

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
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  // ─── 1. La fiche client ─────────────────────────────────────────────────
  const chantierA = await nouveauChantier(page, `Réessayer dictée ${Date.now()}`);
  await page.goto(`${BASE}/chantiers/${chantierA}/coordonnees`, { waitUntil: "networkidle" });

  let cleDuSon: string | null = null;
  await page.route(`**/api/notes-vocales/${chantierA}`, async (route) => {
    const reponse = await route.fetch();
    const [note] = await laNote(chantierA);
    cleDuSon = note?.storage_key ?? null;
    await pool.query("update notes_vocales set storage_key = $2 where chantier_id = $1", [
      chantierA,
      `chantiers/${chantierA}/notes/egare.webm`,
    ]);
    await route.fulfill({ response: reponse });
  });

  await page.locator('[data-atlas="anneau-note-vocale"] .atlas-micro').click();
  await page.waitForTimeout(3000);
  await page.locator('[data-atlas="dictee-envoyer"]').click();

  const reessayer = page.locator('[data-atlas="reessayer-la-dictee"]');
  const phraseRouge = page.locator('[data-atlas="echec-de-la-dictee"]');

  await cas("la transcription échoue : la phrase rouge le dit, et « Réessayer » est dessous", async () => {
    await reessayer.waitFor({ state: "visible", timeout: 90_000 });
    assert.ok(cleDuSon, "la note n'a jamais été rangée : l'échec n'a pas été provoqué, rien n'est éprouvé");
    const texte = (await phraseRouge.innerText()).trim();
    assert.ok(texte.length > 0, "aucune phrase rouge : l'échec est muet");
    // **La phrase ne dit plus « rien à reprendre »** : il y avait une dictée,
    // c'est sa transcription qui a manqué. L'écran d'avant mentait ici.
    assert.doesNotMatch(texte, /rien à reprendre/, `la phrase nie la dictée qu'il vient de faire : « ${texte} »`);
    assert.equal(await reessayer.innerText(), "Réessayer");
    const boitePhrase = await phraseRouge.boundingBox();
    const boiteBouton = await reessayer.boundingBox();
    assert.ok(boitePhrase && boiteBouton, "la phrase ou le bouton n'a pas de place à l'écran");
    assert.ok(boiteBouton.y >= boitePhrase.y + boitePhrase.height - 1, "« Réessayer » n'est pas sous la phrase rouge");
  });

  await cas("« Réessayer » relance la transcription et le devis sur la même note, sans redicter", async () => {
    assert.ok(cleDuSon, "aucune clé à rendre : le cas précédent n'a rien provoqué");
    const [avant] = await laNote(chantierA);
    assert.ok(avant, "aucune note en base");
    assert.equal(avant.transcription_statut, "echouee", "la transcription n'a pas échoué : le cas ne mesure rien");
    // Le fichier « retrouvé » : ce que Réessayer doit reprendre est la même note.
    await pool.query("update notes_vocales set storage_key = $2 where chantier_id = $1", [chantierA, cleDuSon]);

    await reessayer.click();
    // **`any` et non `race`** : selon la dictée, la chaîne s'arrête aux
    // questions d'avant-chiffrage sur la fiche, ou emmène au devis.
    await Promise.any([
      page.locator('[data-atlas="question-chiffrage"]').first().waitFor({ state: "visible", timeout: 120_000 }),
      page.waitForURL(/\/devis-complet$/, { timeout: 120_000 }),
    ]);

    const apres = await laNote(chantierA);
    assert.equal(apres.length, 1, "une seconde note est apparue : Réessayer a redicté au lieu de reprendre");
    assert.equal(apres[0].id, avant.id, "la note a changé : Réessayer devait reprendre la même dictée");
    assert.equal(apres[0].transcription_statut, "reussie", "la transcription n'a pas été relancée");
    assert.equal(apres[0].transcription, TEXTE_DE_LESSAI);
  });
  await page.unroute(`**/api/notes-vocales/${chantierA}`);

  // ─── 2. Les chemins qui menaient à l'ancien écran ───────────────────────
  const chantierB = await nouveauChantier(page, `Relancer transcription ${Date.now()}`);

  await cas("sans note, la Transcription mène à la fiche client pour dicter", async () => {
    await page.goto(`${BASE}/chantiers/${chantierB}/transcription`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "Enregistrer une note vocale" }).click();
    await page.waitForURL(new RegExp(`/chantiers/${chantierB}/coordonnees$`), { timeout: 30_000 });
  });

  await cas("sans note, les Informations mènent à la fiche client pour dicter", async () => {
    await page.goto(`${BASE}/chantiers/${chantierB}/informations`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "Aller à la note vocale" }).click();
    await page.waitForURL(new RegExp(`/chantiers/${chantierB}/coordonnees$`), { timeout: 30_000 });
  });

  await cas("l'ancienne adresse de la note vocale renvoie à la fiche client", async () => {
    await page.goto(`${BASE}/chantiers/${chantierB}/note-vocale`, { waitUntil: "networkidle" });
    assert.match(page.url(), new RegExp(`/chantiers/${chantierB}/coordonnees$`));
    // Un chantier que l'on ne voit pas reste introuvable : la RLS rend la même
    // absence pour un chantier d'ailleurs que pour un chantier inexistant.
    await page.goto(`${BASE}/chantiers/00000000-0000-0000-0000-000000000000/note-vocale`, {
      waitUntil: "networkidle",
    });
    assert.ok(await page.locator("text=This page could not be found.").isVisible(), "un chantier invisible ne rend pas 404");
  });

  // ─── 3. L'écran Transcription relance sur place ─────────────────────────
  //
  // La note part par la route de l'anneau, la seule entrée d'un son depuis que
  // l'ancien écran et son « Ajouter un fichier audio » sont retirés.
  const envoi = await page.request.post(`${BASE}/api/notes-vocales/${chantierB}`, {
    multipart: {
      fichier: { name: "note.wav", mimeType: "audio/wav", buffer: readFileSync(MICRO_SIMULE) },
      dureeSecondes: "3",
    },
  });
  assert.equal(envoi.status(), 200, `la note n'a pas été rangée : ${await envoi.text()}`);
  const transcription = `${BASE}/chantiers/${chantierB}/transcription`;
  const sesMots = page.locator(`text=${TEXTE_DE_LESSAI.slice(0, 40)}`).first();

  await cas("jamais lancée : « Lancer la transcription » transcrit sur place", async () => {
    await page.goto(transcription, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Lancer la transcription" }).click({ timeout: 10_000 });
    await sesMots.waitFor({ state: "visible", timeout: 60_000 });
    assert.equal(page.url(), transcription, "le geste a quitté l'écran Transcription");
    const [note] = await laNote(chantierB);
    assert.equal(note.transcription_statut, "reussie");
  });

  await cas("échouée : « Relancer la transcription » relance sur place, et ses mots arrivent", async () => {
    // Un échec d'hier, son intact : ce qu'un fournisseur en panne aurait laissé.
    await pool.query(
      `update notes_vocales
          set transcription = null, transcription_statut = 'echouee',
              transcription_erreur = 'Le fournisseur est momentanément indisponible.'
        where chantier_id = $1`,
      [chantierB]
    );
    await page.goto(transcription, { waitUntil: "networkidle" });
    assert.equal(await sesMots.count(), 0, "les mots sont déjà là : l'échec n'a pas été posé");
    await page.getByRole("button", { name: "Relancer la transcription" }).click({ timeout: 10_000 });
    await sesMots.waitFor({ state: "visible", timeout: 60_000 });
    assert.equal(page.url(), transcription, "le geste a quitté l'écran Transcription");
    const [note] = await laNote(chantierB);
    assert.equal(note.transcription_statut, "reussie");
    assert.equal(note.transcription, TEXTE_DE_LESSAI);
  });

  await navigateur.close();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Reprendre une dictée qui a échoué — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
