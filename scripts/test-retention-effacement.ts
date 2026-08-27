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
import {
  exporterClient,
  effacerClient,
  apercuSuppressionClient,
} from "../src/server/repositories/donnees-client";
import * as facturesRepo from "../src/server/repositories/factures";
import * as lignesPrixRepo from "../src/server/repositories/lignes-prix";
import { devis as devisTable } from "../src/server/db/schema";
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
    assert.deepStrictEqual(rapport.pieces, [], "rien n'engageait : rien ne devait être conservé");
    assert.strictEqual(rapport.motif, null, "rien conservé : aucun motif à annoncer");
    assert.ok(rapport.supprimes > 0);

    // **IL DISPARAÎT POUR DE BON — sa proposition C, tranchée le 27 août 2026.**
    // Ce cas exigeait auparavant une fiche renommée « Client effacé », qui
    // restait en base. Il a choisi la suppression entière quand rien n'engage :
    // on adapte le contrôle à sa décision, on ne réclame pas ce qu'il a fait
    // retirer (`CLAUDE.md` §5 bis).
    assert.strictEqual(rapport.disparu, true, "le rapport annonce une fiche survivante");
    assert.strictEqual(
      await relireClient(ctx, client.id),
      null,
      "la fiche du client existe encore : il la retrouverait en cherchant"
    );
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
      { decision: "accepte" as const, dateRetenue: versJourIso(ajouterJours(MAINTENANT, 10)) },
      MAINTENANT
    );

    const rapport = await effacerClient(ctx, client.id, MAINTENANT);
    assert.ok(rapport);
    assert.strictEqual(rapport.pieces.length, 1, "le devis accepté devait être conservé");
    assert.strictEqual(rapport.pieces[0].quoi, "devis-accepte");
    // **La pièce porte son NUMÉRO**, sans quoi l'écran dirait « un devis est
    // conservé » — une phrase qu'on ne peut pas retrouver dans un classeur.
    assert.ok(rapport.pieces[0].numero && rapport.pieces[0].numero !== "?", "la pièce conservée n'est pas nommée");
    assert.ok(rapport.pieces[0].jusquAu, "l'échéance doit être annoncée");
    assert.strictEqual(rapport.disparu, false, "une pièce le retient : il ne peut pas avoir disparu");
    assert.match(rapport.motif ?? "", /obligation comptable/);

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
      { decision: "accepte" as const, dateRetenue: versJourIso(ajouterJours(MAINTENANT, 12)) },
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

  // ─── LE CAS QUI MANQUAIT, ET QUI FAISAIT TOMBER LA FONCTION ───────────────
  //
  // **Trouvé le 26 août 2026 en cherchant avant de coder** (`CLAUDE.md` §5 ter) :
  // `effacerClient` levait sur un client à qui un devis était simplement PARTI.
  // Elle ne conservait que les devis liés à une acceptation et tentait de
  // détruire les autres — or `trg_devis_immuable` scelle tout devis `envoye`.
  //
  // **Aucune suite ne le voyait** : elles couvraient le client sans devis, et le
  // devis accepté. Le milieu — parti, sans réponse — est pourtant l'état le plus
  // fréquent, et c'est celui dans lequel le patron a essayé.
  await test("un devis PARTI sans réponse ne bloque plus la suppression", async () => {
    const ctx = await contexte("devis-parti");
    const client = await clientsRepo.creerClient(ctx, { nom: "M. Renard", telephone: "0611000011" });
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Haie", clientId: client.id });
    const d = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
    await devisRepo.envoyerDevis(ctx, d.id);

    const rapport = await effacerClient(ctx, client.id, MAINTENANT);
    assert.ok(rapport, "la suppression n'a rien rendu");
    assert.deepStrictEqual(
      rapport.pieces,
      [],
      "un devis parti sans réponse n'engage rien : il ne doit rien retenir"
    );
    assert.strictEqual(rapport.disparu, true, "le client devait disparaître entièrement");
    assert.strictEqual(await relireClient(ctx, client.id), null, "la fiche existe encore");

    const restant = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) =>
      tx.select({ id: devisTable.id }).from(devisTable).where(eq(devisTable.id, d.id))
    );
    assert.strictEqual(restant.length, 0, "le devis parti est resté en base");
  });

  // ─── ET LA PORTE NE S'OUVRE QUE LÀ ────────────────────────────────────────
  //
  // **C'est le contrôle qui défend la migration 0068.** Elle apprend au
  // déclencheur à céder pour un `DELETE`, mais SEULEMENT quand l'effacement a
  // posé son réglage de session. Sans ce cas, on aurait ouvert la porte à tout
  // le monde sans que rien ne rougisse.
  await test("hors effacement, un devis envoyé résiste toujours à la suppression", async () => {
    const ctx = await contexte("porte-fermee");
    const client = await clientsRepo.creerClient(ctx, { nom: "Mme Aubry" });
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Massif", clientId: client.id });
    const d = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
    await devisRepo.envoyerDevis(ctx, d.id);

    let refuse = false;
    try {
      await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) =>
        tx.delete(devisTable).where(eq(devisTable.id, d.id))
      );
    } catch (err) {
      refuse = /ne peut pas être supprimé/.test(
        (err as { cause?: Error }).cause?.message ?? (err as Error).message
      );
    }
    assert.ok(refuse, "un devis envoyé se supprime hors effacement : le sceau ne vaut plus rien");
  });

  // ─── CE QUE LA LOI CLOUE, ET QU'AUCUNE CONFIRMATION NE LÈVE ───────────────
  await test("une facture émise retient le client, et se DIT avec son numéro", async () => {
    const ctx = await contexte("facture");
    const client = await clientsRepo.creerClient(ctx, { nom: "M. Vasseur", telephone: "0622000022" });
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Terrasse", clientId: client.id });
    await lignesPrixRepo.ajouterLignePrix(ctx, chantier.id, "Dallage", "900.00");
    const d = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
    await devisRepo.envoyerDevis(ctx, d.id);
    await facturesRepo.terminerChantier(ctx, chantier.id, MAINTENANT);
    const f = await facturesRepo.getFacturePourChantier(ctx, chantier.id);
    assert.ok(f, "le montage n'a pas produit de facture : il n'y a rien à mesurer");
    await facturesRepo.emettreFacture(ctx, f.facture.id, MAINTENANT);

    // **L'aperçu prévient AVANT, avec le numéro.** C'est sa règle du 27 août :
    // la phrase de prévention doit dire ce qui restera, pas « des documents ».
    const avant = await apercuSuppressionClient(ctx, client.id, MAINTENANT);
    assert.ok(avant, "l'aperçu ne rend rien");
    assert.strictEqual(avant.pieces.length, 1, "la facture émise n'est pas annoncée");
    assert.strictEqual(avant.pieces[0].quoi, "facture");
    assert.match(avant.pieces[0].numero, /^F/, `numéro inattendu : « ${avant.pieces[0].numero} »`);
    assert.match(avant.pieces[0].pourquoi, /dix ans/);

    // **Et l'aperçu ne touche à RIEN** : le client est encore là après.
    assert.ok(await relireClient(ctx, client.id), "l'aperçu a supprimé quelque chose");

    const rapport = await effacerClient(ctx, client.id, MAINTENANT);
    assert.ok(rapport);
    assert.strictEqual(rapport.disparu, false, "une facture émise ne peut pas laisser disparaître le client");
    assert.strictEqual(rapport.pieces.length, 1);
    assert.strictEqual(rapport.pieces[0].quoi, "facture");

    const apres = await relireClient(ctx, client.id);
    assert.ok(apres, "le client a disparu malgré sa facture : la pièce ne vaut plus rien sans son nom");
    assert.strictEqual(apres.nom, "M. Vasseur", "le nom doit survivre avec la facture");
    assert.strictEqual(apres.telephone, null, "les moyens de recontacter doivent partir");
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
