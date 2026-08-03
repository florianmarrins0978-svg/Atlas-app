import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import { preparerEnvoi } from "../src/server/repositories/preparation-envoi";
import { creerEnvoi, lireParJeton, enregistrerReponse } from "../src/server/repositories/envois-devis";
import { versJourIso, ajouterJours } from "../src/server/disponibilites";
import { nettoyerBase } from "./_test-db";

// Le cas du patron, joué de bout en bout sur la vraie base.
//
// `test-creneaux.ts` éprouve la règle sans base. Celle-ci vérifie qu'elle est
// bien appliquée par les TROIS chemins qui doivent dire la même chose :
// l'écran d'envoi, la création de l'envoi, et la revérification de la réponse
// du client. Trois calculs distincts finiraient par diverger, et c'est le
// client qui découvrirait l'écart.
//
// Et une consigne qui prime sur le reste : « mon client ne doit pas être
// informé de la demi-journée, seulement moi ; lui verra le 6 août ». La page
// publique ne reçoit donc que des DATES — un contrôle s'en assure ici, sur le
// contenu sérialisé.

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

// Un mardi, pour que les jours ouvrés se lisent sans compter.
const MARDI = new Date("2026-03-03T09:00:00Z");
const dans = (n: number) => versJourIso(ajouterJours(MARDI, n));

async function contexte(email: string, nombreEquipes = 1) {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise({ nom: "Élagage Éden" }, { email });
  const ctx = { utilisateurId, entrepriseId: entreprise.id };
  if (nombreEquipes !== 1) {
    await entreprisesRepo.mettreAJourEntreprise(ctx, { nombreEquipes });
  }
  return ctx;
}

async function chantierPretAEnvoyer(
  ctx: { utilisateurId: string; entrepriseId: string },
  nom: string,
  dureePrevue: string | null
) {
  const client = await clientsRepo.creerClient(ctx, { nom: "M. Martin", email: "martin@test.local" });
  await clientsRepo.mettreAJourClient(ctx, client.id, { canalCommunication: "email" });
  const chantier = await chantiersRepo.creerChantier(ctx, { nom, clientId: client.id });
  if (dureePrevue) await chantiersRepo.mettreAJourDureeEquipe(ctx, chantier.id, { dureePrevue });
  const devis = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  return { chantierId: chantier.id, devisId: devis.id };
}

async function main() {
  await nettoyerBase();

  await test("une demi-journée déjà prise laisse l'autre proposable", async () => {
    const ctx = await contexte(`demi-${Date.now()}@t.test`);

    // Premier chantier : une demi-journée le jour J.
    const a = await chantierPretAEnvoyer(ctx, "Taille de haie", "une demi-journée");
    const envoiA = await creerEnvoi(
      ctx,
      { chantierId: a.chantierId, devisId: a.devisId, canal: "email", datesProposees: [dans(7)], contenuDevis: "A" },
      MARDI
    );
    const reponseA = await enregistrerReponse(envoiA.jeton, { accepte: true, dateRetenue: dans(7) }, MARDI);
    assert.equal(reponseA.succes, true, "Le premier chantier n'a pas pu être planifié.");

    // Second chantier, une demi-journée lui aussi : le même jour doit rester
    // proposable. C'est exactement le cas du patron.
    const b = await chantierPretAEnvoyer(ctx, "Abattage", "une demi-journée");
    const preparation = await preparerEnvoi(ctx, b.chantierId, MARDI);
    assert.ok(
      preparation.joursLibres.includes(dans(7)),
      `Le jour n'est plus proposé alors que seule sa matinée est prise. Libres : ${preparation.joursLibres.join(", ")}`
    );
  });

  await test("mais une journée entière ne tient plus si le lendemain est plein", async () => {
    const ctx = await contexte(`pleine-${Date.now()}@t.test`);

    for (const [nom, jour, duree] of [
      ["Matin J", dans(7), "une demi-journée"],
      ["Journée J+1", dans(8), "1 jour"],
    ] as const) {
      const c = await chantierPretAEnvoyer(ctx, nom, duree);
      const e = await creerEnvoi(
        ctx,
        { chantierId: c.chantierId, devisId: c.devisId, canal: "email", datesProposees: [jour], contenuDevis: nom },
        MARDI
      );
      const r = await enregistrerReponse(e.jeton, { accepte: true, dateRetenue: jour }, MARDI);
      assert.equal(r.succes, true, `${nom} n'a pas pu être planifié.`);
    }

    // Une journée entière ne peut plus commencer le jour J : elle démarrerait
    // l'après-midi et déborderait sur un lendemain déjà pris.
    const d = await chantierPretAEnvoyer(ctx, "Journée entière", "1 jour");
    const preparation = await preparerEnvoi(ctx, d.chantierId, MARDI);
    assert.ok(
      !preparation.joursLibres.includes(dans(7)),
      "Une journée entière a été proposée sur un jour qui ne peut plus l'accueillir."
    );
  });

  await test("deux équipes tiennent deux chantiers le même jour", async () => {
    const ctx = await contexte(`equipes-${Date.now()}@t.test`, 2);

    const a = await chantierPretAEnvoyer(ctx, "Chantier équipe 1", "1 jour");
    const envoiA = await creerEnvoi(
      ctx,
      { chantierId: a.chantierId, devisId: a.devisId, canal: "email", datesProposees: [dans(7)], contenuDevis: "A" },
      MARDI
    );
    await enregistrerReponse(envoiA.jeton, { accepte: true, dateRetenue: dans(7) }, MARDI);

    const b = await chantierPretAEnvoyer(ctx, "Chantier équipe 2", "1 jour");
    const preparation = await preparerEnvoi(ctx, b.chantierId, MARDI);
    assert.ok(
      preparation.joursLibres.includes(dans(7)),
      "La seconde équipe n'a pas pu être employée le même jour."
    );
  });

  await test("avec une seule équipe, ce même jour est refusé", async () => {
    // Le contrôle précédent ne prouverait rien si le jour restait libre de
    // toute façon : c'est la comparaison qui fait la démonstration.
    const ctx = await contexte(`une-equipe-${Date.now()}@t.test`, 1);

    const a = await chantierPretAEnvoyer(ctx, "Chantier unique", "1 jour");
    const envoiA = await creerEnvoi(
      ctx,
      { chantierId: a.chantierId, devisId: a.devisId, canal: "email", datesProposees: [dans(7)], contenuDevis: "A" },
      MARDI
    );
    await enregistrerReponse(envoiA.jeton, { accepte: true, dateRetenue: dans(7) }, MARDI);

    const b = await chantierPretAEnvoyer(ctx, "Chantier suivant", "1 jour");
    const preparation = await preparerEnvoi(ctx, b.chantierId, MARDI);
    assert.ok(!preparation.joursLibres.includes(dans(7)), "Un jour plein a été proposé avec une seule équipe.");
  });

  await test("un chantier de deux jours bloque bien le lendemain", async () => {
    // Le défaut latent : la durée dictée n'entrait nulle part dans la
    // planification, et le client suivant se voyait proposer le lendemain.
    const ctx = await contexte(`deuxjours-${Date.now()}@t.test`);

    const a = await chantierPretAEnvoyer(ctx, "Gros élagage", "2 jours");
    const envoiA = await creerEnvoi(
      ctx,
      { chantierId: a.chantierId, devisId: a.devisId, canal: "email", datesProposees: [dans(7)], contenuDevis: "A" },
      MARDI
    );
    const r = await enregistrerReponse(envoiA.jeton, { accepte: true, dateRetenue: dans(7) }, MARDI);
    assert.equal(r.succes, true);

    const b = await chantierPretAEnvoyer(ctx, "Chantier suivant", "1 jour");
    const preparation = await preparerEnvoi(ctx, b.chantierId, MARDI);
    assert.ok(
      !preparation.joursLibres.includes(dans(8)),
      "Le lendemain d'un chantier de deux jours est encore proposé."
    );
  });

  await test("le créneau est posé par le planning, jamais choisi par le client", async () => {
    const ctx = await contexte(`creneau-${Date.now()}@t.test`);

    const a = await chantierPretAEnvoyer(ctx, "Matinée", "une demi-journée");
    const envoiA = await creerEnvoi(
      ctx,
      { chantierId: a.chantierId, devisId: a.devisId, canal: "email", datesProposees: [dans(7)], contenuDevis: "A" },
      MARDI
    );
    await enregistrerReponse(envoiA.jeton, { accepte: true, dateRetenue: dans(7) }, MARDI);
    const premier = await chantiersRepo.getChantier(ctx, a.chantierId);
    assert.equal(premier?.creneauDebut, "matin", "Le premier chantier n'a pas pris le matin.");

    const b = await chantierPretAEnvoyer(ctx, "Après-midi", "une demi-journée");
    const envoiB = await creerEnvoi(
      ctx,
      { chantierId: b.chantierId, devisId: b.devisId, canal: "email", datesProposees: [dans(7)], contenuDevis: "B" },
      MARDI
    );
    await enregistrerReponse(envoiB.jeton, { accepte: true, dateRetenue: dans(7) }, MARDI);
    const second = await chantiersRepo.getChantier(ctx, b.chantierId);
    assert.equal(second?.creneauDebut, "apres_midi", "Le second chantier n'a pas basculé l'après-midi.");
    assert.equal(second?.datePlanifiee, dans(7), "Les deux chantiers doivent bien tomber le même jour.");
  });

  await test("le client ne voit jamais la demi-journée — consigne du patron", async () => {
    const ctx = await contexte(`discretion-${Date.now()}@t.test`);

    const a = await chantierPretAEnvoyer(ctx, "Matinée prise", "une demi-journée");
    const envoiA = await creerEnvoi(
      ctx,
      { chantierId: a.chantierId, devisId: a.devisId, canal: "email", datesProposees: [dans(7)], contenuDevis: "A" },
      MARDI
    );
    await enregistrerReponse(envoiA.jeton, { accepte: true, dateRetenue: dans(7) }, MARDI);

    const b = await chantierPretAEnvoyer(ctx, "Second chantier", "une demi-journée");
    const envoiB = await creerEnvoi(
      ctx,
      { chantierId: b.chantierId, devisId: b.devisId, canal: "email", datesProposees: [dans(7)], contenuDevis: "B" },
      MARDI
    );

    const vue = await lireParJeton(envoiB.jeton, MARDI);
    assert.ok(vue);
    const serialise = JSON.stringify(vue);
    assert.ok(!/matin/i.test(serialise), "Le mot « matin » a fuité vers la page du client.");
    assert.ok(!/apres_midi|après-midi/i.test(serialise), "L'après-midi a fuité vers la page du client.");
    assert.ok(!/creneau|créneau/i.test(serialise), "Le créneau a fuité vers la page du client.");
    assert.ok(!/duree|durée/i.test(serialise), "La durée du chantier a fuité vers la page du client.");
    // Et la date reste proposée : c'est bien « le 6 août » qu'il voit.
    assert.ok(vue.datesProposees.includes(dans(7)));
  });

  await test("un chantier planifié avant les créneaux occupe toujours sa journée", async () => {
    // Le risque de la migration : relâcher, du jour au lendemain, des
    // après-midis déjà pris. `planifierChantier` ne pose ni créneau ni durée —
    // c'est exactement l'état des chantiers d'avant.
    const ctx = await contexte(`herite-${Date.now()}@t.test`);
    const herite = await chantiersRepo.creerChantier(ctx, { nom: "Chantier d'avant" });
    await chantiersRepo.planifierChantier(ctx, herite.id, dans(7));
    // L'état exact d'avant la migration : une date, et rien d'autre.
    // `planifierChantier` pose désormais le créneau, il faut donc le retirer
    // pour éprouver ce que la migration trouvera en base.
    await pool.query(
      "UPDATE chantiers SET creneau_debut = NULL, duree_demi_journees = NULL WHERE id = $1",
      [herite.id]
    );

    const b = await chantierPretAEnvoyer(ctx, "Nouveau", "une demi-journée");
    const preparation = await preparerEnvoi(ctx, b.chantierId, MARDI);
    assert.ok(
      !preparation.joursLibres.includes(dans(7)),
      "Un chantier hérité a libéré une demi-journée qu'il occupait."
    );
  });

  await test("la revérification refuse une demi-journée prise entre-temps", async () => {
    // Le client ouvre son lien, part déjeuner, et pendant ce temps la place
    // disparaît. C'est le serveur qui doit dire non, pas l'écran.
    const ctx = await contexte(`course-${Date.now()}@t.test`);

    const a = await chantierPretAEnvoyer(ctx, "Premier", "1 jour");
    const envoiA = await creerEnvoi(
      ctx,
      { chantierId: a.chantierId, devisId: a.devisId, canal: "email", datesProposees: [dans(7)], contenuDevis: "A" },
      MARDI
    );

    const b = await chantierPretAEnvoyer(ctx, "Second", "1 jour");
    const envoiB = await creerEnvoi(
      ctx,
      { chantierId: b.chantierId, devisId: b.devisId, canal: "email", datesProposees: [dans(7)], contenuDevis: "B" },
      MARDI
    );

    assert.equal((await enregistrerReponse(envoiA.jeton, { accepte: true, dateRetenue: dans(7) }, MARDI)).succes, true);
    const second = await enregistrerReponse(envoiB.jeton, { accepte: true, dateRetenue: dans(7) }, MARDI);
    assert.equal(second.succes, false, "Deux chantiers pleins ont été acceptés le même jour avec une seule équipe.");
    if (!second.succes) assert.equal(second.motif, "date_indisponible");
  });

  console.log(`\n${reussis} test(s) réussi(s), ${echoues} échoué(s).`);
  await pool.end();
  if (echoues > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
