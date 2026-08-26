import assert from "node:assert";
import { db, pool } from "../src/server/db/client";
import { users } from "../src/server/db/schema";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as prestationsRepo from "../src/server/repositories/prestations";
import { poserQuestion } from "../src/server/ai/services/assistant-service";
import { poserQuestionAction } from "../src/app/assistant/actions";
import { appliquerPropositionsAction } from "../src/app/chantiers/[id]/informations/actions";
import { enregistrerPropositions } from "../src/server/repositories/propositions-ia";
import { getRole } from "../src/server/autorisation";
import { peutUtiliserLAssistant, type Role } from "../src/lib/acces-roles";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

/**
 * L'assistant explique l'application — et ne sert que le patron.
 *
 * **Deux demandes du 25 août 2026, éprouvées ensemble parce qu'elles se
 * tiennent :** *« qu'il puisse expliquer chaque fonctionnalité de l'appli »* et
 * *« qu'il se comporte comme un vrai assistant au service de l'utilisateur
 * principal seulement le principal »*.
 *
 * **Le piège que la première a failli créer**, et qu'un test garde fermé :
 * « comment je fais pour supprimer un client ? » tombait dans la branche des
 * suppressions — l'assistant allait lire les prestations du chantier et
 * proposait d'en retirer une. Il demandait un geste, on lui modifiait ses
 * données.
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

// `membres_entreprise` applique FORCE ROW LEVEL SECURITY : l'insertion directe
// doit poser `app.entreprise_id`, comme le fait `withEntreprise`.
//
// **« membre » n'existe plus** (migration 0065) : les trois rôles sont
// `proprietaire`, `commercial` et `salarie`.
async function ajouterMembre(entrepriseId: string, utilisateurId: string, role: Role) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entrepriseId]);
    await client.query(`INSERT INTO membres_entreprise (entreprise_id, utilisateur_id, role) VALUES ($1, $2, $3)`, [
      entrepriseId,
      utilisateurId,
      role,
    ]);
    await client.query("COMMIT");
  } finally {
    client.release();
  }
}

async function main() {
  await nettoyerBase();

  const { entreprise, utilisateurId: patron } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Mode d'emploi" },
    { email: "mode-emploi@test.local", nom: "Patron" }
  );
  const P = { entrepriseId: entreprise.id, utilisateurId: patron };
  process.env.AUTH_TEST_UTILISATEUR_ID = patron;

  const chantier = await chantiersRepo.creerChantier(P, { nom: "Chantier mode d'emploi" });
  await prestationsRepo.ajouterPrestation(P, chantier.id, "Poser la faïence");

  // --- Expliquer l'application -------------------------------------------

  await test("Sa question du 25 août reçoit LE GESTE, mot pour mot", async () => {
    const reponse = await poserQuestion(
      P,
      chantier.id,
      [],
      "comment je fais pour supprimer un client en attente de rédaction de son devis sur la page chantier"
    );
    assert.equal(reponse.succes, true);
    if (!reponse.succes) return;
    assert.match(reponse.texte, /Glissez la ligne de droite à gauche/);
    assert.match(reponse.texte, /Retirer/);
    assert.ok(reponse.sources.includes("RechercherModeEmploi"), "La source doit être le mode d'emploi");
  });

  await test("Une question de geste ne touche JAMAIS aux données du chantier", async () => {
    const avant = await prestationsRepo.listerPrestations(P, chantier.id);
    const reponse = await poserQuestion(P, chantier.id, [], "comment je supprime une prestation ?");
    const apres = await prestationsRepo.listerPrestations(P, chantier.id);
    assert.equal(apres.length, avant.length, "Il demandait un geste : rien ne doit avoir bougé");
    assert.equal(reponse.succes, true);
    if (!reponse.succes) return;
    assert.ok(
      reponse.propositions === undefined || reponse.propositions.length === 0,
      "Une question de mode d'emploi ne propose aucune modification"
    );
  });

  await test("UN SEUL geste à l'écran, même quand plusieurs fiches correspondent", async () => {
    // **Trouvé à l'image, jamais par un test vert** (`CLAUDE.md` §5). La
    // première version enchaînait les trois fiches trouvées : le retrait, la
    // création d'un chantier, la saisie du client — trois gestes pour une
    // question, sur un téléphone. Sa règle du 25 août : « le moins de mots
    // possible sinon on se perd dans toutes ces lignes ».
    const reponse = await poserQuestion(
      P,
      chantier.id,
      [],
      "comment je fais pour supprimer un client en attente de rédaction de son devis sur la page chantier"
    );
    assert.equal(reponse.succes, true);
    if (!reponse.succes) return;
    const titres = reponse.texte.match(/\*\*[^*]+\*\*/g) ?? [];
    assert.equal(titres.length, 1, `${titres.length} gestes dans la réponse : ${titres.join(" / ")}`);
  });

  await test("Un geste inconnu se DIT, il ne s'invente pas", async () => {
    const reponse = await poserQuestion(P, chantier.id, [], "comment je fais pour envoyer une fusée sur la lune ?");
    assert.equal(reponse.succes, true);
    if (!reponse.succes) return;
    assert.match(reponse.texte, /ne connais pas ce geste/i);
    // Le piège serait de rendre un geste plausible : on vérifie qu'aucun nom de
    // bouton d'Atlas n'a été servi au hasard.
    assert.ok(!/Retirer|Appuyez sur/.test(reponse.texte), "Aucun geste ne doit être improvisé");
  });

  await test("Plusieurs écrans savent se raconter", async () => {
    const attendus: [string, RegExp][] = [
      ["comment envoyer le devis au client", /Envoyer le devis/],
      ["comment changer mon mot de passe", /Changer de mot de passe/],
      ["comment je déplace un chantier sur le planning", /Déplacer/],
      ["où je vois ma tva", /Ma TVA/],
    ];
    for (const [question, motif] of attendus) {
      const reponse = await poserQuestion(P, chantier.id, [], question);
      assert.equal(reponse.succes, true, question);
      if (reponse.succes) assert.match(reponse.texte, motif, question);
    }
  });

  await test("Sans chantier ouvert, une question de mode d'emploi répond quand même", async () => {
    // Le mode d'emploi ne lit aucune donnée : le refuser hors chantier
    // priverait de réponse celui qui est justement perdu sur un autre écran.
    const reponse = await poserQuestion(P, null, [], "comment je crée un chantier ?");
    assert.equal(reponse.succes, true);
    if (reponse.succes) assert.match(reponse.texte, /Créer un devis/);
  });

  // --- Au service du patron, et de lui seul -------------------------------

  const [salarie] = await db.insert(users).values({ email: "salarie@test.local", nom: "Salarié" }).returning();
  await ajouterMembre(entreprise.id, salarie.id, "salarie");
  const [commercial] = await db.insert(users).values({ email: "commercial@test.local", nom: "Commercial" }).returning();
  await ajouterMembre(entreprise.id, commercial.id, "commercial");

  await test("La règle d'accès à l'assistant vit à UN seul endroit", async () => {
    // **Ouvert au commercial le 26 août 2026, sur sa réponse.** Il voit déjà les
    // prix écran par écran ; la conversation ne lui apprend rien de plus. Le
    // salarié, lui, reste dehors : sa feuille de chantier part sans prix, et
    // l'assistant les rendrait en une phrase.
    assert.equal(peutUtiliserLAssistant("proprietaire"), true);
    assert.equal(peutUtiliserLAssistant("commercial"), true);
    assert.equal(peutUtiliserLAssistant("salarie"), false);
    assert.equal(await getRole({ entrepriseId: entreprise.id, utilisateurId: salarie.id }), "salarie");
    assert.equal(await getRole({ entrepriseId: entreprise.id, utilisateurId: commercial.id }), "commercial");
    assert.equal(await getRole(P), "proprietaire");
  });

  await test("Le salarié ne peut pas poser de question — le commercial, si", async () => {
    process.env.AUTH_TEST_UTILISATEUR_ID = salarie.id;
    const refus = await poserQuestionAction(chantier.id, [], "Quels sont les tarifs de l'entreprise ?");
    assert.equal(refus.succes, false, "un salarié ne doit pas obtenir de réponse");
    if (!refus.succes) assert.match(refus.erreur, /pas disponible pour votre compte/i);

    process.env.AUTH_TEST_UTILISATEUR_ID = commercial.id;
    const passe = await poserQuestionAction(chantier.id, [], "comment je crée un chantier ?");
    assert.equal(passe.succes, true, "un commercial doit passer depuis le 26 août");

    process.env.AUTH_TEST_UTILISATEUR_ID = patron;
  });

  await test("Un salarié ne peut pas appliquer une proposition préparée pour le patron", async () => {
    // La barrière ne peut pas être seulement sur la question : sans elle ici,
    // il suffirait de rejouer l'action avec des identifiants de propositions.
    const [proposition] = await enregistrerPropositions(P, chantier.id, [
      { type: "ajouter_prestation", description: "Ajouter prestation : Taille de haie", donnees: { libelle: "Taille de haie" } },
    ]);
    process.env.AUTH_TEST_UTILISATEUR_ID = salarie.id;
    const { resultats } = await appliquerPropositionsAction(chantier.id, [proposition.id]);
    assert.equal(resultats[0].statut, "conflit");
    assert.equal(resultats[0].categorie, "acces_refuse");
    process.env.AUTH_TEST_UTILISATEUR_ID = patron;

    const prestations = await prestationsRepo.listerPrestations(P, chantier.id);
    assert.ok(!prestations.some((p) => p.libelle === "Taille de haie"), "Rien ne doit avoir été écrit");
  });

  await test("Le patron, lui, passe", async () => {
    const reponse = await poserQuestionAction(chantier.id, [], "comment je crée un chantier ?");
    assert.equal(reponse.succes, true);
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échec(s)`);
  await fermerLimiteur();
  await pool.end();
  if (failed > 0) process.exit(1);
}

main();
