// UN AUDIO NON RECONNU N'EST NI RANGÉ, NI ENVOYÉ CHEZ UN FOURNISSEUR — lot Audio.
//
// ═══════════════════════════════════════════════════════════════════════════
// **POURQUOI UNE SUITE EN BASE, alors que `test-signature-audio.ts` éprouve déjà
// la reconnaissance.**
//
// Celle-là prouve que la fonction dit non. Celle-ci prouve que **le refus
// arrive assez tôt** : avant le stockage, avant l'appel au fournisseur de
// transcription. Une reconnaissance parfaite posée après l'écriture ne
// protégerait rien — et c'est exactement le genre d'écart qu'un contrôle sur
// la seule fonction pure laisse passer.
//
// Elle traverse le service RÉEL (`recevoirNoteVocale`), avec une vraie base et
// un vrai contexte d'entreprise — pas une imitation.

import assert from "node:assert/strict";
import { nettoyerBase } from "./_test-db";
import { Client } from "pg";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import { fermerLimiteur } from "../src/server/rate-limit";
import { temoinWebm, temoinHtml, temoinZip, temoinFausseSynchroMp3 } from "./_temoins-audio";

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

function formDataAvec(octets: Uint8Array, nom: string, type: string): FormData {
  const fd = new FormData();
  fd.set("fichier", new File([octets as BlobPart], nom, { type }));
  return fd;
}

/**
 * Combien de notes existent — **lu par le PROPRIÉTAIRE, jamais par `atlas_app`.**
 *
 * **Ce contrôle a mesuré ZÉRO deux fois avant d'être cru**, et les deux fois il
 * mentait dans les DEUX sens : « la note n'a pas été écrite » sur du code juste,
 * et il aurait annoncé « rien n'a été rangé » sur un fichier hostile réellement
 * rangé.
 *
 * | Ce qu'il faisait | Pourquoi il rendait 0 |
 * |---|---|
 * | compter par le pool de l'application | `atlas_app`, sans `app.entreprise_id` : la RLS ne rend rien |
 * | compter sous le PROPRIÉTAIRE | `notes_vocales` porte `FORCE ROW LEVEL SECURITY` — **le propriétaire y est soumis aussi** |
 *
 * La seconde erreur est celle qui a coûté une migration entière le 21 août 2026
 * (`scripts/test-migrations-sous-rls.ts`). Le contexte se pose, il ne se
 * suppose pas.
 */
async function combienDeNotes(): Promise<number> {
  const { rows } = await admin.query<{ n: number }>("SELECT count(*)::int AS n FROM notes_vocales");
  return Number(rows[0].n);
}

const admin = new Client({ connectionString: process.env.DATABASE_ADMIN_URL });

async function main() {
  console.log("Porte audio : un fichier non reconnu n'atteint ni le disque ni l'IA\n");
  await admin.connect();

  await nettoyerBase();
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Atelier Audio" },
    { email: `audio-${Date.now()}@test.local`, nom: "P" }
  );
  process.env.AUTH_TEST_UTILISATEUR_ID = utilisateurId;
  process.env.AUTH_TEST_ENTREPRISE_ID = entreprise.id;

  // Le contexte de lecture du contrôle lui-même. Sans lui, il compte 0 quoi
  // qu'il arrive — voir `combienDeNotes`.
  await admin.query("SELECT set_config('app.entreprise_id', $1, false)", [entreprise.id]);

  const ctx = { utilisateurId, entrepriseId: entreprise.id };
  const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Élagage" });

  const { recevoirNoteVocale } = await import("../src/server/services/note-vocale-entrante");

  // ─── LES HOSTILES SONT REFUSÉS, ET RIEN N'EST ÉCRIT ───────────────────────

  const hostiles = [
    ["du HTML annoncé audio/webm", temoinHtml(), "note.webm", "audio/webm"],
    ["une archive ZIP annoncée audio/mp4", temoinZip(), "note.m4a", "audio/mp4"],
    ["un faux MP3 : une synchro, aucune trame", temoinFausseSynchroMp3(), "note.mp3", "audio/mpeg"],
    ["un fichier vide", new Uint8Array(0), "note.webm", "audio/webm"],
    ["trois octets", new Uint8Array([0xff, 0xfb, 0x90]), "note.webm", "audio/webm"],
  ] as const;

  for (const [quoi, octets, nom, type] of hostiles) {
    await essai(`${quoi} est refusé, et RIEN n'est rangé`, async () => {
      const avant = await combienDeNotes();
      const r = await recevoirNoteVocale(chantier.id, formDataAvec(octets, nom, type));
      assert.equal(r.ok, false, `accepté : ${JSON.stringify(r)}`);
      assert.equal(
        await combienDeNotes(),
        avant,
        "une note a été écrite en base alors que le fichier était refusé"
      );
    });
  }

  // ─── LA MOITIÉ QUI PROTÈGE DU REMÈDE ──────────────────────────────────────

  await essai("un VRAI WebM est accepté, rangé, et rangé en .webm", async () => {
    const avant = await combienDeNotes();
    const r = await recevoirNoteVocale(chantier.id, formDataAvec(temoinWebm(), "note.webm", "audio/webm"));
    assert.equal(r.ok, true, r.ok ? "" : `refusé : ${r.raison}`);
    assert.equal(await combienDeNotes(), avant + 1, "la note n'a pas été écrite");
    if (r.ok) {
      assert.match(
        r.storageKey ?? "",
        /\.webm$/,
        `rangé sous « ${r.storageKey} » : l'extension ne vient pas du format reconnu`
      );
    }
  });

  await essai("UN VRAI WEBM MAL ANNONCÉ est rangé selon ses OCTETS, pas son étiquette", async () => {
    // Le cœur du lot : le téléphone annonce du MP4, le fichier est du WebM.
    // Le ranger en `.m4a` ferait servir plus tard un `audio/mp4` sur des octets
    // Matroska — c'est le navigateur qui commanderait ce qu'Atlas annonce.
    const r = await recevoirNoteVocale(chantier.id, formDataAvec(temoinWebm(), "note.m4a", "audio/mp4"));
    assert.equal(r.ok, true, r.ok ? "" : `refusé : ${r.raison}`);
    if (r.ok) {
      assert.match(r.storageKey ?? "", /\.webm$/, `rangé sous « ${r.storageKey} » — il a suivi le téléphone`);
    }
  });

  await essai("le type ENREGISTRÉ en base est celui du format reconnu", async () => {
    const { rows } = await admin.query<{ mime_type: string; storage_key: string }>(
      "SELECT mime_type, storage_key FROM notes_vocales ORDER BY created_at DESC LIMIT 1"
    );
    assert.ok(rows[0], "aucune note en base : le contrôle précédent n'a rien rangé");
    assert.equal(
      rows[0].mime_type,
      "audio/webm",
      `la base porte « ${rows[0].mime_type} » — c'est ce qui repartira chez le fournisseur de transcription`
    );
  });

  await essai("sept envois, cinq refusés : le chantier porte UNE note, la dernière", async () => {
    /**
     * **Cette assertion attendait 2, et c'est MOI qui me trompais, pas le
     * code.** Un chantier ne porte qu'une note vocale : la suivante remplace la
     * précédente, et l'ancienne part dans `fichiers_a_purger`
     * (`notes-vocales.ts`). Deux enregistrements valables font donc une note,
     * pas deux.
     *
     * Ce qui compte ici n'a pas bougé : les cinq hostiles n'ont rien laissé.
     */
    assert.equal(await combienDeNotes(), 1, "le chantier ne porte pas exactement une note");

    const { rows } = await admin.query<{ storage_key: string }>(
      "SELECT storage_key FROM notes_vocales LIMIT 1"
    );
    assert.match(
      rows[0].storage_key,
      /\.webm$/,
      `la note retenue est rangée sous « ${rows[0].storage_key} »`
    );

    // Et le fichier remplacé n'est pas oublié sur le disque : il est en file.
    const { rows: purge } = await admin.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM fichiers_a_purger"
    );
    assert.equal(Number(purge[0].n), 1, "le fichier remplacé n'a pas été mis en file de purge");
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Porte audio — ${echecs} échec(s).`);
  await fermerLimiteur();
  await admin.end();
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
