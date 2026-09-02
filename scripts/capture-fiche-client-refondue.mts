// La fiche client refondue, PHOTOGRAPHIÉE sur l'écran réel.
//
// **Pourquoi une capture, et pourquoi elle fait partie du travail.** Trois
// défauts réels de ce projet — une barre de navigation sur la page publique du
// client, l'ordre des totaux d'une facture, une pile de notifications qui
// repoussait tout hors de l'écran — ont été trouvés en regardant une image,
// jamais par un test vert (`CLAUDE.md` §5).
//
// Le montage passe par le VRAI parcours : devis envoyés, chantier terminé,
// facture émise. Un écran photographié sur une base vide montrerait trois
// colonnes vides et ne dirait rien de ce qu'il verra.
//
// Usage : npx tsx scripts/capture-fiche-client-refondue.mts <dossier>
import { mkdirSync } from "node:fs";
import { devices } from "playwright";
import { eq } from "drizzle-orm";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { chantiers, devis } from "../src/server/db/schema";
import { creerChantier } from "../src/server/repositories/chantiers";
import { creerClient } from "../src/server/repositories/clients";
import { ajouterLignePrix } from "../src/server/repositories/lignes-prix";
import { ajouterPrestation } from "../src/server/repositories/prestations";
import { getOuCreerDevisBrouillon, envoyerDevis } from "../src/server/repositories/devis";
import {
  terminerChantier,
  emettreFacture,
  getFacturePourChantier,
} from "../src/server/repositories/factures";
import { ajouterPrestation as ajouterPrestationEntretien } from "../src/server/repositories/prestations-entretien";
import {
  ouvrirPassage,
  lirePassage,
  cocherLigne,
  nommerClient,
  figerPassage,
} from "../src/server/repositories/passages-entretien";

const dossier = process.argv[2];
if (!dossier) {
  console.error("usage: capture-fiche-client-refondue.mts <dossier>");
  process.exit(1);
}
mkdirSync(dossier, { recursive: true });

const BASE = "http://localhost:3000";

const { rows } = await pool.query(
  `SELECT me.utilisateur_id AS u, me.entreprise_id AS e
     FROM membres_entreprise me ORDER BY me.role = 'proprietaire' DESC LIMIT 1`
);
const ctx = { utilisateurId: rows[0].u as string, entrepriseId: rows[0].e as string };

const client = await creerClient(ctx, {
  nom: "Mr. Martins",
  adresse: "10 rue d'Enfer, Nantes",
  telephone: "06 79 98 45 14",
});

/** Un chantier mené jusqu'à la facture, daté — comme la suite base le fait. */
async function chantierDate(nom: string, lignes: [string, string][], jour: string, gestes: string[]) {
  const c = await creerChantier(ctx, { nom, clientId: client.id });
  for (const [libelle, montant] of lignes) await ajouterLignePrix(ctx, c.id, libelle, montant);
  for (const g of gestes) await ajouterPrestation(ctx, c.id, g);
  const d = await getOuCreerDevisBrouillon(ctx, c.id);
  // Avant l'envoi : un devis envoyé est immuable.
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) =>
    tx.update(devis).set({ dateEmission: jour }).where(eq(devis.id, d.id))
  );
  await envoyerDevis(ctx, d.id);
  const quand = new Date(`${jour}T09:00:00Z`);
  await terminerChantier(ctx, c.id, quand);
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) =>
    tx.update(chantiers).set({ termineAt: quand }).where(eq(chantiers.id, c.id))
  );
  const f = await getFacturePourChantier(ctx, c.id);
  await emettreFacture(ctx, f!.facture.id, quand);
}

await chantierDate("Taille de haie", [["Taille de haie de laurier", "340.00"]], "2025-10-02", [
  "Taille au carré, deux faces",
]);
await chantierDate(
  "Élagage de trois chênes",
  [["Élagage — 3 chênes", "1350.00"]],
  "2026-08-12",
  [
    "Démontage en tête de chat, trois sujets",
    "Broyage des branches sur place",
    "Évacuation des gravats",
    "Remise en état de la pelouse",
  ]
);

// **Une fiche d'entretien REMPLIE ET ENVOYÉE.** Depuis sa règle du 23 août
// 2026, c'est la seule chose qui remplit la troisième colonne : sans elle,
// l'image montrerait « Aucune fiche envoyée » et ne dirait rien de ce qu'il
// verra chez un client qu'il entretient.
for (const [jour, faites] of [
  ["2026-05-06", 2],
  ["2026-08-19", 3],
] as const) {
  await ajouterPrestationEntretien(ctx, { famille: "Pelouse", libelle: "Tonte" });
  await ajouterPrestationEntretien(ctx, { famille: "Pelouse", libelle: "Ramassage des feuilles" });
  await ajouterPrestationEntretien(ctx, { famille: "Tailles", libelle: "Taille de haie" });
  const ouvert = await ouvrirPassage(ctx, jour);
  if (!ouvert.ok) throw new Error(`fiche non ouverte : ${ouvert.refus}`);
  const passage = await lirePassage(ctx, ouvert.id);
  for (const ligne of passage!.lignes.slice(0, faites)) await cocherLigne(ctx, ouvert.id, ligne.id, true);
  await nommerClient(ctx, ouvert.id, client.id);
  const fige = await figerPassage(ctx, ouvert.id);
  if (!fige.ok) throw new Error(`fiche non partie : ${fige.phrase}`);
}

const navigateur = await lancerNavigateur();
const page = await (await navigateur.newContext({ ...devices["iPhone 13"] })).newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 60_000 });

await page.goto(`${BASE}/clients/${client.id}`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: `${dossier}/fiche-client-reelle.png`, fullPage: true });

// **Et la feuille d'une fiche d'entretien**, celle qui n'offre plus
// « Enregistrer » : c'est le geste qui a changé, et une image le dit mieux
// qu'une assertion.
// Depuis le 2 septembre 2026 le dossier est en REGISTRES : on touche l'onglet,
// puis la pièce — c'est le chemin qu'il emprunte (`ARCHITECTURE.md` §213).
await page.locator('[data-atlas="registre"]:text-is("Fiches")').click();
await page.waitForTimeout(400);
const registreFiches = page.locator('[role="tabpanel"]:not([hidden])');
await registreFiches.locator('[data-atlas="piece"]').first().click();
await page.locator('[data-atlas="piece-ouvrir"]').waitFor({ state: "visible", timeout: 20_000 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${dossier}/feuille-de-la-fiche.png` });
await page.getByRole("button", { name: "Annuler" }).click();
await page.waitForTimeout(400);

// ─── LA FEUILLE DE SUPPRESSION, SUR UN CLIENT QUI A DES PAPIERS ─────────────
//
// **C'est là que vit sa règle du 27 août** : la phrase de prévention, la
// question de la sauvegarde, et ce que la loi cloue — nommé avec son numéro.
await page.locator('[data-atlas="supprimer-client"]').scrollIntoViewIfNeeded();
await page.locator('[data-atlas="supprimer-client"]').click();
await page.waitForSelector('[data-atlas="confirmer-suppression"]', { timeout: 15_000 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${dossier}/suppression-avec-papiers.png` });
// Et une fois la sauvegarde confirmée : le bouton se déverrouille.
await page.locator('[data-atlas="sauvegarde-ailleurs"]').click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${dossier}/suppression-deverrouillee.png` });
await page.getByRole("button", { name: "Annuler" }).click();
await page.waitForTimeout(300);

// ─── ET LA FICHE D'UN CLIENT SANS AUCUN PAPIER ──────────────────────────────
//
// **C'est la seconde capture qu'il a envoyée le 26 août 2026**, et c'est là que
// vivaient deux des trois défauts : le point entre l'adresse et le téléphone, et
// la phrase grise sous les trois colonnes vides. Une image prise sur un client
// FOURNI ne les montre pas — la phrase ne s'écrivait que sur un client vide.
const toutNeuf = await creerClient(ctx, {
  nom: "M. Moreau (test)",
  adresse: "23 rue d'Issy 92100 Boulogne-Billancourt",
  telephone: "06 00 00 00 05",
});
await page.goto(`${BASE}/clients/${toutNeuf.id}`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.screenshot({ path: `${dossier}/fiche-client-sans-papier.png`, fullPage: true });

// Ce que l'écran porte vraiment, en clair — l'image se regarde, le texte se cite.
const vu = await page.evaluate(() => ({
  colonnes: [...document.querySelectorAll("h3")].map((h3) => ({
    titre: (h3.textContent ?? "").trim(),
    // **`[data-atlas="piece"]`, et non `a`.** Les pièces sont des BOUTONS
    // depuis le 21 août 2026 : ce relevé rendait trois colonnes vides et
    // laissait croire à un écran nu, alors que l'image montrait six pièces.
    // Un relevé qui mesure zéro ne mesure rien (`CLAUDE.md` §5).
    pieces: [...h3.parentElement!.querySelectorAll('[data-atlas="piece"]')].map((b) =>
      (b.textContent ?? "").replace(/\s+/g, " ").trim()
    ),
  })),
  derniere: (document.querySelector("h2")?.textContent ?? "").trim(),
  comprend: [...document.querySelectorAll("h2 ~ ul li")].map((l) => (l.textContent ?? "").trim()),
  debordement: document.documentElement.scrollWidth - window.innerWidth,
}));
// **Les coordonnées, relevées ligne par ligne.** L'image montre la mise en
// page ; ce relevé dit ce qui est écrit, et c'est lui qui attrape un séparateur
// revenu ou un numéro recollé à l'adresse.
const coordonnees = await page.evaluate(
  () =>
    (document.querySelector("header p:last-of-type") as HTMLElement | null)?.innerText ?? "(absent)"
);
console.log(`\ncoordonnées (client sans papier) : ${JSON.stringify(coordonnees)}`);

// La feuille du client SANS papier : pas de prévention, pas de question.
await page.locator('[data-atlas="supprimer-client"]').scrollIntoViewIfNeeded();
await page.locator('[data-atlas="supprimer-client"]').click();
await page.waitForSelector('[data-atlas="confirmer-suppression"]', { timeout: 15_000 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${dossier}/suppression-sans-papier.png` });
console.log(JSON.stringify(vu, null, 2));
console.log(`\nimage écrite dans ${dossier}/fiche-client-reelle.png`);

await navigateur.close();
await pool.end();
