import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import { creerEnvoi, lireParJeton, enregistrerReponse } from "../src/server/repositories/envois-devis";
import { preparerEnvoi, premiersJoursLibres, verifierJourPropose } from "../src/server/repositories/preparation-envoi";
import { versJourIso, ajouterJours, fenetreProposition, compterOccupation } from "../src/server/disponibilites";

// Depuis les créneaux (migration 0019), la disponibilité dépend du chantier
// qu'on cherche à caler : une demi-journée tient là où une journée entière ne
// tient plus. Ces contrôles-ci raisonnent donc sur une journée entière, la
// durée par défaut — c'est-à-dire exactement leur hypothèse d'origine.
const UNE_JOURNEE = 2;
const RIEN_DE_PLANIFIE = { occupation: compterOccupation([], 1), nombreEquipes: 1, dureeDemiJournees: UNE_JOURNEE };
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
        occupation: compterOccupation([{ jour: aOccuper, moment: "matin", dureeDemiJournees: UNE_JOURNEE }], 1),
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
    // **Un prix, sans quoi ce cas n'éprouve plus ce qu'il annonce.** Depuis le
    // 23 août 2026, un devis SANS LIGNE bloque à lui seul l'envoi
    // (`ARCHITECTURE.md` §158) et masquerait le motif qu'on veut lire ici.
    await prixRepo.ajouterLignePrix(ctx, chantier.id, "Élagage d'un chêne", "600.00");
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
    // **Un prix, sans quoi ce cas n'éprouve plus ce qu'il annonce.** Depuis le
    // 23 août 2026, un devis SANS LIGNE bloque à lui seul l'envoi
    // (`ARCHITECTURE.md` §158) et masquerait le motif qu'on veut lire ici.
    await prixRepo.ajouterLignePrix(ctx, chantier.id, "Abattage d'un frêne", "600.00");
    await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);

    const p = await preparerEnvoi(ctx, chantier.id, LUNDI);
    assert.strictEqual(p.blocage, "coordonnee_absente");
  });

  await test("un devis SANS LIGNE bloque à lui seul, avant même le canal", async () => {
    // **Son défaut du 23 août 2026 :** *« le devis part à zéro euro chez la
    // cliente »*. Rien ne s'opposait à l'envoi d'un document qui n'énonce rien,
    // et sa cliente avait « J'accepte ce devis » sous ce vide.
    //
    // **Le motif passe AVANT le canal**, et l'ordre n'est pas un détail : à quoi
    // bon lui faire choisir comment joindre sa cliente pour lui envoyer un
    // document vide ? Ce cas donne donc TOUT ce qu'il faut par ailleurs —
    // canal et téléphone — pour qu'aucun autre motif ne puisse expliquer le
    // refus.
    const ctx = await contexte(`vide-${Date.now()}@t.test`);
    const client = await clientsRepo.creerClient(ctx, { nom: "Mme Roux", telephone: "0655443322" });
    await clientsRepo.mettreAJourClient(ctx, client.id, { canalCommunication: "sms" });
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Sans prix", clientId: client.id });
    await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);

    const p = await preparerEnvoi(ctx, chantier.id, LUNDI);
    assert.strictEqual(
      p.blocage,
      "devis_vide",
      "un devis sans une seule ligne peut partir : le client recevrait un document à zéro euro"
    );
  });

  await test("une ligne suffit à lever le blocage — un devis GRATUIT reste possible", async () => {
    // **La barrière porte sur les LIGNES, jamais sur l'euro.** Un devis à
    // 0,00 € peut être légitime — un geste commercial, un déplacement offert —
    // et le refuser interdirait au patron quelque chose qui est son droit
    // (`CLAUDE.md` §4 : ne rien inventer).
    const ctx = await contexte(`gratuit-${Date.now()}@t.test`);
    const client = await clientsRepo.creerClient(ctx, { nom: "M. Offert", telephone: "0644332211" });
    await clientsRepo.mettreAJourClient(ctx, client.id, { canalCommunication: "sms" });
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Geste", clientId: client.id });
    await prixRepo.ajouterLignePrix(ctx, chantier.id, "Passage offert", "0.00");
    await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);

    const p = await preparerEnvoi(ctx, chantier.id, LUNDI);
    assert.strictEqual(p.blocage, null, "un devis gratuit mais ÉCRIT est refusé : c'est son droit");
  });

  await test("canal et coordonnée présents : rien ne bloque", async () => {
    const ctx = await contexte(`ok-${Date.now()}@t.test`);
    const client = await clientsRepo.creerClient(ctx, { nom: "Mme Costa", telephone: "0611223344" });
    await clientsRepo.mettreAJourClient(ctx, client.id, { canalCommunication: "sms" });
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Taille", clientId: client.id });
    // **Un prix, sans quoi ce cas n'éprouve plus ce qu'il annonce.** Depuis le
    // 23 août 2026, un devis SANS LIGNE bloque à lui seul l'envoi
    // (`ARCHITECTURE.md` §158) et masquerait le motif qu'on veut lire ici.
    await prixRepo.ajouterLignePrix(ctx, chantier.id, "Taille d'une haie", "600.00");
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

  await test("l'écran PRÉVIENT qu'un chantier en cours occupe ce jour", async () => {
    // **Retourné le 23 août 2026, sur sa règle :** *« si l'utilisateur juge
    // qu'il peut rajouter un chantier, il doit pouvoir le faire quand même »*.
    // Ce n'est plus le refus qu'on éprouve, c'est l'AVERTISSEMENT : sans lui, il
    // passerait outre sans savoir qu'il passe outre, et l'on retomberait sur le
    // défaut du 22 août — un jour déjà pris proposé sans que rien ne le dise.
    const ctx = await contexte(`deborde-envoi-${Date.now()}@t.test`);
    const client = await clientsRepo.creerClient(ctx, { nom: "M. Faucher", email: "f@ex.test" });
    await clientsRepo.mettreAJourClient(ctx, client.id, { canalCommunication: "email" });
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Haie", clientId: client.id });
    await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);

    const long = await chantiersRepo.creerChantier(ctx, { nom: "Trois jours de taille" });
    await chantiersRepo.mettreAJourDureeEquipe(ctx, long.id, { dureePrevue: "3 jours" });
    await chantiersRepo.planifierChantier(ctx, long.id, dans(0));

    const v = await verifierJourPropose(ctx, chantier.id, dans(2), undefined, LUNDI);
    assert.strictEqual(v.retenable, true, "le jour est refusé au lieu d'être signalé");
    assert.match(
      v.raison ?? "",
      /complet/i,
      `rien ne l'avertit que le ${dans(2)} est pris : « ${v.raison} »`
    );
    // Prévenir sans montrer la sortie, c'est le laisser chercher à l'aveugle.
    assert.ok(v.alternative, "aucun jour libre proposé à côté");
  });

  await test("et ce qu'il a proposé, son client peut le prendre", async () => {
    // **L'autre bout de la même règle.** Le laisser proposer un jour plein puis
    // le refuser à son client, c'est perdre le devis sur une décision qu'il
    // avait prise — et le client, lui, n'y comprendrait rien : il a reçu cette
    // date.
    const ctx = await contexte(`force-${Date.now()}@t.test`);
    const client = await clientsRepo.creerClient(ctx, { nom: "M. Faucher", email: "f@ex.test" });
    await clientsRepo.mettreAJourClient(ctx, client.id, { canalCommunication: "email" });
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Haie", clientId: client.id });
    const brouillon = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);

    const deja = await chantiersRepo.creerChantier(ctx, { nom: "Déjà calé" });
    await chantiersRepo.planifierChantier(ctx, deja.id, dans(10));

    const envoi = await creerEnvoi(
      ctx,
      {
        chantierId: chantier.id,
        devisId: brouillon.id,
        canal: "email",
        datesProposees: [dans(10)],
        contenuDevis: "Taille de haie",
      },
      LUNDI
    );
    const r = await enregistrerReponse(
      envoi.jeton,
      {
        decision: "accepte",
        dateRetenue: dans(10),
        precision: null,
        adresseIp: null,
        agentUtilisateur: null,
      },
      LUNDI
    );
    assert.deepStrictEqual(
      r,
      { succes: true, dateRetenue: dans(10), contreProposee: false },
      "le client s'est vu refuser une date que le patron lui avait proposée"
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

  await test("un devis accepté POSE le chantier, et le planning le montre", async () => {
    // **Sa panne du 22 août 2026 :** *« tu vois bien que le chantier de Bernard
    // n'est pas indiqué [...] juste le chantier n'apparaît pas sur le
    // calendrier »*, capture du 24 à l'appui : matin libre, après-midi libre.
    //
    // **Aucun contrôle ne couvrait ce chemin en entier.** On vérifiait que la
    // réponse du client était acceptée (`succes: true`) — jamais que le
    // chantier portait ensuite une date, ni qu'il remontait dans la liste du
    // planning. Or l'écriture se fait sous un contexte de JETON, pas de
    // session : une règle d'isolation qui la refuserait ne lèverait rien, elle
    // toucherait zéro ligne en silence.
    const ctx = await contexte(`pose-${Date.now()}@t.test`);
    const client = await clientsRepo.creerClient(ctx, { nom: "Bernard", email: "b@ex.test" });
    await clientsRepo.mettreAJourClient(ctx, client.id, { canalCommunication: "email" });
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Haie de Bernard", clientId: client.id });
    const brouillon = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);

    const envoi = await creerEnvoi(
      ctx,
      {
        chantierId: chantier.id,
        devisId: brouillon.id,
        canal: "email",
        datesProposees: [dans(10)],
        contenuDevis: "Taille de haie",
      },
      LUNDI
    );

    const r = await enregistrerReponse(
      envoi.jeton,
      {
        decision: "accepte",
        dateRetenue: dans(10),
        precision: null,
        adresseIp: null,
        agentUtilisateur: null,
      },
      LUNDI
    );
    assert.deepStrictEqual(
      r,
      { succes: true, dateRetenue: dans(10), contreProposee: false },
      "le client n'a pas pu accepter"
    );

    // 1. La date est-elle vraiment ÉCRITE sur le chantier ?
    const pose = await chantiersRepo.getChantier(ctx, chantier.id);
    assert.strictEqual(
      pose?.datePlanifiee,
      dans(10),
      `le devis est accepté mais le chantier ne porte aucune date : ${pose?.datePlanifiee ?? "null"}`
    );
    assert.ok(pose?.creneauDebut, "le chantier n'a pas de créneau de départ");

    // 2. Et le PLANNING le voit-il ? La liste exige un devis envoyé : un
    //    chantier daté mais absent de cette liste ne s'affiche nulle part, et
    //    c'est exactement ce qu'il a sous les yeux.
    const surLePlanning = await chantiersRepo.listerChantiersPourPlanning(ctx);
    const vu = surLePlanning.find((c) => c.id === chantier.id);
    assert.ok(
      vu,
      "le chantier porte sa date mais n'apparaît pas dans le planning : il est invisible"
    );
    assert.strictEqual(vu?.datePlanifiee, dans(10), "le planning ne lit pas la bonne date");
  });

  await test("un chantier DATÉ se voit au planning, même sans devis envoyé", async () => {
    // **Sa panne du 22 août 2026 :** *« tu vois bien que le chantier de Bernard
    // n'est pas indiqué [...] juste le chantier n'apparaît pas sur le
    // calendrier »*, capture du 24 à l'appui : matin libre, après-midi libre.
    //
    // **Le défaut n'était pas dans l'écriture mais dans la LECTURE.** La liste
    // du planning n'admettait que les chantiers dont le devis est parti, tandis
    // que le calcul de capacité compte tous les chantiers datés. Un chantier
    // daté sans devis envoyé prenait donc la place — le client se voyait
    // refuser ce jour — pendant que le planning l'affichait libre.
    const ctx = await contexte(`invisible-${Date.now()}@t.test`);
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Haie de Bernard" });
    await chantiersRepo.planifierChantier(ctx, chantier.id, dans(10));

    const surLePlanning = await chantiersRepo.listerChantiersPourPlanning(ctx);
    const vu = surLePlanning.find((c) => c.id === chantier.id);
    assert.ok(
      vu,
      `le chantier est posé au ${dans(10)} mais n'apparaît pas au planning : le jour se lit libre`
    );
    assert.strictEqual(vu?.datePlanifiee, dans(10));

    // **Et il prend bien la place qu'il occupe.** C'est l'autre moitié de la
    // règle : si l'affichage et la capacité ne disaient pas la même chose, on
    // n'aurait fait que déplacer le mensonge d'un écran à l'autre.
    const client = await clientsRepo.creerClient(ctx, { nom: "M. Faucher", email: "f@ex.test" });
    await clientsRepo.mettreAJourClient(ctx, client.id, { canalCommunication: "email" });
    const autre = await chantiersRepo.creerChantier(ctx, { nom: "Autre haie", clientId: client.id });
    await devisRepo.getOuCreerDevisBrouillon(ctx, autre.id);
    const p = await preparerEnvoi(ctx, autre.id, LUNDI);
    assert.ok(
      p.joursOccupes.includes(dans(10)),
      `le ${dans(10)} n'est pas barré alors qu'un chantier y est posé`
    );
  });

  // ─── SA RÈGLE DU 22 AOÛT : « oui si c'est des journées complètes, non si
  //     c'est des demi-journées » ───────────────────────────────────────────
  //
  // Elle répond à : *« mettre toutes mes équipes sur un chantier doit-il fermer
  // la journée ? »*. Les deux moitiés de sa réponse sont éprouvées séparément,
  // parce qu'une seule des deux passerait aussi bien avec une règle fausse.

  await test("TOUTES ses équipes sur une JOURNÉE ferment le jour au client", async () => {
    const ctx = await contexte(`journee-${Date.now()}@t.test`);
    await entreprisesRepo.mettreAJourEntreprise(ctx, { nombreEquipes: 2 });

    const eric = await chantiersRepo.creerChantier(ctx, { nom: "Mr. Eric" });
    await chantiersRepo.mettreAJourDureeEquipe(ctx, eric.id, { dureePrevue: "1 journée" });
    await chantiersRepo.planifierChantier(ctx, eric.id, dans(10), { quand: "journee" });
    // Ses deux équipes, matin ET après-midi : c'est sa capture du 22 août.
    for (const demi of ["matin", "apres_midi"] as const) {
      for (const rang of [1, 2]) {
        await chantiersRepo.basculerEquipeDuChantier(ctx, eric.id, demi, rang);
      }
    }

    const client = await clientsRepo.creerClient(ctx, { nom: "M. Faucher", email: "f@ex.test" });
    await clientsRepo.mettreAJourClient(ctx, client.id, { canalCommunication: "email" });
    const autre = await chantiersRepo.creerChantier(ctx, { nom: "Autre", clientId: client.id });
    await devisRepo.getOuCreerDevisBrouillon(ctx, autre.id);

    // **On interroge `joursOccupes`, jamais `joursLibres`.** Cette dernière ne
    // rend que les SIX premiers jours suggérés : un jour situé plus loin en est
    // absent de toute façon, et une assertion posée dessus serait verte quoi
    // qu'il arrive. La première version de ce contrôle est tombée dedans —
    // c'est le piège du `CLAUDE.md` §5, un contrôle vert qui ne prouve rien.
    const p = await preparerEnvoi(ctx, autre.id, LUNDI);
    assert.ok(
      p.joursOccupes.includes(dans(10)),
      `${dans(10)} reste offert alors que ses DEUX équipes y sont toute la journée`
    );
  });

  await test("TOUTES ses équipes sur une DEMI-journée laissent le jour ouvert", async () => {
    // L'autre moitié de sa règle, et c'est elle qui interdit de simplifier en
    // « toutes les équipes ⇒ jour fermé » : l'après-midi reste libre, donc le
    // jour reste proposable.
    const ctx = await contexte(`demi-${Date.now()}@t.test`);
    await entreprisesRepo.mettreAJourEntreprise(ctx, { nombreEquipes: 2 });

    const eric = await chantiersRepo.creerChantier(ctx, { nom: "Mr. Eric" });
    await chantiersRepo.mettreAJourDureeEquipe(ctx, eric.id, { dureePrevue: "une demi-journée" });
    await chantiersRepo.planifierChantier(ctx, eric.id, dans(10), { quand: "matin" });
    for (const rang of [1, 2]) {
      await chantiersRepo.basculerEquipeDuChantier(ctx, eric.id, "matin", rang);
    }

    const client = await clientsRepo.creerClient(ctx, { nom: "M. Faucher", email: "f@ex.test" });
    await clientsRepo.mettreAJourClient(ctx, client.id, { canalCommunication: "email" });
    const autre = await chantiersRepo.creerChantier(ctx, { nom: "Autre", clientId: client.id });
    await chantiersRepo.mettreAJourDureeEquipe(ctx, autre.id, { dureePrevue: "une demi-journée" });
    await devisRepo.getOuCreerDevisBrouillon(ctx, autre.id);

    const p = await preparerEnvoi(ctx, autre.id, LUNDI);
    assert.ok(
      !p.joursOccupes.includes(dans(10)),
      `${dans(10)} est barré alors que son après-midi est libre`
    );
  });

  await test("une date trop proche NOMME le premier jour possible", async () => {
    // **Sa remarque du 23 août 2026 :** *« "trop tôt" veut rien dire, on
    // comprend pas bien »*. La phrase énonçait la règle — « proposez au moins
    // après-demain » — au lieu de dire quoi faire, et obligeait à compter dans
    // sa tête devant un calendrier qui affiche déjà les dates.
    const ctx = await contexte(`tot-${Date.now()}@t.test`);
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Haie" });
    await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);

    const v = await verifierJourPropose(ctx, chantier.id, dans(0), undefined, LUNDI);
    assert.strictEqual(v.retenable, false, "une date passée doit rester refusée");
    assert.ok(
      !/trop tôt/i.test(v.raison ?? ""),
      `« trop tôt » est revenu : « ${v.raison} »`
    );
    assert.ok(
      !/en défaut/i.test(v.raison ?? ""),
      `la phrase le met encore en tort : « ${v.raison} »`
    );
    // **Elle doit NOMMER le jour**, pas le lui faire calculer.
    assert.match(
      v.raison ?? "",
      /\d{1,2}\s+\p{L}+/u,
      `la phrase ne nomme aucune date : « ${v.raison} »`
    );
    assert.strictEqual(v.alternative, dans(2), "le premier jour possible n'est pas offert");
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
