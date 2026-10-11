// Regarder les DEUX écrans de la réception d'une facture — sa demande du
// 9 septembre 2026. §5 : on regarde l'écran, un test vert ne suffit pas.
//
//   npx tsx --env-file=.env scripts/capture-reception-facture.mts <dossier>
//
// **Ce que seule une image montre ici :** que la case est bien la DERNIÈRE
// chose de la page — posée sous « Télécharger ma facture », elle se lirait
// comme une condition à remplir pour ouvrir le document, ce que le patron a
// explicitement écarté. Aucune assertion ne dit ça ; un œil, si.
import { mkdirSync } from "node:fs";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import { terminerChantier, emettreFacture } from "../src/server/repositories/factures";
import { creerEnvoiFacture } from "../src/server/repositories/envois-factures";
import { fermerLimiteur } from "../src/server/rate-limit";

const BASE = process.env.ATLAS_BASE ?? "http://localhost:3000";
const dossier = process.argv[2] ?? "./captures-reception";
mkdirSync(dossier, { recursive: true });

const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
  { nom: "Eden Nature" },
  { email: `capture-reception-${Date.now()}@t.test` }
);
const ctx = { utilisateurId, entrepriseId: entreprise.id };

const client = await clientsRepo.creerClient(ctx, { nom: "Mme Durand", telephone: "0612345678" });
const chantier = await chantiersRepo.creerChantier(ctx, {
  nom: "Chez Mme Durand",
  adresseChantier: "12 rue des Écoles",
  clientId: client.id,
});
await prixRepo.ajouterLignePrix(ctx, chantier.id, "Taille de haies", "1480.00");
const brouillon = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
await devisRepo.envoyerDevis(ctx, brouillon.id);
const facture = await terminerChantier(ctx, chantier.id);
await emettreFacture(ctx, facture.id);
const envoi = await creerEnvoiFacture(ctx, facture.id, "sms");

console.log(`facture ${facture.numeroCommercial} · jeton posé`);

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await contexte.newPage();
const erreurs: string[] = [];
page.on("pageerror", (e) => erreurs.push(String(e)));

const reponse = await page.goto(`${BASE}/factures/${envoi.jeton}`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600);

// **La mise en page doit être posée avant de mesurer** : une boîte de zéro
// pixel n'est pas un succès, c'est une mesure impossible (`CLAUDE.md` §5).
const casePosee = page.locator('button[aria-pressed]').filter({ hasText: "reçu cette facture" });
const cadre = await casePosee.boundingBox();
const bouton = await page.locator("a", { hasText: "Télécharger ma facture" }).boundingBox();
console.log("statut", reponse?.status());
console.log(
  "la case est SOUS le bouton de téléchargement :",
  cadre && bouton ? cadre.y > bouton.y : "introuvable"
);
console.log("hauteur de la case :", cadre ? Math.round(cadre.height) : "aucune", "px (44 attendu au moins)");

await page.screenshot({ path: `${dossier}/client-avant.png`, fullPage: true });

await casePosee.click();
await page.waitForTimeout(1200);
console.log("après l'appui :", (await casePosee.innerText()).replace(/\n/g, " · "));
await page.screenshot({ path: `${dossier}/client-apres.png`, fullPage: true });

// Rechargée, la confirmation doit être retrouvée : sinon le client croirait son
// premier appui perdu.
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(600);
console.log("après rechargement :", (await casePosee.innerText()).replace(/\n/g, " · "));
await page.screenshot({ path: `${dossier}/client-rechargee.png`, fullPage: true });

console.log("erreurs de page :", erreurs.length ? erreurs : "aucune");
await navigateur.close();
await fermerLimiteur();
await pool.end();
