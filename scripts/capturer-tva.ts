import path from "node:path";
import { mkdirSync } from "node:fs";
import { Client } from "pg";
import { lancerNavigateur } from "./e2e-browser";
import type { Page } from "playwright";
import { creerClient } from "../src/server/repositories/clients";
import { creerChantier } from "../src/server/repositories/chantiers";
import { ajouterLignePrix } from "../src/server/repositories/lignes-prix";
import { getOuCreerDevisBrouillon, envoyerDevis } from "../src/server/repositories/devis";
import { terminerChantier, emettreFacture, getFacturePourChantier } from "../src/server/repositories/factures";
import { noterPaiement } from "../src/server/repositories/paiements-facture";
import { creerAchatTva } from "../src/server/repositories/achats-tva";
import { periodeCourante, periodePrecedente } from "../src/server/periode-tva";
import { pool } from "../src/server/db/client";

// **REGARDER « MA TVA », POUR DE VRAI.**
//
// `CLAUDE.md` §5 : *« Et surtout : regarder l'écran. »* Trois défauts de la
// refonte du 3 septembre 2026 sont sortis d'une image et d'aucun test — le
// séparateur de milliers que Playfair ne dessine pas, le fond `rustTint`
// invisible sur Nuit, et le gris de second rang sous le seuil de contraste.
//
// **Pourquoi un script à part, et pas une suite.** Une suite affirme ; elle ne
// montre pas. Et le jeu de démonstration ne suffit pas à voir cet écran : sans
// achat, sans facture émise et sans facture en attente, l'addition affiche trois
// zéros et les trois listes sont vides. On ne verrait rien de ce qui a été codé.
//
// **Ce qu'il pose, et pourquoi c'est légitime :** dans SA base d'essai, deux
// chantiers facturés (dont un jamais réglé, pour l'attente), trois achats sur la
// période courante, et un gros achat sur la précédente — le mois où l'on achète
// une machine sans facturer, c'est-à-dire le crédit de TVA.
//
//   1. lancer le serveur :  npm run build && npx next start
//   2. npx tsx scripts/capturer-tva.ts <dossier>

/**
 * **`localhost`, et surtout PAS `127.0.0.1`.**
 *
 * Payé le 3 septembre 2026, et cela a coûté une heure. Next 16, en mode
 * développement, **refuse les fichiers JavaScript de la page quand l'origine
 * demandée n'est pas celle qu'il sert** : trois `403` sur `/_next/static/chunks`,
 * silencieux dans la page. Rien ne s'hydrate alors — aucun composant client, donc
 * aucun effet — et la frise des périodes s'ouvrait sur janvier au lieu du mois
 * regardé. J'ai corrigé deux fois du code qui n'avait rien.
 *
 * Le banc, lui, ne disait rien : les captures étaient belles et fausses. La
 * leçon est celle d'`AGENTS.md` — un contrôle doit désigner le bon coupable.
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SORTIE = process.argv[2] ?? "/tmp/captures-tva";

/** Ses achats, tels qu'il les scanne : une station, un fournisseur, une jardinerie. */
const ACHATS = [
  { fournisseur: "Aqua Plus", totalTtc: 612.4, tva: 102.07, saisie: "scan" as const, jour: 6 },
  { fournisseur: "TotalEnergies", totalTtc: 96.0, tva: 16.0, saisie: "scan" as const, jour: 14 },
  { fournisseur: "Pépinière Marnier", totalTtc: 770.58, tva: 128.43, saisie: "main" as const, jour: 21 },
];

/** Le jour N de la période donnée, en ISO. */
function jourDe(p: { debut: string }, jour: number): string {
  return `${p.debut.slice(0, 8)}${String(jour).padStart(2, "0")}`;
}

async function poserLeDecor() {
  const admin = new Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();
  const { rows } = await admin.query(
    `select m.utilisateur_id, m.entreprise_id
       from membres_entreprise m
       join users u on u.id = m.utilisateur_id
      where u.email = 'demo@atlas.local'
      limit 1`
  );
  if (rows.length === 0) {
    throw new Error(
      "Le compte de démonstration est absent : la base n'est pas amorcée. `npm run db:seed` d'abord."
    );
  }
  const ctx = { utilisateurId: rows[0].utilisateur_id, entrepriseId: rows[0].entreprise_id };

  // **Le contexte d'isolation, même pour le propriétaire.** Les tables portent
  // `FORCE ROW LEVEL SECURITY` : sans lui, les écritures ci-dessous ne
  // toucheraient AUCUNE ligne — et sans erreur.
  await admin.query("select set_config('app.entreprise_id', $1, false)", [ctx.entrepriseId]);

  // On part de l'encaissement et du mois : c'est le réglage par défaut, et le
  // seul où l'attente et le crédit se voient tous les deux.
  await admin.query(
    "update entreprises set periodicite_tva = 'mensuelle', tva_exigibilite = 'encaissements' where id = $1",
    [ctx.entrepriseId]
  );

  // **On efface le décor précédent avant de le reposer.** Un premier essai de ce
  // script s'est arrêté APRÈS avoir semé et avant de photographier ; le second a
  // semé par-dessus, et l'image montrait six achats au lieu de trois — deux
  // « Aqua Plus », deux « TotalEnergies ». Un banc qui empile ne montre plus
  // l'écran qu'on croit regarder.
  await admin.query("delete from achats_tva where entreprise_id = $1 and fournisseur = any($2)", [
    ctx.entrepriseId,
    [...ACHATS.map((a) => a.fournisseur), "Husqvarna Lyon"],
  ]);

  const courante = periodeCourante("mensuelle");
  const precedente = periodePrecedente(courante);

  try {
    for (const a of ACHATS) {
      await creerAchatTva(ctx, {
        dateAchat: jourDe(courante, a.jour),
        fournisseur: a.fournisseur,
        totalTtc: a.totalTtc,
        tauxTva: 20,
        tvaDeductible: a.tva,
        saisie: a.saisie,
      });
    }

    // Le mois d'avant : une machine, et presque rien de facturé. C'est le
    // crédit de TVA, l'état que l'écran doit savoir écrire négativement.
    await creerAchatTva(ctx, {
      dateAchat: jourDe(precedente, 5),
      fournisseur: "Husqvarna Lyon",
      totalTtc: 5340.0,
      tauxTva: 20,
      tvaDeductible: 890.0,
      saisie: "scan",
    });

    // Deux chantiers facturés : l'un réglé — il entre au relevé —, l'autre non,
    // qui reste dans « En attente de paiement ».
    for (const c of [
      { nom: "Mme Levasseur", prix: "3200.00", regle: true },
      { nom: "Copropriété Les Tilleuls", prix: "3840.00", regle: false },
    ]) {
      const client = await creerClient(ctx, { nom: c.nom });
      const chantier = await creerChantier(ctx, { nom: `Entretien — ${c.nom}`, clientId: client.id });
      await ajouterLignePrix(ctx, chantier.id, "Élagage et évacuation", c.prix);
      const devis = await getOuCreerDevisBrouillon(ctx, chantier.id);
      await envoyerDevis(ctx, devis.id);
      await terminerChantier(ctx, chantier.id);
      const f = await getFacturePourChantier(ctx, chantier.id);
      await emettreFacture(ctx, f!.facture.id);
      if (c.regle) {
        await noterPaiement(ctx, f!.facture.id, {
          date: jourDe(courante, 20),
          montant: f!.facture.totalTtc,
        });
      }
    }
  } finally {
    await admin.end();
  }
}

/** La charte de la PERSONNE, posée en base : l'écran la lit au serveur. */
async function poserLaCharte(nom: "origine" | "nuit") {
  const admin = new Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();
  await admin.query("update users set charte = $1 where email = 'demo@atlas.local'", [nom]);
  await admin.end();
}

async function seConnecter(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').waitFor();
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
}

async function main() {
  mkdirSync(SORTIE, { recursive: true });
  await poserLeDecor();

  const navigateur = await lancerNavigateur();
  // Son écran, au pixel près : 390 × 664, et deux fois la densité.
  const contexte = await navigateur.newContext({
    viewport: { width: 390, height: 664 },
    deviceScaleFactor: 2,
  });
  const page = await contexte.newPage();
  await seConnecter(page);

  const courante = periodeCourante("mensuelle");
  const precedente = periodePrecedente(courante);
  const lien = (p: { annee: number; numero: number }) => `${BASE}/termines/tva?annee=${p.annee}&t=${p.numero}`;

  // **`networkidle`, et non `domcontentloaded`.** Une mesure prise avant la
  // feuille de style compare des boîtes de zéro pixel et rend un vert qui ne
  // prouve rien (`CLAUDE.md` §5, la faute du 15 août 2026).
  const ouvrir = async (url: string) => {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Reste à payer", { timeout: 30_000 });
    await page.waitForTimeout(400);
  };

  const tirer = async (nom: string, entier = false) =>
    page.screenshot({ path: path.join(SORTIE, `${nom}.png`), fullPage: entier });

  for (const charte of ["origine", "nuit"] as const) {
    await poserLaCharte(charte);

    await ouvrir(lien(courante));
    await tirer(`${charte}-01-haut`);
    await tirer(`${charte}-02-entier`, true);

    // La feuille des deux déclarations : le rythme, le régime, et l'écart.
    await page.click('[data-atlas="declarations"]');
    await page.waitForTimeout(400);
    await tirer(`${charte}-03-declarations`);
    await page.keyboard.press("Escape");

    // Le crédit de TVA : le mois de la machine.
    await ouvrir(lien(precedente));
    await tirer(`${charte}-04-credit`);
  }

  // La feuille de saisie d'un achat, sur la charte d'origine.
  await poserLaCharte("origine");
  await ouvrir(lien(courante));
  await page.getByRole("button", { name: "Écrire à la main" }).click();
  await page.waitForTimeout(400);
  await tirer("origine-05-achat");

  await navigateur.close();
  await pool.end();
  console.log(`Captures écrites dans ${SORTIE}`);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
