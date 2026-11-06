/* =======================================================================
   Une note dictée sans réseau est gardée, et part sur son appui.

   **Sa planche du 5 novembre 2026, la B le 6** (`appli/soignee/note-sans-reseau.html`) :
   « je pense qu'il faut appuyer pour que la note parte ». Jusque-là, un envoi
   raté disait « puis refaites la note », et sur une fiche NEUVE il ne disait
   rien du tout : la création du chantier levait, rien ne la rattrapait, et la
   note partait avec la variable qui la portait.

   Deux parcours, joués comme lui les joue : sur le chantier, puis le réseau
   coupé, puis rendu.
     1. une fiche NEUVE dictée sans réseau : « Gardée », la phrase qui dit de
        rester sur la page ; le réseau rendu, « Envoyer » ; son appui crée le
        chantier ET range la note ;
     2. un chantier qui existe : gardée, puis la page ROUVERTE la retrouve, et
        son appui l'envoie ; partie, elle quitte le téléphone.
   ======================================================================= */
import { lancerNavigateur } from "./e2e-browser";
import { Pool } from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "playwright";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { ADRESSE } from "./_adresse";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MICRO_SIMULE = path.join(__dirname, "fixtures", "fake-mic.wav");
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

/** Dicte trois secondes, puis touche l'avion. */
async function dicter(page: Page) {
  await page.locator('[data-atlas="anneau-note-vocale"] .atlas-micro').click();
  await page.waitForTimeout(3000);
  await page.locator('[data-atlas="dictee-envoyer"]').click();
}

/** Combien de notes gardées le téléphone porte. */
async function notesGardees(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const r = indexedDB.open("atlas-notes-gardees", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("notes", { keyPath: "chantierId" });
        r.onsuccess = () => {
          const c = r.result.transaction("notes", "readonly").objectStore("notes").count();
          c.onsuccess = () => resolve(c.result);
          c.onerror = () => resolve(-1);
        };
        r.onerror = () => resolve(-1);
      })
  );
}

async function main() {
  console.log("=== Une note sans réseau est gardée ===\n");

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

  // ─── 1. La fiche NEUVE ────────────────────────────────────────────────────
  const nom = `Sans réseau ${Date.now()}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', nom);
  await contexte.setOffline(true);
  await dicter(page);

  await cas("fiche neuve sans réseau : la note est gardée, et la page le dit", async () => {
    await page.locator('[data-atlas="note-gardee"]').waitFor({ timeout: 15_000 });
    const phrase = (await page.locator('[data-atlas="note-gardee-phrase"]').textContent()) ?? "";
    if (!/revient/.test(phrase) || !/page/.test(phrase)) throw new Error(`phrase inattendue : « ${phrase} »`);
    if (/refaites/i.test(phrase)) throw new Error("la phrase dit encore de refaire la note");
  });

  await cas("sans réseau, rien ne part tout seul : aucun Envoyer à toucher", async () => {
    if ((await page.locator('[data-atlas="note-gardee-envoyer"]').count()) !== 0) {
      throw new Error("le disque propose Envoyer alors que le serveur est injoignable");
    }
  });

  await contexte.setOffline(false);
  await cas("le réseau rendu, le disque redevient Envoyer, et c'est l'appui qui envoie", async () => {
    await page.locator('[data-atlas="note-gardee-envoyer"]').waitFor({ timeout: 20_000 });
    await page.locator('[data-atlas="note-gardee-envoyer"]').click();
    await page.locator('[data-atlas="note-gardee"], [data-atlas="note-gardee-envoyer"]').first().waitFor({ state: "detached", timeout: 20_000 });
    const { rows } = await pool.query(
      `SELECT n.envoi_id FROM notes_vocales n JOIN chantiers c ON c.id = n.chantier_id JOIN clients cl ON cl.id = c.client_id WHERE cl.nom = $1`,
      [nom]
    );
    if (rows.length !== 1) throw new Error(`${rows.length} note(s) en base pour la fiche neuve, au lieu d'une`);
    if (!rows[0].envoi_id) throw new Error("la note est partie sans son identifiant d'envoi");
  });

  // ─── 2. Un chantier qui existe, la page rouverte ─────────────────────────
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', `Rouverte ${Date.now()}`);
  const chantierId = await creerPuisFiche(page);
  const fiche = `${BASE}/chantiers/${chantierId}/coordonnees`;
  await page.goto(fiche, { waitUntil: "networkidle" });
  await contexte.setOffline(true);
  await dicter(page);

  await cas("chantier existant sans réseau : la phrase de la planche, mot pour mot", async () => {
    await page.locator('[data-atlas="note-gardee"]').waitFor({ timeout: 15_000 });
    const phrase = ((await page.locator('[data-atlas="note-gardee-phrase"]').textContent()) ?? "").trim();
    if (phrase !== "Envoyez-la quand le réseau revient.") throw new Error(`« ${phrase} »`);
    if ((await notesGardees(page)) !== 1) throw new Error("la note n'est pas rangée sur le téléphone");
  });

  await contexte.setOffline(false);
  await page.goto(fiche, { waitUntil: "networkidle" });
  await cas("la page rouverte retrouve la note, et son appui l'envoie", async () => {
    await page.locator('[data-atlas="note-gardee-envoyer"]').waitFor({ timeout: 20_000 });
    await page.locator('[data-atlas="note-gardee-envoyer"]').click();
    await page.waitForTimeout(6000);
    const { rows } = await pool.query(`SELECT envoi_id FROM notes_vocales WHERE chantier_id = $1`, [chantierId]);
    if (rows.length !== 1 || !rows[0].envoi_id) throw new Error("la note gardée n'est pas arrivée en base");
  });

  await cas("partie, la voix du client quitte le téléphone", async () => {
    const n = await notesGardees(page);
    if (n !== 0) throw new Error(`${n} note(s) encore gardée(s) après l'envoi`);
  });

  await navigateur.close();
  await pool.end();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Note sans réseau : ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
