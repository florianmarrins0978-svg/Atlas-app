/**
 * LES JOURS QUE LA CLIENTE PROPOSE — sur la base, du lien jusqu'au planning.
 *
 * Sa demande du 20 septembre 2026 : *« lorsqu'elle clique sur proposer des
 * jours, s'il y a plusieurs jours il faut mettre le même système que nous :
 * les 4 dates s'affichent, elle clique sur un jour sélectionné pour le
 * désélectionner et reclique ailleurs pour le déplacer »*.
 *
 * **Ce que cette suite garde, et qui n'existait pas avant ce lot :**
 *   · ses quatre jours se posent tels quels, même s'ils ne se suivent pas —
 *     avant, elle envoyait une date et le serveur étalait un bloc derrière
 *     elle, sur des jours qu'elle n'avait jamais vus ;
 *   · déplacer UN jour en gardant le premier reste une contre-proposition —
 *     le raccourci « la date n'est pas dans celles proposées » aurait jeté sa
 *     liste au profit de celle du patron, sans que rien ne le dise ;
 *   · trois jours pour un chantier de quatre sont REFUSÉS : l'artisan n'aurait
 *     pas eu de quoi faire le travail, et personne ne l'aurait su avant le
 *     chantier ;
 *   · l'écran de retour qu'elle rouvre depuis son SMS lui redit TOUS ses
 *     jours, pas seulement le premier ;
 *   · un envoi où le patron n'a pas ouvert le calendrier refuse toujours ;
 *   · et le chemin d'avant — une réponse sans liste — se pose comme toujours.
 *
 *   npx tsx scripts/test-jours-du-client-db.ts   (sur atlas_test)
 */
import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import { creerEnvoi, enregistrerReponse, lireParJeton } from "../src/server/repositories/envois-devis";
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

// mardi 10, mercredi 11, jeudi 12, vendredi 13, puis lundi 16.
const MARDI_10 = dans(7);
const MERCREDI_11 = dans(8);
const JEUDI_12 = dans(9);
const VENDREDI_13 = dans(10);
const LUNDI_16 = dans(13);

async function contexte(email: string) {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise({ nom: "Élagage Éden" }, { email });
  return { utilisateurId, entrepriseId: entreprise.id };
}

async function chantierPret(
  ctx: { utilisateurId: string; entrepriseId: string },
  nom: string,
  dureePrevue: string
) {
  const client = await clientsRepo.creerClient(ctx, { nom: "Mme Linotte", email: "linotte@test.local" });
  await clientsRepo.mettreAJourClient(ctx, client.id, { canalCommunication: "email" });
  const chantier = await chantiersRepo.creerChantier(ctx, { nom, clientId: client.id });
  await chantiersRepo.mettreAJourDureeEquipe(ctx, chantier.id, { dureePrevue });
  const devis = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  return { chantierId: chantier.id, devisId: devis.id };
}

/** Un envoi de quatre jours d'affilée, calendrier ouvert sauf mention contraire. */
async function envoiDeQuatreJours(
  ctx: { utilisateurId: string; entrepriseId: string },
  chantier: { chantierId: string; devisId: string },
  contenu: string,
  autreDateAutorisee = true
) {
  return creerEnvoi(
    ctx,
    {
      chantierId: chantier.chantierId,
      devisId: chantier.devisId,
      canal: "email",
      datesProposees: [MARDI_10],
      joursProposes: [[MARDI_10, MERCREDI_11, JEUDI_12, VENDREDI_13]],
      autreDateAutorisee,
      contenuDevis: contenu,
    },
    MARDI
  );
}

const joursPoses = (creneaux: readonly { jour: string }[]) => [...new Set(creneaux.map((c) => c.jour))].sort();

async function main() {
  await nettoyerBase();

  await test("ses quatre jours se posent tels quels, même quand ils ne se suivent pas", async () => {
    const ctx = await contexte(`jours-client-${Date.now()}@t.test`);
    const c = await chantierPret(ctx, "Taille de haie", "4 jours");
    const envoi = await envoiDeQuatreJours(ctx, c, "A");

    // Elle efface le vendredi et le remet au lundi suivant.
    const siens = [MARDI_10, MERCREDI_11, JEUDI_12, LUNDI_16];
    const r = await enregistrerReponse(
      envoi.jeton,
      { decision: "accepte", dateRetenue: MARDI_10, joursRetenus: siens },
      MARDI
    );
    assert.equal(r.succes, true, "L'acceptation de ses jours a été refusée.");

    const poses = await chantiersRepo.creneauxDunChantier(ctx, c.chantierId);
    assert.deepEqual(joursPoses(poses), [...siens].sort(), `Le chantier s'est posé sur ${joursPoses(poses).join(", ")}`);
    assert.ok(
      !poses.some((p) => p.jour === VENDREDI_13),
      "Le vendredi a été pris alors qu'elle l'avait effacé."
    );
  });

  await test("garder le premier jour et déplacer le dernier reste une CONTRE-PROPOSITION", async () => {
    // Le raccourci d'avant — « la date n'est pas dans celles proposées » —
    // aurait rendu `false` ici, et sa liste aurait été jetée en silence.
    const ctx = await contexte(`contre-${Date.now()}@t.test`);
    const c = await chantierPret(ctx, "Tonte", "4 jours");
    const envoi = await envoiDeQuatreJours(ctx, c, "B");

    const r = await enregistrerReponse(
      envoi.jeton,
      { decision: "accepte", dateRetenue: MARDI_10, joursRetenus: [MARDI_10, MERCREDI_11, JEUDI_12, LUNDI_16] },
      MARDI
    );
    assert.equal(r.succes, true);
    assert.equal(r.succes && r.contreProposee, true, "Ses jours à elle sont passés pour ceux du patron.");
  });

  await test("les mêmes jours que proposés ne sont PAS une contre-proposition", async () => {
    const ctx = await contexte(`memes-${Date.now()}@t.test`);
    const c = await chantierPret(ctx, "Plantation", "4 jours");
    const envoi = await envoiDeQuatreJours(ctx, c, "C");

    const r = await enregistrerReponse(
      envoi.jeton,
      {
        decision: "accepte",
        dateRetenue: MARDI_10,
        joursRetenus: [MARDI_10, MERCREDI_11, JEUDI_12, VENDREDI_13],
      },
      MARDI
    );
    assert.equal(r.succes, true);
    assert.equal(r.succes && r.contreProposee, false, "Reprendre les jours du patron a été lu comme un refus des siens.");
  });

  await test("trois jours pour un chantier de quatre : REFUSÉ", async () => {
    const ctx = await contexte(`incomplet-${Date.now()}@t.test`);
    const c = await chantierPret(ctx, "Abattage", "4 jours");
    const envoi = await envoiDeQuatreJours(ctx, c, "D");

    const r = await enregistrerReponse(
      envoi.jeton,
      { decision: "accepte", dateRetenue: MARDI_10, joursRetenus: [MARDI_10, MERCREDI_11, LUNDI_16] },
      MARDI
    );
    assert.equal(r.succes, false, "Trois jours sur quatre sont passés.");
    assert.equal(r.succes === false && r.motif, "jours_incomplets");

    // Et rien n'a été posé : un refus qui planifie quand même serait pire.
    const poses = await chantiersRepo.creneauxDunChantier(ctx, c.chantierId);
    assert.deepEqual(poses, [], "Le chantier a été planifié malgré le refus.");
  });

  await test("un premier jour qui n'est pas le sien est refusé", async () => {
    const ctx = await contexte(`premier-${Date.now()}@t.test`);
    const c = await chantierPret(ctx, "Élagage", "4 jours");
    const envoi = await envoiDeQuatreJours(ctx, c, "E");

    const r = await enregistrerReponse(
      envoi.jeton,
      {
        decision: "accepte",
        dateRetenue: LUNDI_16,
        joursRetenus: [MARDI_10, MERCREDI_11, JEUDI_12, VENDREDI_13],
      },
      MARDI
    );
    assert.equal(r.succes, false, "Une date qui ne commence pas sa liste est passée.");
  });

  await test("l'écran de retour lui redit TOUS ses jours, pas seulement le premier", async () => {
    const ctx = await contexte(`retour-${Date.now()}@t.test`);
    const c = await chantierPret(ctx, "Haie", "4 jours");
    const envoi = await envoiDeQuatreJours(ctx, c, "F");
    const siens = [MARDI_10, MERCREDI_11, JEUDI_12, LUNDI_16];

    await enregistrerReponse(
      envoi.jeton,
      { decision: "accepte", dateRetenue: MARDI_10, joursRetenus: siens },
      MARDI
    );
    const lu = await lireParJeton(envoi.jeton, MARDI);
    assert.deepEqual(lu?.joursRetenus, [...siens].sort(), "La page de retour ne porte pas ses jours.");
  });

  await test("une date offerte, sans liste : les jours du PATRON font foi", async () => {
    const ctx = await contexte(`patron-${Date.now()}@t.test`);
    const c = await chantierPret(ctx, "Massif", "4 jours");
    const envoi = await envoiDeQuatreJours(ctx, c, "G");

    const r = await enregistrerReponse(envoi.jeton, { decision: "accepte", dateRetenue: MARDI_10 }, MARDI);
    assert.equal(r.succes, true);
    const poses = await chantiersRepo.creneauxDunChantier(ctx, c.chantierId);
    assert.deepEqual(joursPoses(poses), [MARDI_10, MERCREDI_11, JEUDI_12, VENDREDI_13]);

    // Et la mémoire de la réponse est écrite même là : une réponse qui se redit
    // toute seule vaut mieux qu'une réponse à recroiser avec `jours_proposes`.
    const lu = await lireParJeton(envoi.jeton, MARDI);
    assert.deepEqual(lu?.joursRetenus, [MARDI_10, MERCREDI_11, JEUDI_12, VENDREDI_13]);
  });

  await test("calendrier fermé par le patron : ses jours à elle sont refusés", async () => {
    // La page les cache déjà, mais elle est publique et son formulaire se
    // rejoue : la règle tient au serveur (17 août 2026).
    const ctx = await contexte(`ferme-${Date.now()}@t.test`);
    const c = await chantierPret(ctx, "Clôture", "4 jours");
    const envoi = await envoiDeQuatreJours(ctx, c, "H", false);

    const r = await enregistrerReponse(
      envoi.jeton,
      { decision: "accepte", dateRetenue: MARDI_10, joursRetenus: [MARDI_10, MERCREDI_11, JEUDI_12, LUNDI_16] },
      MARDI
    );
    assert.equal(r.succes, false, "Une contre-proposition est passée sur un envoi fermé.");
    assert.equal(r.succes === false && r.motif, "autre_date_refusee");
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
