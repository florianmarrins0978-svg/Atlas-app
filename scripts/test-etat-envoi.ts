import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as devisRepo from "../src/server/repositories/devis";
import {
  creerEnvoi,
  enregistrerReponse,
  dernierEnvoi,
  notificationsPatron,
  marquerReponseVue,
  VALIDITE_LIEN_JOURS,
} from "../src/server/repositories/envois-devis";
import {
  etatEnvoi,
  attendLeClient,
  demandeUneAction,
  RELANCE_APRES_JOURS,
} from "../src/lib/etat-envoi";
import { getStatutAffiche, getPlanificationEtat } from "../src/lib/chantier-etat";
import { versJourIso, ajouterJours } from "../src/server/disponibilites";
import { nettoyerBase } from "./_test-db";

// Où en est le devis d'un chantier, du point de vue du patron — docs/AGENT.md
// §2.2. Un chantier dont le devis est parti est BLOQUÉ : ni planifié, ni
// facturable, ni à planifier soi-même. Encore faut-il que les écrans le disent.

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
const MAINTENANT = new Date("2026-03-02T09:00:00Z");
const ilYA = (jours: number) => new Date(MAINTENANT.getTime() - jours * JOUR);
const dans = (jours: number) => versJourIso(ajouterJours(MAINTENANT, jours));

async function contexteAvecDevis(suffixe: string) {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Atelier État" },
    { email: `etat-${suffixe}-${Date.now()}@t.test` }
  );
  const ctx = { utilisateurId, entrepriseId: entreprise.id };
  const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Élagage du tilleul" });
  const d = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  return { ctx, chantierId: chantier.id, devisId: d.id };
}

async function main() {
  await nettoyerBase();

  // ---- La règle, seule
  await test("sans envoi, il n'y a rien à attendre", async () => {
    assert.strictEqual(etatEnvoi(null, MAINTENANT), "non_envoye");
    assert.strictEqual(
      etatEnvoi({ envoyeAt: null, expireAt: null, reponse: null }, MAINTENANT),
      "non_envoye"
    );
  });

  await test("un devis parti récemment est en attente, pas à relancer", async () => {
    const e = etatEnvoi(
      { envoyeAt: ilYA(RELANCE_APRES_JOURS - 1), expireAt: dans(40), reponse: null },
      MAINTENANT
    );
    assert.strictEqual(e, "en_attente");
  });

  await test("passé le délai, le silence appelle une relance", async () => {
    const e = etatEnvoi(
      { envoyeAt: ilYA(RELANCE_APRES_JOURS + 1), expireAt: dans(40), reponse: null },
      MAINTENANT
    );
    assert.strictEqual(e, "a_relancer");
  });

  await test("un lien expiré sans réponse rend le devis caduc", async () => {
    const e = etatEnvoi({ envoyeAt: ilYA(60), expireAt: ilYA(1), reponse: null }, MAINTENANT);
    assert.strictEqual(e, "caduc");
  });

  await test("une réponse tranche toujours, même après expiration", async () => {
    // Un devis accepté la veille de sa péremption reste accepté : le contraire
    // ferait disparaître un engagement pris.
    assert.strictEqual(
      etatEnvoi({ envoyeAt: ilYA(60), expireAt: ilYA(1), reponse: "acceptee" }, MAINTENANT),
      "accepte"
    );
    assert.strictEqual(
      etatEnvoi({ envoyeAt: ilYA(60), expireAt: ilYA(1), reponse: "refusee" }, MAINTENANT),
      "retourne"
    );
  });

  await test("attendre le client et appeler une action sont deux questions distinctes", async () => {
    assert.strictEqual(attendLeClient("en_attente"), true);
    assert.strictEqual(attendLeClient("a_relancer"), true);
    assert.strictEqual(attendLeClient("retourne"), false, "un refus n'est plus une attente");
    assert.strictEqual(attendLeClient("caduc"), false);

    assert.strictEqual(demandeUneAction("en_attente"), false, "attendre n'est pas agir");
    assert.strictEqual(demandeUneAction("a_relancer"), true);
    assert.strictEqual(demandeUneAction("retourne"), true);
    assert.strictEqual(demandeUneAction("caduc"), true);
    assert.strictEqual(demandeUneAction("accepte"), false);
  });

  // ---- Ce que les écrans en font
  await test("la liste distingue l'attente, la relance et le refus", async () => {
    const base = {
      photosCount: 1,
      aUneNoteVocale: true,
      informationsVerifieesAt: ilYA(20),
      devisEnvoyeAt: ilYA(10),
      datePlanifiee: null,
    };
    const statut = (envoye: Date, reponse: "acceptee" | "refusee" | null) =>
      getStatutAffiche(
        { ...base, envoiEnvoyeAt: envoye, envoiExpireAt: dans(30), envoiReponse: reponse },
        MAINTENANT
      );

    assert.strictEqual(statut(ilYA(1), null), "en_attente_client");
    assert.strictEqual(statut(ilYA(RELANCE_APRES_JOURS + 1), null), "a_relancer");
    assert.strictEqual(statut(ilYA(1), "refusee"), "devis_retourne");
  });

  await test("un chantier planifié reste planifié, quoi qu'ait dit l'envoi", async () => {
    const s = getStatutAffiche(
      {
        photosCount: 0,
        aUneNoteVocale: false,
        informationsVerifieesAt: null,
        devisEnvoyeAt: ilYA(10),
        datePlanifiee: dans(5),
        envoiEnvoyeAt: ilYA(10),
        envoiExpireAt: dans(30),
        envoiReponse: "acceptee",
      },
      MAINTENANT
    );
    assert.strictEqual(s, "planifie");
  });

  await test("sans information sur l'envoi, le statut reste celui d'avant", async () => {
    // Les appels qui ne remontent pas l'envoi ne doivent pas se mettre à
    // raconter n'importe quoi : ils gardent l'ancien comportement.
    const s = getStatutAffiche(
      {
        photosCount: 0,
        aUneNoteVocale: false,
        informationsVerifieesAt: ilYA(5),
        devisEnvoyeAt: ilYA(1),
        datePlanifiee: null,
      },
      MAINTENANT
    );
    assert.strictEqual(s, "devis_envoye");
  });

  await test("le planning ne propose pas de planifier ce que le client décide", async () => {
    // Planifier soi-même un chantier dont le client choisit sa date, c'est
    // préparer deux engagements sur le même jour.
    const enAttente = getPlanificationEtat(
      {
        devisEnvoyeAt: ilYA(1),
        datePlanifiee: null,
        envoiEnvoyeAt: ilYA(1),
        envoiExpireAt: dans(40),
        envoiReponse: null,
      },
      MAINTENANT
    );
    assert.strictEqual(enAttente, "attente_client");

    // Un devis retourné redevient planifiable à la main : plus personne
    // n'arbitre à la place du patron.
    const retourne = getPlanificationEtat(
      {
        devisEnvoyeAt: ilYA(1),
        datePlanifiee: null,
        envoiEnvoyeAt: ilYA(1),
        envoiExpireAt: dans(40),
        envoiReponse: "refusee",
      },
      MAINTENANT
    );
    assert.strictEqual(retourne, "a_planifier");
  });

  // ---- Le dernier envoi, en base
  await test("un chantier sans envoi n'en a pas", async () => {
    const { ctx, chantierId } = await contexteAvecDevis("sansenvoi");
    assert.strictEqual(await dernierEnvoi(ctx, chantierId), null);
  });

  await test("le dernier envoi est le dernier, pas le premier", async () => {
    const { ctx, chantierId, devisId } = await contexteAvecDevis("plusieurs");
    const premier = await creerEnvoi(
      ctx,
      { chantierId, devisId, canal: "sms", datesProposees: [dans(10)], contenuDevis: "v1" },
      ilYA(20)
    );
    await enregistrerReponse(premier.jeton, { accepte: false }, ilYA(19));

    const second = await creerEnvoi(
      ctx,
      { chantierId, devisId, canal: "sms", datesProposees: [dans(12)], contenuDevis: "v2" },
      ilYA(1)
    );

    const dernier = await dernierEnvoi(ctx, chantierId);
    assert.strictEqual(dernier?.id, second.id, "l'envoi retenu n'est pas le plus récent");
    assert.strictEqual(
      etatEnvoi(dernier, MAINTENANT),
      "en_attente",
      "un refus ancien fige le chantier alors qu'un nouveau devis est parti"
    );
  });

  await test("la durée de vie du lien décide de la caducité", async () => {
    const { ctx, chantierId, devisId } = await contexteAvecDevis("caduc");
    // Envoyé il y a plus longtemps que la validité du lien : le client ne peut
    // plus répondre, le devis ne vaut plus rien tel quel.
    await creerEnvoi(
      ctx,
      { chantierId, devisId, canal: "sms", datesProposees: [dans(10)], contenuDevis: "d" },
      ilYA(VALIDITE_LIEN_JOURS + 1)
    );
    const envoi = await dernierEnvoi(ctx, chantierId);
    assert.strictEqual(etatEnvoi(envoi, MAINTENANT), "caduc");
  });

  // ---- Ce que le patron doit apprendre
  await test("un refus remonte avec le nom du chantier, pas un identifiant", async () => {
    const { ctx, chantierId, devisId } = await contexteAvecDevis("notifrefus");
    const envoi = await creerEnvoi(
      ctx,
      { chantierId, devisId, canal: "sms", datesProposees: [dans(10)], contenuDevis: "d" },
      ilYA(2)
    );
    await enregistrerReponse(envoi.jeton, { accepte: false }, ilYA(1));

    const notifs = await notificationsPatron(ctx);
    assert.strictEqual(notifs.length, 1);
    assert.strictEqual(notifs[0].reponse, "refusee");
    assert.strictEqual(
      notifs[0].chantierNom,
      "Élagage du tilleul",
      "une alerte qui n'annonce pas de quel chantier elle parle ne sera pas lue"
    );
  });

  await test("une acceptation sur une date proposée ne dérange personne", async () => {
    const { ctx, chantierId, devisId } = await contexteAvecDevis("notifok");
    const envoi = await creerEnvoi(
      ctx,
      { chantierId, devisId, canal: "sms", datesProposees: [dans(10)], contenuDevis: "d" },
      ilYA(2)
    );
    await enregistrerReponse(envoi.jeton, { accepte: true, dateRetenue: dans(10) }, ilYA(1));

    assert.strictEqual(
      (await notificationsPatron(ctx)).length,
      0,
      "signaler le déroulement attendu noierait les nouvelles qui comptent"
    );
  });

  await test("une date que le client a proposée lui-même, elle, est signalée", async () => {
    const { ctx, chantierId, devisId } = await contexteAvecDevis("notifcontre");
    const envoi = await creerEnvoi(
      ctx,
      { chantierId, devisId, canal: "sms", datesProposees: [dans(10)], contenuDevis: "d" },
      ilYA(2)
    );
    // Le client retient un autre jour libre : l'agenda du patron change sans
    // qu'il ait rien décidé.
    await enregistrerReponse(envoi.jeton, { accepte: true, dateRetenue: dans(15) }, ilYA(1));

    const notifs = await notificationsPatron(ctx);
    assert.strictEqual(notifs.length, 1);
    assert.strictEqual(notifs[0].dateContreProposee, true);
    assert.strictEqual(notifs[0].dateRetenue, dans(15));
  });

  await test("une nouvelle vue ne revient pas", async () => {
    const { ctx, chantierId, devisId } = await contexteAvecDevis("notifvue");
    const envoi = await creerEnvoi(
      ctx,
      { chantierId, devisId, canal: "sms", datesProposees: [dans(10)], contenuDevis: "d" },
      ilYA(2)
    );
    await enregistrerReponse(envoi.jeton, { accepte: false }, ilYA(1));

    const notifs = await notificationsPatron(ctx);
    await marquerReponseVue(ctx, notifs[0].envoiId, MAINTENANT);
    assert.strictEqual((await notificationsPatron(ctx)).length, 0);
  });

  await test("les nouvelles d'une entreprise ne parviennent pas à l'autre", async () => {
    const a = await contexteAvecDevis("iso-a");
    const b = await contexteAvecDevis("iso-b");
    const envoi = await creerEnvoi(
      a.ctx,
      { chantierId: a.chantierId, devisId: a.devisId, canal: "sms", datesProposees: [dans(10)], contenuDevis: "d" },
      ilYA(2)
    );
    await enregistrerReponse(envoi.jeton, { accepte: false }, ilYA(1));

    assert.strictEqual((await notificationsPatron(b.ctx)).length, 0);
    assert.strictEqual(await dernierEnvoi(b.ctx, a.chantierId), null);
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
