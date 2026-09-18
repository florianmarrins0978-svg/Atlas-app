import assert from "node:assert/strict";
import { rencontreReelle, rougesApresComplement, suitesDuComplement } from "./_apres-fusion.mjs";

/**
 * LE COMPLÉMENT NE TIENT QUE POUR LE MÊME LOT, ET NE REJOUE QUE LA RENCONTRE.
 *
 * Sa règle du 17 septembre 2026 : « rejoue juste ce qui a bougé ». Chaque cas
 * ci-dessous est une façon de laisser passer autre chose que ça.
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

console.log("\n=== Ce qu'on rejoue ===");

cas("les écrans de la RENCONTRE, et les suites qu'elle apporte — sans doublon, triés", () => {
  const suites = suitesDuComplement({
    suitesDeLaRencontre: ["test-fiche-client-e2e.ts", "test-accueil-e2e.ts", "test-fiche-client-e2e.ts"],
    fichiersDeLaRencontre: [
      "src/app/EcranChantiers.tsx",
      "scripts/test-micro-fiche-client-degage-e2e.ts",
      "scripts/test-une-suite-base.ts",
      "scripts\\test-accueil-en-cours-colle-e2e.ts",
    ],
  });
  assert.deepEqual(suites, [
    "test-accueil-e2e.ts",
    "test-accueil-en-cours-colle-e2e.ts",
    "test-fiche-client-e2e.ts",
    "test-micro-fiche-client-degage-e2e.ts",
  ]);
});

cas("aucune rencontre : rien à rejouer côté navigateur", () => {
  assert.deepEqual(suitesDuComplement({ suitesDeLaRencontre: [], fichiersDeLaRencontre: [] }), []);
});

// ═══════════════════════════════════════════════════════════════════════════
// LA RENCONTRE — sa règle du 17 septembre 2026 : « le fait que main change
// parce qu'une autre session a fusionné ne doit jamais, à lui seul, provoquer
// une nouvelle batterie complète ».
// ═══════════════════════════════════════════════════════════════════════════

/** Un graphe d'essai : A emploie B, C ne connaît personne. */
const GRAPHE = {
  entourage: (fichiers: string[]) => {
    const liens: Record<string, string[]> = {
      "src/app/fiche-client/Ecran.tsx": ["src/app/fiche-client/Ecran.tsx", "src/lib/civilite.ts"],
      "src/lib/civilite.ts": ["src/lib/civilite.ts", "src/app/fiche-client/Ecran.tsx"],
      "src/app/paysage/Arrosage.tsx": ["src/app/paysage/Arrosage.tsx", "src/lib/arrosage-calcul.ts"],
    };
    const tout = new Set<string>();
    for (const f of fichiers) for (const x of liens[f] ?? []) tout.add(x);
    return tout;
  },
};

cas("main a touché une zone SANS RAPPORT : aucune rencontre, donc rien à rejouer", () => {
  const r = rencontreReelle({
    fichiersDuLot: ["src/app/fiche-client/Ecran.tsx"],
    fichiersDuDelta: ["src/app/paysage/Arrosage.tsx", "src/lib/arrosage-calcul.ts"],
    graphe: GRAPHE,
  });
  assert.equal(r.sansRapport, true, `rencontre inventée : ${r.fichiers.join(", ")}`);
});

cas("main a touché une DÉPENDANCE que le lot emploie : la rencontre la nomme", () => {
  const r = rencontreReelle({
    fichiersDuLot: ["src/app/fiche-client/Ecran.tsx"],
    fichiersDuDelta: ["src/lib/civilite.ts", "src/app/paysage/Arrosage.tsx"],
    graphe: GRAPHE,
  });
  assert.equal(r.sansRapport, false);
  assert.deepEqual(r.fichiers, ["src/lib/civilite.ts"], "la zone sans rapport est entrée dans la rencontre");
});

cas("main a touché un APPELANT du lot : c'est aussi une rencontre", () => {
  const r = rencontreReelle({
    fichiersDuLot: ["src/lib/civilite.ts"],
    fichiersDuDelta: ["src/app/fiche-client/Ecran.tsx"],
    graphe: GRAPHE,
  });
  assert.equal(r.sansRapport, false);
});

cas("ce que le graphe ne lit pas — migration, outillage — entre toujours dans la rencontre", () => {
  const r = rencontreReelle({
    fichiersDuLot: ["src/app/fiche-client/Ecran.tsx"],
    fichiersDuDelta: ["drizzle/0099_une_migration.sql"],
    graphe: GRAPHE,
  });
  assert.equal(r.sansRapport, false, "une migration arrivée de main a été déclarée sans rapport");
});

cas("des documents seuls ne rencontrent rien : ils ne s'exécutent pas", () => {
  const r = rencontreReelle({
    fichiersDuLot: ["src/app/fiche-client/Ecran.tsx"],
    fichiersDuDelta: ["CHANGELOG.md", "docs/A-FAIRE.md", "appli/une-planche.html"],
    graphe: GRAPHE,
  });
  assert.equal(r.sansRapport, true, `rencontre inventée : ${r.fichiers.join(", ")}`);
});

cas("SON EXEMPLE — A tient sa fiche client, B fusionne autre chose : A ne recommence rien", () => {
  const sansRapport = rencontreReelle({
    fichiersDuLot: ["src/app/fiche-client/Ecran.tsx"],
    fichiersDuDelta: ["src/app/paysage/Arrosage.tsx"],
    graphe: GRAPHE,
  });
  assert.equal(sansRapport.sansRapport, true);

  // « Si B a modifié une fonction directement utilisée par A : A rejoue
  //   seulement les tests client concernés. »
  const touche = rencontreReelle({
    fichiersDuLot: ["src/app/fiche-client/Ecran.tsx"],
    fichiersDuDelta: ["src/lib/civilite.ts"],
    graphe: GRAPHE,
  });
  assert.deepEqual(touche.fichiers, ["src/lib/civilite.ts"]);
});

console.log("\n=== Ce que le verdict complété retient ===");

cas("une suite rejouée verte sort des rouges ; une suite non rejouée garde son rouge", () => {
  const rouges = rougesApresComplement({
    rougesAvant: ["test-outil.ts", "test-ecran-x-e2e.ts", "test-ecran-y-e2e.ts"],
    suitesRejouees: ["test-outil.ts", "test-ecran-x-e2e.ts"],
    rougesMesures: ["test-outil.ts"],
  });
  // outil : rejouée, encore rouge → reste ; x : rejouée, verte → sort ; y : pas rejouée → reste.
  assert.deepEqual(rouges, ["test-ecran-y-e2e.ts", "test-outil.ts"]);
});

cas("un rouge mesuré maintenant entre, même s'il n'était pas rouge avant", () => {
  const rouges = rougesApresComplement({ rougesAvant: [], suitesRejouees: ["test-neuf-e2e.ts"], rougesMesures: ["test-neuf-e2e.ts"] });
  assert.deepEqual(rouges, ["test-neuf-e2e.ts"]);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Le complément après fusion — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
