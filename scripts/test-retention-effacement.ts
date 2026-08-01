import assert from "node:assert";
import { eq } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { audiosAPurger, clients as clientsTable } from "../src/server/db/schema";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as notesRepo from "../src/server/repositories/notes-vocales";
import * as devisRepo from "../src/server/repositories/devis";
import { enregistrerObjet } from "../src/server/storage";
import { purgerAudiosTranscrits } from "../src/server/repositories/retention";
import { exporterClient, effacerClient } from "../src/server/repositories/donnees-client";
import { creerEnvoi, enregistrerReponse } from "../src/server/repositories/envois-devis";
import { audioAPurger, RETENTION, motifConservation, echeanceConservation } from "../src/server/retention";
import { versJourIso, ajouterJours } from "../src/server/disponibilites";
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

const JOUR = 86_400_000;
const MAINTENANT = new Date("2026-04-01T09:00:00Z");
const ilYA = (jours: number) => new Date(MAINTENANT.getTime() - jours * JOUR);

/**
 * Relit une fiche client. Passe par le contexte d'entreprise : la table est
 * cloisonnée, et une lecture directe ne renvoie rien — un test qui lirait sans
 * contexte échouerait en accusant le code plutôt que lui-même.
 */
async function relireClient(ctx: { utilisateurId: string; entrepriseId: string }, id: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [row] = await tx.select().from(clientsTable).where(eq(clientsTable.id, id)).limit(1);
    return row ?? null;
  });
}

/** Rend une entrée de la file de purge échue, pour exercer le planificateur. */
async function rendreEchue(ctx: { utilisateurId: string; entrepriseId: string }, noteId: string) {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx
      .update(audiosAPurger)
      .set({ purgerLe: ilYA(1) })
      .where(eq(audiosAPurger.noteId, noteId));
  });
}

async function contexte(suffixe: string) {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Atelier" },
    { email: `ret-${suffixe}-${Date.now()}@t.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

async function creerNoteTranscrite(ctx: { utilisateurId: string; entrepriseId: string }, chantierId: string) {
  const objet = await enregistrerObjet(`chantiers/${chantierId}/notes`, Buffer.from("audio"), ".webm");
  await notesRepo.enregistrerNoteVocale(ctx, chantierId, {
    storageKey: objet.storageKey,
    mimeType: "audio/webm",
    tailleOctets: objet.tailleOctets,
    checksum: objet.checksum,
    dureeSecondes: 12,
  });
  await notesRepo.enregistrerSuccesTranscription(ctx, chantierId, "Élagage du tilleul, deux jours.");
}

async function main() {
  await nettoyerBase();

  // ---- Règles pures
  await test("l'audio n'est purgé qu'après transcription réussie", async () => {
    const base = { storageKey: "k", transcription: "texte", updatedAt: ilYA(30) };
    assert.strictEqual(audioAPurger({ ...base, transcriptionStatut: "reussie" }, MAINTENANT), true);
    assert.strictEqual(audioAPurger({ ...base, transcriptionStatut: "echouee" }, MAINTENANT), false);
    assert.strictEqual(audioAPurger({ ...base, transcriptionStatut: "en_cours" }, MAINTENANT), false);
    assert.strictEqual(audioAPurger({ ...base, transcriptionStatut: "non_demandee" }, MAINTENANT), false);
  });

  await test("une transcription vide ne suffit pas à purger la source", async () => {
    const r = audioAPurger(
      { storageKey: "k", transcription: "   ", transcriptionStatut: "reussie", updatedAt: ilYA(30) },
      MAINTENANT
    );
    assert.strictEqual(r, false, "purger sur une transcription vide détruirait la seule source");
  });

  await test("le délai de reprise est respecté", async () => {
    const avant = audioAPurger(
      { storageKey: "k", transcription: "t", transcriptionStatut: "reussie", updatedAt: ilYA(RETENTION.audioApresTranscriptionJours - 1) },
      MAINTENANT
    );
    const apres = audioAPurger(
      { storageKey: "k", transcription: "t", transcriptionStatut: "reussie", updatedAt: ilYA(RETENTION.audioApresTranscriptionJours + 1) },
      MAINTENANT
    );
    assert.strictEqual(avant, false, "purgé trop tôt : une transcription contestée ne pourrait plus être reprise");
    assert.strictEqual(apres, true);
  });

  await test("un audio déjà purgé ne l'est pas deux fois", async () => {
    const r = audioAPurger(
      { storageKey: null, transcription: "t", transcriptionStatut: "reussie", updatedAt: ilYA(30) },
      MAINTENANT
    );
    assert.strictEqual(r, false);
  });

  await test("le motif de conservation dit ce qui reste et jusqu'à quand", async () => {
    assert.strictEqual(motifConservation(0, null), null, "rien de conservé : pas de motif");
    const m = motifConservation(2, new Date("2031-04-01T00:00:00Z"));
    assert.match(m ?? "", /2 pièces comptables/);
    assert.match(m ?? "", /2031-04-01/);
    assert.match(m ?? "", /L123-22/);
  });

  await test("l'échéance de conservation compte en années pleines", async () => {
    const e = echeanceConservation(new Date("2026-04-01T00:00:00Z"), 10);
    assert.strictEqual(e.toISOString().slice(0, 10), "2036-04-01");
  });

  // ---- Purge réelle
  await test("la purge retire l'audio et conserve la transcription", async () => {
    const ctx = await contexte("purge");
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Élagage" });
    await creerNoteTranscrite(ctx, chantier.id);

    // La purge travaille depuis la file, alimentée à la transcription : c'est
    // l'échéance de la file qu'il faut faire passer, pas la date de la note.
    const noteAvant = await notesRepo.getNoteVocale(ctx, chantier.id);
    assert.ok(noteAvant, "note introuvable");
    await rendreEchue(ctx, noteAvant.id);

    const { audiosPurges } = await purgerAudiosTranscrits(MAINTENANT);
    assert.strictEqual(audiosPurges, 1);

    const note = await notesRepo.getNoteVocale(ctx, chantier.id);
    assert.strictEqual(note?.storageKey, null, "l'audio devrait être effacé");
    assert.ok(note?.transcription, "la transcription devait survivre");
    assert.ok(note?.audioPurgeLe, "la date de purge n'est pas consignée");
  });

  await test("une note trop récente n'est pas purgée", async () => {
    const ctx = await contexte("recente");
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Taille" });
    await creerNoteTranscrite(ctx, chantier.id);

    const { audiosPurges } = await purgerAudiosTranscrits(MAINTENANT);
    assert.strictEqual(audiosPurges, 0);
    const note = await notesRepo.getNoteVocale(ctx, chantier.id);
    assert.ok(note?.storageKey, "l'audio a été purgé avant le délai");
  });

  await test("la purge est idempotente", async () => {
    const ctx = await contexte("idem");
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Haie" });
    await creerNoteTranscrite(ctx, chantier.id);
    const n = await notesRepo.getNoteVocale(ctx, chantier.id);
    assert.ok(n, "note introuvable");
    await rendreEchue(ctx, n.id);

    await purgerAudiosTranscrits(MAINTENANT);
    const seconde = await purgerAudiosTranscrits(MAINTENANT);
    assert.strictEqual(seconde.audiosPurges, 0, "la seconde exécution ne doit rien retrouver");
  });

  // ---- Export
  await test("l'export rassemble tout ce qui touche au client", async () => {
    const ctx = await contexte("export");
    const client = await clientsRepo.creerClient(ctx, { nom: "Mme Martin", telephone: "0600000000" });
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Élagage", clientId: client.id });
    await creerNoteTranscrite(ctx, chantier.id);
    await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);

    const e = await exporterClient(ctx, client.id, MAINTENANT);
    assert.ok(e, "export vide");
    assert.strictEqual(e.chantiers.length, 1);
    assert.strictEqual(e.chantiers[0].notesVocales.length, 1);
    assert.strictEqual(e.chantiers[0].devis.length, 1);
    assert.match(JSON.stringify(e.client), /Mme Martin/);
  });

  await test("l'export d'un client inconnu ne renvoie rien", async () => {
    const ctx = await contexte("inconnu");
    const autre = await contexte("autre");
    const client = await clientsRepo.creerClient(autre, { nom: "Chez l'autre" });
    assert.strictEqual(await exporterClient(ctx, client.id, MAINTENANT), null);
  });

  // ---- Effacement
  await test("sans devis accepté, tout part et le nom aussi", async () => {
    const ctx = await contexte("efface");
    const client = await clientsRepo.creerClient(ctx, {
      nom: "M. Dupont",
      telephone: "0611223344",
      email: "d@ex.test",
    });
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Abattage", clientId: client.id });
    await creerNoteTranscrite(ctx, chantier.id);

    const rapport = await effacerClient(ctx, client.id, MAINTENANT);
    assert.ok(rapport);
    assert.strictEqual(rapport.conservees, 0);
    assert.strictEqual(rapport.motif, null, "rien conservé : aucun motif à annoncer");
    assert.ok(rapport.supprimes > 0);

    const apres = await relireClient(ctx, client.id);
    assert.ok(apres, "client introuvable après effacement");
    assert.strictEqual(apres.nom, "Client effacé");
    assert.strictEqual(apres.telephone, null);
    assert.strictEqual(apres.email, null);
    assert.ok(apres.effaceLe, "la date d'effacement n'est pas consignée");
  });

  await test("un devis accepté est conservé, avec le nom qui le rend valable", async () => {
    const ctx = await contexte("conserve");
    const client = await clientsRepo.creerClient(ctx, { nom: "Mme Costa", telephone: "0655443322" });
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Terrasse", clientId: client.id });
    const d = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
    const envoi = await creerEnvoi(
      ctx,
      {
        chantierId: chantier.id,
        devisId: d.id,
        canal: "sms",
        datesProposees: [versJourIso(ajouterJours(MAINTENANT, 10))],
        contenuDevis: "devis",
      },
      MAINTENANT
    );
    await enregistrerReponse(
      envoi.jeton,
      { accepte: true, dateRetenue: versJourIso(ajouterJours(MAINTENANT, 10)) },
      MAINTENANT
    );

    const rapport = await effacerClient(ctx, client.id, MAINTENANT);
    assert.ok(rapport);
    assert.strictEqual(rapport.conservees, 1, "le devis accepté devait être conservé");
    assert.match(rapport.motif ?? "", /obligation comptable/);
    assert.ok(rapport.echeanceConservation, "l'échéance doit être annoncée");

    const apres = await relireClient(ctx, client.id);
    assert.ok(apres, "client introuvable après effacement");
    assert.strictEqual(apres.nom, "Mme Costa", "le nom doit survivre : sans lui la pièce ne vaut rien");
    assert.strictEqual(apres.telephone, null, "les moyens de recontacter doivent partir");
    assert.match(apres.conservationMotif ?? "", /conservée/);
  });

  await test("le lien public du devis est retiré même quand le devis est conservé", async () => {
    const ctx = await contexte("lien");
    const client = await clientsRepo.creerClient(ctx, { nom: "M. Faucher" });
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Toiture", clientId: client.id });
    const d = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
    const envoi = await creerEnvoi(
      ctx,
      {
        chantierId: chantier.id,
        devisId: d.id,
        canal: "email",
        datesProposees: [versJourIso(ajouterJours(MAINTENANT, 12))],
        contenuDevis: "devis",
      },
      MAINTENANT
    );
    await enregistrerReponse(
      envoi.jeton,
      { accepte: true, dateRetenue: versJourIso(ajouterJours(MAINTENANT, 12)) },
      MAINTENANT
    );

    await effacerClient(ctx, client.id, MAINTENANT);

    const { lireParJeton } = await import("../src/server/repositories/envois-devis");
    assert.strictEqual(
      await lireParJeton(envoi.jeton, MAINTENANT),
      null,
      "un lien survivant rouvrirait l'accès aux données effacées"
    );
  });

  await test("effacer le client d'une autre entreprise est impossible", async () => {
    const a = await contexte("iso-a");
    const b = await contexte("iso-b");
    const client = await clientsRepo.creerClient(a, { nom: "Chez A" });
    assert.strictEqual(await effacerClient(b, client.id, MAINTENANT), null);

    const intact = await relireClient(a, client.id);
    assert.strictEqual(intact?.nom, "Chez A", "le client d'une autre entreprise a été modifié");
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
