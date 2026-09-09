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
// · deux « c'est fini » créaient deux retours pour un seul chantier ;
// · **la photo d'un retour partait à la purge** — le piège du 8 septembre 2026,
//   écrit dans `TODO.md` avant d'être codé : le fichier disparaîtrait des mois
//   plus tard, sur un écran que personne ne regardait ce jour-là.
//
// Elle tourne sous `atlas_app`, comme le produit. Les comptes de contrôle, eux,
// se lisent sous le PROPRIÉTAIRE avec un contexte posé — `retours_intervention`
// porte `FORCE ROW LEVEL SECURITY`, et le propriétaire y est soumis aussi.

import assert from "node:assert/strict";
import { Client } from "pg";
import { nettoyerBase } from "./_test-db";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as photosRepo from "../src/server/repositories/photos";
import {
  poserLeRetour,
  retourDuChantier,
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
    const r = await retourDuChantier(ctxA, chantierA.id);
    assert.ok(r, "le retour n'a pas été posé");
    assert.equal(r.taches.length, 2);
    // Ce qui n'a PAS été fait reste : c'est ce qui empêche de facturer un
    // travail qui n'a pas eu lieu.
    assert.deepEqual(r.taches.map((t) => t.faite), [true, false]);
    // Le mot est tranché de ses espaces, jamais laissé tel quel.
    assert.equal(r.aSignaler, "la haie attendra");
  });

  await essai("un second « c'est fini » MET À JOUR, il n'en crée pas un deuxième", async () => {
    await poserLeRetour(ctxA, chantierA.id, {
      taches: [
        { libelle: "Débroussaillage", faite: true },
        { libelle: "Taille de la haie", faite: true },
      ],
      photoIds: [],
      aSignaler: null,
    });
    assert.equal(await compterLesRetours(ctxA), 1, "deux retours pour un seul chantier");
    const r = await retourDuChantier(ctxA, chantierA.id);
    assert.deepEqual(r?.taches.map((t) => t.faite), [true, true], "les tâches n'ont pas été remplacées");
    // Une chaîne vide devient NULL : sinon l'écran afficherait une case
    // « À signaler » vide, qui se lit comme un mot perdu.
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
    assert.equal(chezA.length, 1, `A voit ${chezA.length} retours`);
    assert.equal(chezB.length, 1, `B voit ${chezB.length} retours`);
    assert.ok(!chezA.some((r) => r.chantierNom === "Tonte Bernard"), "A voit le chantier de B");
    // Et le retour de B est INTROUVABLE depuis A, pas seulement absent de la
    // liste : c'est la différence entre un filtre et une isolation.
    assert.equal(await retourDuChantier(ctxA, chantierB.id), null);
  });

  // ═════════════════════════════════════════════════════════════════════════
  // LA PHOTO QUI SURVIT — le piège écrit dans `TODO.md` avant d'être codé.
  await essai("la photo d'un retour NE PART PAS à la purge", async () => {
    const photo = await photosRepo.ajouterPhoto(ctxA, chantierA.id, {
      storageKey: `chantiers/${chantierA.id}/photos/tenue.jpg`,
      mimeType: "image/jpeg",
      tailleOctets: 10,
      checksum: "x".repeat(64),
    });
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
    const r = await retourDuChantier(ctxA, chantierA.id);
    assert.equal(r?.photos.length, 1, "le retour a perdu sa photo");
  });

  // **Et le contrôle sait échouer.** Une photo ordinaire, elle, DOIT partir en
  // purge — sans ce cas, la garde pourrait tout retenir et personne ne le
  // verrait avant que le rangement soit plein.
  await essai("une photo ordinaire part bien à la purge", async () => {
    const photo = await photosRepo.ajouterPhoto(ctxA, chantierA.id, {
      storageKey: `chantiers/${chantierA.id}/photos/ordinaire.jpg`,
      mimeType: "image/jpeg",
      tailleOctets: 10,
      checksum: "y".repeat(64),
    });
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
