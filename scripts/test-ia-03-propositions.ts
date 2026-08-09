import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as prestationsRepo from "../src/server/repositories/prestations";
import * as materielRepo from "../src/server/repositories/materiel";
import { poserQuestion } from "../src/server/ai/services/assistant-service";
import { appliquerPropositionsAction } from "../src/app/chantiers/[id]/informations/actions";
import { enregistrerPropositions } from "../src/server/repositories/propositions-ia";
import type { ActionProposee } from "../src/server/ai/propositions";
import type { Ctx } from "../src/server/repositories/context";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

// Remédiation bugs 2/3 : la confirmation ne prend plus des objets de
// proposition en clair, mais des identifiants de propositions déjà
// enregistrées côté serveur. Ce helper reproduit exactement le flux réel
// (génération -> enregistrement -> confirmation par id).
async function appliquerViaPropositions(ctx: Ctx, chantierId: string, propositions: ActionProposee[]) {
  const enregistrees = await enregistrerPropositions(ctx, chantierId, propositions);
  return appliquerPropositionsAction(chantierId, enregistrees.map((r) => r.id));
}

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
    { nom: "Entreprise Propositions A" },
    { email: "propositions-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  process.env.AUTH_TEST_UTILISATEUR_ID = userA;
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Propositions B" },
    { email: "propositions-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier propositions" });
  const prestationExistante = await prestationsRepo.ajouterPrestation(A, chantier.id, "Poser la faïence");

  // --- Création de propositions (demande d'ajout direct) ---

  await test("Demande d'ajout : le LLM prépare une proposition, aucune écriture immédiate", async () => {
    const avant = await prestationsRepo.listerPrestations(A, chantier.id);
    const reponse = await poserQuestion(A, chantier.id, [], "Ajoute la prestation Élagage chêne");
    assert.equal(reponse.succes, true);
    if (reponse.succes) {
      assert.ok(reponse.propositions && reponse.propositions.length === 1);
      assert.equal(reponse.propositions![0].type, "ajouter_prestation");
    }
    const apres = await prestationsRepo.listerPrestations(A, chantier.id);
    assert.equal(apres.length, avant.length, "Aucune écriture avant confirmation");
  });

  await test("Demande de suppression : consulte d'abord la liste, propose la bonne cible par id", async () => {
    const reponse = await poserQuestion(A, chantier.id, [], "Supprime la prestation Poser la faïence");
    assert.equal(reponse.succes, true);
    if (reponse.succes) {
      assert.ok(reponse.propositions && reponse.propositions.length === 1);
      assert.equal(reponse.propositions![0].type, "supprimer_prestation");
      assert.equal(reponse.propositions![0].donnees.id, prestationExistante.id);
    }
  });

  await test("Demande de modification de durée : proposition sans écriture immédiate", async () => {
    const avant = await chantiersRepo.getChantier(A, chantier.id);
    const reponse = await poserQuestion(A, chantier.id, [], "Modifie la durée à 3 jours");
    assert.equal(reponse.succes, true);
    if (reponse.succes) {
      assert.equal(reponse.propositions?.[0]?.type, "modifier_duree");
    }
    const apres = await chantiersRepo.getChantier(A, chantier.id);
    assert.equal(apres?.dureePrevue, avant?.dureePrevue, "Aucune écriture avant confirmation");
  });

  // --- Application après confirmation (via les Server Actions existantes) ---

  await test("Application d'une proposition confirmée : ajoute réellement la prestation", async () => {
    const proposition: ActionProposee = {
      type: "ajouter_prestation",
      description: "Ajouter prestation : Élagage chêne",
      donnees: { libelle: "Élagage chêne" },
    };
    const { resultats } = await appliquerViaPropositions(A, chantier.id, [proposition]);
    assert.equal(resultats.length, 1);
    assert.equal(resultats[0].statut, "appliquee");
    const liste = await prestationsRepo.listerPrestations(A, chantier.id);
    assert.ok(liste.some((p) => p.libelle === "Élagage chêne"));
  });

  // --- Filtrage des éléments décochés / application partielle ---

  await test("Application partielle : seules les propositions retenues sont exécutées", async () => {
    const avant = await materielRepo.listerMateriel(A, chantier.id);
    const propositions: ActionProposee[] = [
      { type: "ajouter_materiel", description: "Ajouter matériel : Nacelle", donnees: { libelle: "Nacelle" } },
    ];
    // Simule le filtrage côté client : une seconde proposition décochée n'est
    // jamais transmise à l'action — elle ne doit donc jamais être exécutée.
    const { resultats } = await appliquerViaPropositions(A, chantier.id, propositions);
    assert.equal(resultats.length, 1);
    const apres = await materielRepo.listerMateriel(A, chantier.id);
    assert.equal(apres.length, avant.length + 1);
    assert.ok(apres.some((m) => m.libelle === "Nacelle"));
    assert.ok(!apres.some((m) => m.libelle === "Brouette"), "Un élément non transmis ne doit jamais apparaître");
  });

  // --- Conflit : élément supprimé entre-temps ---

  await test("Conflit : une proposition ciblant un élément déjà supprimé échoue proprement, sans bloquer les autres", async () => {
    const cible = await prestationsRepo.ajouterPrestation(A, chantier.id, "Prestation temporaire");
    await prestationsRepo.supprimerPrestation(A, cible.id); // supprimée entre-temps

    const propositions: ActionProposee[] = [
      { type: "supprimer_prestation", description: `Supprimer prestation : ${cible.libelle}`, donnees: { id: cible.id } },
      { type: "ajouter_prestation", description: "Ajouter prestation : Peinture", donnees: { libelle: "Peinture" } },
    ];
    const { resultats } = await appliquerViaPropositions(A, chantier.id, propositions);
    assert.equal(resultats.length, 2);
    assert.equal(resultats[0].statut, "conflit");
    assert.equal(resultats[1].statut, "appliquee", "La seconde proposition doit s'appliquer malgré le conflit sur la première");

    const liste = await prestationsRepo.listerPrestations(A, chantier.id);
    assert.ok(liste.some((p) => p.libelle === "Peinture"));
  });

  await test("Conflit : modification d'un matériel déjà supprimé", async () => {
    const cible = await materielRepo.ajouterMateriel(A, chantier.id, "Perceuse");
    await materielRepo.supprimerMateriel(A, cible.id);
    const { resultats } = await appliquerViaPropositions(A, chantier.id, [
      { type: "modifier_materiel", description: "Modifier matériel", donnees: { id: cible.id, libelle: "Perceuse Bosch" } },
    ]);
    assert.equal(resultats[0].statut, "conflit");
  });

  // --- Isolation ---

  await test("Isolation : B ne peut cibler aucune prestation du chantier de A (lecture RLS vide)", async () => {
    const reponse = await poserQuestion(B, chantier.id, [], "Supprime la prestation Poser la faïence");
    assert.equal(reponse.succes, true);
    if (reponse.succes) {
      // RLS renvoie une liste vide à B : aucune correspondance ne peut être
      // trouvée, donc aucune proposition de suppression ciblée n'est produite.
      const propositionSuppression = reponse.propositions?.find((p) => p.type === "supprimer_prestation");
      assert.equal(propositionSuppression, undefined);
    }
    const listeA = await prestationsRepo.listerPrestations(A, chantier.id);
    assert.ok(listeA.some((p) => p.libelle === "Poser la faïence"), "La prestation de A doit rester intacte");
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  // **Sans ceci, cette suite ne rendait jamais la main.** Elle traverse une
  // action limitée en débit ; avec `REDIS_URL` posé — ce que `CLAUDE.md` §5
  // demande —, la connexion ioredis restait ouverte et le processus vivait
  // pour toujours, après avoir affiché « 8 test(s) réussi(s) ». `npm test`
  // s'arrêtait là, sans un mot, et tout ce qui suit dans l'alphabet n'était
  // jamais joué.
  await fermerLimiteur();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
