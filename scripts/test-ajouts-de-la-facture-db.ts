import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import {
  ajouterLigneDeFacture,
  ajouterMainDoeuvreDeFacture,
  creerFactureSansDevis,
  emettreFacture,
  getFacturePourChantier,
  majLigneDeFacture,
  terminerChantier,
} from "../src/server/repositories/factures";
import { ligneDuChoix } from "../src/server/chiffrage/main-oeuvre-choisie";
import type { LigneDeMainOeuvre } from "../src/lib/feuille-main-oeuvre";
import type { Ctx } from "../src/server/repositories/context";

/**
 * LES AJOUTS DU DEVIS SUR LA FACTURE, PAR LE DÉPÔT — sa planche du 4 novembre
 * 2026 (`appli/soignee/facture.html`, page « ts »), sous `atlas_app`, donc
 * sous la RLS (`CLAUDE.md` §5).
 *
 * Sa remarque : *« la facture, quand on crée une facture, n'a pas été modifiée
 * comme la facture suivie d'un devis. Le bouton ma TVA, main d'œuvre, est le
 * même qu'à l'ancienne. »* Les pastilles ouvrent désormais les feuilles du
 * devis ; ce que la suite tient, c'est ce que la BASE en reçoit :
 *
 *   · la main d'œuvre de son équipe arrive en ligne, en jours d'homme au prix
 *     du jour, recalculée au serveur par la fonction du devis (`ligneDuChoix`) ;
 *   · « dont main d'œuvre HT » la compte, borné au total HT ; à chiffrer, il
 *     ne bouge pas ;
 *   · sur une facture née d'un devis, c'est un travail EN PLUS, et le devis ne
 *     bouge pas ;
 *   · le taux d'une TVA tapée se relit au serveur, comme sur le devis ;
 *   · une facture partie refuse tout.
 */

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const MAINTENANT = new Date("2026-11-04T10:00:00Z");

/** Ce que la feuille renvoie pour son équipe, relu au serveur comme l'action le fait. */
async function sonEquipe(ctx: Ctx, hommes: number, jours: number, tarif: string | null): Promise<LigneDeMainOeuvre> {
  const ligne = await ligneDuChoix(ctx, { qui: "equipe", hommes, jours, tarif });
  if ("raison" in ligne) throw new Error(`le choix de son équipe est refusé : ${ligne.raison}`);
  return ligne;
}

async function main() {
  await nettoyerBase();
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Eden Nature" },
    { email: `ajouts-facture-${Math.random().toString(36).slice(2)}@essai.local`, nom: "Patron" }
  );
  const ctx: Ctx = { utilisateurId, entrepriseId: entreprise.id };
  const client = await clientsRepo.creerClient(ctx, { nom: "Vasseur", civilite: "mme", telephone: "0698765432" });

  console.log("\n=== La facture faite sans devis ===\n");

  const chantierDirect = await chantiersRepo.creerChantier(ctx, {
    nom: "Haie du fond",
    adresseChantier: "14 chemin des Vignes, 44300 Nantes",
    clientId: client.id,
  });
  const directe = await creerFactureSansDevis(ctx, chantierDirect.id, MAINTENANT);
  const premiere = await ajouterLigneDeFacture(ctx, directe.id);
  assert.ok(premiere.ok);
  await majLigneDeFacture(ctx, directe.id, premiere.ligne.id, { libelle: "Taille de la haie", quantite: "1", prixUnitaire: "400" });

  await essai("son équipe : 2 hommes × 2 jours × 280 €, posés en jours d'homme, une ligne ordinaire", async () => {
    const pose = await ajouterMainDoeuvreDeFacture(ctx, directe.id, null, await sonEquipe(ctx, 2, 2, "280"));
    assert.ok(pose.ok, pose.ok ? "" : pose.raison);
    const f = await getFacturePourChantier(ctx, chantierDirect.id);
    const l = f?.lignes.find((x) => x.id === pose.ligne.id);
    assert.ok(l, "la ligne de main d'œuvre n'est pas en base");
    assert.deepEqual(
      { libelle: l.libelle, quantite: Number(l.quantite), unite: l.unite, pu: Number(l.prixUnitaire), montant: Number(l.montant), supplement: l.supplement },
      { libelle: "Main d’œuvre", quantite: 4, unite: "jour/homme", pu: 280, montant: 1120, supplement: false }
    );
    // L'écran range la ligne d'après ce que le serveur a écrit, jamais d'après une déduction.
    assert.equal(pose.ligne.supplement, false);
  });

  await essai("« dont main d'œuvre HT » la compte, et l'écran reçoit ce que la base a retenu", async () => {
    const f = await getFacturePourChantier(ctx, chantierDirect.id);
    assert.equal(f?.facture.mainDoeuvreHt, "1120.00");
  });

  await essai("dans la TVA où il a appuyé : une seconde main d'œuvre à 10 % s'ajoute à « dont »", async () => {
    const pose = await ajouterMainDoeuvreDeFacture(ctx, directe.id, "10.00", await sonEquipe(ctx, 1, 0.5, "280"));
    assert.ok(pose.ok, pose.ok ? "" : pose.raison);
    assert.equal(pose.ligne.tauxTva, "10.00");
    assert.equal(pose.mainDoeuvreHt, "1260.00");
    const f = await getFacturePourChantier(ctx, chantierDirect.id);
    assert.equal(f?.facture.mainDoeuvreHt, "1260.00");
  });

  await essai("sans prix du jour, elle arrive à chiffrer, et « dont » ne bouge pas", async () => {
    const pose = await ajouterMainDoeuvreDeFacture(ctx, directe.id, null, await sonEquipe(ctx, 2, 1, null));
    assert.ok(pose.ok, pose.ok ? "" : pose.raison);
    assert.equal(Number(pose.ligne.montant), 0);
    assert.equal(pose.mainDoeuvreHt, "1260.00", "une main d'œuvre sans prix a changé « dont »");
  });

  await essai("le taux d'une TVA se relit au serveur : 8,5 devient 8,50 ; « dix » se refuse avec ses mots", async () => {
    const tapee = await ajouterLigneDeFacture(ctx, directe.id, "8,5");
    assert.ok(tapee.ok, tapee.ok ? "" : tapee.raison);
    assert.equal(tapee.ligne.tauxTva, "8.50");
    const illisible = await ajouterLigneDeFacture(ctx, directe.id, "dix");
    assert.ok(!illisible.ok, "un taux illisible a été posé en base");
    assert.match(illisible.raison, /taux/);
    const mo = await ajouterMainDoeuvreDeFacture(ctx, directe.id, "dix", await sonEquipe(ctx, 1, 1, "280"));
    assert.ok(!mo.ok, "une main d'œuvre a été posée sous un taux illisible");
  });

  console.log("\n=== La facture née d'un devis ===\n");

  const chantier = await chantiersRepo.creerChantier(ctx, {
    nom: "Aménagement",
    adresseChantier: "14 chemin des Vignes, 44300 Nantes",
    clientId: client.id,
  });
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Terrassement et préparation du sol", "380.00", {
    quantite: "1",
    prixUnitaire: "380.00",
    unite: "forfait",
    mainDoeuvre: true,
  });
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Fourniture de gazon en rouleau", "780.00", {
    quantite: "120",
    prixUnitaire: "6.50",
    unite: "m²",
  });
  await devisRepo.envoyerDevis(ctx, (await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id)).id);
  await terminerChantier(ctx, chantier.id, MAINTENANT);
  const nee = await getFacturePourChantier(ctx, chantier.id);
  assert.ok(nee);
  const factureId = nee.facture.id;
  const avantDuDevis = nee.lignes.map((l) => ({ id: l.id, montant: l.montant }));

  await essai("elle est un travail EN PLUS, et « dont » ajoute sa part à celle du devis", async () => {
    assert.equal(nee.facture.mainDoeuvreHt, "380.00", "« dont » n'est pas repris du devis");
    const pose = await ajouterMainDoeuvreDeFacture(ctx, factureId, null, await sonEquipe(ctx, 2, 1, "280"));
    assert.ok(pose.ok, pose.ok ? "" : pose.raison);
    assert.equal(pose.ligne.supplement, true, "la main d'œuvre ajoutée sur la facture ne se range pas en plus");
    assert.equal(pose.mainDoeuvreHt, "940.00");
  });

  await essai("les lignes du devis n'ont pas bougé", async () => {
    const apres = await getFacturePourChantier(ctx, chantier.id);
    for (const l of avantDuDevis) {
      assert.equal(apres?.lignes.find((x) => x.id === l.id)?.montant, l.montant, "une ligne acceptée a été réécrite");
    }
  });

  console.log("\n=== Une facture partie ===\n");

  await essai("une facture arrêtée ne reçoit plus de main d'œuvre", async () => {
    await emettreFacture(ctx, factureId, MAINTENANT);
    const pose = await ajouterMainDoeuvreDeFacture(ctx, factureId, null, await sonEquipe(ctx, 1, 1, "280"));
    assert.ok(!pose.ok, "une main d'œuvre s'est posée sur une facture partie");
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Les ajouts du devis sur la facture, en base — ${echecs} échec(s).`);
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
