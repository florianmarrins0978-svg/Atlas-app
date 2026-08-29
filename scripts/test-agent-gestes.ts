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
import { ongletDuChantier } from "../src/lib/onglet-chantier";
import { getStatutAffiche } from "../src/lib/chantier-etat";

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

/**
 * Clore un chantier en base, POUR DE VRAI.
 *
 * **Un `UPDATE` par le pool nu ne touche rien, et ne le dit pas.** `atlas_app`
 * travaille sous `FORCE ROW LEVEL SECURITY` : sans `app.entreprise_id` posé
 * dans la MÊME transaction, la politique ne voit aucune ligne et la requête
 * réussit sur zéro ligne (`CLAUDE.md` §3). Le cas passait alors au vert sur un
 * chantier resté ordinaire — et c'est le préalable du contrôle qui l'a dit.
 */
async function clore(ctx: Ctx, chantierId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [ctx.entrepriseId]);
    const r = await client.query(`UPDATE chantiers SET termine_at = now() WHERE id = $1`, [chantierId]);
    await client.query("COMMIT");
    if (r.rowCount !== 1) throw new Error(`la clôture n'a touché aucune ligne (${r.rowCount})`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
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
    // Leur outil (celui de `main`) prend `nom` et emploie la règle de l'écran.
    const r = (await outil.executer({ ctx: A, chantierId: null }, { nom: "bernard" })) as {
      trouves: { chantierId: string; chantierNom: string }[];
    };
    assert.equal(r.trouves[0].chantierId, chantier.id);
  });

  await test("Isolation : l'entreprise voisine ne voit aucun de ces chantiers", async () => {
    const outil = getOutil("RechercherChantier")!;
    const r = (await outil.executer({ ctx: B, chantierId: null }, { nom: "bernard" })) as {
      trouves: unknown[];
    };
    assert.equal(r.trouves.length, 0);
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

  await test("Créer un chantier — sans aucun chantier ouvert (migration 0067)", async () => {
    const { resultats } = await confirmer(A, null, [
      { type: "creer_chantier", description: "Créer la fiche : Durand", donnees: { client: "Durand" } },
    ]);
    assert.equal(resultats[0].statut, "appliquee", resultats[0].message);
    // **Le nom se DÉDUIT du client** (sa règle du 5 août 2026 : un chantier ne
    // se baptise pas), par la même fonction que l'écran de création.
    const tous = await chantiersRepo.listerChantiersPourAffichage(A);
    assert.ok(tous.some((c) => c.nom.includes("Durand")), "aucune fiche ouverte pour Durand");
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
    /**
     * **On vise la RÈGLE, pas le libellé.** Ce cas exigeait « ouvrez-le, ou
     * nommez-le » mot pour mot — et il a rougi le 27 août 2026 sur une demande
     * exaucée : le patron reproche depuis le 25 août qu'on le renvoie ouvrir
     * une fiche lui-même. Une suite qui réclame ce qu'il a fait retirer rend
     * son écran impossible à changer (`CLAUDE.md` §5 bis).
     *
     * Ce qui compte : le geste le DIT au lieu de planter, il dit quelque chose,
     * et il ne le renvoie pas ouvrir une fiche.
     */
    assert.ok((resultats[0].message ?? "").trim().length > 0, "un conflit muet n'apprend rien");
    assert.doesNotMatch(resultats[0].message ?? "", /ouvrez-le|ouvrir/i);
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

  /**
   * PEU IMPORTE L'ÉCRAN — sa règle du 27 août 2026 : *« l'encart assistant, peu
   * importe où je l'ouvre, il doit pouvoir répondre à mes envies »*.
   *
   * Ces trois cas jouent l'ACCUEIL : `chantierId` vaut `null`, comme lorsqu'il
   * ouvre le panneau depuis la liste ou le planning. Le geste doit alors porter
   * sur le chantier qu'il NOMME, et non se refuser.
   */
  await test("DEPUIS L'ACCUEIL, un geste porte sur le chantier qu'il nomme", async () => {
    const { resultats } = await confirmer(A, null, [
      {
        type: "noter_chantier",
        description: "Noter le chantier",
        donnees: { chantierId: chantier.id, note: "Vu depuis l'accueil." },
      },
    ]);
    assert.equal(resultats[0].statut, "appliquee", resultats[0].message);
  });

  await test("DEPUIS L'ACCUEIL, la clé peut s'appeler autrement — le geste porte quand même", async () => {
    // Le modèle range la même idée sous des noms voisins ; la consigne nomme
    // désormais la clé, et les alias rattrapent ce qui passe à côté. C'est la
    // faute du 26 août d'un cran plus loin (`chantier-vise.ts`).
    const { resultats } = await confirmer(A, null, [
      {
        type: "noter_chantier",
        description: "Noter le chantier",
        donnees: { chantier_id: chantier.id, note: "Rangé sous un autre nom." },
      },
    ]);
    assert.equal(resultats[0].statut, "appliquee", resultats[0].message);
  });

  await test("« id » NE DÉSIGNE PAS le chantier — le geste ne vise pas à côté", async () => {
    /**
     * `donnees.id` porte l'élément touché sur la moitié des gestes. L'accepter
     * comme chantier ferait viser une prestation, et le refus qui s'ensuit
     * envoie chercher au mauvais endroit. Sans chantier ouvert ni clé connue,
     * le geste doit se refuser — proprement, et sans renvoyer le patron ouvrir
     * une fiche lui-même.
     */
    const { resultats } = await confirmer(A, null, [
      { type: "noter_chantier", description: "Noter le chantier", donnees: { id: chantier.id, note: "À côté." } },
    ]);
    assert.equal(resultats[0].statut, "conflit");
    assert.doesNotMatch(
      resultats[0].message ?? "",
      /ouvrez-le|ouvrir/i,
      "le refus renvoie le patron ouvrir une fiche — c'est exactement ce qu'il a reproché"
    );
  });

  /**
   * L'ONGLET NE DOIT RIEN CHANGER — sa règle du 27 août 2026 : *« que je sois
   * dans la catégorie terminé ou chantier, je dois pouvoir lui demander
   * n'importe quoi ; il ne doit pas être attaché à une catégorie »*.
   *
   * Un chantier rangé dans « Terminés » n'est pas un chantier différent : c'est
   * le même, à un autre moment de sa vie. Ce qui suit le prouve plutôt que de
   * l'affirmer — et il commence par VÉRIFIER que le chantier d'essai est bien
   * dans cet onglet-là, sans quoi le contrôle ne mesurerait rien.
   */
  await test("UN CHANTIER TERMINÉ se cherche et se lit comme les autres, sans écran ouvert", async () => {
    const fini = await chantiersRepo.creerChantier(A, { nom: "Mur fini Bernard", clientId: bernard.id });
    await clore(A, fini.id);

    // **On s'assure qu'il est VRAIMENT dans « Terminés ».** Sans ce préalable,
    // le cas passerait au vert sur un chantier ordinaire — un contrôle qui ne
    // mesure pas ce qu'il annonce (`CLAUDE.md` §5).
    const tous = await chantiersRepo.listerChantiersPourAffichage(A);
    const ligne = tous.find((c) => c.id === fini.id)!;
    assert.equal(
      ongletDuChantier({ statut: getStatutAffiche(ligne), datePlanifiee: ligne.datePlanifiee }),
      "termines",
      "le chantier d'essai n'est pas dans l'onglet Terminés : ce cas ne prouverait rien"
    );

    // Trouvé depuis AUCUN écran de chantier — comme lorsqu'il ouvre le panneau
    // depuis l'onglet Terminés.
    const outil = getOutil("RechercherChantier")!;
    const r = (await outil.executer({ ctx: A, chantierId: null }, { nom: "Mur fini" })) as {
      trouves: { chantierId: string }[];
    };
    assert.ok(
      r.trouves.some((t) => t.chantierId === fini.id),
      "un chantier terminé est introuvable : l'assistant serait attaché à une catégorie"
    );

    // Et lu, toujours sans écran ouvert.
    const lecture = getOutil("LireInformationsChantier")!;
    const infos = (await lecture.executer({ ctx: A, chantierId: null }, { chantierId: fini.id })) as {
      erreur?: string;
    };
    assert.ok(!infos.erreur, `la lecture refuse un chantier terminé : ${infos.erreur}`);
  });

  await test("ET IL S'Y NOTE, depuis l'onglet Terminés", async () => {
    const fini = await chantiersRepo.creerChantier(A, { nom: "Allée finie Bernard", clientId: bernard.id });
    await clore(A, fini.id);
    const { resultats } = await confirmer(A, null, [
      {
        type: "noter_chantier",
        description: "Noter le chantier",
        donnees: { chantierId: fini.id, note: "Le client rappellera au printemps." },
      },
    ]);
    assert.equal(resultats[0].statut, "appliquee", resultats[0].message);
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échec(s)`);
  await fermerLimiteur();
  await pool.end();
  if (failed > 0) process.exit(1);
}

main();
