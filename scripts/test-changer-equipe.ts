// Changer l'équipe d'un chantier posé, sans toucher à sa date.
//
// **Son geste du 14 août 2026**, arrêté sur planche
// (`maquettes/atlas-planning-equipe.html`) : *« on devait pouvoir affilier une
// équipe à un chantier ajouté au planning une fois que le client a validé le
// devis »*.
//
// CE QUE CETTE SUITE TIENT :
//
//   · LA DATE NE BOUGE PAS. C'est toute la promesse de l'écran, et c'est ce
//     qui distingue ce geste d'un déplacement : un chantier que le client a
//     validé porte une date qu'on lui a annoncée ;
//   · DEUX CHANTIERS NE TOMBENT PAS SUR LA MÊME ÉQUIPE au même moment. La
//     place a été réservée à la pose ; l'affilier ailleurs la déplace d'une
//     file à l'autre, elle ne s'en invente pas une seconde ;
//   · À UNE SEULE ÉQUIPE, on refuse. Écrire un rang ferait apparaître
//     « Équipe A » sur le planning — ce que le patron a interdit le 10 août.

import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";
import { creerEntreprise, mettreAJourEntreprise } from "../src/server/repositories/entreprises";
import {
  creerChantier,
  planifierChantier,
  changerEquipeChantier,
  mettreAJourDureeEquipe,
  EquipeIndisponible,
} from "../src/server/repositories/chantiers";
import { listerEquipes } from "../src/server/repositories/equipes";

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

async function monter(nombreEquipes: number) {
  await nettoyerBase();
  const { entreprise, utilisateurId } = await creerEntreprise(
    { nom: "Essai équipes" },
    { email: `eq-${Math.random().toString(36).slice(2)}@essai.local`, nom: "Patron" }
  );
  const ctx = { utilisateurId, entrepriseId: entreprise.id };
  await mettreAJourEntreprise(ctx, { nombreEquipes });
  return ctx;
}

async function main() {
  console.log("=== Changer l'équipe d'un chantier posé ===\n");

  await essai("l'équipe change, et la date ne bouge pas", async () => {
    const ctx = await monter(2);
    const c = await creerChantier(ctx, { nom: "Abattage" });
    await planifierChantier(ctx, c.id, JOUR, { moment: "matin", rangEquipe: 1 });
    const apres = await changerEquipeChantier(ctx, c.id, 2);
    assert.equal(apres.datePlanifiee, JOUR, "la date a bougé");
    assert.equal(apres.creneauDebut, "matin", "la demi-journée a bougé");

    const eq = await listerEquipes(ctx);
    const rang2 = eq.find((e) => e.rang === 2);
    assert.equal(apres.equipeId, rang2?.id, "l'équipe n'a pas été prise");
  });

  // LE CONTRÔLE QUI COMPTE : deux chantiers sur la même équipe au même moment
  // ne sont pas un planning, c'est une journée impossible.
  await essai("une équipe déjà prise sur ce créneau refuse", async () => {
    const ctx = await monter(2);
    const a = await creerChantier(ctx, { nom: "Abattage" });
    const b = await creerChantier(ctx, { nom: "Élagage" });
    await planifierChantier(ctx, a.id, JOUR, { moment: "matin", rangEquipe: 1 });
    await planifierChantier(ctx, b.id, JOUR, { moment: "matin", rangEquipe: 2 });
    await assert.rejects(() => changerEquipeChantier(ctx, b.id, 1), EquipeIndisponible);
  });

  // **Le contrôle porte sur les CRÉNEAUX, pas sur le jour.** Deux chantiers
  // d'une demi-journée chacun tiennent sur la même équipe le même jour — l'un
  // le matin, l'autre l'après-midi.
  //
  // Ce contrôle a d'abord rougi, et il avait raison : sans durée dictée, un
  // chantier dure UNE JOURNÉE ENTIÈRE (`DUREE_PAR_DEFAUT_DEMI_JOURNEES` vaut 2)
  // et occupe donc les deux demi-journées. C'est le test qui se trompait, pas le
  // serveur.
  await essai("mais une autre demi-journée passe", async () => {
    const ctx = await monter(2);
    const a = await creerChantier(ctx, { nom: "Abattage" });
    const b = await creerChantier(ctx, { nom: "Élagage" });
    // `creerChantier` ne prend pas la durée : elle se dicte, et se corrige à la
    // molette. Sans demi-journée, un chantier occupe la JOURNÉE entière.
    await mettreAJourDureeEquipe(ctx, a.id, { dureePrevue: "une demi-journée" });
    await mettreAJourDureeEquipe(ctx, b.id, { dureePrevue: "une demi-journée" });
    await planifierChantier(ctx, a.id, JOUR, { moment: "matin", rangEquipe: 1 });
    await planifierChantier(ctx, b.id, JOUR, { moment: "apres_midi", rangEquipe: 2 });
    const apres = await changerEquipeChantier(ctx, b.id, 1);
    assert.equal(apres.creneauDebut, "apres_midi");
    assert.equal(apres.datePlanifiee, JOUR);
  });

  // Et l'inverse, qui prouve que le premier contrôle ne passe pas par hasard :
  // à une journée entière, l'après-midi est pris aussi.
  await essai("une journée entière occupe aussi l'après-midi", async () => {
    const ctx = await monter(2);
    const a = await creerChantier(ctx, { nom: "Abattage" });
    const b = await creerChantier(ctx, { nom: "Élagage" });
    await mettreAJourDureeEquipe(ctx, b.id, { dureePrevue: "une demi-journée" });
    await planifierChantier(ctx, a.id, JOUR, { moment: "matin", rangEquipe: 1 });
    await planifierChantier(ctx, b.id, JOUR, { moment: "apres_midi", rangEquipe: 2 });
    await assert.rejects(() => changerEquipeChantier(ctx, b.id, 1), EquipeIndisponible);
  });

  // À une seule équipe, il n'y a personne à distinguer : c'est sa règle du
  // 10 août, et l'écran ne propose d'ailleurs aucune ligne.
  await essai("à une seule équipe, le serveur refuse", async () => {
    const ctx = await monter(1);
    const c = await creerChantier(ctx, { nom: "Abattage" });
    await planifierChantier(ctx, c.id, JOUR, { moment: "matin", rangEquipe: null });
    await assert.rejects(() => changerEquipeChantier(ctx, c.id, 1), EquipeIndisponible);
  });

  await essai("un chantier sans date ne s'affilie pas", async () => {
    const ctx = await monter(2);
    const c = await creerChantier(ctx, { nom: "Sans date" });
    await assert.rejects(() => changerEquipeChantier(ctx, c.id, 1), EquipeIndisponible);
  });

  // Se remettre sur sa PROPRE équipe ne doit pas se refuser soi-même : le
  // chantier courant est exclu du décompte.
  await essai("se remettre sur son équipe ne se refuse pas", async () => {
    const ctx = await monter(2);
    const c = await creerChantier(ctx, { nom: "Abattage" });
    await planifierChantier(ctx, c.id, JOUR, { moment: "matin", rangEquipe: 1 });
    const apres = await changerEquipeChantier(ctx, c.id, 1);
    assert.equal(apres.datePlanifiee, JOUR);
  });

  // ─── RETIRER L'ÉQUIPE — impossible jusqu'au 14 août 2026 ─────────────────
  //
  // **Le défaut que ces cas empêchent de revenir.** `planifierChantier` écrit
  // `...(equipeId ? { equipeId } : {})` : le cas « plus personne » y est ignoré
  // en SILENCE, et cette fonction-ci exigeait un rang. Une équipe posée par
  // erreur ne pouvait donc plus jamais être défaite, par aucun chemin — et rien
  // à l'écran ne le disait.
  //
  // Le patron a retenu le 14 août la pastille sur la ligne
  // (`docs/maquettes/52-appliquer-une-equipe.html`), et son écran porte
  // « Personne pour l'instant ».
  await essai("retirer l'équipe la retire pour de bon", async () => {
    const ctx = await monter(2);
    const c = await creerChantier(ctx, { nom: "Abattage" });
    await planifierChantier(ctx, c.id, JOUR, { moment: "matin", rangEquipe: 1 });
    const apres = await changerEquipeChantier(ctx, c.id, null);
    assert.equal(apres.equipeId, null);
    // La date ne bouge pas : c'est la promesse de l'écran, retirer n'est pas
    // déplanifier.
    assert.equal(apres.datePlanifiee, JOUR);
  });

  // **Libérer une place n'en prend aucune.** Refuser un retrait parce que
  // « l'équipe est occupée » enfermerait le patron dans son erreur : l'équipe
  // occupée, c'est justement celle du chantier qu'il veut détacher.
  await essai("retirer ne se refuse jamais pour occupation", async () => {
    const ctx = await monter(2);
    const a = await creerChantier(ctx, { nom: "Haie" });
    const b = await creerChantier(ctx, { nom: "Élagage" });
    await planifierChantier(ctx, a.id, JOUR, { moment: "matin", rangEquipe: 1 });
    await planifierChantier(ctx, b.id, JOUR, { moment: "matin", rangEquipe: 2 });
    const apres = await changerEquipeChantier(ctx, b.id, null);
    assert.equal(apres.equipeId, null);
  });

  // Le chemin complet, celui que fait son doigt : poser, changer, retirer,
  // remettre. C'est la séquence qui casse quand le retrait laisse la base dans
  // un état que la réaffiliation ne sait plus lire.
  await essai("poser, changer, retirer, remettre — la place reste reprenable", async () => {
    const ctx = await monter(2);
    const c = await creerChantier(ctx, { nom: "Terrasse" });
    await planifierChantier(ctx, c.id, JOUR, { moment: "matin", rangEquipe: 1 });
    await changerEquipeChantier(ctx, c.id, 2);
    await changerEquipeChantier(ctx, c.id, null);
    const repris = await changerEquipeChantier(ctx, c.id, 1);
    const equipes = await listerEquipes(ctx);
    assert.equal(repris.equipeId, equipes.find((e) => e.rang === 1)?.id);
  });

  // **À une seule équipe, retirer doit RÉUSSIR** là où affilier se refuse. Un
  // chantier qui traîne une équipe d'un temps où le compteur était à deux doit
  // pouvoir s'en défaire, sinon la ligne garde un nom que l'écran n'affiche
  // plus — et personne ne peut le nettoyer.
  await essai("à une seule équipe, retirer reste possible", async () => {
    const ctx = await monter(2);
    const c = await creerChantier(ctx, { nom: "Clôture" });
    await planifierChantier(ctx, c.id, JOUR, { moment: "matin", rangEquipe: 1 });
    await mettreAJourEntreprise(ctx, { nombreEquipes: 1 });
    const apres = await changerEquipeChantier(ctx, c.id, null);
    assert.equal(apres.equipeId, null);
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Changement d'équipe — ${echecs} échec(s).`);
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
