/**
 * DÉFAIRE UNE ACCEPTATION — son choix 3 du 7 octobre 2026
 * (`appli/devis-accepte-par-erreur.html`).
 *
 * *« Si jamais un client valide un devis sans faire exprès [...] il nous appelle
 * pour nous dire : je me suis trompé. »* Ce que cette suite garde, sur la base,
 * sous le rôle de l'application (la RLS s'applique) :
 *
 *   A. « Il veut une autre date » : l'envoi redevient sans réponse, le chantier
 *      quitte le planning, et le client peut répondre à nouveau par son lien.
 *   B. « Il ne veut plus du devis » : refusé, quitte le planning, le lien ne
 *      permet plus d'accepter, et l'accueil ne l'annonce pas comme une nouvelle.
 *   C. L'acceptation effacée est GARDÉE : sa date, son adresse, son appareil.
 *   D. La trace ne se réécrit ni ne s'efface sous `atlas_app`.
 *   E. Un devis qui n'est pas accepté ne se défait pas, et rien n'est écrit.
 *   F. Une facture préparée l'interdit, et rien n'est écrit.
 *   G. Une autre entreprise ne peut rien défaire.
 *
 *   npx tsx scripts/test-acceptation-defaite-db.ts   (sur atlas_test)
 */
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { acceptationsDefaites, envoisDevis } from "../src/server/db/schema";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import { creerEnvoi, enregistrerReponse } from "../src/server/repositories/envois-devis";
import { defaireLAcceptation, AcceptationNonDefaite } from "../src/server/repositories/acceptation-defaite";
import { terminerChantier } from "../src/server/repositories/factures";
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
const PROPOSEE = dans(21);
const LENDEMAIN = dans(22);

type Ctx = { utilisateurId: string; entrepriseId: string };

async function contexte(email: string): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise({ nom: "Jardins Roux" }, { email });
  return { utilisateurId, entrepriseId: entreprise.id };
}

/** Un devis de deux jours, parti, puis accepté par le client sur sa page. */
async function devisAccepte(ctx: Ctx, nom: string) {
  const client = await clientsRepo.creerClient(ctx, { nom: "Mme Roux", email: "roux@test.local" });
  await clientsRepo.mettreAJourClient(ctx, client.id, { canalCommunication: "email" });
  const chantier = await chantiersRepo.creerChantier(ctx, { nom, clientId: client.id });
  await chantiersRepo.mettreAJourDureeEquipe(ctx, chantier.id, { dureePrevue: "2 jours" });
  // **Un devis réellement parti** : avec une ligne et envoyé, comme chez lui.
  // Un brouillon accepté ne se facturerait pas, et le cas F ne mesurerait rien.
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Taille de haie", "600.00");
  const devis = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  await devisRepo.envoyerDevis(ctx, devis.id);
  const envoi = await creerEnvoi(
    ctx,
    { chantierId: chantier.id, devisId: devis.id, canal: "email", datesProposees: [PROPOSEE], contenuDevis: nom },
    MARDI
  );
  const r = await enregistrerReponse(
    envoi.jeton,
    {
      decision: "accepte",
      dateRetenue: PROPOSEE,
      joursRetenus: [PROPOSEE, LENDEMAIN],
      adresseIp: "203.0.113.7",
      agentUtilisateur: "iPhone du client",
    },
    MARDI
  );
  assert.equal(r.succes, true, `L'acceptation de départ a été refusée : ${JSON.stringify(r)}`);
  return { chantierId: chantier.id, jeton: envoi.jeton, envoiId: envoi.id };
}

async function lireEnvoi(ctx: Ctx, envoiId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [e] = await tx.select().from(envoisDevis).where(eq(envoisDevis.id, envoiId)).limit(1);
    return e;
  });
}

async function traces(ctx: Ctx, envoiId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
    tx.select().from(acceptationsDefaites).where(eq(acceptationsDefaites.envoiId, envoiId))
  );
}

async function auPlanning(ctx: Ctx, chantierId: string) {
  const c = await chantiersRepo.getChantier(ctx, chantierId);
  const creneaux = await chantiersRepo.creneauxDunChantier(ctx, chantierId);
  return { date: c?.datePlanifiee ?? null, creneaux: creneaux.length };
}

async function motif(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return "aucun refus";
  } catch (e) {
    if (e instanceof AcceptationNonDefaite) return e.motif;
    throw e;
  }
}

async function main() {
  await nettoyerBase();

  await test("A. une autre date : sans réponse, hors du planning, et le lien répond de nouveau", async () => {
    const ctx = await contexte(`attente-${Date.now()}@t.test`);
    const c = await devisAccepte(ctx, "Taille de haie");
    const avant = await auPlanning(ctx, c.chantierId);
    assert.ok(avant.date && avant.creneaux > 0, "L'acceptation n'a pas posé le chantier : le cas ne mesure rien.");

    await defaireLAcceptation(ctx, c.chantierId, "attente");

    const e = await lireEnvoi(ctx, c.envoiId);
    assert.equal(e.reponse, null, "Le devis est encore accepté.");
    assert.equal(e.responduAt, null);
    assert.equal(e.dateRetenue, null, "La date retenue a survécu à l'acceptation défaite.");
    assert.equal(e.joursRetenus, null);
    assert.deepEqual(await auPlanning(ctx, c.chantierId), { date: null, creneaux: 0 }, "Le chantier est resté posé.");

    const encore = await enregistrerReponse(
      c.jeton,
      { decision: "accepte", dateRetenue: PROPOSEE, joursRetenus: [PROPOSEE, LENDEMAIN] },
      MARDI
    );
    assert.equal(encore.succes, true, `Le client ne peut plus répondre par son lien : ${JSON.stringify(encore)}`);
  });

  await test("B. plus de devis : refusé, hors du planning, et le lien n'accepte plus", async () => {
    const ctx = await contexte(`refus-${Date.now()}@t.test`);
    const c = await devisAccepte(ctx, "Élagage");
    await defaireLAcceptation(ctx, c.chantierId, "refusee");

    const e = await lireEnvoi(ctx, c.envoiId);
    assert.equal(e.reponse, "refusee");
    assert.ok(e.responduAt, "Un refus sans date viole la contrainte de l'envoi.");
    assert.ok(e.vuParPatronAt, "L'accueil annoncerait comme une nouvelle le refus qu'il vient de noter.");
    assert.deepEqual(await auPlanning(ctx, c.chantierId), { date: null, creneaux: 0 });

    const encore = await enregistrerReponse(
      c.jeton,
      { decision: "accepte", dateRetenue: PROPOSEE, joursRetenus: [PROPOSEE, LENDEMAIN] },
      MARDI
    );
    assert.equal(encore.succes, false, "Le client a pu accepter un devis noté refusé.");
  });

  await test("C. l'acceptation effacée est gardée : sa date, son adresse, son appareil", async () => {
    const ctx = await contexte(`trace-${Date.now()}@t.test`);
    const c = await devisAccepte(ctx, "Massif");
    await defaireLAcceptation(ctx, c.chantierId, "attente");

    const t = await traces(ctx, c.envoiId);
    assert.equal(t.length, 1, `${t.length} trace(s) au lieu d'une.`);
    assert.equal(t[0].vers, "attente");
    assert.equal(t[0].dateRetenue, PROPOSEE);
    assert.deepEqual(t[0].joursRetenus, [PROPOSEE, LENDEMAIN]);
    assert.equal(t[0].adresseIp, "203.0.113.7");
    assert.equal(t[0].agentUtilisateur, "iPhone du client");
    assert.equal(t[0].defaitePar, ctx.utilisateurId);
  });

  await test("D. la trace ne se réécrit ni ne s'efface sous atlas_app", async () => {
    const ctx = await contexte(`immuable-${Date.now()}@t.test`);
    const c = await devisAccepte(ctx, "Pelouse");
    await defaireLAcceptation(ctx, c.chantierId, "refusee");
    for (const requete of [
      sql`update acceptations_defaites set adresse_ip = 'effacée'`,
      sql`delete from acceptations_defaites`,
    ]) {
      const refus = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) => tx.execute(requete)).then(
        () => null,
        (e: unknown) => e
      );
      assert.ok(refus, "L'application a pu réécrire ou effacer la preuve d'un accord.");
      const texte = `${(refus as Error).message} ${((refus as { cause?: Error }).cause?.message) ?? ""}`;
      assert.match(texte, /permission denied/, `Refusé, mais pas par les droits : ${texte}`);
    }
    assert.equal((await traces(ctx, c.envoiId)).length, 1);
  });

  await test("E. un devis qui n'est pas accepté ne se défait pas, et rien n'est écrit", async () => {
    const ctx = await contexte(`pas-accepte-${Date.now()}@t.test`);
    const c = await devisAccepte(ctx, "Clôture");
    await defaireLAcceptation(ctx, c.chantierId, "attente");
    assert.equal(await motif(() => defaireLAcceptation(ctx, c.chantierId, "refusee")), "pas_accepte");
    assert.equal((await traces(ctx, c.envoiId)).length, 1, "Un second geste a écrit une seconde trace.");
    assert.equal((await lireEnvoi(ctx, c.envoiId)).reponse, null, "Le refus a quand même été écrit.");
  });

  await test("F. une facture préparée l'interdit, et rien n'est écrit", async () => {
    const ctx = await contexte(`facture-${Date.now()}@t.test`);
    const c = await devisAccepte(ctx, "Terrasse");
    await terminerChantier(ctx, c.chantierId, MARDI);
    assert.equal(await motif(() => defaireLAcceptation(ctx, c.chantierId, "attente")), "facture_preparee");
    const e = await lireEnvoi(ctx, c.envoiId);
    assert.equal(e.reponse, "acceptee", "L'acceptation d'un chantier facturé a été effacée.");
    assert.equal((await traces(ctx, c.envoiId)).length, 0);
    assert.ok((await auPlanning(ctx, c.chantierId)).date, "Le chantier facturé a perdu sa date.");
  });

  await test("G. une autre entreprise ne peut rien défaire", async () => {
    const ctx = await contexte(`chez-moi-${Date.now()}@t.test`);
    const autre = await contexte(`chez-lui-${Date.now()}@t.test`);
    const c = await devisAccepte(ctx, "Haie");
    assert.equal(await motif(() => defaireLAcceptation(autre, c.chantierId, "refusee")), "pas_accepte");
    assert.equal((await lireEnvoi(ctx, c.envoiId)).reponse, "acceptee");
    assert.ok((await auPlanning(ctx, c.chantierId)).date);
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
