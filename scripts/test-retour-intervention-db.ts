// LE RETOUR D'INTERVENTION EN BASE — isolation, unicité, et la photo qui survit.
//
// ═══════════════════════════════════════════════════════════════════════════
// **POURQUOI UNE SUITE EN BASE, alors que la règle est déjà éprouvée pure.**
//
// `test-retour-intervention.ts` prouve que la règle décide juste. Elle
// resterait verte si :
//
// · un retour d'une AUTRE entreprise remontait dans la liste — la RLS ne
//   s'éprouve pas sans base, et un retour porte le nom d'un client et des
//   photos de sa propriété ;
// · un second envoi ÉCRASAIT le premier — un chantier de huit jours envoie
//   un retour chaque soir, et le soir 3 ne doit pas effacer le soir 2
//   (sa règle du 19 septembre 2026, migration 0096) ;
// · **la photo d'un retour partait à la purge** — le piège du 8 septembre 2026,
//   écrit dans `TODO.md` avant d'être codé : le fichier disparaîtrait des mois
//   plus tard, sur un écran que personne ne regardait ce jour-là.
//
// Elle tourne sous `atlas_app`, comme le produit. Les comptes de contrôle, eux,
// se lisent sous le PROPRIÉTAIRE avec un contexte posé — `retours_intervention`
// porte `FORCE ROW LEVEL SECURITY`, et le propriétaire y est soumis aussi.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { PHOTOS_MAX_PAR_RETOUR } from "../src/lib/photos-plafonds";
import { poserLeRetourAction } from "../src/app/planning/retour-actions";
import { nettoyerBase } from "./_test-db";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as photosRepo from "../src/server/repositories/photos";
import {
  poserLeRetour,
  modifierLeDernierRetour,
  marquerLeRetourVu,
  dernierRetourDuChantier,
  nombreDeRetoursDuChantier,
  listerLesRetours,
  compterLesRetours,
  photoTenueParUnRetour,
} from "../src/server/repositories/retours-intervention";

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

const admin = new Client({ connectionString: process.env.DATABASE_ADMIN_URL });

/** Combien de clés attendent la purge — la question qui compte pour les photos. */
async function combienEnPurge(): Promise<number> {
  const { rows } = await admin.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM fichiers_a_purger"
  );
  return Number(rows[0].n);
}

async function main() {
  console.log("Le retour d'intervention, en base\n");
  await admin.connect();
  await nettoyerBase();

  const A = await entreprisesRepo.creerEntreprise(
    { nom: "Paysages A" },
    { email: `retour-a-${Date.now()}@test.local`, nom: "Anne" }
  );
  const B = await entreprisesRepo.creerEntreprise(
    { nom: "Paysages B" },
    { email: `retour-b-${Date.now()}@test.local`, nom: "Bruno" }
  );
  const ctxA = { utilisateurId: A.utilisateurId, entrepriseId: A.entreprise.id };
  const ctxB = { utilisateurId: B.utilisateurId, entrepriseId: B.entreprise.id };

  const chantierA = await chantiersRepo.creerChantier(ctxA, { nom: "Haie Rialland" });
  const chantierB = await chantiersRepo.creerChantier(ctxB, { nom: "Tonte Bernard" });

  await essai("un retour se pose, avec ses tâches et son mot", async () => {
    await poserLeRetour(ctxA, chantierA.id, {
      taches: [
        { libelle: "Débroussaillage", faite: true },
        { libelle: "Taille de la haie", faite: false },
      ],
      photoIds: [],
      aSignaler: "  la haie attendra  ",
    });
    const r = await dernierRetourDuChantier(ctxA, chantierA.id);
    assert.ok(r, "le retour n'a pas été posé");
    assert.equal(r.taches.length, 2);
    // Ce qui n'a PAS été fait reste : c'est ce qui empêche de facturer un
    // travail qui n'a pas eu lieu.
    assert.deepEqual(r.taches.map((t) => t.faite), [true, false]);
    // Le mot est tranché de ses espaces, jamais laissé tel quel.
    assert.equal(r.aSignaler, "la haie attendra");
  });

  await essai("un second envoi est un SECOND retour — jour après jour, sans écraser le premier", async () => {
    await poserLeRetour(ctxA, chantierA.id, {
      taches: [
        { libelle: "Débroussaillage", faite: true },
        { libelle: "Taille de la haie", faite: true },
      ],
      photoIds: [],
      aSignaler: null,
    });
    assert.equal(await nombreDeRetoursDuChantier(ctxA, chantierA.id), 2, "le second envoi a écrasé le premier");
    assert.equal(await compterLesRetours(ctxA), 2);
    // Le DERNIER pré-coche la fiche du lendemain : c'est bien le second.
    const r = await dernierRetourDuChantier(ctxA, chantierA.id);
    assert.deepEqual(r?.taches.map((t) => t.faite), [true, true], "le dernier retour n'est pas le plus récent");
    // Une chaîne vide devient NULL : sinon l'écran afficherait une case
    // « À signaler » vide, qui se lit comme un mot perdu.
    assert.equal(r?.aSignaler, null);
  });

  // **Un retour vide part quand même** — sa règle du 19 septembre : ni photo,
  // ni case ; c'est le serveur qui ne refuse plus, la base n'a jamais refusé.
  await essai("un retour sans rien de coché ni de photo se pose", async () => {
    await poserLeRetour(ctxA, chantierA.id, { taches: [{ libelle: "Débroussaillage", faite: false }], photoIds: [], aSignaler: "  " });
    assert.equal(await nombreDeRetoursDuChantier(ctxA, chantierA.id), 3);
    const r = await dernierRetourDuChantier(ctxA, chantierA.id);
    assert.deepEqual(r?.taches.map((t) => t.faite), [false]);
    assert.equal(r?.aSignaler, null);
  });

  await essai("un retour d'une AUTRE entreprise ne remonte jamais", async () => {
    await poserLeRetour(ctxB, chantierB.id, {
      taches: [{ libelle: "Tonte", faite: true }],
      photoIds: [],
      aSignaler: null,
    });
    const chezA = await listerLesRetours(ctxA);
    const chezB = await listerLesRetours(ctxB);
    // Les trois de A — ses trois soirs —, et rien de B.
    assert.equal(chezA.length, 3, `A voit ${chezA.length} retours`);
    assert.equal(chezB.length, 1, `B voit ${chezB.length} retours`);
    assert.ok(!chezA.some((r) => r.chantierNom === "Tonte Bernard"), "A voit le chantier de B");
    // Et le retour de B est INTROUVABLE depuis A, pas seulement absent de la
    // liste : c'est la différence entre un filtre et une isolation.
    assert.equal(await dernierRetourDuChantier(ctxA, chantierB.id), null);
    assert.equal(await nombreDeRetoursDuChantier(ctxA, chantierB.id), 0);
  });

  // ═════════════════════════════════════════════════════════════════════════
  // LA PHOTO QUI SURVIT — le piège écrit dans `TODO.md` avant d'être codé.
  await essai("la photo d'un retour NE PART PAS à la purge", async () => {
    const ajout = await photosRepo.ajouterPhoto(ctxA, chantierA.id, {
      storageKey: `chantiers/${chantierA.id}/photos/tenue.jpg`,
      mimeType: "image/jpeg",
      tailleOctets: 10,
      checksum: "x".repeat(64),
    });
    assert.ok(ajout.ok, "la photo du décor a été refusée");
    const photo = ajout.photo;
    await poserLeRetour(ctxA, chantierA.id, {
      taches: [{ libelle: "Débroussaillage", faite: true }],
      photoIds: [photo.id],
      aSignaler: null,
    });
    assert.equal(await photoTenueParUnRetour(ctxA, photo.id), true);

    const avant = await combienEnPurge();
    await photosRepo.supprimerPhoto(ctxA, photo.id);
    assert.equal(
      await combienEnPurge(),
      avant,
      "la clé d'une photo de retour a été mise en file de purge"
    );
    // Le retour la montre toujours : c'est le fichier qu'on protégeait.
    const r = await dernierRetourDuChantier(ctxA, chantierA.id);
    assert.equal(r?.photos.length, 1, "le retour a perdu sa photo");
  });

  // **Et le contrôle sait échouer.** Une photo ordinaire, elle, DOIT partir en
  // purge — sans ce cas, la garde pourrait tout retenir et personne ne le
  // verrait avant que le rangement soit plein.
  await essai("une photo ordinaire part bien à la purge", async () => {
    const ajout = await photosRepo.ajouterPhoto(ctxA, chantierA.id, {
      storageKey: `chantiers/${chantierA.id}/photos/ordinaire.jpg`,
      mimeType: "image/jpeg",
      tailleOctets: 10,
      checksum: "y".repeat(64),
    });
    assert.ok(ajout.ok, "la photo du décor a été refusée");
    const photo = ajout.photo;
    const avant = await combienEnPurge();
    await photosRepo.supprimerPhoto(ctxA, photo.id);
    assert.equal(
      await combienEnPurge(),
      avant + 1,
      "une photo sans retour n'a pas été mise en file de purge"
    );
  });

  await essai("la liste porte le nom du CLIENT, ou du chantier à défaut", async () => {
    const liste = await listerLesRetours(ctxA);
    // Le chantier a été créé sans fiche client : la liste retombe donc sur son
    // nom plutôt que d'inventer « Sans client ».
    assert.equal(liste[0].clientNom, "Haie Rialland");
  });

  // ═══ LE PLAFOND DU RETOUR — sa décision du 20 septembre 2026 ══════════════
  //
  // **Par l'ACTION, pas le dépôt** : c'est elle qui tient la borne, parce que
  // l'écran n'est pas la seule porte. Le refus est rendu AVANT toute écriture
  // et avant `revalidatePath`, ce qui permet de le jouer d'ici. Un seul plafond
  // sur le retour, et c'est celui-là : tout le reste part tel quel (sa règle
  // du 19 septembre).
  await essai(`un retour à ${PHOTOS_MAX_PAR_RETOUR + 1} photos est refusé par l'action, à ${PHOTOS_MAX_PAR_RETOUR} le dépôt l'accepte`, async () => {
    process.env.AUTH_TEST_UTILISATEUR_ID = A.utilisateurId;
    const trop = Array.from({ length: PHOTOS_MAX_PAR_RETOUR + 1 }, () => randomUUID());
    const r = await poserLeRetourAction(chantierA.id, { taches: [], photoIds: trop, aSignaler: null });
    assert.equal(r.ok, false, "onze photos sont passées");
    assert.match(r.ok ? "" : r.raison, /10 photos au plus par retour/);
    // Et le contrôle sait le contraire : dix, le dépôt les prend (des
    // identifiants inconnus ne sont simplement pas retenus).
    const avant = await nombreDeRetoursDuChantier(ctxA, chantierA.id);
    await poserLeRetour(ctxA, chantierA.id, { taches: [], photoIds: trop.slice(0, PHOTOS_MAX_PAR_RETOUR), aSignaler: null });
    assert.equal(await nombreDeRetoursDuChantier(ctxA, chantierA.id), avant + 1);
  });

  // ═══ MODIFIER LE RETOUR ENVOYÉ — sa demande du 25 septembre 2026 ═══════════
  //
  // *« J'ai envoyé un retour sans faire exprès, il faut que je puisse le
  // modifier […] et ça modifie le retour envoyé, ça n'en envoie pas un
  // deuxième ! »* Le compte ne bouge pas, le contenu change, et seul le
  // DERNIER se modifie : un retour de la semaine dernière reste la preuve de
  // ce soir-là.
  await essai("modifier le dernier retour le RÉÉCRIT, il n'en crée pas un second", async () => {
    const chantier = await chantiersRepo.creerChantier(ctxA, { nom: "Pagnol" });
    const ajout = await photosRepo.ajouterPhoto(ctxA, chantier.id, {
      storageKey: `chantiers/${chantier.id}/photos/modif.jpg`,
      mimeType: "image/jpeg",
      tailleOctets: 10,
      checksum: "m".repeat(64),
    });
    assert.ok(ajout.ok, "la photo du décor a été refusée");
    await poserLeRetour(ctxA, chantier.id, {
      taches: [{ libelle: "Tonte", faite: false }, { libelle: "Taille", faite: false }],
      photoIds: [],
      aSignaler: null,
    });
    const avant = await dernierRetourDuChantier(ctxA, chantier.id);
    assert.ok(avant);
    // Le patron l'avait déjà ouvert : modifié, il doit le revoir.
    await marquerLeRetourVu(ctxA, avant.id);
    const nonLusAvant = await compterLesRetours(ctxA);

    const fait = await modifierLeDernierRetour(ctxA, chantier.id, avant.id, {
      taches: [{ libelle: "Tonte", faite: true }, { libelle: "Taille", faite: false }],
      photoIds: [ajout.photo.id],
      aSignaler: "  portail cassé  ",
    });
    assert.equal(fait, true, "la modification a été refusée");
    assert.equal(await nombreDeRetoursDuChantier(ctxA, chantier.id), 1, "la modification a créé un second retour");
    const apres = await dernierRetourDuChantier(ctxA, chantier.id);
    assert.equal(apres?.id, avant.id, "ce n'est plus le même retour");
    assert.deepEqual(apres?.taches.map((t) => t.faite), [true, false]);
    assert.equal(apres?.aSignaler, "portail cassé");
    assert.deepEqual(apres?.photos.map((p) => p.id), [ajout.photo.id]);
    assert.equal(await compterLesRetours(ctxA), nonLusAvant + 1, "le retour modifié ne redevient pas non lu");

    // Et la photo retirée du retour se retire vraiment.
    await modifierLeDernierRetour(ctxA, chantier.id, avant.id, {
      taches: apres!.taches,
      photoIds: [],
      aSignaler: null,
    });
    const vide = await dernierRetourDuChantier(ctxA, chantier.id);
    assert.equal(vide?.photos.length, 0, "la photo décochée est restée sur le retour");
    assert.equal(vide?.aSignaler, null);
  });

  await essai("un retour qui n'est PAS le dernier ne se modifie pas", async () => {
    const chantier = await chantiersRepo.creerChantier(ctxA, { nom: "Deux soirs" });
    await poserLeRetour(ctxA, chantier.id, { taches: [{ libelle: "Soir 1", faite: true }], photoIds: [], aSignaler: null });
    const soir1 = await dernierRetourDuChantier(ctxA, chantier.id);
    // `pose_le` départage : on laisse passer l'horloge.
    await new Promise((r) => setTimeout(r, 20));
    await poserLeRetour(ctxA, chantier.id, { taches: [{ libelle: "Soir 2", faite: true }], photoIds: [], aSignaler: null });
    const fait = await modifierLeDernierRetour(ctxA, chantier.id, soir1!.id, {
      taches: [{ libelle: "Soir 1", faite: false }],
      photoIds: [],
      aSignaler: "réécrit",
    });
    assert.equal(fait, false, "le retour d'hier a été réécrit");
    const liste = (await listerLesRetours(ctxA)).filter((r) => r.chantierNom === "Deux soirs");
    assert.equal(liste.length, 2);
    assert.ok(!liste.some((r) => r.aSignaler === "réécrit"));
  });

  await essai("le retour d'une AUTRE entreprise ne se modifie pas", async () => {
    const chezB = await dernierRetourDuChantier(ctxB, chantierB.id);
    assert.ok(chezB);
    const fait = await modifierLeDernierRetour(ctxA, chantierB.id, chezB.id, {
      taches: [],
      photoIds: [],
      aSignaler: "intrus",
    });
    assert.equal(fait, false);
    assert.equal((await dernierRetourDuChantier(ctxB, chantierB.id))?.aSignaler, null);
  });

  await essai("une photo supprimée puis retirée du retour part enfin à la purge", async () => {
    const chantier = await chantiersRepo.creerChantier(ctxA, { nom: "Purge" });
    const ajout = await photosRepo.ajouterPhoto(ctxA, chantier.id, {
      storageKey: `chantiers/${chantier.id}/photos/purge.jpg`,
      mimeType: "image/jpeg",
      tailleOctets: 10,
      checksum: "p".repeat(64),
    });
    assert.ok(ajout.ok);
    await poserLeRetour(ctxA, chantier.id, { taches: [], photoIds: [ajout.photo.id], aSignaler: null });
    const r = await dernierRetourDuChantier(ctxA, chantier.id);
    await photosRepo.supprimerPhoto(ctxA, ajout.photo.id);
    const avant = await combienEnPurge();
    await modifierLeDernierRetour(ctxA, chantier.id, r!.id, { taches: [], photoIds: [], aSignaler: null });
    assert.equal(await combienEnPurge(), avant + 1, "le fichier que plus rien ne tient est resté hors de la purge");
  });

  await admin.end();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Retour d'intervention en base — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await admin.end().catch(() => {});
  await pool.end().catch(() => {});
  process.exit(1);
});
