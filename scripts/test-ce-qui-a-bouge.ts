import assert from "node:assert/strict";
import { aRejouer, batterieDue, ceQuiABouge, horsSuitesApres, partagerLaRencontre } from "./_ce-qui-a-bouge.mjs";

/**
 * **SA BOUCLE DU 17 SEPTEMBRE 2026, À 23 H.**
 *
 * *« Ça recommence et c'est ça à chaque fois ! »* — une batterie à 158 suites
 * sur 159, deux rouges : une ligne de documentation à corriger en trois
 * secondes, et un rouge venu de `main`. La session corrige la documentation, et
 * repart pour cinquante minutes.
 *
 * Cette suite fixe la règle qui l'en empêche : **on rejoue ce qui était rouge,
 * plus ce que la correction peut casser.** Jamais tout.
 */

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== Ce qui a bougé depuis le verdict ===");

cas("un .md ne se lit que dans git — l'empreinte ne l'indexe pas", () => {
  // C'est EXACTEMENT son cas : le rouge était « Mémoire du dépôt », et la
  // correction touchait un document. Sans cette lecture, la correction serait
  // invisible et le rouge resterait pour toujours.
  assert.deepEqual(ceQuiABouge([], ["HANDOVER.md", "docs/A-FAIRE.md"]), ["HANDOVER.md", "docs/A-FAIRE.md"]);
});

cas("ce que l'empreinte indexe ne se relit PAS dans git", () => {
  // Une fusion réécrit les fichiers qu'elle apporte : les reprendre depuis git
  // ferait passer pour « bougé » un contenu identique — le défaut retiré du
  // garde-fou le matin même (ARCHITECTURE.md §380).
  assert.deepEqual(ceQuiABouge([], ["src/lib/prix.ts", "scripts/test-x.ts", "drizzle/0001.sql"]), []);
  assert.deepEqual(ceQuiABouge(["src/lib/prix.ts"], ["src/lib/prix.ts"]), ["src/lib/prix.ts"]);
});

console.log("\n=== Ce qu'on rejoue, et rien de plus ===");

cas("SON CAS : un rouge de documentation corrigé ne rejoue ni les suites, ni le navigateur", () => {
  const { etapes, navigateur } = aRejouer({
    bouge: ["HANDOVER.md"],
    rougesAvant: [],
    horsSuitesAvant: ["Mémoire du dépôt"],
    suitesDesEcrans: [],
  });
  assert.deepEqual(etapes, ["Types", "Lint", "Mémoire du dépôt"]);
  assert.deepEqual(navigateur, [], "une correction de documentation a réclamé des suites navigateur");
  assert.ok(!etapes.includes("Suites base de données"), "CINQUANTE MINUTES pour une ligne de doc : c'est la boucle du 17 septembre");
  assert.ok(!etapes.includes("Construction"));
});

cas("une étape hors suites rouge se rejoue, quelle qu'elle soit", () => {
  for (const nom of ["Construction", "Fournisseurs d'IA", "Connexion derrière un proxy"]) {
    assert.ok(aRejouer({ bouge: [], horsSuitesAvant: [nom] }).etapes.includes(nom), nom);
  }
});

cas("un bilan incomplet désigne quand même son étape", () => {
  const { etapes } = aRejouer({ bouge: [], horsSuitesAvant: ["Suites navigateur (bilan incomplet)"] });
  assert.ok(etapes.includes("Suites navigateur"), "l'étape à rejouer n'a pas été reconnue sous son bilan incomplet");
});

cas("une correction dans src/lib rejoue les suites base ET les écrans atteints", () => {
  const { etapes, navigateur } = aRejouer({
    bouge: ["src/lib/prix.ts"],
    suitesDesEcrans: ["test-facture-e2e.ts"],
  });
  assert.ok(etapes.includes("Suites base de données"));
  assert.ok(etapes.includes("Données de démonstration"), "npm test vide la base : sans réamorçage, le navigateur accuse le produit");
  assert.ok(etapes.indexOf("Données de démonstration") < etapes.indexOf("Suites navigateur"));
  assert.deepEqual(navigateur, ["test-facture-e2e.ts"]);
});

cas("une suite base rouge fait rejouer les suites base, même sans rien qui bouge", () => {
  assert.ok(aRejouer({ bouge: [], rougesAvant: ["test-isolation.ts"] }).etapes.includes("Suites base de données"));
});

cas("une suite navigateur rouge se rejoue, elle et pas les autres", () => {
  const { etapes, navigateur } = aRejouer({ bouge: [], rougesAvant: ["test-planning-e2e.ts"] });
  assert.deepEqual(navigateur, ["test-planning-e2e.ts"]);
  assert.ok(!etapes.includes("Suites base de données"), "un rouge navigateur a fait rejouer les suites base");
});

console.log("\n=== Un rouge qu'on ne remesure pas reste rouge ===");

cas("une étape rejouée VERTE sort de la liste", () => {
  assert.deepEqual(
    horsSuitesApres({ horsSuitesAvant: ["Mémoire du dépôt"], etapesRejouees: ["Types", "Lint", "Mémoire du dépôt"], tombees: [] }),
    []
  );
});

cas("une étape NON rejouée garde son rouge — jamais absoute", () => {
  assert.deepEqual(
    horsSuitesApres({ horsSuitesAvant: ["Construction"], etapesRejouees: ["Types", "Lint"], tombees: [] }),
    ["Construction"]
  );
});

cas("une étape rejouée et tombée reste rouge, sans doublon", () => {
  assert.deepEqual(
    horsSuitesApres({ horsSuitesAvant: ["Mémoire du dépôt"], etapesRejouees: ["Mémoire du dépôt"], tombees: ["Mémoire du dépôt"] }),
    ["Mémoire du dépôt"]
  );
});


// ─── SA CAPTURE DU 18 SEPTEMBRE 2026, À 00 h 27 ────────────────────────────
//
// *« Ça continue »* — une session : « main a apporté 30 commits, dont du code
// qui touche l'argent. La rencontre atteint le niveau 3 → batterie entière. »
// C'était une erreur de catégorie : la gravité de `main` a déjà été éprouvée
// par `main`. Ce qui n'a jamais été mesuré, c'est la rencontre.

cas("SON CAS : l'argent apporté par main ne réclame PAS la batterie entière", () => {
  const { duLot, venuDeMain } = partagerLaRencontre({
    fichiers: ["src/server/repositories/devis-repo.ts", "src/app/planning/PlanningClient.tsx"],
    fichiersDuLot: ["src/app/planning/PlanningClient.tsx"],
  });
  assert.deepEqual(duLot, ["src/app/planning/PlanningClient.tsx"]);
  assert.deepEqual(venuDeMain, ["src/server/repositories/devis-repo.ts"]);
  assert.equal(
    batterieDue({ niveauDuLot: 2, plancherVenuDeMain: [] }),
    null,
    "CINQUANTE MINUTES parce qu'une session voisine a touché aux devis : c'est la boucle du 18 septembre"
  );
});

cas("une MIGRATION apportée par main fait repartir la batterie — le sol a bougé", () => {
  const raison = batterieDue({ niveauDuLot: 2, plancherVenuDeMain: ["drizzle/0099_x.sql"] });
  assert.ok(raison, "une migration arrivée sous le lot a été rattrapée au lieu d'être remesurée");
  assert.match(raison!, /drizzle/);
});

cas("le lot, LUI, garde toute sa gravité : niveau 3 = batterie", () => {
  assert.ok(batterieDue({ niveauDuLot: 3, plancherVenuDeMain: [] }));
});

cas("la gravité venue de main force les suites du fond, pas la batterie", () => {
  const { etapes } = aRejouer({ bouge: ["src/app/devis/page.tsx"], graviteVenueDeMain: true });
  assert.ok(etapes.includes("Suites base de données"), "les règles d'argent et l'isolation vivent là");
  assert.ok(!etapes.includes("Construction"));
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Ce qui a bougé depuis le verdict — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
