/**
 * DEUX JOURS QUI NE SE TOUCHENT PAS — le chantier prend LES JOURS QU'IL A POSÉS.
 *
 * Sa question du 17 septembre 2026, capture à l'appui : *« un chantier de deux
 * jours, je veux lui proposer le premier jour le 18 et on vient finir le
 * chantier le 22 — comment je fais ? »*. Avant ce lot, la date retenue devenait
 * un bloc d'un seul tenant (`creneauxDuChantier`) : le 18 acceptée, le 19 pris,
 * et le 22 jamais.
 *
 * Ce que cette suite garde, sur la base :
 *   · un envoi porte les jours de chaque proposition, et l'acceptation écrit
 *     CES jours-là — pas le lendemain ;
 *   · une proposition d'affilée se comporte comme avant, au créneau près ;
 *   · deux propositions, la cliente en choisit une par son premier jour, et
 *     c'est sa liste à elle qui se pose ;
 *   · un envoi d'avant la migration 0095 (sans liste) se pose comme toujours ;
 *   · le serveur refuse une liste qui ne dit pas ce que dit la durée.
 *
 *   npx tsx scripts/test-envoi-jours-pas-colles-db.ts   (sur atlas_test)
 */
import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import { creerEnvoi, enregistrerReponse, lireParJeton } from "../src/server/repositories/envois-devis";
import { versJourIso, ajouterJours } from "../src/lib/disponibilites";
import { nettoyerBase } from "./_test-db";

let reussis = 0;
let echoues = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    reussis++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    echoues++;
  }
}

// Un mardi : les jours ouvrés qui suivent se comptent sans surprise de week-end.
const MARDI = new Date("2026-03-03T09:00:00Z");
const dans = (n: number) => versJourIso(ajouterJours(MARDI, n));

async function contexte(email: string) {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise({ nom: "Élagage Éden" }, { email });
  return { utilisateurId, entrepriseId: entreprise.id };
}

async function chantierPret(ctx: { utilisateurId: string; entrepriseId: string }, nom: string, dureePrevue: string) {
  const client = await clientsRepo.creerClient(ctx, { nom: "Mme Linotte", email: "linotte@test.local" });
  await clientsRepo.mettreAJourClient(ctx, client.id, { canalCommunication: "email" });
  const chantier = await chantiersRepo.creerChantier(ctx, { nom, clientId: client.id });
  await chantiersRepo.mettreAJourDureeEquipe(ctx, chantier.id, { dureePrevue });
  const devis = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  return { chantierId: chantier.id, devisId: devis.id };
}

const cles = (creneaux: readonly { jour: string; moment: string }[]) =>
  creneaux.map((c) => `${c.jour}:${c.moment}`).sort();

async function main() {
  await nettoyerBase();

  // Mardi + 7 = mardi ; + 8 = mercredi ; + 11 = samedi → on vise +7 et +13 (lundi).
  const LE_18 = dans(7);
  const LE_19 = dans(8);
  const LE_22 = dans(13);

  await test("le 18 et le 22 : l'acceptation pose ces deux jours, et pas le 19", async () => {
    const ctx = await contexte(`pas-colles-${Date.now()}@t.test`);
    const c = await chantierPret(ctx, "Taille de haie", "2 jours");
    const envoi = await creerEnvoi(
      ctx,
      {
        chantierId: c.chantierId,
        devisId: c.devisId,
        canal: "email",
        datesProposees: [LE_18],
        joursProposes: [[LE_18, LE_22]],
        contenuDevis: "A",
      },
      MARDI
    );
    const lu = await lireParJeton(envoi.jeton, MARDI);
    assert.deepEqual(lu?.joursProposes, [[LE_18, LE_22]], "La page du client ne reçoit pas les jours proposés.");

    const r = await enregistrerReponse(envoi.jeton, { decision: "accepte", dateRetenue: LE_18 }, MARDI);
    assert.equal(r.succes, true, "L'acceptation a été refusée.");
    const poses = await chantiersRepo.creneauxDunChantier(ctx, c.chantierId);
    assert.deepEqual(
      cles(poses),
      cles([
        { jour: LE_18, moment: "matin" },
        { jour: LE_18, moment: "apres_midi" },
        { jour: LE_22, moment: "matin" },
        { jour: LE_22, moment: "apres_midi" },
      ]),
      `Le chantier s'est posé sur ${cles(poses).join(", ")}`
    );
    assert.ok(!poses.some((p) => p.jour === LE_19), "Le 19 a été pris alors qu'il avait été effacé.");
  });

  await test("un bloc d'affilée se pose comme avant", async () => {
    const ctx = await contexte(`bloc-${Date.now()}@t.test`);
    const c = await chantierPret(ctx, "Tonte", "2 jours");
    const envoi = await creerEnvoi(
      ctx,
      {
        chantierId: c.chantierId,
        devisId: c.devisId,
        canal: "email",
        datesProposees: [LE_18],
        joursProposes: [[LE_18, LE_19]],
        contenuDevis: "B",
      },
      MARDI
    );
    const r = await enregistrerReponse(envoi.jeton, { decision: "accepte", dateRetenue: LE_18 }, MARDI);
    assert.equal(r.succes, true);
    const poses = await chantiersRepo.creneauxDunChantier(ctx, c.chantierId);
    assert.deepEqual(new Set(poses.map((p) => p.jour)), new Set([LE_18, LE_19]));
  });

  await test("deux propositions : la cliente choisit la seconde par son premier jour, et c'est sa liste qui se pose", async () => {
    const ctx = await contexte(`deux-${Date.now()}@t.test`);
    const c = await chantierPret(ctx, "Plantation", "2 jours");
    const LE_23 = dans(14);
    const LE_25 = dans(16);
    const envoi = await creerEnvoi(
      ctx,
      {
        chantierId: c.chantierId,
        devisId: c.devisId,
        canal: "email",
        datesProposees: [LE_18, LE_23],
        joursProposes: [[LE_18, LE_22], [LE_23, LE_25]],
        contenuDevis: "C",
      },
      MARDI
    );
    const r = await enregistrerReponse(envoi.jeton, { decision: "accepte", dateRetenue: LE_23 }, MARDI);
    assert.equal(r.succes, true, "L'acceptation de la seconde a été refusée.");
    const poses = await chantiersRepo.creneauxDunChantier(ctx, c.chantierId);
    assert.deepEqual(new Set(poses.map((p) => p.jour)), new Set([LE_23, LE_25]));
  });

  await test("une demi-journée sur des jours séparés : le dernier jour ne prend que le matin", async () => {
    const ctx = await contexte(`impaire-${Date.now()}@t.test`);
    const c = await chantierPret(ctx, "Élagage", "1,5 jour");
    const envoi = await creerEnvoi(
      ctx,
      {
        chantierId: c.chantierId,
        devisId: c.devisId,
        canal: "email",
        datesProposees: [LE_18],
        joursProposes: [[LE_18, LE_22]],
        contenuDevis: "D",
      },
      MARDI
    );
    const r = await enregistrerReponse(envoi.jeton, { decision: "accepte", dateRetenue: LE_18 }, MARDI);
    assert.equal(r.succes, true);
    const poses = await chantiersRepo.creneauxDunChantier(ctx, c.chantierId);
    assert.deepEqual(
      cles(poses),
      cles([
        { jour: LE_18, moment: "matin" },
        { jour: LE_18, moment: "apres_midi" },
        { jour: LE_22, moment: "matin" },
      ])
    );
  });

  await test("sans liste (un envoi d'avant), le bloc d'affilée se pose comme toujours", async () => {
    const ctx = await contexte(`avant-${Date.now()}@t.test`);
    const c = await chantierPret(ctx, "Débroussaillage", "2 jours");
    const envoi = await creerEnvoi(
      ctx,
      { chantierId: c.chantierId, devisId: c.devisId, canal: "email", datesProposees: [LE_18], contenuDevis: "E" },
      MARDI
    );
    const r = await enregistrerReponse(envoi.jeton, { decision: "accepte", dateRetenue: LE_18 }, MARDI);
    assert.equal(r.succes, true);
    const poses = await chantiersRepo.creneauxDunChantier(ctx, c.chantierId);
    assert.deepEqual(new Set(poses.map((p) => p.jour)), new Set([LE_18, LE_19]));
  });

  await test("le serveur refuse une liste qui ne compte pas les jours de la durée, ou dont le premier jour n'est pas la date", async () => {
    const ctx = await contexte(`refus-${Date.now()}@t.test`);
    const c = await chantierPret(ctx, "Clôture", "2 jours");
    await assert.rejects(
      creerEnvoi(
        ctx,
        { chantierId: c.chantierId, devisId: c.devisId, canal: "email", datesProposees: [LE_18], joursProposes: [[LE_18]], contenuDevis: "F" },
        MARDI
      ),
      /jour/i,
      "Une liste d'un seul jour pour deux jours de chantier est passée."
    );
    await assert.rejects(
      creerEnvoi(
        ctx,
        { chantierId: c.chantierId, devisId: c.devisId, canal: "email", datesProposees: [LE_18], joursProposes: [[LE_19, LE_22]], contenuDevis: "F" },
        MARDI
      ),
      /premier jour/i,
      "Une liste dont le premier jour n'est pas la date proposée est passée."
    );
  });

  console.log(`\n${reussis} réussi(s), ${echoues} échoué(s)`);
  await pool.end();
  process.exit(echoues === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
