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

// Ce que l'écran porte vraiment, en clair — l'image se regarde, le texte se cite.
const vu = await page.evaluate(() => ({
  colonnes: [...document.querySelectorAll("h3")].map((h3) => ({
    titre: (h3.textContent ?? "").trim(),
    pieces: [...h3.parentElement!.querySelectorAll("a")].map((a) =>
      (a.textContent ?? "").replace(/\s+/g, " ").trim()
    ),
  })),
  derniere: (document.querySelector("h2")?.textContent ?? "").trim(),
  comprend: [...document.querySelectorAll("h2 ~ ul li")].map((l) => (l.textContent ?? "").trim()),
  debordement: document.documentElement.scrollWidth - window.innerWidth,
}));
console.log(JSON.stringify(vu, null, 2));
console.log(`\nimage écrite dans ${dossier}/fiche-client-reelle.png`);

await navigateur.close();
await pool.end();
