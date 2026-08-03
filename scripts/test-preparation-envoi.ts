import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import { preparerEnvoi, premiersJoursLibres } from "../src/server/repositories/preparation-envoi";
import { versJourIso, ajouterJours, fenetreProposition, compterOccupation } from "../src/server/disponibilites";

// Depuis les créneaux (migration 0019), la disponibilité dépend du chantier
// qu'on cherche à caler : une demi-journée tient là où une journée entière ne
// tient plus. Ces contrôles-ci raisonnent donc sur une journée entière, la
// durée par défaut — c'est-à-dire exactement leur hypothèse d'origine.
const UNE_JOURNEE = 2;
const RIEN_DE_PLANIFIE = { occupation: compterOccupation([]), nombreEquipes: 1, dureeDemiJournees: UNE_JOURNEE };
import { nettoyerBase } from "./_test-db";

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

// Un lundi, pour que les calculs de jours ouvrés soient lisibles.
const LUNDI = new Date("2026-03-02T09:00:00Z");
const dans = (n: number) => versJourIso(ajouterJours(LUNDI, n));

async function contexte(email: string) {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Atelier" },
    { email }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

async function main() {
  await nettoyerBase();

  await test("les jours suggérés sautent samedis et dimanches", async () => {
    const libres = premiersJoursLibres(LUNDI, RIEN_DE_PLANIFIE, 6);
    for (const j of libres) {
      const jour = new Date(`${j}T00:00:00Z`).getUTCDay();
      assert.notStrictEqual(jour, 0, `${j} est un dimanche`);
      assert.notStrictEqual(jour, 6, `${j} est un samedi`);
    }
    assert.strictEqual(libres.length, 6);
  });

  await test("les jours suggérés respectent le délai minimal", async () => {
    const fenetre = fenetreProposition(LUNDI);
    for (const j of premiersJoursLibres(LUNDI, RIEN_DE_PLANIFIE, 6)) {
      assert.ok(j >= fenetre.debut, `${j} tombe avant le délai minimal`);
    }
  });

  await test("un jour occupé n'est jamais suggéré", async () => {
    const libres = premiersJoursLibres(LUNDI, RIEN_DE_PLANIFIE, 6);
    const aOccuper = libres[0];
    const apres = premiersJoursLibres(
      LUNDI,
      {
        occupation: compterOccupation([{ jour: aOccuper, moment: "matin", dureeDemiJournees: UNE_JOURNEE }]),
        nombreEquipes: 1,
        dureeDemiJournees: UNE_JOURNEE,
      },
      6
    );
    assert.ok(!apres.includes(aOccuper), "le jour occupé est encore suggéré");
    assert.strictEqual(apres.length, 6, "la liste doit rester complète");
  });

  await test("sans canal renseigné, l'envoi est bloqué", async () => {
    const ctx = await contexte(`sanscanal-${Date.now()}@t.test`);
    const client = await clientsRepo.creerClient(ctx, { nom: "Mme Martin", telephone: "0600000000" });
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Élagage", clientId: client.id });
    await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);

    const p = await preparerEnvoi(ctx, chantier.id, LUNDI);
    assert.strictEqual(p.blocage, "canal_absent");
    assert.strictEqual(p.canal, null);
  });

  await test("canal SMS sans téléphone : bloqué avec le bon motif", async () => {
    const ctx = await contexte(`sanstel-${Date.now()}@t.test`);
    const client = await clientsRepo.creerClient(ctx, { nom: "M. Dupont" });
    await clientsRepo.mettreAJourClient(ctx, client.id, { canalCommunication: "sms" });
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Abattage", clientId: client.id });
    await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);

    const p = await preparerEnvoi(ctx, chantier.id, LUNDI);
    assert.strictEqual(p.blocage, "coordonnee_absente");
  });

  await test("canal et coordonnée présents : rien ne bloque", async () => {
    const ctx = await contexte(`ok-${Date.now()}@t.test`);
    const client = await clientsRepo.creerClient(ctx, { nom: "Mme Costa", telephone: "0611223344" });
    await clientsRepo.mettreAJourClient(ctx, client.id, { canalCommunication: "sms" });
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Taille", clientId: client.id });
    await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);

    const p = await preparerEnvoi(ctx, chantier.id, LUNDI);
    assert.strictEqual(p.blocage, null);
    assert.strictEqual(p.canal, "sms");
    assert.strictEqual(p.destinataire, "0611223344");
    assert.strictEqual(p.clientNom, "Mme Costa");
    assert.ok(p.joursLibres.length > 0);
  });

  await test("les jours déjà pris remontent bien depuis la base", async () => {
    const ctx = await contexte(`occupes-${Date.now()}@t.test`);
    const client = await clientsRepo.creerClient(ctx, { nom: "M. Faucher", email: "f@ex.test" });
    await clientsRepo.mettreAJourClient(ctx, client.id, { canalCommunication: "email" });
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Haie", clientId: client.id });
    await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);

    const autre = await chantiersRepo.creerChantier(ctx, { nom: "Déjà calé" });
    await chantiersRepo.planifierChantier(ctx, autre.id, dans(15));

    const p = await preparerEnvoi(ctx, chantier.id, LUNDI);
    assert.ok(p.joursOccupes.includes(dans(15)), "le jour occupé n'est pas remonté");
    assert.ok(!p.joursLibres.includes(dans(15)), "un jour occupé est suggéré");
  });

  console.log(`\n${passed} réussis, ${failed} échoués`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
