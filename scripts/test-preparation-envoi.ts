import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import { creerEnvoi, lireParJeton, enregistrerReponse } from "../src/server/repositories/envois-devis";
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

  await test("un chantier COMMENCÉ AVANT la fenêtre et encore en cours n'est pas oublié", async () => {
    // **Sa panne du 22 août 2026 :** *« je peux proposer le 24 alors qu'un
    // client a validé le 24 — corrige-moi ça ! Ça ne doit jamais se
    // reproduire, c'est une erreur gravissime !!!! »*
    //
    // Les trois chemins d'occupation bornaient leur requête sur la date de
    // DÉPART du chantier. Un chantier de trois jours parti l'avant-veille tient
    // encore le premier jour proposable : sa ligne n'était pas ramenée, ce jour
    // paraissait libre, et l'écran le suggérait. La revérification de la
    // réponse du client lisait la même occupation tronquée, donc rien ne
    // rattrapait la faute — deux chantiers le même jour, découverts sur le
    // terrain.
    const ctx = await contexte(`deborde-${Date.now()}@t.test`);
    const client = await clientsRepo.creerClient(ctx, { nom: "M. Faucher", email: "f@ex.test" });
    await clientsRepo.mettreAJourClient(ctx, client.id, { canalCommunication: "email" });
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Haie", clientId: client.id });
    await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);

    // Trois jours ouvrés partis le lundi : lundi, mardi, MERCREDI. Le mercredi
    // est `dans(2)`, c'est-à-dire le PREMIER jour proposable — et le départ,
    // `dans(0)`, tombe hors de la fenêtre.
    const long = await chantiersRepo.creerChantier(ctx, { nom: "Trois jours de taille" });
    await chantiersRepo.mettreAJourDureeEquipe(ctx, long.id, { dureePrevue: "3 jours" });
    await chantiersRepo.planifierChantier(ctx, long.id, dans(0));

    const fenetre = fenetreProposition(LUNDI);
    assert.strictEqual(fenetre.debut, dans(2), "la fenêtre ne commence pas où ce cas le suppose");

    const p = await preparerEnvoi(ctx, chantier.id, LUNDI);
    assert.ok(
      !p.joursLibres.includes(dans(2)),
      `${dans(2)} est suggéré alors qu'un chantier commencé le ${dans(0)} l'occupe encore`
    );
    assert.ok(
      p.joursOccupes.includes(dans(2)),
      `${dans(2)} n'est pas barré sur son calendrier alors qu'il est pris`
    );
  });

  await test("l'envoi REFUSE de proposer un jour qu'un chantier en cours occupe", async () => {
    // Le premier verrou : le patron ne peut même pas mettre ce jour dans son
    // envoi. Avant la correction, `creerEnvoi` lisait la même occupation
    // tronquée et laissait passer.
    const ctx = await contexte(`deborde-envoi-${Date.now()}@t.test`);
    const client = await clientsRepo.creerClient(ctx, { nom: "M. Faucher", email: "f@ex.test" });
    await clientsRepo.mettreAJourClient(ctx, client.id, { canalCommunication: "email" });
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Haie", clientId: client.id });
    const brouillon = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);

    const long = await chantiersRepo.creerChantier(ctx, { nom: "Trois jours de taille" });
    await chantiersRepo.mettreAJourDureeEquipe(ctx, long.id, { dureePrevue: "3 jours" });
    await chantiersRepo.planifierChantier(ctx, long.id, dans(0));

    await assert.rejects(
      () =>
        creerEnvoi(
          ctx,
          {
            chantierId: chantier.id,
            devisId: brouillon.id,
            canal: "email",
            datesProposees: [dans(2)],
            contenuDevis: "Taille de haie",
          },
          LUNDI
        ),
      /jour_occupe/,
      `${dans(2)} a été proposé alors qu'un chantier commencé le ${dans(0)} l'occupe encore`
    );
  });

  await test("le client ne peut pas retenir un jour qu'un chantier en cours occupe", async () => {
    // **Le verrou qui compte vraiment.** L'écran peut se tromper sans dommage
    // tant que la revérification refuse ; c'est elle qui décide, et c'est elle
    // qui lisait aussi l'occupation tronquée.
    //
    // Le chantier long est posé APRÈS l'envoi, à dessein : c'est la course
    // réelle — le devis part le lundi, la semaine se remplit, le client répond
    // le mercredi. Le poser avant ne prouverait rien, puisque `creerEnvoi`
    // refuserait déjà (contrôle précédent).
    const ctx = await contexte(`deborde-client-${Date.now()}@t.test`);
    const client = await clientsRepo.creerClient(ctx, { nom: "M. Faucher", email: "f@ex.test" });
    await clientsRepo.mettreAJourClient(ctx, client.id, { canalCommunication: "email" });
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Haie", clientId: client.id });
    const brouillon = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);

    const envoi = await creerEnvoi(
      ctx,
      {
        chantierId: chantier.id,
        devisId: brouillon.id,
        canal: "email",
        datesProposees: [dans(2)],
        contenuDevis: "Taille de haie",
      },
      LUNDI
    );

    const long = await chantiersRepo.creerChantier(ctx, { nom: "Trois jours de taille" });
    await chantiersRepo.mettreAJourDureeEquipe(ctx, long.id, { dureePrevue: "3 jours" });
    await chantiersRepo.planifierChantier(ctx, long.id, dans(0));

    const r = await enregistrerReponse(envoi.jeton, {
      decision: "accepte",
      dateRetenue: dans(2),
      precision: null,
      adresseIp: null,
      agentUtilisateur: null,
      // **Sans cette date, le lien est « expiré » et le refus ne prouve
      // rien du planning.** La première version de ce contrôle était verte
      // pour ce motif-là, sur l'ancienne borne comme sur la nouvelle.
    }, LUNDI);
    // **Le motif est vérifié, pas seulement l'échec.** Un refus pour « déjà
    // répondu » ou « lien expiré » rendrait ce contrôle vert sans rien prouver
    // du planning — c'est le piège du `CLAUDE.md` §5.
    assert.deepStrictEqual(
      r,
      { succes: false, motif: "date_indisponible" },
      `le client a retenu ${dans(2)}, déjà pris par un chantier commencé le ${dans(0)}`
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
