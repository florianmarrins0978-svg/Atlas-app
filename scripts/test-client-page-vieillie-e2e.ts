import assert from "node:assert/strict";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as devisRepo from "../src/server/repositories/devis";
import * as clientsRepo from "../src/server/repositories/clients";
import { creerEnvoi, lireParJeton } from "../src/server/repositories/envois-devis";
import { versJourIso, ajouterJours } from "../src/lib/disponibilites";
import { ADRESSE } from "./_adresse";

// **« Lorsque le client choisit sa date, voilà ce que l'appli dit. »** Le
// patron, le 17 octobre 2026 à 23 h 17 : « Une erreur, cette page n'a pas pu
// s'afficher », un bouton « Réessayer », et ni notification ni chantier au
// planning.
//
// Son espace installait une nouvelle version pendant que la page de son client
// était ouverte. L'acceptation partait donc avec l'identifiant d'action de
// l'ancienne version ; le serveur neuf la refusait comme inconnue, et
// `useActionState` jetait ce refus jusqu'à l'écran d'erreur. « Réessayer »
// refait le même rendu avec la même action périmée : il échoue à l'identique,
// autant de fois qu'on appuie. Le client était dans une impasse.
//
// `src/lib/reprise-erreur.ts` savait déjà sortir de cette impasse pour un
// MORCEAU de code disparu (recharger seul, une fois). Il ne reconnaissait pas
// l'autre visage de la même page vieillie : l'action disparue.
//
// La page vieillie est fabriquée contre le VRAI serveur : chaque appel
// d'action part avec un identifiant que la version servie ne connaît pas.

const BASE = ADRESSE;

async function main() {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Atelier de la page vieillie" },
    { email: `client-vieillie-${Date.now()}@atlas.test` }
  );
  const ctx = { utilisateurId, entrepriseId: entreprise.id };
  const client = await clientsRepo.creerClient(ctx, {
    nom: "Huguette Groupiron",
    civilite: "mme",
    telephone: "06 12 34 56 78",
  });
  const chantier = await chantiersRepo.creerChantier(ctx, {
    nom: "Taille de la haie",
    adresseChantier: "5 avenue de la République",
    clientId: client.id,
  });
  const d = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  const maintenant = new Date();
  const dateVoulue = versJourIso(ajouterJours(maintenant, 24));
  const envoi = await creerEnvoi(
    ctx,
    {
      chantierId: chantier.id,
      devisId: d.id,
      canal: "sms",
      datesProposees: [versJourIso(ajouterJours(maintenant, 20)), dateVoulue],
      contenuDevis: "devis-page-vieillie",
    },
    maintenant
  );

  const navigateur = await lancerNavigateur();
  const page = await (await navigateur.newContext({ viewport: { width: 390, height: 664 } })).newPage();
  await page.goto(`${BASE}/devis/${envoi.jeton}`, { waitUntil: "networkidle" });

  // La page est ouverte : l'espace « bascule » maintenant.
  let vieillie = true;
  await page.route("**/*", async (route) => {
    const entetes = route.request().headers();
    if (!vieillie || !entetes["next-action"]) return route.continue();
    await route.continue({ headers: { ...entetes, "next-action": "0".repeat(42) } });
  });

  await page.locator(`input[name="choixDate"][value="${dateVoulue}"]`).check();
  const rechargement = page.waitForEvent("load", { timeout: 20_000 }).catch(() => null);
  await page.click('button:has-text("J\'accepte ce devis")');

  // --- 1. Pas d'impasse : la page se recharge seule --------------------------
  const recharge = await rechargement;
  // Rechargée, elle porte les identifiants de la version servie.
  vieillie = false;
  await page.waitForLoadState("networkidle");
  const impasse = await page.locator("text=Cette page n'a pas pu s'afficher").count();
  assert.ok(
    recharge && impasse === 0,
    "Le client reste devant « Une erreur » et « Réessayer », qui rejoue la même action périmée."
  );
  assert.equal((await lireParJeton(envoi.jeton))?.reponse ?? null, null, "Une réponse est partie avec une action inconnue.");
  console.log("  ✓ une acceptation partie d'une page vieillie recharge la page, sans impasse");

  // --- 2. Rechargée, son choix aboutit, et le chantier se planifie ----------
  await page.locator(`input[name="choixDate"][value="${dateVoulue}"]`).check();
  await page.click('button:has-text("J\'accepte ce devis")');
  await page.waitForSelector("text=Votre artisan est prévenu", { timeout: 15_000 });
  assert.equal((await lireParJeton(envoi.jeton))?.reponse, "acceptee");
  assert.equal((await chantiersRepo.getChantier(ctx, chantier.id))?.datePlanifiee, dateVoulue);
  console.log("  ✓ rechargée, son acceptation part et le chantier se planifie");

  await navigateur.close();
  await pool.end();
  console.log("✅ Un client sur une page vieillie n'est jamais dans une impasse.");
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
