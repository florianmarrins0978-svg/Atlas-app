import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as devisRepo from "../src/server/repositories/devis";
import {
  creerEnvoi,
  lireParJeton,
  enregistrerReponse,
  envoisEnAttente,
  reponsesNonVues,
  marquerReponseVue,
  joursOccupes,
  genererJeton,
  DatesProposeesInvalidesError,
} from "../src/server/repositories/envois-devis";
import {
  fenetreProposition,
  dateRetenable,
  motifRefusDate,
  versJourIso,
  ajouterJours,
} from "../src/server/disponibilites";
import { jourLisible } from "../src/lib/jour";
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

const MAINTENANT = new Date("2026-03-02T09:00:00Z");
const dans = (jours: number) => versJourIso(ajouterJours(MAINTENANT, jours));

async function contexteAvecDevis(email: string) {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: `Entreprise ${email}` },
    { email }
  );
  const ctx = { utilisateurId, entrepriseId: entreprise.id };
  const chantier = await chantiersRepo.creerChantier(ctx, {
    nom: "Élagage du tilleul",
    adresseChantier: "5 avenue de la République",
  });
  const d = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  return { ctx, chantierId: chantier.id, devisId: d.id };
}

async function main() {
  await nettoyerBase();

  // ---- Écriture des dates : ce que le client lit sur son devis.
  await test("une date est écrite en toutes lettres, sans décalage de fuseau", async () => {
    assert.strictEqual(jourLisible("2026-03-23"), "lundi 23 mars");
    assert.strictEqual(jourLisible("2026-12-31"), "jeudi 31 décembre");
    // Le premier du mois est le seul ordinal du français.
    assert.strictEqual(jourLisible("2026-08-01"), "samedi 1er août");
    // Un jour est un jour, pas un instant : minuit ne doit jamais reculer
    // d'une case selon le fuseau du lecteur.
    assert.strictEqual(jourLisible("2026-01-01"), "jeudi 1er janvier");
  });

  await test("une date illisible est rendue telle quelle, jamais devinée", async () => {
    assert.strictEqual(jourLisible("pas-une-date"), "pas-une-date");
  });

  // ---- Règles pures : la même fonction sert l'affichage et la revérification.
  await test("la fenêtre exclut aujourd'hui et demain", async () => {
    const f = fenetreProposition(MAINTENANT);
    assert.strictEqual(f.debut, dans(2), "le délai minimal n'est pas appliqué");
    assert.strictEqual(f.fin, dans(90));
  });

  await test("un jour occupé n'est pas retenable", async () => {
    const f = fenetreProposition(MAINTENANT);
    assert.strictEqual(dateRetenable(dans(10), [dans(10)], f), false);
    assert.strictEqual(dateRetenable(dans(10), [dans(11)], f), true);
  });

  await test("le motif du refus est explicite", async () => {
    const f = fenetreProposition(MAINTENANT);
    assert.strictEqual(motifRefusDate(dans(200), [], f), "hors_fenetre");
    assert.strictEqual(motifRefusDate(dans(0), [], f), "hors_fenetre");
    assert.strictEqual(motifRefusDate(dans(10), [dans(10)], f), "jour_occupe");
    assert.strictEqual(motifRefusDate(dans(10), [], f), null);
  });

  await test("deux jetons ne se ressemblent jamais", async () => {
    const jetons = new Set(Array.from({ length: 200 }, () => genererJeton()));
    assert.strictEqual(jetons.size, 200, "collision de jeton");
    for (const j of jetons) assert.ok(j.length >= 40, "jeton trop court");
  });

  // ---- Création de l'envoi
  await test("le patron ne peut pas proposer un jour déjà occupé", async () => {
    const { ctx, chantierId, devisId } = await contexteAvecDevis(`occupe-${Date.now()}@t.test`);
    const autre = await chantiersRepo.creerChantier(ctx, { nom: "Chantier déjà calé" });
    await chantiersRepo.planifierChantier(ctx, autre.id, dans(10));

    await assert.rejects(
      () =>
        creerEnvoi(
          ctx,
          { chantierId, devisId, canal: "sms", datesProposees: [dans(10)], contenuDevis: "devis" },
          MAINTENANT
        ),
      (err: unknown) => err instanceof DatesProposeesInvalidesError
    );
  });

  await test("une ou deux dates, jamais zéro ni trois", async () => {
    const { ctx, chantierId, devisId } = await contexteAvecDevis(`nb-${Date.now()}@t.test`);
    for (const dates of [[], [dans(5), dans(6), dans(7)]]) {
      await assert.rejects(() =>
        creerEnvoi(
          ctx,
          { chantierId, devisId, canal: "email", datesProposees: dates, contenuDevis: "d" },
          MAINTENANT
        )
      );
    }
  });

  await test("l'envoi place le chantier en attente de réponse", async () => {
    const { ctx, chantierId, devisId } = await contexteAvecDevis(`attente-${Date.now()}@t.test`);
    const envoi = await creerEnvoi(
      ctx,
      { chantierId, devisId, canal: "sms", datesProposees: [dans(10), dans(14)], contenuDevis: "devis" },
      MAINTENANT
    );
    assert.ok(envoi.jeton);
    assert.match(envoi.empreinteDevis, /^[0-9a-f]{64}$/);

    const chantier = await chantiersRepo.getChantier(ctx, chantierId);
    assert.ok(chantier?.devisEnvoyeAt, "le chantier n'est pas marqué comme envoyé");
    assert.strictEqual(chantier?.datePlanifiee, null, "il ne doit pas être planifié avant la réponse");

    const attente = await envoisEnAttente(ctx);
    assert.strictEqual(attente.length, 1);
  });

  // ---- Lecture par jeton
  await test("un jeton inconnu ne révèle rien", async () => {
    assert.strictEqual(await lireParJeton(genererJeton(), MAINTENANT), null);
    assert.strictEqual(await lireParJeton("", MAINTENANT), null);
  });

  await test("la page reçoit les jours occupés, et rien d'autre", async () => {
    const { ctx, chantierId, devisId } = await contexteAvecDevis(`page-${Date.now()}@t.test`);
    const autre = await chantiersRepo.creerChantier(ctx, { nom: "Chantier confidentiel" });
    await chantiersRepo.planifierChantier(ctx, autre.id, dans(20));

    const envoi = await creerEnvoi(
      ctx,
      { chantierId, devisId, canal: "email", datesProposees: [dans(10)], contenuDevis: "devis" },
      MAINTENANT
    );
    const vue = await lireParJeton(envoi.jeton, MAINTENANT);
    assert.ok(vue);
    assert.ok(vue.joursOccupes.includes(dans(20)), "le jour occupé n'est pas transmis");
    // Le contenu de la vue ne doit comporter que des dates et des identifiants.
    const serialise = JSON.stringify(vue);
    assert.ok(!/confidentiel/i.test(serialise), "un nom de chantier a fuité vers la page publique");
  });

  await test("un lien expiré est signalé comme tel", async () => {
    const { ctx, chantierId, devisId } = await contexteAvecDevis(`exp-${Date.now()}@t.test`);
    const envoi = await creerEnvoi(
      ctx,
      { chantierId, devisId, canal: "sms", datesProposees: [dans(10)], contenuDevis: "d" },
      MAINTENANT
    );
    const plusTard = ajouterJours(MAINTENANT, 60);
    const vue = await lireParJeton(envoi.jeton, plusTard);
    assert.strictEqual(vue?.expire, true);
  });

  // ---- Réponse du client
  await test("acceptation d'une date proposée : chantier planifié", async () => {
    const { ctx, chantierId, devisId } = await contexteAvecDevis(`ok-${Date.now()}@t.test`);
    const envoi = await creerEnvoi(
      ctx,
      { chantierId, devisId, canal: "sms", datesProposees: [dans(10), dans(14)], contenuDevis: "d" },
      MAINTENANT
    );
    const r = await enregistrerReponse(
      envoi.jeton,
      { accepte: true, dateRetenue: dans(14), adresseIp: "203.0.113.9", agentUtilisateur: "Test" },
      MAINTENANT
    );
    assert.deepStrictEqual(r, { succes: true, dateRetenue: dans(14), contreProposee: false });

    const chantier = await chantiersRepo.getChantier(ctx, chantierId);
    assert.strictEqual(chantier?.datePlanifiee, dans(14));
  });

  await test("contre-proposition sur un jour libre : acceptée et signalée", async () => {
    const { ctx, chantierId, devisId } = await contexteAvecDevis(`cp-${Date.now()}@t.test`);
    const envoi = await creerEnvoi(
      ctx,
      { chantierId, devisId, canal: "email", datesProposees: [dans(10)], contenuDevis: "d" },
      MAINTENANT
    );
    const r = await enregistrerReponse(
      envoi.jeton,
      { accepte: true, dateRetenue: dans(30), precision: "plutôt le matin", demarrageAnticipe: true },
      MAINTENANT
    );
    assert.strictEqual(r.succes, true);
    assert.strictEqual(r.succes && r.contreProposee, true, "la contre-proposition n'est pas signalée");

    const chantier = await chantiersRepo.getChantier(ctx, chantierId);
    assert.strictEqual(chantier?.datePlanifiee, dans(30));
  });

  await test("revérification : une date prise entre-temps est refusée", async () => {
    const { ctx, chantierId, devisId } = await contexteAvecDevis(`race-${Date.now()}@t.test`);
    const envoi = await creerEnvoi(
      ctx,
      { chantierId, devisId, canal: "sms", datesProposees: [dans(10)], contenuDevis: "d" },
      MAINTENANT
    );

    // Le patron cale un autre chantier ce jour-là APRÈS l'envoi.
    const autre = await chantiersRepo.creerChantier(ctx, { nom: "Urgence" });
    await chantiersRepo.planifierChantier(ctx, autre.id, dans(10));

    const r = await enregistrerReponse(
      envoi.jeton,
      { accepte: true, dateRetenue: dans(10) },
      MAINTENANT
    );
    assert.deepStrictEqual(r, { succes: false, motif: "date_indisponible" });

    // Le devis n'est pas marqué accepté : l'appelant doit redemander une date.
    const vue = await lireParJeton(envoi.jeton, MAINTENANT);
    assert.strictEqual(vue?.reponse, null);
  });

  await test("une date hors fenêtre est refusée", async () => {
    const { ctx, chantierId, devisId } = await contexteAvecDevis(`hf-${Date.now()}@t.test`);
    const envoi = await creerEnvoi(
      ctx,
      { chantierId, devisId, canal: "sms", datesProposees: [dans(10)], contenuDevis: "d" },
      MAINTENANT
    );
    const r = await enregistrerReponse(
      envoi.jeton,
      { accepte: true, dateRetenue: dans(300) },
      MAINTENANT
    );
    assert.deepStrictEqual(r, { succes: false, motif: "date_indisponible" });
  });

  await test("refus : enregistré, chantier non planifié, patron notifié", async () => {
    const { ctx, chantierId, devisId } = await contexteAvecDevis(`refus-${Date.now()}@t.test`);
    const envoi = await creerEnvoi(
      ctx,
      { chantierId, devisId, canal: "email", datesProposees: [dans(10)], contenuDevis: "d" },
      MAINTENANT
    );
    const r = await enregistrerReponse(
      envoi.jeton,
      { accepte: false, precision: "trop cher pour l'instant" },
      MAINTENANT
    );
    assert.deepStrictEqual(r, { succes: true, dateRetenue: null, contreProposee: false });

    const chantier = await chantiersRepo.getChantier(ctx, chantierId);
    assert.strictEqual(chantier?.datePlanifiee, null, "un refus ne doit rien planifier");

    const nonVues = await reponsesNonVues(ctx);
    assert.strictEqual(nonVues.length, 1);
    assert.strictEqual(nonVues[0].reponse, "refusee");

    await marquerReponseVue(ctx, nonVues[0].id, MAINTENANT);
    assert.strictEqual((await reponsesNonVues(ctx)).length, 0);
  });

  await test("on ne répond pas deux fois", async () => {
    const { ctx, chantierId, devisId } = await contexteAvecDevis(`double-${Date.now()}@t.test`);
    const envoi = await creerEnvoi(
      ctx,
      { chantierId, devisId, canal: "sms", datesProposees: [dans(10)], contenuDevis: "d" },
      MAINTENANT
    );
    await enregistrerReponse(envoi.jeton, { accepte: true, dateRetenue: dans(10) }, MAINTENANT);
    const seconde = await enregistrerReponse(
      envoi.jeton,
      { accepte: false },
      MAINTENANT
    );
    assert.deepStrictEqual(seconde, { succes: false, motif: "deja_repondu" });
  });

  await test("un lien expiré ne permet plus de répondre", async () => {
    const { ctx, chantierId, devisId } = await contexteAvecDevis(`expr-${Date.now()}@t.test`);
    const envoi = await creerEnvoi(
      ctx,
      { chantierId, devisId, canal: "sms", datesProposees: [dans(10)], contenuDevis: "d" },
      MAINTENANT
    );
    const r = await enregistrerReponse(
      envoi.jeton,
      { accepte: true, dateRetenue: dans(10) },
      ajouterJours(MAINTENANT, 60)
    );
    assert.deepStrictEqual(r, { succes: false, motif: "expire" });
  });

  await test("accepter sans date est refusé", async () => {
    const { ctx, chantierId, devisId } = await contexteAvecDevis(`sansdate-${Date.now()}@t.test`);
    const envoi = await creerEnvoi(
      ctx,
      { chantierId, devisId, canal: "sms", datesProposees: [dans(10)], contenuDevis: "d" },
      MAINTENANT
    );
    const r = await enregistrerReponse(envoi.jeton, { accepte: true }, MAINTENANT);
    assert.deepStrictEqual(r, { succes: false, motif: "date_manquante" });
  });

  // ---- Cloisonnement
  await test("une entreprise ne voit jamais les envois d'une autre", async () => {
    const a = await contexteAvecDevis(`iso-a-${Date.now()}@t.test`);
    const b = await contexteAvecDevis(`iso-b-${Date.now()}@t.test`);
    await creerEnvoi(
      a.ctx,
      { chantierId: a.chantierId, devisId: a.devisId, canal: "sms", datesProposees: [dans(10)], contenuDevis: "d" },
      MAINTENANT
    );
    assert.strictEqual((await envoisEnAttente(b.ctx)).length, 0);
  });

  await test("les jours occupés d'une entreprise ne fuient pas chez l'autre", async () => {
    const a = await contexteAvecDevis(`jo-a-${Date.now()}@t.test`);
    const b = await contexteAvecDevis(`jo-b-${Date.now()}@t.test`);
    const chantierA = await chantiersRepo.creerChantier(a.ctx, { nom: "Chez A" });
    await chantiersRepo.planifierChantier(a.ctx, chantierA.id, dans(12));

    const f = fenetreProposition(MAINTENANT);
    assert.ok((await joursOccupes(a.ctx, f.debut, f.fin)).includes(dans(12)));
    assert.strictEqual((await joursOccupes(b.ctx, f.debut, f.fin)).includes(dans(12)), false);
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
