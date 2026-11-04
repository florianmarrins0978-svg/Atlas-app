import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { ADRESSE } from "./_adresse";

const BASE = ADRESSE;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FAKE_MIC = path.join(__dirname, "fixtures", "fake-mic.wav");

// **Ce qu'une note rangée devient, et ce que la suivante en fait.**
//
// Cette suite ouvrait l'écran Note vocale : enregistrer, écouter, remplacer.
// L'écran est retiré le 3 novembre 2026 (son accord, le jour où « Réessayer »
// est arrivé sur la fiche client), et avec lui la lecture et le bouton
// « Remplacer la note ». **Ce qu'elle éprouvait du SERVEUR reste vrai**, et se
// tient désormais sur la route que l'anneau emploie
// (`/api/notes-vocales/<chantier>`) :
//
//   1. le son rangé est un vrai fichier, non vide, servi comme de l'audio ;
//   2. une seconde dictée sur le même chantier REMPLACE la première, sous une
//      clé neuve, et l'ancienne n'est plus servie (le fichier, lui, attend sa
//      purge : `test-note-vocale-repo.ts`).

async function main() {
  const browser = await lancerNavigateur();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 10000 });

  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', `Chantier note e2e ${Date.now()}`);
  const idChantier = await creerPuisFiche(page);

  async function dicter(): Promise<string> {
    const reponse = await page.request.post(`${BASE}/api/notes-vocales/${idChantier}`, {
      multipart: {
        fichier: { name: "note.wav", mimeType: "audio/wav", buffer: readFileSync(FAKE_MIC) },
        dureeSecondes: "2",
      },
    });
    assert.equal(reponse.status(), 200, `la note n'a pas été rangée : ${await reponse.text()}`);
    const corps = (await reponse.json()) as { ok: boolean; storageKey: string | null };
    assert.ok(corps.ok && corps.storageKey, "la route dit oui sans rendre la clé du son rangé");
    return corps.storageKey;
  }

  // --- 1. Le son rangé est un vrai audio ---
  const cle1 = await dicter();
  const servi = await page.request.get(`${BASE}/api/fichiers/${cle1}`);
  assert.equal(servi.status(), 200);
  assert.ok(servi.headers()["content-type"]?.startsWith("audio/"), "Le fichier servi doit être un vrai audio");
  assert.ok((await servi.body()).length > 0, "Le fichier audio enregistré ne doit pas être vide");

  // --- 2. Une seconde dictée remplace la première ---
  const cle2 = await dicter();
  assert.notEqual(cle2, cle1, "Le remplacement doit produire une nouvelle clé de stockage");
  const { rows: notes } = await pool.query("select storage_key from notes_vocales where chantier_id = $1", [idChantier]);
  assert.equal(notes.length, 1, "deux notes sur un chantier : la seconde dictée s'est ajoutée au lieu de remplacer");
  assert.equal(notes[0].storage_key, cle2);
  // La route de service vérifie l'appartenance à un enregistrement ACTIF : une
  // clé remplacée n'est plus servie, sans quoi un fichier orphelin en attente
  // de purge resterait exposé.
  const ancien = await page.request.get(`${BASE}/api/fichiers/${cle1}`);
  assert.notEqual(ancien.status(), 200, "l'enregistrement remplacé est encore servi");

  await browser.close();
  await pool.end();
  console.log("✅ Test bout-en-bout Note vocale réussi.");
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
