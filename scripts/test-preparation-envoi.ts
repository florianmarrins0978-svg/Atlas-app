import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import { creerEnvoi, lireParJeton } from "../src/server/repositories/envois-devis";
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
  // **L'identité est complète, et c'est délibéré.** Depuis le 14 août 2026 un
  // devis ne part pas sans nom, adresse, SIRET ni IBAN (`ARCHITECTURE.md` §97),
  // et ce blocage passe AVANT ceux du canal. Une entreprise à moitié remplie
  // ferait donc rougir les trois contrôles ci-dessous en accusant l'identité,
  // alors que le sujet de cette suite est le canal du client.
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    {
      nom: "Atelier",
      adresse: "10 rue des Artisans, Nantes",
      siret: "12345678900012",
      iban: "FR7630001007941234567890185",
    },
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

  await test("son calendrier barre un jour pris dans DIX MOIS", async () => {
    // **Sa demande du 9 août 2026 :** *« tu peux aller jusqu'à douze mois
    // d'occupation. »* Avant, l'occupation n'était lue que sur trois mois : un
    // jour déjà pris en février s'affichait libre en août, et le serveur ne le
    // refusait qu'après coup — au moment précis où il venait de le choisir.
    const ctx = await contexte(`lointain-${Date.now()}@t.test`);
    const client = await clientsRepo.creerClient(ctx, { nom: "M. Faucher", email: "f@ex.test" });
    await clientsRepo.mettreAJourClient(ctx, client.id, { canalCommunication: "email" });
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Haie", clientId: client.id });
    await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);

    const autre = await chantiersRepo.creerChantier(ctx, { nom: "Déjà calé, très loin" });
    await chantiersRepo.planifierChantier(ctx, autre.id, dans(300));

    const p = await preparerEnvoi(ctx, chantier.id, LUNDI);
    assert.ok(
      p.joursOccupes.includes(dans(300)),
      "un jour pris dans dix mois s'affiche libre : le patron le proposera, et le serveur le refusera après coup"
    );
  });

  await test("mais PAS au-delà des douze mois — la queue reste au serveur", async () => {
    // La réserve, tenue par un contrôle plutôt que par un commentaire : au-delà
    // de son chiffre, le calendrier ne barre rien et c'est `verifierJourPropose`
    // qui tranche. Élargir en silence coûterait une requête plus lourde à chaque
    // ouverture de l'écran, pour un cas rare.
    const ctx = await contexte(`au-dela-${Date.now()}@t.test`);
    const client = await clientsRepo.creerClient(ctx, { nom: "M. Faucher", email: "f2@ex.test" });
    await clientsRepo.mettreAJourClient(ctx, client.id, { canalCommunication: "email" });
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Haie", clientId: client.id });
    await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);

    const autre = await chantiersRepo.creerChantier(ctx, { nom: "Dans seize mois" });
    await chantiersRepo.planifierChantier(ctx, autre.id, dans(480));

    const p = await preparerEnvoi(ctx, chantier.id, LUNDI);
    assert.ok(!p.joursOccupes.includes(dans(480)));
    // Et l'horizon de PROPOSITION, lui, va bien jusque-là : le jour reste
    // choisissable, il n'est simplement pas annoncé comme pris.
    assert.ok(dans(480) <= p.horizon.fin, "l'horizon de proposition s'est rétréci par effet de bord");
  });

  await test("ce que voit le CLIENT n'a pas bougé : trois mois, pas douze", async () => {
    // **Le contrôle qui rend l'élargissement défendable.** Les douze mois sont
    // pour son écran à lui. Livrer la même liste au client reviendrait à lui
    // donner le carnet de commandes (`docs/AGENT.md` §2.2 bis).
    //
    // **Ce qu'il attrape exactement**, vérifié en le confrontant à quatre
    // mutations plutôt qu'en le supposant : il rougit quand on élargit
    // `FENETRE_PROPOSITION_JOURS`, c'est-à-dire la fenêtre du client elle-même.
    // Il reste vert si l'on touche à l'horizon du patron — et c'est la bonne
    // nouvelle : les deux chemins ne se rejoignent nulle part. La liste du
    // patron vient de `preparerEnvoi`, celle du client est recalculée par
    // `lireParJeton` quand il ouvre son lien. Aucune valeur ne transite de
    // l'une à l'autre, et c'est ce qui permet d'élargir la première sans
    // risque pour la seconde.
    const ctx = await contexte(`client-${Date.now()}@t.test`);
    const client = await clientsRepo.creerClient(ctx, { nom: "Mme Costa", telephone: "0611223344" });
    await clientsRepo.mettreAJourClient(ctx, client.id, { canalCommunication: "sms" });
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Haie", clientId: client.id });
    const brouillon = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
    await prixRepo.ajouterLignePrix(ctx, chantier.id, "Taille de haie", "600.00");
    await devisRepo.envoyerDevis(ctx, brouillon.id);

    const occupeLoin = await chantiersRepo.creerChantier(ctx, { nom: "Dans dix mois" });
    await chantiersRepo.planifierChantier(ctx, occupeLoin.id, dans(300));

    const envoi = await creerEnvoi(
      ctx,
      {
        chantierId: chantier.id,
        devisId: brouillon.id,
        canal: "sms",
        datesProposees: [dans(10)],
        contenuDevis: "Taille de haie",
      },
      LUNDI
    );
    const vu = await lireParJeton(envoi.jeton, LUNDI);
    assert.ok(vu, "le client n'ouvre pas son devis");
    assert.ok(
      !vu.joursOccupes.includes(dans(300)),
      "le client apprend qu'un jour dans dix mois est pris : c'est le planning du patron qui fuit"
    );
    assert.ok(
      vu.joursOccupes.every((j) => j <= vu.fenetre.fin),
      "un jour occupé dépasse la fenêtre annoncée au client"
    );
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
