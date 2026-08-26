import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as tarifsRepo from "../src/server/repositories/tarifs";
import { poserQuestion } from "../src/server/ai/services/assistant-service";
import { appliquerPropositionsAction } from "../src/app/chantiers/[id]/informations/actions";
import { enregistrerPropositions } from "../src/server/repositories/propositions-ia";
import { getOutil } from "../src/server/ai/tools/registre";
import type { ActionProposee } from "../src/server/ai/propositions";
import type { Ctx } from "../src/server/repositories/context";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

/**
 * L'agent : dix gestes de plus, et TOUS confirmés par son doigt.
 *
 * **Sa demande du 26 août 2026 :** *« je veux que ce soit un vrai agent IA avec
 * toutes les capacités possibles et imaginables sur l'appli »* — et sa réponse,
 * le même jour, sur ce qu'il pourrait faire tout seul : *« je pense qu'il ne
 * doit pas pouvoir le faire, très important que ça reste le doigt du patron »*.
 *
 * **Ce que cette suite défend avant tout** : qu'une QUESTION n'écrive jamais
 * rien, et qu'un geste relise sa cible en base au moment d'écrire — pas au
 * moment de proposer. Entre les deux, le chantier a pu disparaître.
 */

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

/** Le parcours réel : on enregistre la proposition, puis on la confirme par son id. */
async function confirmer(ctx: Ctx, chantierId: string | null, propositions: ActionProposee[]) {
  const enregistrees = await enregistrerPropositions(ctx, chantierId, propositions);
  return appliquerPropositionsAction(
    chantierId,
    enregistrees.map((r) => r.id)
  );
}

async function main() {
  await nettoyerBase();

  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Agent" },
    { email: "agent@test.local", nom: "Patron" }
  );
  const A = { entrepriseId: entreprise.id, utilisateurId };
  process.env.AUTH_TEST_UTILISATEUR_ID = utilisateurId;

  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Agent voisine" },
    { email: "agent-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  const bernard = await clientsRepo.creerClient(A, { nom: "Bernard Lemoine", telephone: "0600000000" });
  const chantier = await chantiersRepo.creerChantier(A, { nom: "Terrasse Bernard", clientId: bernard.id });

  // --- Les outils de lecture, qui donnent les cibles ----------------------

  await test("RechercherChantier retrouve un chantier par le nom du client", async () => {
    const outil = getOutil("RechercherChantier")!;
    const r = (await outil.executer({ ctx: A, chantierId: null }, { motCle: "bernard" })) as {
      trouve: boolean;
      chantiers: { chantierId: string; nom: string }[];
    };
    assert.equal(r.trouve, true);
    assert.equal(r.chantiers[0].chantierId, chantier.id);
  });

  await test("Isolation : l'entreprise voisine ne voit aucun de ces chantiers", async () => {
    const outil = getOutil("RechercherChantier")!;
    const r = (await outil.executer({ ctx: B, chantierId: null }, { motCle: "bernard" })) as { trouve: boolean };
    assert.equal(r.trouve, false);
  });

  await test("LireClients rend l'identifiant, sans quoi on corrigerait le mauvais Martin", async () => {
    const outil = getOutil("LireClients")!;
    const r = (await outil.executer({ ctx: A, chantierId: null }, { motCle: "bernard" })) as {
      trouve: boolean;
      clients: { clientId: string; telephone: string | null }[];
    };
    assert.equal(r.clients[0].clientId, bernard.id);
    assert.equal(r.clients[0].telephone, "0600000000");
  });

  await test("LirePlanning sépare ce qui est posé de ce qui attend un jour", async () => {
    const outil = getOutil("LirePlanning")!;
    const r = (await outil.executer({ ctx: A, chantierId: null }, {})) as { poses: unknown[]; sansDate: unknown[] };
    assert.ok(Array.isArray(r.poses) && Array.isArray(r.sansDate));
  });

  // --- Les gestes, un par un ---------------------------------------------

  await test("Créer un chantier — sans aucun chantier ouvert (migration 0066)", async () => {
    const { resultats } = await confirmer(A, null, [
      { type: "creer_chantier", description: "Créer le chantier : Haie Durand", donnees: { nom: "Haie Durand" } },
    ]);
    assert.equal(resultats[0].statut, "appliquee", resultats[0].message);
    const tous = await chantiersRepo.listerChantiers(A);
    assert.ok(tous.some((c) => c.nom === "Haie Durand"));
  });

  await test("Corriger un client — et SEULS les champs donnés bougent", async () => {
    const { resultats } = await confirmer(A, null, [
      {
        type: "modifier_client",
        description: "Corriger Bernard : téléphone",
        donnees: { clientId: bernard.id, telephone: "0611111111" },
      },
    ]);
    assert.equal(resultats[0].statut, "appliquee", resultats[0].message);
    const apres = await clientsRepo.getClient(A, bernard.id);
    assert.equal(apres!.telephone, "0611111111");
    assert.equal(apres!.nom, "Bernard Lemoine", "Le nom ne devait pas bouger");
  });

  await test("Poser un chantier au planning", async () => {
    const { resultats } = await confirmer(A, chantier.id, [
      {
        type: "planifier_chantier",
        description: "Poser Terrasse Bernard",
        donnees: { chantierId: chantier.id, jour: "2026-09-14", quand: "matin" },
      },
    ]);
    assert.equal(resultats[0].statut, "appliquee", resultats[0].message);
    const apres = await chantiersRepo.getChantier(A, chantier.id);
    assert.equal(apres!.datePlanifiee, "2026-09-14");
  });

  await test("Un jour qui n'existe pas est refusé — le 31 février s'écrit très bien", async () => {
    const { resultats } = await confirmer(A, chantier.id, [
      {
        type: "planifier_chantier",
        description: "Poser au 31 février",
        donnees: { chantierId: chantier.id, jour: "2026-02-31", quand: "matin" },
      },
    ]);
    assert.equal(resultats[0].statut, "conflit");
    assert.equal(resultats[0].categorie, "donnee_invalide");
  });

  await test("Retirer du planning", async () => {
    const { resultats } = await confirmer(A, chantier.id, [
      { type: "retirer_du_planning", description: "Retirer du planning", donnees: { chantierId: chantier.id } },
    ]);
    assert.equal(resultats[0].statut, "appliquee", resultats[0].message);
    const apres = await chantiersRepo.getChantier(A, chantier.id);
    assert.equal(apres!.datePlanifiee, null);
  });

  await test("Déplacer un chantier qui n'est posé nulle part est REFUSÉ, et le dit", async () => {
    const { resultats } = await confirmer(A, chantier.id, [
      {
        type: "deplacer_chantier",
        description: "Déplacer",
        donnees: { chantierId: chantier.id, jour: "2026-09-15", quand: "matin" },
      },
    ]);
    assert.equal(resultats[0].statut, "conflit");
    assert.match(resultats[0].message ?? "", /posé sur aucun jour/i);
  });

  await test("Noter sur un chantier", async () => {
    const { resultats } = await confirmer(A, chantier.id, [
      {
        type: "noter_chantier",
        description: "Noter",
        donnees: { chantierId: chantier.id, note: "Le client est absent le matin." },
      },
    ]);
    assert.equal(resultats[0].statut, "appliquee", resultats[0].message);
    const apres = await chantiersRepo.getChantier(A, chantier.id);
    assert.equal(apres!.note, "Le client est absent le matin.");
  });

  await test("Corriger l'adresse d'un chantier", async () => {
    const { resultats } = await confirmer(A, chantier.id, [
      {
        type: "modifier_adresse_chantier",
        description: "Adresse",
        donnees: { chantierId: chantier.id, adresse: "12 rue des Lilas, Nantes" },
      },
    ]);
    assert.equal(resultats[0].statut, "appliquee", resultats[0].message);
    const apres = await chantiersRepo.getChantier(A, chantier.id);
    assert.equal(apres!.adresseChantier, "12 rue des Lilas, Nantes");
  });

  await test("Créer un tarif — mais JAMAIS sans prix", async () => {
    const { resultats } = await confirmer(A, null, [
      { type: "creer_tarif", description: "Élagage", donnees: { intitule: "Élagage d'un tilleul", prix: "450.00" } },
      { type: "creer_tarif", description: "Sans prix", donnees: { intitule: "Broyage" } },
    ]);
    assert.equal(resultats[0].statut, "appliquee", resultats[0].message);
    assert.equal(resultats[1].statut, "conflit", "Un prix ne s'invente pas");
    const tous = await tarifsRepo.listerTarifs(A);
    assert.ok(tous.some((t) => t.intitule === "Élagage d'un tilleul"));
    assert.ok(!tous.some((t) => t.intitule === "Broyage"));
  });

  await test("Corriger un tarif", async () => {
    const tarif = await tarifsRepo.creerTarif(A, { intitule: "Tonte", prix: "80.00" });
    const { resultats } = await confirmer(A, null, [
      { type: "modifier_tarif", description: "Tonte à 95", donnees: { tarifId: tarif.id, prix: "95.00" } },
    ]);
    assert.equal(resultats[0].statut, "appliquee", resultats[0].message);
    assert.equal((await tarifsRepo.getTarif(A, tarif.id))!.prix, "95.00");
  });

  // --- Ce qui doit REFUSER ------------------------------------------------

  await test("Isolation : un chantier de l'entreprise voisine est indiscernable d'un disparu", async () => {
    const chezB = await chantiersRepo.creerChantier(B, { nom: "Chantier voisin" });
    const { resultats } = await confirmer(A, null, [
      { type: "noter_chantier", description: "Noter chez le voisin", donnees: { chantierId: chezB.id, note: "coucou" } },
    ]);
    assert.equal(resultats[0].statut, "conflit");
    assert.equal(resultats[0].categorie, "conflit_metier");
    const intact = await chantiersRepo.getChantier(B, chezB.id);
    assert.equal(intact!.note, null, "Rien ne doit avoir été écrit chez le voisin");
  });

  await test("Un geste qui vise un chantier, sans chantier, le DIT au lieu de planter", async () => {
    const { resultats } = await confirmer(A, null, [
      { type: "noter_chantier", description: "Noter dans le vide", donnees: { note: "coucou" } },
    ]);
    assert.equal(resultats[0].statut, "conflit");
    assert.match(resultats[0].message ?? "", /ouvrez-le, ou nommez-le/i);
  });

  await test("Un client disparu rend un conflit, jamais une écriture au hasard", async () => {
    const { resultats } = await confirmer(A, null, [
      {
        type: "modifier_client",
        description: "Client fantôme",
        donnees: { clientId: "00000000-0000-0000-0000-000000000000", telephone: "0600000000" },
      },
    ]);
    assert.equal(resultats[0].statut, "conflit");
    assert.equal(resultats[0].categorie, "conflit_metier");
  });

  // --- Et surtout : une QUESTION n'écrit rien ------------------------------

  await test("Demander un geste ne l'exécute PAS — c'est le doigt du patron qui écrit", async () => {
    const avant = await chantiersRepo.listerChantiers(A);
    const reponse = await poserQuestion(A, chantier.id, [], "Crée un chantier pour Madame Lucie");
    assert.equal(reponse.succes, true);
    if (!reponse.succes) return;
    assert.ok(reponse.propositions && reponse.propositions.length > 0, "Une proposition était attendue");
    assert.equal(reponse.propositions![0].type, "creer_chantier");
    const apres = await chantiersRepo.listerChantiers(A);
    assert.equal(apres.length, avant.length, "RIEN ne doit avoir été créé avant sa confirmation");
  });

  await test("Un geste sans chantier ouvert propose quand même — trouvé à l'image", async () => {
    // **Le défaut que la capture a montré le 26 août 2026.** Depuis l'accueil,
    // « Crée un chantier pour Madame Lucie » répondait « Aucun chantier dans le
    // contexte courant » : un message technique, et FAUX — créer un chantier ne
    // demande justement aucun chantier ouvert. Aucun test ne le voyait, parce
    // que tous posaient leurs questions depuis un chantier.
    const reponse = await poserQuestion(A, null, [], "Crée un chantier pour Madame Lucie");
    assert.equal(reponse.succes, true, !reponse.succes ? reponse.erreur : "");
    if (!reponse.succes) return;
    assert.ok(reponse.propositions && reponse.propositions.length === 1, "Une proposition était attendue");
    assert.equal(reponse.propositions![0].type, "creer_chantier");

    // Et elle s'applique jusqu'au bout, sans chantier.
    const { resultats } = await appliquerPropositionsAction(null, [reponse.propositions![0].id]);
    assert.equal(resultats[0].statut, "appliquee", resultats[0].message);
  });

  await test("Une question hors d'Atlas ne déclenche aucun outil, et se refuse", async () => {
    const reponse = await poserQuestion(A, chantier.id, [], "est-ce que le CGR de Mantes est ouvert ?");
    assert.equal(reponse.succes, true);
    if (!reponse.succes) return;
    assert.match(reponse.texte, /ne réponds qu'aux questions sur Atlas/i);
    assert.deepEqual(reponse.sources, [], "Aucun outil ne doit avoir été consulté");
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échec(s)`);
  await fermerLimiteur();
  await pool.end();
  if (failed > 0) process.exit(1);
}

main();
