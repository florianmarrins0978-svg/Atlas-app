/**
 * Les trois écrans du client, sous les yeux — parce qu'un vert ne les montre pas.
 *
 * Trois défauts réels de ce dépôt ont été trouvés sur une capture et par aucun
 * test (`CLAUDE.md` §5). Cet écran-ci est le seul que le client voit, et il a
 * changé le 31 août 2026 : il doit tenir dans un téléphone, et redonner le
 * devis à qui revient après l'avoir accepté.
 *
 * Demande un serveur en marche :
 *
 *   DATABASE_URL=… npm run dev -- -p 3000
 *   DATABASE_URL=… npx tsx scripts/capture-devis-client.mts
 */
import { lancerNavigateur } from "./e2e-browser";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import { creerEnvoi } from "../src/server/repositories/envois-devis";
import { versJourIso, ajouterJours } from "../src/server/disponibilites";
import { pool } from "../src/server/db/client";

const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
  { nom: "Atlas" },
  { email: `capture-${Date.now()}@atlas.test` }
);
const ctx = { utilisateurId, entrepriseId: entreprise.id };
const client = await clientsRepo.creerClient(ctx, { nom: "Huguette Groupiron", civilite: "mme" });
const chantier = await chantiersRepo.creerChantier(ctx, {
  nom: "Taille de haies",
  adresseChantier: "Rue du Tourigou 29950 Bénodet",
  clientId: client.id,
});
await prixRepo.ajouterLignePrix(ctx, chantier.id, "Taille de haies 40 ml", "200.00");
await prixRepo.ajouterLignePrix(ctx, chantier.id, "Taille des graminées", "200.00");
await prixRepo.ajouterLignePrix(ctx, chantier.id, "Menus travaux", "150.00");
const d = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
await devisRepo.envoyerDevis(ctx, d.id);
const maintenant = new Date();
const envoi = await creerEnvoi(
  ctx,
  {
    chantierId: chantier.id,
    devisId: d.id,
    canal: "sms",
    datesProposees: [3, 10].map((n) => versJourIso(ajouterJours(maintenant, n))),
    contenuDevis: "capture",
  },
  maintenant
);

const nav = await lancerNavigateur();
const page = await (await nav.newContext()).newPage();
await page.goto(`http://localhost:3000/devis/${envoi.jeton}`, { waitUntil: "networkidle" });
await page.screenshot({ path: "/tmp/captures/client-1-choix.png" });
await page.locator(`input[name="choixDate"][value="${versJourIso(ajouterJours(maintenant, 3))}"]`).check();
await page.click('button:has-text("J\'accepte ce devis")');
await page.waitForSelector("text=Votre artisan est prévenu");
await page.screenshot({ path: "/tmp/captures/client-2-accepte.png" });
await page.goto(`http://localhost:3000/devis/${envoi.jeton}`, { waitUntil: "networkidle" });
await page.screenshot({ path: "/tmp/captures/client-3-retour.png" });
await nav.close();
await pool.end();
console.log("Captures dans /tmp/captures : client-1-choix, client-2-accepte, client-3-retour");
