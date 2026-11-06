/* =======================================================================
   Le plafond de la franchise, dans la base : le compte d'une entreprise,
   jamais celui d'une autre, et l'arrêt dans l'émission elle-même.

   Sa planche du 5 novembre 2026, A ET B le 6 novembre. La règle pure se
   joue dans `test-franchise-plafond.ts` ; ici, ce que seule la base dit :
   quelles factures comptent (émises, de l'année, de CETTE entreprise), et
   qu'aucune facture ne passe le plafond majoré sans son « L'envoyer sans
   TVA », puisque l'arrêt vit dans `emettreFacture`, par où toute facture
   passe.

   Suite base, sous `atlas_app` : la RLS est posée par `withEntreprise`, et
   le compte d'Eden Nature ne doit pas voir les factures de la voisine.
   ======================================================================= */
import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import {
  ajouterLigneDeFacture,
  creerFactureSansDevis,
  emettreFacture,
  FacturePasseLePlafondError,
  getFacturePourChantier,
  majLigneDeFacture,
} from "../src/server/repositories/factures";
import { compteDeLaFranchise } from "../src/server/repositories/franchise-plafond";
import type { Ctx } from "../src/server/repositories/context";

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

const MAINTENANT = new Date("2026-11-06T10:00:00Z");
const L_AN_DERNIER = new Date("2025-12-30T10:00:00Z");

async function uneEntreprise(nom: string, regime: "franchise" | "assujettie"): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom },
    { email: `franchise-${Math.random().toString(36).slice(2)}@essai.local`, nom: "Patron" }
  );
  const ctx: Ctx = { utilisateurId, entrepriseId: entreprise.id };
  await entreprisesRepo.mettreAJourEntreprise(ctx, { regimeTva: regime });
  return ctx;
}

/** Une facture faite sans devis, d'une seule ligne au montant donné, en brouillon. */
let rang = 0;
async function uneFacture(ctx: Ctx, montant: string, quand: Date = MAINTENANT): Promise<{ id: string; chantierId: string }> {
  // Un client neuf par facture, nom et téléphone distincts : aucun rapprochement ne les réunit.
  rang++;
  const client = await clientsRepo.creerClient(ctx, {
    nom: `Vasseur ${rang}`,
    civilite: "mme",
    telephone: `06987654${String(rang).padStart(2, "0")}`,
  });
  const chantier = await chantiersRepo.creerChantier(ctx, {
    nom: "Entretien du jardin",
    adresseChantier: "14 chemin des Vignes, 44300 Nantes",
    clientId: client.id,
  });
  const facture = await creerFactureSansDevis(ctx, chantier.id, quand);
  const ligne = await ajouterLigneDeFacture(ctx, facture.id);
  assert.ok(ligne.ok, ligne.ok ? "" : ligne.raison);
  await majLigneDeFacture(ctx, facture.id, ligne.ligne.id, { libelle: "Entretien", quantite: "1", prixUnitaire: montant });
  return { id: facture.id, chantierId: chantier.id };
}

async function main() {
  await nettoyerBase();
  const eden = await uneEntreprise("Eden Nature", "franchise");
  const voisine = await uneEntreprise("Jardins de la voisine", "franchise");
  const assujettie = await uneEntreprise("Paysages assujettis", "assujettie");

  console.log("\n=== Ce qui compte, et pour qui ===\n");

  await emettreFacture(eden, (await uneFacture(eden, "30000")).id, MAINTENANT);
  await emettreFacture(voisine, (await uneFacture(voisine, "20000")).id, MAINTENANT);

  await essai("le compte d'Eden Nature : sa facture émise de l'année, et rien de la voisine", async () => {
    const { regime, compte } = await compteDeLaFranchise(eden, MAINTENANT);
    assert.equal(regime, "franchise");
    assert.equal(compte.totalCentimes, 3_000_000, "le compte a vu une facture qui n'est pas la sienne");
    assert.equal(compte.factures.nombre, 1);
    assert.equal(compte.etat, "proche");
  });

  await essai("la voisine ne voit pas non plus celles d'Eden Nature", async () => {
    const { compte } = await compteDeLaFranchise(voisine, MAINTENANT);
    assert.equal(compte.totalCentimes, 2_000_000);
  });

  await essai("un brouillon ne compte pas : il n'est parti chez personne", async () => {
    await uneFacture(eden, "5000");
    const { compte } = await compteDeLaFranchise(eden, MAINTENANT);
    assert.equal(compte.totalCentimes, 3_000_000);
  });

  await essai("une facture de l'an dernier ne compte pas dans l'année", async () => {
    await emettreFacture(eden, (await uneFacture(eden, "1000", L_AN_DERNIER)).id, L_AN_DERNIER);
    const { compte } = await compteDeLaFranchise(eden, MAINTENANT);
    assert.equal(compte.totalCentimes, 3_000_000);
    const avant = await compteDeLaFranchise(eden, L_AN_DERNIER);
    assert.equal(avant.compte.totalCentimes, 100_000);
  });

  console.log("\n=== L'arrêt, dans l'émission elle-même ===\n");

  const lambert = await uneFacture(eden, "12000");

  await essai("30 000 + 12 000 passent le plafond majoré : l'émission s'arrête, avec le compte", async () => {
    await assert.rejects(
      () => emettreFacture(eden, lambert.id, MAINTENANT),
      (err: unknown) => {
        assert.ok(err instanceof FacturePasseLePlafondError, `attendu l'arrêt du plafond, reçu ${String(err)}`);
        assert.equal(err.arret.avecElleCentimes, 4_200_000);
        assert.equal(err.arret.factureCentimes, 1_200_000);
        assert.equal(err.arret.dejaPasse, false);
        return true;
      }
    );
  });

  await essai("arrêtée, elle reste un brouillon : rien n'est parti, rien n'est numéroté", async () => {
    const f = await getFacturePourChantier(eden, lambert.chantierId);
    assert.equal(f?.facture.statut, "brouillon");
  });

  await essai("« L'envoyer sans TVA » la fait partir, et le compte la porte", async () => {
    const emise = await emettreFacture(eden, lambert.id, MAINTENANT, { malgreLePlafond: true });
    assert.equal(emise.statut, "emise");
    const { compte } = await compteDeLaFranchise(eden, MAINTENANT);
    assert.equal(compte.totalCentimes, 4_200_000);
    assert.equal(compte.etat, "majore_passe");
  });

  await essai("le plafond déjà passé : la suivante s'arrête encore, et le dit", async () => {
    const suivante = await uneFacture(eden, "100");
    await assert.rejects(
      () => emettreFacture(eden, suivante.id, MAINTENANT),
      (err: unknown) => err instanceof FacturePasseLePlafondError && err.arret.dejaPasse
    );
  });

  await essai("une entreprise Assujettie n'est jamais arrêtée, même à 50 000 €", async () => {
    const f = await uneFacture(assujettie, "50000");
    const emise = await emettreFacture(assujettie, f.id, MAINTENANT);
    assert.equal(emise.statut, "emise");
    const { regime } = await compteDeLaFranchise(assujettie, MAINTENANT);
    assert.equal(regime, "assujettie");
  });

  console.log(echecs ? `\n❌ ${echecs} échec(s).` : "\n✅ Le compte de la franchise ne voit que ses factures, et l'émission s'arrête au plafond majoré.");
  await pool.end();
  if (echecs) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
