import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as prestationsRepo from "../src/server/repositories/prestations";
import * as tarifsRepo from "../src/server/repositories/tarifs";
import { poserQuestion } from "../src/server/ai/services/assistant-service";
import { outilsDisponibles, getOutil } from "../src/server/ai/tools/registre";
import { fournisseurLLMDev } from "../src/server/ai/providers/llm/dev";
import { _reinitialiserEnvPourTests } from "../src/server/env";
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

async function main() {
  await nettoyerBase();

  const { entreprise: entA, utilisateurId: userA } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Assistant A" },
    { email: "assistant-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Assistant B" },
    { email: "assistant-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier assistant" });
  await prestationsRepo.ajouterPrestation(A, chantier.id, "Poser la faïence");
  await prestationsRepo.ajouterPrestation(A, chantier.id, "Déposer le carrelage");
  await tarifsRepo.creerTarif(A, { intitule: "Main d'œuvre", prix: "280.00" });

  // --- Sélection d'outils (fournisseur dev) ---

  await test("Sélection d'outil : une question sur les prestations déclenche LirePrestations", async () => {
    const resultat = await fournisseurLLMDev.genererAvecOutils!(
      "systeme",
      [{ role: "user", contenu: "Quelles sont les prestations prévues ?" }],
      outilsDisponibles.map((o) => ({ nom: o.nom, description: o.description, schema: o.schema }))
    );
    assert.equal(resultat.succes, true);
    if (resultat.succes) {
      assert.equal(resultat.type, "appel_outil");
      if (resultat.type === "appel_outil") assert.equal(resultat.outil, "LirePrestations");
    }
  });

  await test("Après résultat d'outil, le fournisseur dev produit une réponse texte finale", async () => {
    const resultat = await fournisseurLLMDev.genererAvecOutils!(
      "systeme",
      [
        { role: "user", contenu: "Quelles sont les prestations prévues ?" },
        { role: "outil", outil: "LirePrestations", resultat: { prestations: ["Poser la faïence"] } },
      ],
      []
    );
    assert.equal(resultat.succes, true);
    if (resultat.succes) assert.equal(resultat.type, "texte");
  });

  // --- Appel du LLM via le service complet (conversation simple bout en bout) ---

  await test("Conversation simple : question sur les prestations -> réponse avec source", async () => {
    const reponse = await poserQuestion(A, chantier.id, [], "Peux-tu me dire quelles prestations sont prévues ?");
    assert.equal(reponse.succes, true);
    if (reponse.succes) {
      assert.ok(reponse.texte.length > 0);
      assert.ok(reponse.sources.includes("LirePrestations"));
    }
  });

  await test("Question sur les tarifs -> outil LireTarifs utilisé comme source", async () => {
    const reponse = await poserQuestion(A, chantier.id, [], "Quels sont nos tarifs actuels ?");
    assert.equal(reponse.succes, true);
    if (reponse.succes) assert.ok(reponse.sources.includes("LireTarifs"));
  });

  // --- Absence de mutation ---

  await test("Absence de mutation : poser une question ne modifie jamais les données", async () => {
    const avant = await prestationsRepo.listerPrestations(A, chantier.id);
    await poserQuestion(A, chantier.id, [], "Ajoute une prestation de peinture s'il te plaît.");
    const apres = await prestationsRepo.listerPrestations(A, chantier.id);
    assert.equal(apres.length, avant.length, "Aucune prestation ne doit avoir été créée par l'assistant");
  });

  // --- Gestion des erreurs ---

  await test("Aucun chantier dans le contexte : l'outil renvoie une erreur métier propre, pas une exception", async () => {
    const outil = getOutil("LirePrestations")!;
    const resultat = (await outil.executer({ ctx: A, chantierId: null }, {})) as { erreur?: string };
    assert.ok(resultat.erreur);
  });

  await test("Message vide : le fournisseur dev renvoie une erreur structurée, jamais une exception", async () => {
    const resultat = await fournisseurLLMDev.genererAvecOutils!("systeme", [{ role: "user", contenu: "" }], []);
    assert.equal(resultat.succes, false);
  });

  await test("Fournisseur sans genererAvecOutils : le service renvoie un message utilisateur propre", async () => {
    const original = process.env.LLM_PROVIDER;
    process.env.LLM_PROVIDER = "openai"; // stub, non implémenté pour l'usage d'outils
    _reinitialiserEnvPourTests();
    try {
      const reponse = await poserQuestion(A, chantier.id, [], "Bonjour");
      assert.equal(reponse.succes, false);
      if (!reponse.succes) {
        assert.ok(!/stack|SDK|Error:/i.test(reponse.erreur), "Aucun détail technique ne doit être exposé");
      }
    } finally {
      if (original === undefined) delete process.env.LLM_PROVIDER;
      else process.env.LLM_PROVIDER = original;
      _reinitialiserEnvPourTests();
    }
  });

  // --- Isolation ---

  await test("Isolation : le contexte de B ne peut jamais lire les prestations du chantier de A", async () => {
    const outil = getOutil("LirePrestations")!;
    const resultat = (await outil.executer({ ctx: B, chantierId: chantier.id }, {})) as { prestations: string[] };
    assert.equal(resultat.prestations.length, 0);
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
