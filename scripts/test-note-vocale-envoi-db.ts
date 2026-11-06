/* =======================================================================
   Un même envoi de note ne s'enregistre qu'une fois (migration 0166).

   **Pourquoi** : sa planche du 5 novembre 2026, la B le 6. Une note dictée
   sans réseau est gardée sur le téléphone et repart sur son appui. Une
   réponse perdue en chemin, puis un second appui, et le même son arrivait
   deux fois : la note réécrite, sa transcription remise à zéro, le devis
   préparé une seconde fois. Le téléphone pose un identifiant sur l'envoi ;
   le serveur reconnaît celui qu'il a déjà reçu (`noteDejaRecue`).

   Suite BASE, sous `atlas_app` : elle tient aussi l'isolation, qu'une suite
   navigateur, sous un rôle qui traverse la RLS, ne verrait pas
   (`CLAUDE.md` §5).
   ======================================================================= */
import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as notesRepo from "../src/server/repositories/notes-vocales";
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

const ENVOI = "6f1c2b9e-0d3a-4c7e-9b21-5a8f0e4d2c11";
const AUTRE = "0a9b8c7d-6e5f-4a3b-8c2d-1e0f9a8b7c6d";

async function main() {
  await nettoyerBase();

  const a = await entreprisesRepo.creerEntreprise({ nom: "Envoi note A" }, { email: "envoi-note-a@test.local", nom: "A" });
  const b = await entreprisesRepo.creerEntreprise({ nom: "Envoi note B" }, { email: "envoi-note-b@test.local", nom: "B" });
  const A = { entrepriseId: a.entreprise.id, utilisateurId: a.utilisateurId };
  const B = { entrepriseId: b.entreprise.id, utilisateurId: b.utilisateurId };
  const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier envoi" });

  const son = (cle: string, envoiId?: string) => ({
    storageKey: cle,
    mimeType: "audio/mp4",
    tailleOctets: 5000,
    checksum: cle,
    dureeSecondes: 42,
    envoiId,
  });

  await test("un envoi enregistré se reconnaît à son identifiant", async () => {
    await notesRepo.enregistrerNoteVocale(A, chantier.id, son("test/envoi-1.m4a", ENVOI));
    const deja = await notesRepo.noteDejaRecue(A, chantier.id, ENVOI);
    assert.ok(deja, "l'envoi reçu n'est pas reconnu : un second appui réécrirait la note");
    assert.equal(deja.storageKey, "test/envoi-1.m4a");
    assert.equal(deja.dureeSecondes, 42);
  });

  await test("un autre identifiant n'est pas reconnu", async () => {
    assert.equal(await notesRepo.noteDejaRecue(A, chantier.id, AUTRE), null);
  });

  await test("une autre entreprise ne reconnaît pas l'envoi : la RLS tient", async () => {
    assert.equal(await notesRepo.noteDejaRecue(B, chantier.id, ENVOI), null);
  });

  await test("une note remplacée par un envoi SANS identifiant ne se fait pas passer pour l'ancien", async () => {
    await notesRepo.enregistrerNoteVocale(A, chantier.id, son("test/envoi-2.m4a"));
    assert.equal(
      await notesRepo.noteDejaRecue(A, chantier.id, ENVOI),
      null,
      "l'ancien identifiant a survécu au remplacement : renvoyer l'ancienne note rendrait la nouvelle"
    );
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM fichiers_a_purger WHERE storage_key = $1`, ["test/envoi-1.m4a"]);
    assert.equal(rows[0].n, 1, "le son remplacé doit partir en file de purge, comme avant");
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
