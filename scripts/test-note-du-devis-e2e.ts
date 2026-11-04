import assert from "node:assert/strict";
import { Pool } from "pg";
import { lancerNavigateur } from "./e2e-browser";
import { pool as poolApp } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as devisRepo from "../src/server/repositories/devis";
import * as clientsRepo from "../src/server/repositories/clients";
import { creerEnvoi } from "../src/server/repositories/envois-devis";
import { fenetreProposition, versJourIso, ajouterJours } from "../src/lib/disponibilites";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { ADRESSE } from "./_adresse";

// ═══════════════════════════════════════════════════════════════════════════
// LA NOTE DU DEVIS : CHEZ LE CLIENT, ET MONTRÉE UNE FOIS AU PATRON
// ═══════════════════════════════════════════════════════════════════════════
//
// Ses planches du 3 novembre 2026, tranchées le 4 (`appli/soignee/
// devis-note-client.html`, `devis-note-avant-envoi.html`) :
//   · ce qu'il écrit dans « Notes / conditions » paraît sur la page que son
//     client ouvre depuis le SMS, juste avant « J'accepte ce devis » ;
//   · coupée à deux lignes, elle s'ouvre en entier d'un appui, et la page
//     tient toujours dans 390 × 664 ;
//   · au premier toucher du champ, une fenêtre lui montre où le client la
//     lira, puis plus jamais pour ce compte (migration 0163).
//
// **Par la porte du patron** (`CLAUDE.md` §5 quater) : la fenêtre se mesure en
// touchant le vrai champ, la note en ouvrant le vrai lien. Les deux défauts
// vus en codant sont tenus ici : une note longue coupée qui ne s'ouvrait pas
// (le texte mesuré était remplacé), et une image arrivée après la fenêtre.

const BASE = ADRESSE;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let echecs = 0;
async function cas(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const COURTE = "Le jour de l'intervention, merci de libérer la place de parking.";
const LONGUE =
  "Le jour de l'intervention, merci de libérer la place de parking sous le prunier et de laisser le portail ouvert dès 8 h.\n" +
  "L'eau du jardin sera coupée une heure en fin de matinée.\nL'évacuation des tailles est comprise dans le prix.";

/** Un devis envoyé, avec sa note, et le lien que reçoit le client. */
async function lienAvecNote(note: string): Promise<string> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Atelier de la Note" },
    { email: `note-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@atlas.test` }
  );
  const ctx = { utilisateurId, entrepriseId: entreprise.id };
  // Un client nommé, avec civilité : le cas le plus haut, celui du patron.
  const client = await clientsRepo.creerClient(ctx, { nom: "Huguette Groupiron", civilite: "mme", telephone: "06 12 34 56 78" });
  const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Taille des fruitiers", adresseChantier: "12 rue des Tilleuls", clientId: client.id });
  const d = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  await devisRepo.mettreAJourEnTeteDevis(ctx, d.id, { conditionsPaiement: note });
  const maintenant = new Date();
  const fenetre = fenetreProposition(maintenant);
  const date = versJourIso(ajouterJours(new Date(`${fenetre.debut}T12:00:00Z`), 5));
  const envoi = await creerEnvoi(
    ctx,
    { chantierId: chantier.id, devisId: d.id, canal: "sms", datesProposees: [date], contenuDevis: `note-${Date.now()}` },
    maintenant
  );
  return `${BASE}/devis/${envoi.jeton}`;
}

async function main() {
  const navigateur = await lancerNavigateur();

  // ─── Chez le client ──────────────────────────────────────────────────────
  const telephone = await navigateur.newContext({ viewport: { width: 390, height: 664 } });

  await cas("la note courte paraît juste avant « J'accepte ce devis », sans rien à toucher", async () => {
    const page = await telephone.newPage();
    await page.goto(await lienAvecNote(COURTE), { waitUntil: "networkidle" });
    const note = page.locator('[data-atlas="note-du-devis"]');
    await note.waitFor({ timeout: 30_000 });
    assert.match(await note.innerText(), /libérer la place de parking/);
    assert.equal(await note.getAttribute("role"), null, "une note entière ne doit pas se présenter comme un bouton");
    const boiteNote = await note.boundingBox();
    const boiteAccord = await page.getByRole("button", { name: "J'accepte ce devis" }).boundingBox();
    assert.ok(boiteNote && boiteAccord && boiteNote.height > 0, "mesure impossible : une boîte de zéro pixel ne prouve rien");
    assert.ok(boiteNote.y < boiteAccord.y, "la note doit précéder l'accord");
    await page.close();
  });

  await cas("la note longue s'ouvre en entier d'un appui, et la page tient dans 664 px", async () => {
    const page = await telephone.newPage();
    await page.goto(await lienAvecNote(LONGUE), { waitUntil: "networkidle" });
    const note = page.locator('[data-atlas="note-du-devis"]');
    await note.waitFor({ timeout: 30_000 });
    // Le défaut vu en codant : coupée, elle restait un simple bloc.
    await page.waitForFunction(() => document.querySelector('[data-atlas="note-du-devis"]')?.getAttribute("role") === "button", null, { timeout: 10_000 });
    const bas = await page.evaluate(() => Math.max(...[...document.querySelectorAll("button, p")].map((e) => e.getBoundingClientRect().bottom)));
    assert.ok(bas > 0 && bas <= 664, `la page déborde de l'écran : ${Math.round(bas)} px`);
    await note.click();
    // La phrase est AUSSI dans la note coupée, cachée sous la coupe : on lit
    // celle de la feuille, sous son titre, et elle seule.
    const feuille = page.getByRole("heading", { name: "À savoir" }).locator("xpath=following-sibling::p[1]");
    await feuille.waitFor({ timeout: 10_000 });
    assert.match(await feuille.innerText(), /L'évacuation des tailles est comprise dans le prix\./);
    await page.getByRole("button", { name: "Revenir au devis" }).click();
    await page.close();
  });

  await cas("sans note, la page n'en montre aucune", async () => {
    const page = await telephone.newPage();
    await page.goto(await lienAvecNote("   "), { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "J'accepte ce devis" }).waitFor({ timeout: 30_000 });
    assert.equal(await page.locator('[data-atlas="note-du-devis"]').count(), 0);
    await page.close();
  });

  // ─── Chez le patron ──────────────────────────────────────────────────────
  const { rows: compte } = await pool.query(`SELECT id, aide_note_devis_vue_le FROM users WHERE email = 'demo@atlas.local'`);
  assert.ok(compte[0]?.id, "le compte de démonstration est absent : la base n'est pas amorcée");
  const avant = compte[0].aide_note_devis_vue_le;
  await pool.query(`UPDATE users SET aide_note_devis_vue_le = NULL WHERE id = $1`, [compte[0].id]);

  try {
    const patron = await navigateur.newContext({ viewport: { width: 390, height: 664 } });
    const page = await patron.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', "demo@atlas.local");
    await page.fill('input[name="password"]', "demo1234");
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/`, { timeout: 20_000 });

    await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
    await page.fill('input[placeholder="Bernard"]', `M. Prunier ${Date.now()}`);
    const chantierId = await creerPuisFiche(page);
    await page.waitForLoadState("networkidle");
    const ecran = `${BASE}/chantiers/${chantierId}/devis-complet`;

    const toucherLeChamp = async () => {
      const champ = page.locator('[aria-label="Notes et conditions"]').first();
      await champ.scrollIntoViewIfNeeded();
      await champ.click();
    };
    const fenetre = page.locator('[data-atlas="ou-le-client-lira-la-note"]');

    await cas("au premier toucher de « Notes / conditions », la fenêtre montre la page du client", async () => {
      await page.goto(ecran, { waitUntil: "networkidle" });
      await toucherLeChamp();
      await fenetre.waitFor({ timeout: 5_000 });
      assert.match(await fenetre.innerText(), /Ta note :/);
      // L'image doit être LÀ, pas en route : le second défaut vu en codant.
      const image = fenetre.locator("img");
      await page.waitForFunction((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0, await image.elementHandle(), { timeout: 5_000 });
      // L'écriture part avec la fenêtre, sans attendre : on lui laisse le temps.
      let vue: Date | null = null;
      for (const essai of [0, 1, 2, 3]) {
        if (essai > 0) await page.waitForTimeout(essai * 400);
        vue = (await pool.query(`SELECT aide_note_devis_vue_le FROM users WHERE id = $1`, [compte[0].id])).rows[0]?.aide_note_devis_vue_le ?? null;
        if (vue) break;
      }
      assert.ok(vue, "la fenêtre a été montrée sans être notée vue");
    });

    await cas("elle part seule, et ne revient plus, ni sur la page ni après rechargement", async () => {
      await fenetre.waitFor({ state: "detached", timeout: 12_000 });
      await page.locator('[aria-label="Notes et conditions"]').first().blur();
      await toucherLeChamp();
      await page.waitForTimeout(1_000);
      assert.equal(await fenetre.count(), 0, "revenue sur la même page");
      await page.goto(ecran, { waitUntil: "networkidle" });
      await toucherLeChamp();
      await page.waitForTimeout(1_500);
      assert.equal(await fenetre.count(), 0, "revenue après rechargement");
    });
  } finally {
    await pool.query(`UPDATE users SET aide_note_devis_vue_le = $1 WHERE id = $2`, [avant, compte[0].id]);
  }

  await navigateur.close();
  await pool.end();
  await poolApp.end();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} La note du devis — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch((fin) => console.error("Le pool ne s'est pas refermé", fin));
  process.exit(1);
});
