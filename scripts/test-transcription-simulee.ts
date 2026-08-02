import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as notesRepo from "../src/server/repositories/notes-vocales";
import * as brouillonsRepo from "../src/server/repositories/brouillons-informations";
import { genererBrouillon } from "../src/server/ai/services/brouillon-service";
import { extraire } from "../src/server/ai/services/extraction-service";
import {
  fournisseurTranscriptionDev,
  estTranscriptionSimulee,
  PREFIXE_TRANSCRIPTION_SIMULEE,
} from "../src/server/ai/providers/transcription/dev";
import { nettoyerBase } from "./_test-db";

// Le devis du patron s'est rempli de deux prestations qu'il n'avait jamais
// dictées :
//
//   « [Transcription simulée — fournisseu »
//   « 1137980 octets reçus] »
//
// Aucun prestataire de transcription n'étant raccordé, sa dictée n'avait pas
// été écoutée : le texte de remplacement du fournisseur de développement avait
// été traité comme une vraie transcription, découpé en segments, et chaque
// segment était devenu une prestation. L'écran affirmait par-dessus « Proposé à
// partir de votre dictée ».
//
// C'est l'interdit le plus net de ce dépôt (CLAUDE.md §4) : ne jamais inventer
// une prestation. Cette suite existe pour que ça ne puisse plus revenir.

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

const DICTEE_REELLE =
  "Élagage du sapin devant la maison, deux jours, deux hommes, évacuation des branchages";

async function main() {
  await nettoyerBase();

  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Transcription" },
    { email: "transcription@test.local", nom: "T" }
  );
  const A = { entrepriseId: entreprise.id, utilisateurId };

  await test("Le fournisseur de développement marque son texte de remplacement", async () => {
    const r = await fournisseurTranscriptionDev.transcrire(Buffer.from("abc"), "audio/webm");
    assert.equal(r.succes, true);
    if (!r.succes) return;
    assert.ok(
      r.texte.startsWith(PREFIXE_TRANSCRIPTION_SIMULEE),
      "le texte de remplacement doit porter le préfixe qui le rend reconnaissable"
    );
    assert.ok(estTranscriptionSimulee(r.texte));
  });

  await test("Une vraie dictée n'est jamais prise pour un texte de remplacement", async () => {
    assert.equal(estTranscriptionSimulee(DICTEE_REELLE), false);
    assert.equal(estTranscriptionSimulee(null), false);
    assert.equal(estTranscriptionSimulee(""), false);
  });

  // Le cœur du défaut : sans garde, l'extraction fabrique des prestations à
  // partir du texte de remplacement. On le constate ici plutôt que de le
  // supposer — c'est ce qui rend la garde nécessaire.
  await test("Sans garde, l'extraction fabriquerait bien des prestations", async () => {
    const remplacement = `${PREFIXE_TRANSCRIPTION_SIMULEE} fournisseur de développement, 1137980 octets reçus]`;
    const r = await extraire(remplacement);
    assert.equal(r.succes, true);
    if (!r.succes) return;
    assert.ok(
      r.proposition.prestations.length > 0,
      "sans garde, le texte de remplacement produit des prestations — c'est le défaut"
    );
  });

  await test("Une note transcrite par le fournisseur de développement ne produit AUCUN brouillon", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier dictée simulée" });
    await notesRepo.enregistrerNoteVocale(A, chantier.id, {
      storageKey: "essai/simulee.webm",
      mimeType: "audio/webm",
      tailleOctets: 1137980,
      checksum: "chk-simulee",
      dureeSecondes: 12,
    });

    const simulee = await fournisseurTranscriptionDev.transcrire(Buffer.from("x".repeat(64)), "audio/webm");
    assert.equal(simulee.succes, true);
    if (!simulee.succes) return;
    await notesRepo.enregistrerSuccesTranscription(A, chantier.id, simulee.texte);

    const resultat = await genererBrouillon(A, chantier.id);
    assert.equal(
      resultat.statut,
      "transcription_simulee",
      "la génération doit refuser, et le dire pour la bonne raison"
    );

    // Et surtout : rien n'a été écrit. Un brouillon fabriqué resterait ensuite
    // dans le devis, même après correction de la cause.
    const brouillon = await brouillonsRepo.getBrouillon(A, chantier.id);
    assert.equal(brouillon, null, "aucun brouillon ne doit avoir été enregistré");
  });

  await test("Une dictée réelle continue d'être analysée normalement", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier dictée réelle" });
    await notesRepo.enregistrerNoteVocale(A, chantier.id, {
      storageKey: "essai/reelle.webm",
      mimeType: "audio/webm",
      tailleOctets: 2048,
      checksum: "chk-reelle",
      dureeSecondes: 8,
    });
    await notesRepo.enregistrerSuccesTranscription(A, chantier.id, DICTEE_REELLE);

    const resultat = await genererBrouillon(A, chantier.id);
    assert.equal(
      resultat.statut,
      "genere",
      "la garde ne doit jamais bloquer une transcription légitime"
    );
    if (resultat.statut !== "genere") return;
    assert.ok(
      resultat.brouillon.contenu.prestations.length > 0,
      "une vraie dictée doit toujours produire des prestations"
    );
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end().catch(() => {});
  process.exit(1);
});
