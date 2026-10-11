// LE SERVEUR REFUSE DE COCHER QUELQU'UN QUI N'EST PAS LÀ.
//
// **Son signalement du 7 septembre 2026, capture à l'appui :** *« j'ai mis
// Julien en congé, la feuille le dit aussi, or je peux quand même sélectionner
// Julien ce jour — il doit être grisé et on ne doit pas pouvoir le
// sélectionner. »*
//
// **POURQUOI CETTE SUITE EST UNE SUITE BASE, ET PAS UNE SUITE NAVIGATEUR.**
// Griser une pastille est une affaire d'écran, et un écran ne protège rien : il
// se contourne. Ce qui tient vraiment, c'est le refus du serveur — et il ne se
// voit que d'ici. Les suites navigateur, elles, tournent sous un rôle qui
// traverse la RLS (`CLAUDE.md` §5) : elles ne diraient rien de ce chemin.
//
// CE QU'ELLE TIENT :
//
//   · le refus de COCHER une personne absente, à la source ;
//   · le DÉCOCHAGE toujours possible — sinon l'état qu'il a photographié est
//     sans issue, aucun autre chemin ne retire quelqu'un d'une demi-journée ;
//   · un chantier de DEUX jours dont un seul tombe sur le congé : refusé, parce
//     qu'une coche vaut pour le chantier entier ;
//   · une absence RETIRÉE rend la coche possible — sans quoi un congé annulé
//     laisserait la personne interdite pour toujours ;
//   · rien ne change pour qui n'est pas absent, et c'est le cas de tous les
//     jours : une règle qui déborde coûte plus cher que le défaut qu'elle
//     corrige.

import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import { creerEntreprise, mettreAJourEntreprise } from "../src/server/repositories/entreprises";
import {
  creerChantier,
  planifierChantier,
  deplanifierChantier,
  basculerEquipeDuChantier,
} from "../src/server/repositories/chantiers";
import {
  noterAbsenceEquipe,
  retirerAbsenceEquipe,
} from "../src/server/repositories/absences-equipe";

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

/** Un lundi loin devant : le planning refuse les jours passés. */
const JOUR = "2027-03-15";
/** Le lendemain ouvré, pour les chantiers de deux jours. */
const LENDEMAIN = "2027-03-16";

/**
 * Étaler un chantier sur deux jours, en base.
 *
 * **Aucune fonction de dépôt ne pose cette durée-là** : `planifierChantier` ne
 * connaît que matin, après-midi et journée (`departEtDuree`), et
 * `mettreAJourDureeEquipe` ne touche que la durée ANNONCÉE, pas les
 * demi-journées occupées. Une première version passait quand même
 * `dureeDemiJournees` à cette dernière : Drizzle l'écrivait — le nom de colonne
 * existe — et le contrôle passait, mais par un chemin que TypeScript refuse.
 * Un contrôle vert par un canal qui ne compile pas ne prouve rien de durable.
 */
async function etalerSurDeuxJours(entrepriseId: string, chantierId: string) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entrepriseId]);
    await c.query(
      `UPDATE chantiers SET duree_demi_journees = 4, creneau_debut = 'matin' WHERE id = $1`,
      [chantierId]
    );
    await c.query("COMMIT");
  } finally {
    c.release();
  }
}

async function monter() {
  const { entreprise, utilisateurId } = await creerEntreprise(
    { nom: "Essai absent" },
    { email: `abs-${Math.random().toString(36).slice(2)}@essai.local`, nom: "Patron" }
  );
  const ctx = { utilisateurId, entrepriseId: entreprise.id };
  await mettreAJourEntreprise(ctx, { nombreEquipes: 2 });
  return ctx;
}

async function main() {
  console.log("=== Le serveur refuse de cocher un absent ===\n");

  await essai("SA CAPTURE : Julien en congé ce jour-là ne se coche pas", async () => {
    const ctx = await monter();
    const chantier = await creerChantier(ctx, { nom: "Chez Mr. Julien" });
    await planifierChantier(ctx, chantier.id, JOUR, { demi: "matin" });
    await noterAbsenceEquipe(ctx, {
      rang: 1,
      premierJour: JOUR,
      dernierJour: JOUR,
      motif: "congé",
    });

    const etat = await basculerEquipeDuChantier(ctx, chantier.id, "matin", 1);
    assert.ok(etat, "le chantier n'a pas été trouvé : rien n'est mesuré");
    assert.deepEqual(etat.matin, [], "l'absent a été coché quand même");
  });

  await essai("le refus ne déborde pas : Antoine, lui, se coche", async () => {
    const ctx = await monter();
    const chantier = await creerChantier(ctx, { nom: "Chez Mr. Julien" });
    await planifierChantier(ctx, chantier.id, JOUR, { demi: "matin" });
    await noterAbsenceEquipe(ctx, {
      rang: 1,
      premierJour: JOUR,
      dernierJour: JOUR,
      motif: null,
    });

    const etat = await basculerEquipeDuChantier(ctx, chantier.id, "matin", 2);
    assert.deepEqual(etat?.matin, [2], "le congé de l'un a bloqué l'autre");
  });

  await essai("ON PEUT TOUJOURS DÉCOCHER — l'état qu'il a photographié se répare", async () => {
    // La coche est ANTÉRIEURE au congé : c'est l'ordre exact de sa capture.
    // Sans cette sortie, la personne resterait annoncée sur le chantier pour
    // toujours — il n'existe aucun autre chemin pour l'en retirer.
    const ctx = await monter();
    const chantier = await creerChantier(ctx, { nom: "Chez Mr. Julien" });
    await planifierChantier(ctx, chantier.id, JOUR, { demi: "matin" });
    const avant = await basculerEquipeDuChantier(ctx, chantier.id, "matin", 1);
    assert.deepEqual(avant?.matin, [1], "la coche d'avant le congé n'a pas pris");

    await noterAbsenceEquipe(ctx, {
      rang: 1,
      premierJour: JOUR,
      dernierJour: JOUR,
      motif: null,
    });
    const apres = await basculerEquipeDuChantier(ctx, chantier.id, "matin", 1);
    assert.deepEqual(apres?.matin, [], "impossible de retirer un absent déjà coché");
  });

  await essai("deux jours, un seul de congé : ACCEPTÉ — son choix C du 8 septembre", async () => {
    /*
     * **Ce contrôle a été retourné, et c'est tout le lot du 8 septembre 2026.**
     *
     * Il défendait l'inverse la veille : la coche était refusée dès qu'un jour
     * du chantier tombait sur un congé. Ce refus était un CONTOURNEMENT — le
     * modèle ne savait pas dire « Julien vendredi mais pas jeudi », alors on
     * interdisait plutôt que de mentir.
     *
     * Sa proposition C le dit désormais : la pastille porte les jours où il
     * vient. Refuser reviendrait à lui interdire d'envoyer son gars le jour où
     * il est disponible.
     */
    const ctx = await monter();
    const chantier = await creerChantier(ctx, { nom: "Deux jours" });
    await planifierChantier(ctx, chantier.id, JOUR, { demi: "matin" });
    await etalerSurDeuxJours(ctx.entrepriseId, chantier.id);
    // Absent le SECOND jour seulement : le premier reste à faire.
    await noterAbsenceEquipe(ctx, {
      rang: 1,
      premierJour: LENDEMAIN,
      dernierJour: LENDEMAIN,
      motif: null,
    });

    const etat = await basculerEquipeDuChantier(ctx, chantier.id, "matin", 1);
    assert.deepEqual(etat?.matin, [1], "refusé alors qu'il est là le premier jour");
  });

  await essai("le congé qui couvre TOUT le chantier refuse encore", async () => {
    // La seule interdiction qui reste, et elle est nécessaire : cocher
    // quelqu'un qui ne viendra aucun des deux jours ferait partir le chantier
    // avec un nom qui n'y sera jamais.
    const ctx = await monter();
    const chantier = await creerChantier(ctx, { nom: "Deux jours couverts" });
    await planifierChantier(ctx, chantier.id, JOUR, { demi: "matin" });
    await etalerSurDeuxJours(ctx.entrepriseId, chantier.id);
    await noterAbsenceEquipe(ctx, {
      rang: 1, premierJour: JOUR, dernierJour: LENDEMAIN, motif: null,
    });

    const etat = await basculerEquipeDuChantier(ctx, chantier.id, "matin", 1);
    assert.deepEqual(etat?.matin, [], "coché alors qu'il n'est là aucun jour");
  });

  await essai("le congé RETIRÉ rend la coche possible", async () => {
    const ctx = await monter();
    const chantier = await creerChantier(ctx, { nom: "Chez Mr. Julien" });
    await planifierChantier(ctx, chantier.id, JOUR, { demi: "matin" });
    const absence = await noterAbsenceEquipe(ctx, {
      rang: 1,
      premierJour: JOUR,
      dernierJour: JOUR,
      motif: null,
    });
    assert.ok(absence, "l'absence n'a pas été posée : rien n'est mesuré");

    const bloque = await basculerEquipeDuChantier(ctx, chantier.id, "matin", 1);
    assert.deepEqual(bloque?.matin, [], "le décor n'est pas celui qu'on croit");

    await retirerAbsenceEquipe(ctx, absence.id);
    const libre = await basculerEquipeDuChantier(ctx, chantier.id, "matin", 1);
    assert.deepEqual(libre?.matin, [1], "un congé annulé interdit encore la personne");
  });

  // ═══ LA RACINE : poser un congé RÉCONCILIE ce qui devient faux ═══════════
  //
  // **Sa consigne du 8 septembre 2026 : « pas de pansement, corrige le problème
  // à la racine ».** Refuser de COCHER un absent ferme une porte ; l'autre
  // restait grande ouverte, et c'est par elle que son cas est arrivé — la coche
  // était ANTÉRIEURE au congé. Poser un congé n'avait jamais rien défait.

  await essai("RACINE : poser le congé RETIRE la personne des chantiers touchés", async () => {
    // Chantier d'UNE journée : le congé le couvre en entier, donc la coche
    // n'annonce plus personne et se retire. Sur un chantier de deux jours dont
    // un seul est couvert, elle RESTE — c'est le cas juste en dessous.
    const ctx = await monter();
    const chantier = await creerChantier(ctx, { nom: "Chez Mr. Julien" });
    await planifierChantier(ctx, chantier.id, JOUR, { demi: "matin" });
    const avant = await basculerEquipeDuChantier(ctx, chantier.id, "matin", 1);
    assert.deepEqual(avant?.matin, [1], "le décor n'est pas celui qu'on croit");

    const posee = await noterAbsenceEquipe(ctx, {
      rang: 1,
      premierJour: JOUR,
      dernierJour: JOUR,
      motif: "congé",
    });
    assert.ok(posee, "l'absence n'a pas été posée : rien n'est mesuré");

    // Ce que la base porte VRAIMENT après le congé — pas ce que l'écran croit.
    const apres = await basculerEquipeDuChantier(ctx, chantier.id, "apres_midi", 2);
    assert.deepEqual(
      apres?.matin,
      [],
      "le congé a laissé la personne affectée : la racine n'est pas corrigée"
    );
    assert.deepEqual(
      posee.chantiersLiberes.map((c) => c.nom),
      ["Chez Mr. Julien"],
      "le chantier libéré n'est pas annoncé : le retrait se ferait en silence"
    );
  });

  await essai("elle est retirée des DEUX demi-journées, pas d'une seule", async () => {
    const ctx = await monter();
    const chantier = await creerChantier(ctx, { nom: "Journée entière" });
    await planifierChantier(ctx, chantier.id, JOUR, { demi: "matin" });
    await basculerEquipeDuChantier(ctx, chantier.id, "matin", 1);
    await basculerEquipeDuChantier(ctx, chantier.id, "apres_midi", 1);

    await noterAbsenceEquipe(ctx, { rang: 1, premierJour: JOUR, dernierJour: JOUR, motif: null });

    const etat = await basculerEquipeDuChantier(ctx, chantier.id, "matin", 2);
    assert.deepEqual(etat?.matin, [2], "le matin garde l'absent");
    assert.deepEqual(etat?.apres_midi, [], "l'après-midi garde l'absent");
  });

  await essai("le congé ne touche QUE la personne concernée", async () => {
    const ctx = await monter();
    const chantier = await creerChantier(ctx, { nom: "À deux" });
    await planifierChantier(ctx, chantier.id, JOUR, { demi: "matin" });
    await basculerEquipeDuChantier(ctx, chantier.id, "matin", 1);
    await basculerEquipeDuChantier(ctx, chantier.id, "matin", 2);

    await noterAbsenceEquipe(ctx, { rang: 1, premierJour: JOUR, dernierJour: JOUR, motif: null });

    const etat = await basculerEquipeDuChantier(ctx, chantier.id, "apres_midi", 2);
    assert.deepEqual(etat?.matin, [2], "le congé de l'un a emporté l'autre");
  });

  await essai("un congé qui ne touche AUCUN chantier ne défait rien", async () => {
    const ctx = await monter();
    const chantier = await creerChantier(ctx, { nom: "Loin du congé" });
    await planifierChantier(ctx, chantier.id, JOUR, { demi: "matin" });
    await basculerEquipeDuChantier(ctx, chantier.id, "matin", 1);

    const posee = await noterAbsenceEquipe(ctx, {
      rang: 1,
      premierJour: "2027-04-05",
      dernierJour: "2027-04-09",
      motif: null,
    });
    assert.deepEqual(posee?.chantiersLiberes, [], "un congé lointain a défait quelque chose");

    const etat = await basculerEquipeDuChantier(ctx, chantier.id, "apres_midi", 2);
    assert.deepEqual(etat?.matin, [1], "la personne a été retirée sans raison");
  });

  await essai("un chantier SANS DATE n'est pas touché — un congé ne pose rien", async () => {
    // Sans date, aucun jour n'est traversé : la coche reste vraie le jour où il
    // le posera. La défaire serait lui faire perdre un choix déjà fait.
    const ctx = await monter();
    const chantier = await creerChantier(ctx, { nom: "Sans date" });
    await planifierChantier(ctx, chantier.id, JOUR, { demi: "matin" });
    await basculerEquipeDuChantier(ctx, chantier.id, "matin", 1);
    await deplanifierChantier(ctx, chantier.id);

    const posee = await noterAbsenceEquipe(ctx, {
      rang: 1,
      premierJour: JOUR,
      dernierJour: JOUR,
      motif: null,
    });
    assert.deepEqual(posee?.chantiersLiberes, [], "un chantier sans date a été touché");
  });

  await essai("un congé PARTIEL ne défait plus rien — son choix C", async () => {
    // La version d'hier vidait le chantier entier ; C garde la coche et écrit
    // les jours restants sur la pastille.
    const ctx = await monter();
    const chantier = await creerChantier(ctx, { nom: "Deux jours, un congé" });
    await planifierChantier(ctx, chantier.id, JOUR, { demi: "matin" });
    await etalerSurDeuxJours(ctx.entrepriseId, chantier.id);
    await basculerEquipeDuChantier(ctx, chantier.id, "matin", 1);

    const posee = await noterAbsenceEquipe(ctx, {
      rang: 1, premierJour: LENDEMAIN, dernierJour: LENDEMAIN, motif: null,
    });
    assert.deepEqual(posee?.chantiersLiberes, [], "un congé partiel a vidé le chantier");

    const etat = await basculerEquipeDuChantier(ctx, chantier.id, "apres_midi", 2);
    assert.deepEqual(etat?.matin, [1], "la personne a été retirée du jour où elle est là");
  });

  await essai("DEUX congés qui se suivent couvrent le chantier, et là on retire", async () => {
    // **Les absences déjà en base comptent.** Deux congés d'un jour chacun
    // couvrent un chantier de deux jours qu'aucun ne couvre seul : ne regarder
    // que celui qu'on pose laisserait la coche sur un chantier vide.
    const ctx = await monter();
    const chantier = await creerChantier(ctx, { nom: "Couvert en deux fois" });
    await planifierChantier(ctx, chantier.id, JOUR, { demi: "matin" });
    await etalerSurDeuxJours(ctx.entrepriseId, chantier.id);
    await basculerEquipeDuChantier(ctx, chantier.id, "matin", 1);

    await noterAbsenceEquipe(ctx, { rang: 1, premierJour: JOUR, dernierJour: JOUR, motif: null });
    const seconde = await noterAbsenceEquipe(ctx, {
      rang: 1, premierJour: LENDEMAIN, dernierJour: LENDEMAIN, motif: null,
    });
    assert.deepEqual(
      seconde?.chantiersLiberes.map((c) => c.nom),
      ["Couvert en deux fois"],
      "les deux congés réunis couvrent le chantier, et la coche est restée"
    );
  });

  await essai("sans aucun congé, rien ne change — le cas de tous les jours", async () => {
    const ctx = await monter();
    const chantier = await creerChantier(ctx, { nom: "Ordinaire" });
    await planifierChantier(ctx, chantier.id, JOUR, { demi: "matin" });
    const etat = await basculerEquipeDuChantier(ctx, chantier.id, "apres_midi", 1);
    assert.deepEqual(etat?.apres_midi, [1], "une règle qui déborde sur le cas normal");
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Cocher un absent — ${echecs} échec(s).`);
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
