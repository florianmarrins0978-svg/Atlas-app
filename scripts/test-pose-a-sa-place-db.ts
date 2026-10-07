/**
 * POSER UN CLIENT À SA PLACE — son choix B du 7 octobre 2026.
 *
 * Sa question : *« si j'envoie un devis à un client, que c'est une personne
 * âgée et qu'elle n'arrive pas à choisir ses dates via mon lien, est-ce que du
 * planning je peux reprendre le client avec le devis pour l'ajouter moi-même ? »*
 * Ce n'était pas possible. Ce que cette suite garde, sur la base, sous le rôle
 * de l'application (la RLS s'applique) :
 *
 *   A. « Signe sur son lien » : le chantier est posé, le devis N'EST PAS
 *      accepté, et le lien montre les jours posés au lieu d'en offrir.
 *   B. Sa réponse ne déplace jamais le chantier : un jour posté d'ailleurs est
 *      ignoré, ses demi-journées restent celles du patron.
 *   C. Les 14 jours de rétractation tiennent sur le lien comme avant.
 *   D. « Signé sur papier » : accepté, marqué papier, saisi par qui, lien fermé,
 *      et aucune carte « Devis accepté » pour son propre geste.
 *   E. Papier dans les 14 jours sans demande écrite : refusé, et RIEN n'est
 *      écrit, ni la place ni l'accord.
 *   F. Un envoi qui n'attend plus rien ne se pose pas à sa place.
 *   G. Une autre entreprise ne peut rien poser.
 *   H. Retiré du planning, le lien redevient celui d'avant.
 *   I. Une correction sur des jours posés ne porte aucun souhait de date.
 *
 *   npx tsx scripts/test-pose-a-sa-place-db.ts   (sur atlas_test)
 */
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { envoisDevis } from "../src/server/db/schema";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import { creerEnvoi, enregistrerReponse, lireParJeton } from "../src/server/repositories/envois-devis";
import { poserALaPlaceDuClient } from "../src/server/repositories/pose-a-sa-place";
import { notificationsPatron } from "../src/server/repositories/envois-devis";
import { versJourIso, ajouterJours } from "../src/lib/disponibilites";
import { nettoyerBase } from "./_test-db";

let reussis = 0;
let echoues = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    reussis++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    echoues++;
  }
}

// Un mardi : les jours ouvrés qui suivent se comptent sans surprise de week-end.
const MARDI = new Date("2026-03-03T09:00:00Z");
const dans = (n: number) => versJourIso(ajouterJours(MARDI, n));
// Dans ses 14 jours (lundi), et bien au-delà (mardi + 4 semaines).
const DANS_LE_DELAI = dans(6);
const HORS_DELAI = dans(28);
const PROPOSEE = dans(21);

type Ctx = { utilisateurId: string; entrepriseId: string };

async function contexte(email: string): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise({ nom: "Jardins Roux" }, { email });
  return { utilisateurId, entrepriseId: entreprise.id };
}

/** Un chantier de deux jours dont le devis est parti, sans réponse. */
async function devisParti(ctx: Ctx, nom: string) {
  const client = await clientsRepo.creerClient(ctx, { nom: "Mme Roux", email: "roux@test.local" });
  await clientsRepo.mettreAJourClient(ctx, client.id, { canalCommunication: "email" });
  const chantier = await chantiersRepo.creerChantier(ctx, { nom, clientId: client.id });
  await chantiersRepo.mettreAJourDureeEquipe(ctx, chantier.id, { dureePrevue: "2 jours" });
  const devis = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  const envoi = await creerEnvoi(
    ctx,
    { chantierId: chantier.id, devisId: devis.id, canal: "email", datesProposees: [PROPOSEE], contenuDevis: nom },
    MARDI
  );
  return { chantierId: chantier.id, jeton: envoi.jeton, envoiId: envoi.id };
}

async function lireEnvoi(ctx: Ctx, envoiId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [e] = await tx.select().from(envoisDevis).where(eq(envoisDevis.id, envoiId)).limit(1);
    return e;
  });
}

const cles = (creneaux: readonly { jour: string; moment: string }[]) =>
  creneaux.map((c) => `${c.jour}:${c.moment}`).sort();

async function main() {
  await nettoyerBase();

  await test("A. signe sur son lien : posé, PAS accepté, et le lien montre les jours posés", async () => {
    const ctx = await contexte(`lien-${Date.now()}@t.test`);
    const c = await devisParti(ctx, "Taille de haie");
    const r = await poserALaPlaceDuClient(ctx, c.chantierId, HORS_DELAI, { maniere: "lien" }, MARDI);
    assert.equal(r.succes, true, "La pose a été refusée.");

    const poses = await chantiersRepo.creneauxDunChantier(ctx, c.chantierId);
    assert.equal(poses.length, 4, `Deux jours devaient se poser, il y a ${poses.length} demi-journées.`);
    assert.equal(poses[0].jour, HORS_DELAI);

    const e = await lireEnvoi(ctx, c.envoiId);
    assert.equal(e.reponse, null, "Poser a valu accord : c'est exactement ce qui a été refusé.");
    assert.equal(e.datesFixeesParArtisan, true);
    assert.equal(e.accordSurPapier, false);

    const lu = await lireParJeton(c.jeton, MARDI);
    assert.deepEqual(lu?.joursFixes, [...new Set(poses.map((p) => p.jour))].sort());
  });

  await test("B. sa réponse ne déplace jamais le chantier, même si le formulaire poste un autre jour", async () => {
    const ctx = await contexte(`fixe-${Date.now()}@t.test`);
    const c = await devisParti(ctx, "Élagage");
    await poserALaPlaceDuClient(ctx, c.chantierId, HORS_DELAI, { maniere: "lien" }, MARDI);
    // Le patron décale le départ à l'après-midi : c'est SA place, demi-journée comprise.
    await chantiersRepo.deplacerChantier(ctx, c.chantierId, "apres_midi");
    const avant = cles(await chantiersRepo.creneauxDunChantier(ctx, c.chantierId));

    const r = await enregistrerReponse(
      c.jeton,
      { decision: "accepte", dateRetenue: PROPOSEE, joursRetenus: [PROPOSEE, dans(22)] },
      MARDI
    );
    assert.equal(r.succes, true, `L'accord a été refusé : ${JSON.stringify(r)}`);
    assert.deepEqual(cles(await chantiersRepo.creneauxDunChantier(ctx, c.chantierId)), avant, "Le chantier a bougé.");

    const e = await lireEnvoi(ctx, c.envoiId);
    assert.equal(e.reponse, "acceptee");
    assert.equal(e.dateRetenue, HORS_DELAI, "La date retenue n'est pas le premier jour posé.");
    assert.equal(e.dateContreProposee, false, "Ses propres jours se lisent comme une contre-proposition.");
    assert.equal(e.accordSurPapier, false, "Une signature en ligne s'est marquée papier.");
  });

  await test("C. sur le lien, les 14 jours de rétractation tiennent comme avant", async () => {
    const ctx = await contexte(`delai-${Date.now()}@t.test`);
    const c = await devisParti(ctx, "Tonte");
    await poserALaPlaceDuClient(ctx, c.chantierId, DANS_LE_DELAI, { maniere: "lien" }, MARDI);
    const sans = await enregistrerReponse(c.jeton, { decision: "accepte", dateRetenue: DANS_LE_DELAI }, MARDI);
    assert.deepEqual(sans, { succes: false, motif: "demarrage_non_demande" });
    const avec = await enregistrerReponse(
      c.jeton,
      { decision: "accepte", dateRetenue: DANS_LE_DELAI, demarrageAnticipe: true },
      MARDI
    );
    assert.equal(avec.succes, true);
  });

  await test("D. signé sur papier : accepté, marqué papier, saisi par lui, lien fermé, aucune carte", async () => {
    const ctx = await contexte(`papier-${Date.now()}@t.test`);
    const c = await devisParti(ctx, "Plantation");
    const r = await poserALaPlaceDuClient(
      ctx,
      c.chantierId,
      HORS_DELAI,
      { maniere: "papier", demarrageAnticipe: false },
      MARDI
    );
    assert.equal(r.succes, true);
    const e = await lireEnvoi(ctx, c.envoiId);
    assert.equal(e.reponse, "acceptee");
    assert.equal(e.accordSurPapier, true);
    assert.equal(e.accordPapierPar, ctx.utilisateurId);
    assert.equal(e.dateRetenue, HORS_DELAI);
    assert.equal(e.adresseIp, null, "Une adresse a été inventée pour un accord papier.");
    assert.ok(e.vuParPatronAt, "Sa propre saisie lui reviendrait en carte « Devis accepté ».");

    const notifs = await notificationsPatron(ctx);
    assert.ok(!notifs.some((n) => JSON.stringify(n).includes(c.chantierId)), "Une carte annonce son propre geste.");

    const lu = await lireParJeton(c.jeton, MARDI);
    assert.equal(lu?.reponse, "acceptee", "Le lien reste ouvert à une réponse.");
    const encore = await enregistrerReponse(c.jeton, { decision: "refuse" }, MARDI);
    assert.deepEqual(encore, { succes: false, motif: "deja_repondu" });
  });

  await test("E. papier dans les 14 jours sans demande écrite : refusé, et RIEN n'est écrit", async () => {
    const ctx = await contexte(`papier-delai-${Date.now()}@t.test`);
    const c = await devisParti(ctx, "Débroussaillage");
    const r = await poserALaPlaceDuClient(
      ctx,
      c.chantierId,
      DANS_LE_DELAI,
      { maniere: "papier", demarrageAnticipe: false },
      MARDI
    );
    assert.deepEqual(r, { succes: false, motif: "demarrage_non_demande" });
    assert.equal((await chantiersRepo.creneauxDunChantier(ctx, c.chantierId)).length, 0, "Le chantier s'est posé quand même.");
    const e = await lireEnvoi(ctx, c.envoiId);
    assert.equal(e.reponse, null);
    assert.equal(e.datesFixeesParArtisan, false);

    const ok = await poserALaPlaceDuClient(
      ctx,
      c.chantierId,
      DANS_LE_DELAI,
      { maniere: "papier", demarrageAnticipe: true },
      MARDI
    );
    assert.equal(ok.succes, true);
    assert.equal((await lireEnvoi(ctx, c.envoiId)).demarrageAnticipe, true);
  });

  await test("F. un envoi qui n'attend plus rien ne se pose pas à sa place", async () => {
    const ctx = await contexte(`repondu-${Date.now()}@t.test`);
    const c = await devisParti(ctx, "Arrosage");
    await enregistrerReponse(c.jeton, { decision: "refuse" }, MARDI);
    const r = await poserALaPlaceDuClient(ctx, c.chantierId, HORS_DELAI, { maniere: "lien" }, MARDI);
    assert.deepEqual(r, { succes: false, motif: "plus_en_attente" });
    assert.equal((await chantiersRepo.creneauxDunChantier(ctx, c.chantierId)).length, 0);
  });

  await test("G. une autre entreprise ne peut rien poser", async () => {
    const ctx = await contexte(`proprio-${Date.now()}@t.test`);
    const autre = await contexte(`intrus-${Date.now()}@t.test`);
    const c = await devisParti(ctx, "Clôture");
    const r = await poserALaPlaceDuClient(autre, c.chantierId, HORS_DELAI, { maniere: "papier", demarrageAnticipe: true }, MARDI);
    assert.deepEqual(r, { succes: false, motif: "plus_en_attente" });
    const e = await lireEnvoi(ctx, c.envoiId);
    assert.equal(e.reponse, null);
    assert.equal((await chantiersRepo.creneauxDunChantier(ctx, c.chantierId)).length, 0);
  });

  await test("H. retiré du planning, le lien redevient celui d'avant", async () => {
    const ctx = await contexte(`retire-${Date.now()}@t.test`);
    const c = await devisParti(ctx, "Pelouse");
    await poserALaPlaceDuClient(ctx, c.chantierId, HORS_DELAI, { maniere: "lien" }, MARDI);
    await chantiersRepo.deplanifierChantier(ctx, c.chantierId);
    const lu = await lireParJeton(c.jeton, MARDI);
    assert.equal(lu?.joursFixes, null, "Le lien montre des jours qui ne sont plus posés.");
    const r = await enregistrerReponse(c.jeton, { decision: "accepte", dateRetenue: PROPOSEE, demarrageAnticipe: true }, MARDI);
    assert.equal(r.succes, true, "Elle ne peut plus répondre par ses dates proposées.");
  });

  await test("I. une correction sur des jours posés ne porte aucun souhait de date", async () => {
    const ctx = await contexte(`correction-${Date.now()}@t.test`);
    const c = await devisParti(ctx, "Massif");
    await poserALaPlaceDuClient(ctx, c.chantierId, HORS_DELAI, { maniere: "lien" }, MARDI);
    const r = await enregistrerReponse(
      c.jeton,
      { decision: "correction", precision: "Le prix de la haie", dateRetenue: HORS_DELAI },
      MARDI
    );
    assert.equal(r.succes, true);
    const e = await lireEnvoi(ctx, c.envoiId);
    assert.equal(e.reponse, "correction");
    assert.equal(e.joursSouhaites, null, "Les jours du patron se sont inscrits comme un souhait du client.");
  });

  console.log(`\n${reussis} réussi(s), ${echoues} échoué(s)`);
  await pool.end();
  process.exit(echoues === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
