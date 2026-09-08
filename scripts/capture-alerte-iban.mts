// REGARDER L'ALERTE « ANCIEN IBAN » — aux trois endroits qu'il a retenus.
//   npx tsx scripts/capture-alerte-iban.mts <dossier>
//
// **Obligation du dépôt, pas une finition** (`CLAUDE.md` §5) : quatre défauts
// réels d'Atlas ne sont sortis que d'une capture regardée, jamais d'un test
// vert. Une alerte qui déborde, un bouton collé, une phrase coupée : rien de
// tout cela ne fait rougir une suite.
//
// Le montage FABRIQUE la situation, plutôt que d'espérer qu'elle existe : une
// facture émise sur le compte de démonstration, puis un changement d'IBAN. Sans
// ces deux gestes, l'alerte ne s'afficherait pas — et l'on photographierait un
// écran vide en croyant l'avoir vue.
import { lancerNavigateur } from "./e2e-browser";
import type { Page } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { pool, db } from "../src/server/db/client";
import { entreprises, users, membresEntreprise } from "../src/server/db/schema";
import { eq } from "drizzle-orm";
import * as clientsRepo from "../src/server/repositories/clients";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import { terminerChantier, emettreFacture } from "../src/server/repositories/factures";

const BASE = process.env.ATLAS_BASE ?? "http://localhost:3000";
const dossier = process.argv[2] ?? "/tmp/captures-iban";
mkdirSync(dossier, { recursive: true });

// ─── Le montage : une facture partie, puis un changement de banque ──────────

const [demo] = await db.select().from(users).where(eq(users.email, "demo@atlas.local")).limit(1);
if (!demo) throw new Error("le compte de démonstration est absent : la base n'est pas amorcée");
const [adhesion] = await db
  .select({ entrepriseId: membresEntreprise.entrepriseId })
  .from(membresEntreprise)
  .where(eq(membresEntreprise.utilisateurId, demo.id))
  .limit(1);
if (!adhesion) throw new Error("le compte de démonstration n'appartient à aucune entreprise");

const ctx = { utilisateurId: demo.id, entrepriseId: adhesion.entrepriseId };

await entreprisesRepo.mettreAJourEntreprise(ctx, { iban: "FR7611110000011111111111111" });
const client = await clientsRepo.creerClient(ctx, {
  nom: "Mme Grospiron",
  telephone: "06 12 34 56 78",
});
const chantier = await chantiersRepo.creerChantier(ctx, {
  nom: "Taille de haie",
  adresseChantier: "5 rue des Lilas",
  clientId: client.id,
});
await prixRepo.ajouterLignePrix(ctx, chantier.id, "Taille de haie", "1233.33");
const devis = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
await devisRepo.envoyerDevis(ctx, devis.id);
const facture = await terminerChantier(ctx, chantier.id);
await emettreFacture(ctx, facture.id);

// Il change de banque APRÈS l'envoi : c'est tout le sujet.
await entreprisesRepo.mettreAJourEntreprise(ctx, { iban: "FR7622220000022222222222222" });
await pool.end();

// ─── Ce qu'il voit ─────────────────────────────────────────────────────────

async function connecter(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
}

const navigateur = await lancerNavigateur();
// 390 × 844 : son iPhone. Une capture prise sur un grand écran ne montre pas ce
// qu'il voit, et c'est justement ce qu'on cherche.
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
const page = await contexte.newPage();

try {
  await connecter(page);

  const prendre = async (nom: string) => {
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(dossier, `${nom}.png`), fullPage: true });
    console.log(`  ${nom}`);
  };

  await page.goto(`${BASE}/reglages/identite`, { waitUntil: "networkidle" });
  await prendre("1-dans-les-reglages");

  await page.goto(`${BASE}/termines/tva`, { waitUntil: "networkidle" });
  await prendre("2-en-attente-de-paiement");

  // La feuille du message : c'est elle qui part chez le client, et il doit
  // pouvoir la lire avant de l'envoyer.
  const prevenir = page.locator('button:has-text("Prévenir")').first();
  if (await prevenir.count()) {
    await prevenir.click();
    await page.waitForTimeout(500);
    await prendre("3-le-message");
  } else {
    // **On ne conclut pas sur une absence.** Un bouton introuvable ne prouve
    // pas que la feuille est juste : il dit que l'alerte ne s'affiche pas, et
    // c'est un défaut à voir, pas à taire (`CLAUDE.md` §5).
    console.log("  ⚠ aucun bouton « Prévenir » : l'alerte ne s'affiche pas");
  }

  console.log(`\nCaptures dans ${dossier}`);
} finally {
  await navigateur.close();
}
