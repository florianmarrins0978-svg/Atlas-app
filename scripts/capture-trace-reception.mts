// Regarder « Factures en attente » AVEC la trace de réception, et la carte
// de l'accueil — sa demande du 9 septembre 2026. §5 : on regarde l'écran.
//
//   ATLAS_BASE=http://localhost:3003 npx tsx scripts/capture-trace-reception.mts <dossier>
//
// **`localhost`, et surtout PAS `127.0.0.1`** : en développement, Next 16
// refuse les fichiers JavaScript de la page quand l'origine diffère de celle
// qu'il attend, et l'écran s'affiche sans jamais s'animer. Payé le 3 septembre
// 2026, et repayé le 9.
//
// **Ce que seule une image montre ici :** que les deux dates tiennent sur la
// ligne sans la casser, et qu'elles ne se confondent pas avec la marque de
// l'ancien IBAN, qui occupe exactement la même place.
import { mkdirSync } from "node:fs";
import { Client } from "pg";
import { lancerNavigateur } from "./e2e-browser";
import type { Page } from "playwright";
import { creerClient } from "../src/server/repositories/clients";
import { creerChantier } from "../src/server/repositories/chantiers";
import { ajouterLignePrix } from "../src/server/repositories/lignes-prix";
import { getOuCreerDevisBrouillon, envoyerDevis } from "../src/server/repositories/devis";
import { terminerChantier, emettreFacture } from "../src/server/repositories/factures";
import {
  accuserReceptionDeLaFacture,
  creerEnvoiFacture,
  noterOuvertureDeLaFacture,
} from "../src/server/repositories/envois-factures";
import { noterPaiement } from "../src/server/repositories/paiements-facture";
import { jourIso } from "../src/lib/jour";
import { pool } from "../src/server/db/client";
import { fermerLimiteur } from "../src/server/rate-limit";

const BASE = process.env.ATLAS_BASE ?? "http://localhost:3000";
const dossier = process.argv[2] ?? "./captures-trace";
mkdirSync(dossier, { recursive: true });

async function contexteDeDemo() {
  // **Un rôle qui TRAVERSE la RLS, et il en faut un.** `membres_entreprise`
  // porte `FORCE ROW LEVEL SECURITY` : même le propriétaire de la table n'y
  // voit rien sans contexte d'entreprise — et c'est justement ce contexte qu'on
  // vient chercher. `ATLAS_BASE_SUPER` d'abord, comme la batterie.
  const admin = new Client({
    connectionString: process.env.ATLAS_BASE_SUPER ?? process.env.DATABASE_ADMIN_URL,
  });
  await admin.connect();
  const { rows } = await admin.query(
    `select u.id as "utilisateurId", m.entreprise_id as "entrepriseId"
       from users u
       join membres_entreprise m on m.utilisateur_id = u.id
      where u.email = 'demo@atlas.local'
      limit 1`
  );
  await admin.end();
  if (rows.length === 0) {
    throw new Error("Le compte de démonstration est absent : la base n'est pas amorcée.");
  }
  return rows[0] as { utilisateurId: string; entrepriseId: string };
}

async function seConnecter(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').waitFor();
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
}

/** Une facture émise et partie, dans l'état demandé. */
async function facturePartie(
  ctx: { utilisateurId: string; entrepriseId: string },
  qui: string,
  etat: "rien" | "ouverte" | "confirmee"
) {
  const client = await creerClient(ctx, { nom: qui, telephone: "0612345678" });
  const chantier = await creerChantier(ctx, {
    nom: `Chez ${qui}`,
    adresseChantier: "12 rue des Écoles",
    clientId: client.id,
  });
  await ajouterLignePrix(ctx, chantier.id, "Taille de haies", "1480.00");
  const brouillon = await getOuCreerDevisBrouillon(ctx, chantier.id);
  await envoyerDevis(ctx, brouillon.id);
  const facture = await terminerChantier(ctx, chantier.id);
  await emettreFacture(ctx, facture.id);
  const envoi = await creerEnvoiFacture(ctx, facture.id, "sms");

  const empreinte = { adresseIp: "203.0.113.7", agentUtilisateur: "Safari/iPhone" };
  if (etat === "ouverte") await noterOuvertureDeLaFacture(envoi.jeton, empreinte);
  if (etat === "confirmee") await accuserReceptionDeLaFacture(envoi.jeton, empreinte);
  return facture;
}

const ctx = await contexteDeDemo();
// Les trois états côte à côte : c'est la seule façon de voir que la ligne dit
// quelque chose d'utile dans chacun, et pas seulement dans le plus favorable.
await facturePartie(ctx, "Mme Durand", "confirmee");
await facturePartie(ctx, "M. Leroy", "ouverte");
await facturePartie(ctx, "Mme Bonnet", "rien");
// **Et une quatrième, déjà entamée** : sa demande du 11 septembre 2026 met deux
// chiffres en tête du formulaire de règlement, et ils ne se distinguent que
// lorsqu'un acompte est passé. Trois factures neuves les auraient montrés
// égaux — un contrôle qui ne peut pas voir la différence ne prouve rien.
const entamee = await facturePartie(ctx, "M. Martin", "ouverte");
await noterPaiement(ctx, entamee.id, { date: jourIso(new Date()), montant: "300.00" });
console.log("quatre factures posées : confirmée, ouverte, jamais ouverte, entamée");

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await contexte.newPage();
const erreurs: string[] = [];
page.on("pageerror", (e) => erreurs.push(String(e)));

await seConnecter(page);

// L'accueil, avec la carte « Facture reçue ».
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const carte = page.locator("text=Facture reçue").first();
console.log("carte sur l'accueil :", (await carte.count()) > 0 ? "présente" : "ABSENTE");
await page.screenshot({ path: `${dossier}/accueil.png`, fullPage: true });

// « Terminés › TVA », où la trace se range.
await page.goto(`${BASE}/termines/tva`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const lignes = await page.locator("text=/Ouverte \\d|Réception confirmée le|Pas encore ouverte/").allTextContents();
console.log("lignes de trace lues :", lignes);
// Un contrôle qui mesure zéro ne mesure rien : sans ces trois lignes, la
// capture ne montrerait rien de ce qu'on vient de coder.
if (lignes.length < 3) console.log("⚠ moins de trois lignes : l'écran ne montre pas ce qu'on croit");
console.log(
  "déborde en largeur :",
  await page.evaluate(() => document.documentElement.scrollWidth > 390)
);
await page.screenshot({ path: `${dossier}/impayes.png`, fullPage: true });

// **LE FORMULAIRE OUVERT, et il ne se voit pas autrement.** Les deux chiffres
// qu'il a demandés le 11 septembre 2026 n'existent que là : une capture de
// l'écran au repos ne montrerait pas ce qu'on vient d'écrire.
const noter = page.locator("text=Noter un règlement").first();
await noter.click();
await page.waitForTimeout(500);
const reste = await page.locator("text=/Reste à payer/").first().textContent();
console.log("en tête du formulaire :", reste?.trim());
await page.screenshot({ path: `${dossier}/noter-un-reglement.png`, fullPage: true });

console.log("erreurs de page :", erreurs.length ? erreurs : "aucune");
await navigateur.close();
await fermerLimiteur();
await pool.end();
