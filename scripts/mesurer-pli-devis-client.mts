/**
 * Le pli de l'écran du client, CALENDRIER OUVERT.
 *
 * Sa règle du 31 août 2026 : *« je veux que le choix de la date qui arrive au
 * client par SMS tienne sur une seule page ! Il ne doit pas avoir à scroll pour
 * voir toutes les infos »*.
 *
 * `test-devis-client-e2e.ts` l'éprouve — mais son commentaire annonce « la
 * contre-proposition ouverte » alors qu'il ne la clique jamais : il mesure la
 * page repliée. Ce script mesure les deux, pour savoir avant de corriger.
 *
 * Demande le serveur en marche :
 *   npm run dev -- -p 3000
 *   npx tsx --env-file=.env scripts/mesurer-pli-devis-client.mts
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
  { nom: "Arborea" },
  { email: `pli-${Date.now()}@atlas.test` }
);
const ctx = { utilisateurId, entrepriseId: entreprise.id };
const client = await clientsRepo.creerClient(ctx, { nom: "Huguette Groupiron", civilite: "mme" });
const chantier = await chantiersRepo.creerChantier(ctx, {
  nom: "Taille de haies",
  adresseChantier: "Rue du Tourigou 29950 Bénodet",
  clientId: client.id,
});
await prixRepo.ajouterLignePrix(ctx, chantier.id, "Taille de haies 40 ml", "200.00");
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
    contenuDevis: "pli",
  },
  maintenant
);

const nav = await lancerNavigateur();
// Son écran, barre d'adresse déduite — la mesure du dépôt depuis le 30 août.
const page = await (await nav.newContext({ viewport: { width: 390, height: 664 } })).newPage();
await page.goto(`http://localhost:3000/devis/${envoi.jeton}`, { waitUntil: "networkidle" });

const mesurer = async (quoi: string) => {
  const m = await page.evaluate(() => ({
    page: document.documentElement.scrollHeight,
    ecran: window.innerHeight,
    dernier: document.querySelector('button[value="refuse"]')?.getBoundingClientRect().bottom ?? 0,
  }));
  const verdict = m.page <= m.ecran && m.dernier <= m.ecran ? "✅ tient" : "❌ DÉBORDE";
  console.log(
    `${verdict}  ${quoi} — page ${m.page} px, écran ${m.ecran} px, dernier bouton à ${Math.round(m.dernier)} px`
  );
  return m;
};

await mesurer("replié (ce que la suite mesure)");
await page.screenshot({ path: "/tmp/captures/pli-1-replie.png" });

await page.locator('input[name="choixDate"][value="autre"]').check();
await page.waitForTimeout(300);
await mesurer("CALENDRIER OUVERT (ce qu'elle annonce)");
await page.screenshot({ path: "/tmp/captures/pli-2-calendrier.png", fullPage: true });

// Un jour proche : la case de rétractation s'ajoute par-dessus.
const proche = versJourIso(ajouterJours(maintenant, 4));
const case_ = page.locator(`[data-jour="${proche}"]`);
if (await case_.count()) {
  await case_.click();
  await page.waitForTimeout(300);
  await mesurer("calendrier + case de rétractation");
  await page.screenshot({ path: "/tmp/captures/pli-3-retractation.png", fullPage: true });
}

await nav.close();
await pool.end();
