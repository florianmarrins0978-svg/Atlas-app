import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import { ajouterLignePrix, listerLignesPrix } from "../src/server/repositories/lignes-prix";
import {
  getOuCreerDevisBrouillon,
  rechercherLignesDevisEntreprise,
  getLigneDevisPourCopie,
} from "../src/server/repositories/devis";
import { poserQuestion } from "../src/server/ai/services/assistant-service";
import { appliquerPropositionsAction } from "../src/app/chantiers/[id]/informations/actions";
import { enregistrerPropositions } from "../src/server/repositories/propositions-ia";
import { getOutil } from "../src/server/ai/tools/registre";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

/**
 * Reprendre une ligne du devis d'un AUTRE client (sa demande du 25 août 2026).
 *
 * **Ce que cette suite défend, et qui n'est pas évident.** Un montant qui
 * traverse le modèle de langage puis le navigateur est un montant qu'on peut
 * changer en chemin — sur un document qui part chez un client. La proposition
 * ne porte donc QUE l'identifiant de la ligne d'origine, et le prix est relu en
 * base à l'instant où l'on écrit. Deux tests l'exigent nommément.
 *
 * **Et la porte ouverte se referme sur l'entreprise.** Chercher « chez tous les
 * clients » est exactement le geste qui, mal borné, ferait sortir le devis du
 * voisin. C'est la RLS qui borne — jamais un filtre écrit à la main —, et c'est
 * éprouvé ici sous le rôle `atlas_app`.
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

async function main() {
  await nettoyerBase();

  const { entreprise: entA, utilisateurId: userA } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Copie A" },
    { email: "copie-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  process.env.AUTH_TEST_UTILISATEUR_ID = userA;

  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Copie B" },
    { email: "copie-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  // --- Chez A : un premier client, son devis, sa ligne d'élagage -----------
  const bernard = await clientsRepo.creerClient(A, { nom: "Bernard Lemoine", canalCommunication: "sms" });
  const chantierBernard = await chantiersRepo.creerChantier(A, { nom: "Jardin Bernard", clientId: bernard.id });
  await ajouterLignePrix(A, chantierBernard.id, "Élagage d'un tilleul", "450.00");
  await ajouterLignePrix(A, chantierBernard.id, "Évacuation des branches", "120.00");
  await getOuCreerDevisBrouillon(A, chantierBernard.id);

  // --- Chez A : le second client, dont le devis est ouvert ----------------
  const durand = await clientsRepo.creerClient(A, { nom: "Durand", canalCommunication: "sms" });
  const chantierDurand = await chantiersRepo.creerChantier(A, { nom: "Jardin Durand", clientId: durand.id });

  // --- Chez B : une ligne homonyme, qui ne doit JAMAIS sortir --------------
  const clientB = await clientsRepo.creerClient(B, { nom: "Bernard Lemoine", canalCommunication: "sms" });
  const chantierB = await chantiersRepo.creerChantier(B, { nom: "Jardin voisin", clientId: clientB.id });
  await ajouterLignePrix(B, chantierB.id, "Élagage d'un tilleul", "999.00");
  await getOuCreerDevisBrouillon(B, chantierB.id);

  await test("La recherche retrouve une ligne par un mot de son libellé", async () => {
    const lignes = await rechercherLignesDevisEntreprise(A, { motCle: "élagage" });
    assert.equal(lignes.length, 1);
    assert.equal(lignes[0].libelle, "Élagage d'un tilleul");
    assert.equal(lignes[0].montant, "450.00");
    assert.equal(lignes[0].client, "Bernard Lemoine");
  });

  await test("La recherche retrouve les lignes par le nom du client", async () => {
    const lignes = await rechercherLignesDevisEntreprise(A, { client: "bernard" });
    assert.equal(lignes.length, 2, "Les deux lignes du devis de Bernard");
  });

  await test("Sans mot-clé ni client, on ne rend RIEN — jamais tous les devis", async () => {
    assert.deepEqual(await rechercherLignesDevisEntreprise(A, {}), []);
    assert.deepEqual(await rechercherLignesDevisEntreprise(A, { motCle: "  ", client: null }), []);
  });

  await test("Isolation : l'entreprise B ne voit pas la ligne homonyme de A", async () => {
    const chezB = await rechercherLignesDevisEntreprise(B, { motCle: "élagage" });
    assert.equal(chezB.length, 1);
    assert.equal(chezB[0].montant, "999.00", "B ne doit voir que SA ligne");
    const chezA = await rechercherLignesDevisEntreprise(A, { motCle: "élagage" });
    assert.equal(chezA[0].montant, "450.00");
  });

  await test("Isolation : B ne peut pas relire une ligne de A par son identifiant", async () => {
    const [ligneDeA] = await rechercherLignesDevisEntreprise(A, { motCle: "élagage" });
    assert.equal(await getLigneDevisPourCopie(B, ligneDeA.ligneId), null);
  });

  // --- L'outil de l'assistant ---------------------------------------------

  await test("L'outil refuse une recherche sans aucun critère, et le dit", async () => {
    const outil = getOutil("RechercherLignesDevis")!;
    const resultat = (await outil.executer({ ctx: A, chantierId: chantierDurand.id }, {})) as {
      trouve: boolean;
      raison?: string;
    };
    assert.equal(resultat.trouve, false);
    assert.ok(resultat.raison);
  });

  await test("L'outil rend l'identifiant de la ligne, pas seulement son libellé", async () => {
    const outil = getOutil("RechercherLignesDevis")!;
    const resultat = (await outil.executer({ ctx: A, chantierId: chantierDurand.id }, { motCle: "élagage" })) as {
      trouve: boolean;
      lignes: { ligneId: string }[];
    };
    assert.equal(resultat.trouve, true);
    assert.ok(resultat.lignes[0].ligneId, "Sans identifiant, la copie devrait recopier un montant — ce qui est refusé");
  });

  // --- Le parcours entier, tel qu'il le vivra ------------------------------

  await test("« Reprends la ligne d'élagage du devis de Bernard » prépare une proposition", async () => {
    const reponse = await poserQuestion(A, chantierDurand.id, [], "Reprends la ligne d'élagage du devis de Bernard");
    assert.equal(reponse.succes, true);
    if (!reponse.succes) return;
    assert.ok(reponse.propositions && reponse.propositions.length === 1, "Une proposition attendue");
    const proposition = reponse.propositions![0];
    assert.equal(proposition.type, "copier_ligne_devis");
    assert.ok(reponse.sources.includes("RechercherLignesDevis"));
  });

  await test("La proposition ne porte NI montant NI libellé — seulement l'identifiant d'origine", async () => {
    const reponse = await poserQuestion(A, chantierDurand.id, [], "Reprends la ligne d'élagage du devis de Bernard");
    assert.equal(reponse.succes, true);
    if (!reponse.succes) return;
    const donnees = reponse.propositions![0].donnees;
    assert.deepEqual(Object.keys(donnees), ["ligneOrigineId"], "Un montant transmis est un montant modifiable en chemin");
  });

  await test("Poser la question n'écrit rien tant qu'il n'a pas validé", async () => {
    const avant = await listerLignesPrix(A, chantierDurand.id);
    await poserQuestion(A, chantierDurand.id, [], "Reprends la ligne d'élagage du devis de Bernard");
    const apres = await listerLignesPrix(A, chantierDurand.id);
    assert.equal(apres.length, avant.length);
  });

  await test("Une fois validée, la ligne arrive sur le devis ouvert, au prix d'origine", async () => {
    const [origine] = await rechercherLignesDevisEntreprise(A, { motCle: "élagage" });
    const [proposition] = await enregistrerPropositions(A, chantierDurand.id, [
      {
        type: "copier_ligne_devis",
        description: "Reprendre « Élagage d'un tilleul »",
        donnees: { ligneOrigineId: origine.ligneId },
      },
    ]);
    const { resultats } = await appliquerPropositionsAction(chantierDurand.id, [proposition.id]);
    assert.equal(resultats[0].statut, "appliquee", resultats[0].message);

    const lignes = await listerLignesPrix(A, chantierDurand.id);
    const copiee = lignes.find((l) => l.libelle === "Élagage d'un tilleul");
    assert.ok(copiee, "La ligne devrait être posée sur le chantier de Durand");
    assert.equal(copiee!.montant, "450.00", "Le montant est relu à la source, jamais recopié");
  });

  await test("Une ligne d'origine disparue rend un conflit, jamais une ligne vide", async () => {
    const [proposition] = await enregistrerPropositions(A, chantierDurand.id, [
      {
        type: "copier_ligne_devis",
        description: "Reprendre une ligne effacée",
        donnees: { ligneOrigineId: "00000000-0000-0000-0000-000000000000" },
      },
    ]);
    const { resultats } = await appliquerPropositionsAction(chantierDurand.id, [proposition.id]);
    assert.equal(resultats[0].statut, "conflit");
    assert.equal(resultats[0].categorie, "conflit_metier");
  });

  await test("Une proposition sans identifiant d'origine est refusée", async () => {
    const [proposition] = await enregistrerPropositions(A, chantierDurand.id, [
      { type: "copier_ligne_devis", description: "Reprendre rien du tout", donnees: {} },
    ]);
    const { resultats } = await appliquerPropositionsAction(chantierDurand.id, [proposition.id]);
    assert.equal(resultats[0].statut, "conflit");
    assert.equal(resultats[0].categorie, "donnee_invalide");
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échec(s)`);
  await fermerLimiteur();
  await pool.end();
  if (failed > 0) process.exit(1);
}

main();
