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
  jourRetenable,
  compterOccupation,
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
    // **L'année de référence est passée explicitement.** Sans elle, ces
    // contrôles auraient viré au rouge le 1er janvier prochain, sur un produit
    // parfaitement sain — une bombe à retardement dans la batterie.
    assert.strictEqual(jourLisible("2026-03-23", MAINTENANT), "lundi 23 mars");
    assert.strictEqual(jourLisible("2026-12-31", MAINTENANT), "jeudi 31 décembre");
    // Le premier du mois est le seul ordinal du français.
    assert.strictEqual(jourLisible("2026-08-01", MAINTENANT), "samedi 1er août");
    // Un jour est un jour, pas un instant : minuit ne doit jamais reculer
    // d'une case selon le fuseau du lecteur.
    assert.strictEqual(jourLisible("2026-01-01", MAINTENANT), "jeudi 1er janvier");
  });

  await test("une date d'une AUTRE année porte son millésime", async () => {
    // **Arrivé avec les dates lointaines.** Depuis que le patron peut proposer
    // à dix-huit mois, « lundi 8 février » ne désigne plus rien : février
    // prochain, ou celui d'après ? Il enverrait une date à un an d'écart de ce
    // qu'il croit, et son client la lirait de même.
    assert.strictEqual(jourLisible("2027-02-08", MAINTENANT), "lundi 8 février 2027");
    assert.strictEqual(jourLisible("2027-08-01", MAINTENANT), "dimanche 1er août 2027");
    // Et l'année en cours reste sobre : quatre-vingt-dix-neuf devis sur cent
    // n'ont que faire de leur millésime.
    assert.doesNotMatch(jourLisible("2026-03-23", MAINTENANT), /2026/);
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
    // Depuis les créneaux (migration 0019), la règle raisonne en demi-journées :
    // un jour n'est plein que si le chantier visé n'y tient plus. Le détail est
    // éprouvé par `test-creneaux.ts` ; ici on vérifie que la règle est bien
    // celle qu'emploie tout ce fichier.
    const f = fenetreProposition(MAINTENANT);
    const UNE_JOURNEE = 2;
    const pris = compterOccupation([{ jour: dans(10), moment: "matin", dureeDemiJournees: UNE_JOURNEE }], 1);
    assert.strictEqual(jourRetenable(dans(10), UNE_JOURNEE, pris, 1, f), false);
    assert.strictEqual(jourRetenable(dans(11), UNE_JOURNEE, pris, 1, f), true);
  });

  await test("hors fenêtre, un jour libre reste refusé", async () => {
    const f = fenetreProposition(MAINTENANT);
    assert.strictEqual(jourRetenable(dans(200), 2, new Map(), 1, f), false, "borne haute");
    assert.strictEqual(jourRetenable(dans(0), 2, new Map(), 1, f), false, "délai minimal");
  });

  await test("deux jetons ne se ressemblent jamais", async () => {
    const jetons = new Set(Array.from({ length: 200 }, () => genererJeton()));
    assert.strictEqual(jetons.size, 200, "collision de jeton");
    for (const j of jetons) assert.ok(j.length >= 40, "jeton trop court");
  });

  // ---- Création de l'envoi
  //
  // **Ce contrôle a été RETOURNÉ le 23 août 2026, sur sa règle :** *« si
  // l'utilisateur juge qu'il peut rajouter un chantier, il doit pouvoir le
  // faire quand même ; nous on a mis un message disant que c'est complet »*.
  // Il réclamait le refus qu'il fait retirer ; le remettre rendrait son écran
  // impossible à changer (`CLAUDE.md` §5 bis).
  await test("le patron PEUT proposer un jour déjà occupé, en le sachant", async () => {
    const { ctx, chantierId, devisId } = await contexteAvecDevis(`occupe-${Date.now()}@t.test`);
    const autre = await chantiersRepo.creerChantier(ctx, { nom: "Chantier déjà calé" });
    await chantiersRepo.planifierChantier(ctx, autre.id, dans(10));

    const envoi = await creerEnvoi(
      ctx,
      { chantierId, devisId, canal: "sms", datesProposees: [dans(10)], contenuDevis: "devis" },
      MAINTENANT
    );
    assert.deepStrictEqual(envoi.datesProposees, [dans(10)], "sa date n'a pas été retenue");
  });

  // **Ce qui reste refusé, et ce n'est PAS un jugement d'artisan.** Une date
  // passée ou au-delà de dix-huit mois n'est pas un arbitrage : la fenêtre
  // garde donc ses bornes. Sans ce contrôle, le retournement ci-dessus aurait
  // tout ouvert d'un coup, et personne ne s'en serait aperçu.
  await test("mais jamais une date hors de sa fenêtre", async () => {
    const { ctx, chantierId, devisId } = await contexteAvecDevis(`fenetre-${Date.now()}@t.test`);
    await assert.rejects(
      () =>
        creerEnvoi(
          ctx,
          { chantierId, devisId, canal: "sms", datesProposees: [dans(-30)], contenuDevis: "devis" },
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
      { decision: "accepte" as const, dateRetenue: dans(14), adresseIp: "203.0.113.9", agentUtilisateur: "Test" },
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
      { decision: "accepte" as const, dateRetenue: dans(30), precision: "plutôt le matin", demarrageAnticipe: true },
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
      { decision: "accepte" as const, dateRetenue: dans(10) },
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
      { decision: "accepte" as const, dateRetenue: dans(300) },
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
      { decision: "refuse" as const, precision: "trop cher pour l'instant" },
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
    await enregistrerReponse(envoi.jeton, { decision: "accepte" as const, dateRetenue: dans(10) }, MAINTENANT);
    const seconde = await enregistrerReponse(
      envoi.jeton,
      { decision: "refuse" as const },
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
      { decision: "accepte" as const, dateRetenue: dans(10) },
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
    const r = await enregistrerReponse(envoi.jeton, { decision: "accepte" as const }, MAINTENANT);
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

  // ---- Une date lointaine : le parcours entier, de bout en bout ----------
  //
  // **Le patron, le 8 août 2026 :** *« la proposition des dates au client, on a
  // une visibilité que sur une semaine. Comment je fais si je dois lui proposer
  // une date dans six mois ? »* Il ajoutait : *« c'est un problème qui va se
  // produire à coup sûr. »*
  //
  // Ce que ces cas tiennent, et qu'aucune règle pure ne peut tenir : la date
  // lointaine traverse RÉELLEMENT la base — création, relecture du lien,
  // acceptation, planification. Trois barrières se dressaient sur ce chemin,
  // toutes calées sur une fenêtre glissante de trois mois.

  const DANS_SIX_MOIS = dans(182);

  // ---- Une date TRÈS PROCHE : le parcours entier, dans l'autre sens -------
  //
  // **Sa règle du 31 août 2026 :** *« si l'utilisateur veut choisir le
  // 1ᵉʳ septembre il doit pouvoir ! »* — le lendemain, donc.
  //
  // C'est la symétrie exacte du bloc ci-dessous, et elle méritait ses propres
  // cas : la borne haute avait coûté trois barrières, la borne basse en cachait
  // une, à l'endroit le plus cher — la page du client.

  const DEMAIN = dans(1);

  await test("le patron peut proposer DEMAIN", async () => {
    const { ctx, chantierId, devisId } = await contexteAvecDevis(`proche-${Date.now()}@t.test`);
    const envoi = await creerEnvoi(
      ctx,
      { chantierId, devisId, canal: "sms", datesProposees: [DEMAIN], contenuDevis: "x" },
      MAINTENANT
    );
    assert.ok(envoi.jeton, "l'envoi n'a pas été créé");
  });

  await test("une date PASSÉE reste refusée", async () => {
    // La seule borne basse qui subsiste. Ouvrir le lendemain sans la garder
    // aurait ouvert hier du même geste — et un client ne peut pas retenir un
    // jour écoulé.
    const { ctx, chantierId, devisId } = await contexteAvecDevis(`hier-${Date.now()}@t.test`);
    await assert.rejects(
      creerEnvoi(
        ctx,
        { chantierId, devisId, canal: "sms", datesProposees: [dans(-1)], contenuDevis: "x" },
        MAINTENANT
      ),
      /hors_fenetre|Date/i
    );
  });

  await test("le client VOIT la date de demain dans sa fenêtre", async () => {
    // La fenêtre du client commence après-demain. Une date proposée en deçà
    // tombait dessous, et rien ne le disait.
    const { ctx, chantierId, devisId } = await contexteAvecDevis(`vueproche-${Date.now()}@t.test`);
    const envoi = await creerEnvoi(
      ctx,
      { chantierId, devisId, canal: "sms", datesProposees: [DEMAIN], contenuDevis: "x" },
      MAINTENANT
    );
    const vue = await lireParJeton(envoi.jeton, MAINTENANT);
    assert.ok(vue, "le lien ne s'ouvre pas");
    assert.ok(
      DEMAIN >= vue.fenetre.debut && DEMAIN <= vue.fenetre.fin,
      `la date proposée ${DEMAIN} tombe hors de la fenêtre [${vue.fenetre.debut} … ${vue.fenetre.fin}]`
    );
  });

  await test("le client ACCEPTE la date de demain, et le chantier se pose", async () => {
    // ═══════════════════════════════════════════════════════════════════════
    // **La barrière muette du 31 août 2026.** Rendre le lendemain choisissable
    // au patron ne suffisait pas : la revérification, côté client, se faisait
    // contre une fenêtre qui commence après-demain. Son client aurait lu « date
    // indisponible » en acceptant la date qu'il venait de recevoir — l'écran du
    // patron disant oui, la page du client non, et le devis perdu là.
    //
    // Rien ne l'aurait signalé : le lot paraissait fini côté patron.
    // ═══════════════════════════════════════════════════════════════════════
    const { ctx, chantierId, devisId } = await contexteAvecDevis(`acceptproche-${Date.now()}@t.test`);
    const envoi = await creerEnvoi(
      ctx,
      { chantierId, devisId, canal: "sms", datesProposees: [DEMAIN], contenuDevis: "x" },
      MAINTENANT
    );
    const r = await enregistrerReponse(
      envoi.jeton,
      { decision: "accepte", dateRetenue: DEMAIN },
      MAINTENANT
    );
    assert.strictEqual(r.succes, true, `le client s'est fait refuser : ${JSON.stringify(r)}`);
    assert.strictEqual(r.succes && r.dateRetenue, DEMAIN);
  });

  await test("le patron peut proposer une date à six mois", async () => {
    const { ctx, chantierId, devisId } = await contexteAvecDevis(`loin-${Date.now()}@t.test`);
    const envoi = await creerEnvoi(
      ctx,
      { chantierId, devisId, canal: "sms", datesProposees: [DANS_SIX_MOIS], contenuDevis: "x" },
      MAINTENANT
    );
    assert.ok(envoi.jeton, "l'envoi n'a pas été créé");
  });

  await test("au-delà de dix-huit mois, elle est refusée", async () => {
    // L'horizon n'est pas une décoration : sans borne, on promettrait un jour
    // dont personne ne sait rien.
    const { ctx, chantierId, devisId } = await contexteAvecDevis(`tresloin-${Date.now()}@t.test`);
    await assert.rejects(
      creerEnvoi(
        ctx,
        { chantierId, devisId, canal: "sms", datesProposees: [dans(600)], contenuDevis: "x" },
        MAINTENANT
      ),
      /hors_fenetre|Date/i
    );
  });

  await test("le client voit sa date lointaine, et PAS le semestre qui précède", async () => {
    const { ctx, chantierId, devisId } = await contexteAvecDevis(`vue-${Date.now()}@t.test`);
    // Un chantier calé dans trois mois : il ne doit PAS apparaître au client,
    // qui n'a été invité que sur la Toussaint.
    const autre = await chantiersRepo.creerChantier(ctx, { nom: "Chantier du milieu" });
    await chantiersRepo.planifierChantier(ctx, autre.id, dans(100));

    const envoi = await creerEnvoi(
      ctx,
      { chantierId, devisId, canal: "sms", datesProposees: [DANS_SIX_MOIS], contenuDevis: "x" },
      MAINTENANT
    );
    const vue = await lireParJeton(envoi.jeton, MAINTENANT);
    assert.ok(vue, "le lien ne s'ouvre pas");
    assert.ok(
      DANS_SIX_MOIS >= vue.fenetre.debut && DANS_SIX_MOIS <= vue.fenetre.fin,
      `la date proposée ${DANS_SIX_MOIS} tombe hors de la fenêtre [${vue.fenetre.debut} … ${vue.fenetre.fin}]`
    );
    assert.ok(
      !vue.joursOccupes.includes(dans(100)),
      "un chantier situé entre aujourd'hui et la date proposée est montré au client : c'est le carnet de commandes qui part"
    );
  });

  await test("le client accepte la date à six mois, et le chantier se pose", async () => {
    // **La barrière la plus coûteuse.** La revérification se faisait contre une
    // fenêtre de trois mois : le client aurait lu « date indisponible » en
    // acceptant la date que le patron venait de lui proposer, et le devis se
    // serait perdu là.
    const { ctx, chantierId, devisId } = await contexteAvecDevis(`accept-${Date.now()}@t.test`);
    const envoi = await creerEnvoi(
      ctx,
      { chantierId, devisId, canal: "sms", datesProposees: [DANS_SIX_MOIS], contenuDevis: "x" },
      MAINTENANT
    );
    const r = await enregistrerReponse(
      envoi.jeton,
      { decision: "accepte", dateRetenue: DANS_SIX_MOIS },
      MAINTENANT
    );
    assert.deepStrictEqual(r, { succes: true, dateRetenue: DANS_SIX_MOIS, contreProposee: false });

    const chantier = await chantiersRepo.getChantier(ctx, chantierId);
    assert.strictEqual(chantier?.datePlanifiee, DANS_SIX_MOIS, "le chantier n'a pas été posé à la date retenue");
  });

  await test("la fenêtre ne glisse plus entre l'envoi et l'ouverture du lien", async () => {
    // **Un défaut latent que personne n'avait signalé**, et qui devenait
    // certain avec une date lointaine : la fenêtre était recalculée depuis la
    // date du JOUR à chaque ouverture. Un devis parti un lundi et ouvert trois
    // semaines plus tard n'offrait plus les mêmes jours.
    const { ctx, chantierId, devisId } = await contexteAvecDevis(`glisse-${Date.now()}@t.test`);
    const envoi = await creerEnvoi(
      ctx,
      { chantierId, devisId, canal: "sms", datesProposees: [dans(5)], contenuDevis: "x" },
      MAINTENANT
    );
    const auDepart = await lireParJeton(envoi.jeton, MAINTENANT);
    const troisSemainesPlusTard = await lireParJeton(envoi.jeton, new Date(MAINTENANT.getTime() + 21 * 86_400_000));
    assert.deepStrictEqual(
      troisSemainesPlusTard?.fenetre,
      auDepart?.fenetre,
      "la fenêtre a glissé : le client ne voit plus ce qui lui avait été promis"
    );
  });

  // ── Le client peut-il proposer une AUTRE date ? (17 août 2026) ────────────
  //
  // *« Il faut que l'utilisateur puisse choisir avant d'envoyer s'il autorise
  // ou non le client à choisir une date si celles proposées ne lui conviennent
  // pas. »* Jusque-là, le client le pouvait TOUJOURS.

  await test("par défaut, le client peut toujours proposer une autre date", async () => {
    // **Le défaut compte autant que le réglage** : les liens déjà partis
    // doivent continuer de se comporter comme le client les a reçus.
    const { ctx, chantierId, devisId } = await contexteAvecDevis(`autre-defaut-${Date.now()}@t.test`);
    const envoi = await creerEnvoi(
      ctx,
      { chantierId, devisId, canal: "sms", datesProposees: [dans(10)], contenuDevis: "devis" },
      MAINTENANT
    );
    const vue = await lireParJeton(envoi.jeton, MAINTENANT);
    assert.strictEqual(vue?.autreDateAutorisee, true, "le calendrier devrait rester ouvert par défaut");
  });

  await test("refusé, le calendrier ne part pas à la page publique", async () => {
    const { ctx, chantierId, devisId } = await contexteAvecDevis(`autre-ferme-${Date.now()}@t.test`);
    const envoi = await creerEnvoi(
      ctx,
      {
        chantierId,
        devisId,
        canal: "sms",
        datesProposees: [dans(10)],
        contenuDevis: "devis",
        autreDateAutorisee: false,
      },
      MAINTENANT
    );
    const vue = await lireParJeton(envoi.jeton, MAINTENANT);
    assert.strictEqual(vue?.autreDateAutorisee, false);
  });

  await test("refusé, une AUTRE date postée au serveur est rejetée", async () => {
    // **C'est le cas qui compte.** La page du client est publique : cacher le
    // calendrier suffit à l'usage, jamais à la règle — son formulaire se rejoue.
    const { ctx, chantierId, devisId } = await contexteAvecDevis(`autre-poste-${Date.now()}@t.test`);
    const envoi = await creerEnvoi(
      ctx,
      {
        chantierId,
        devisId,
        canal: "sms",
        datesProposees: [dans(10)],
        contenuDevis: "devis",
        autreDateAutorisee: false,
      },
      MAINTENANT
    );

    const refus = await enregistrerReponse(
      envoi.jeton,
      { decision: "accepte", dateRetenue: dans(12) },
      MAINTENANT
    );
    assert.strictEqual(refus.succes, false, "une date hors des propositions a été acceptée");
    assert.strictEqual(refus.succes === false && refus.motif, "autre_date_refusee");

    // Et la date PROPOSÉE, elle, passe : on n'a pas fermé la porte principale.
    const accord = await enregistrerReponse(
      envoi.jeton,
      { decision: "accepte", dateRetenue: dans(10) },
      MAINTENANT
    );
    assert.strictEqual(accord.succes, true, "la date proposée devrait rester acceptable");
  });

  await test("autorisé, la contre-proposition reste possible", async () => {
    const { ctx, chantierId, devisId } = await contexteAvecDevis(`autre-ouvert-${Date.now()}@t.test`);
    const envoi = await creerEnvoi(
      ctx,
      {
        chantierId,
        devisId,
        canal: "sms",
        datesProposees: [dans(10)],
        contenuDevis: "devis",
        autreDateAutorisee: true,
      },
      MAINTENANT
    );
    const r = await enregistrerReponse(
      envoi.jeton,
      { decision: "accepte", dateRetenue: dans(12) },
      MAINTENANT
    );
    assert.strictEqual(r.succes, true, "la contre-proposition devrait passer quand elle est autorisée");
    assert.strictEqual(r.succes === true && r.contreProposee, true);
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
