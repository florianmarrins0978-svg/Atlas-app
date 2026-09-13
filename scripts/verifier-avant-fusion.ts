import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { FICHIER_VERDICT } from "./_niveau-de-risque.mjs";
import { verdictAEcrire } from "./_empreinte-de-l-arbre.mjs";

/**
 * NIVEAU 2 — ce qu'on joue avant de fusionner un lot d'OUTILLAGE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Sa règle du 13 septembre 2026 : *« ne pas lancer inutilement toute la
 * batterie lourde après une petite modification »*, et pourtant *« avant
 * fusion, vérifier les parcours critiques concernés »*. Entre les deux, il
 * manquait une marche : soit dix minutes, soit rien.
 *
 * Celle-ci prend les contrôles qui parlent de l'état du dépôt lui-même — les
 * types, le style, la cohérence de la mémoire — et les suites qui n'ont pas
 * besoin d'un navigateur. Elle ne remplace JAMAIS la batterie complète dès que
 * `src/` ou `drizzle/` bouge : `scripts/garde-fusion-main.mjs` calcule le
 * niveau sur le diff, et refuse celle-ci quand il faut l'autre.
 *
 * Au vert, elle dépose le témoin que le garde-fou relit.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const RACINE = path.join(__dirname, "..");

const ETAPES: { titre: string; quoi: string; commande: string[] }[] = [
  { titre: "Types", quoi: "un appel qui ne correspond plus à sa signature", commande: ["npm", "run", "typecheck"] },
  { titre: "Lint", quoi: "les pièges connus de React et de Next", commande: ["npm", "run", "lint"] },
  { titre: "Mémoire du dépôt", quoi: "une documentation qui décrit une version disparue", commande: ["npm", "run", "verifier:memoire"] },
  { titre: "Suites du dépôt", quoi: "les règles métier, l'isolation, et les garde-fous", commande: ["npm", "test"] },
];

const echecs: string[] = [];

for (const etape of ETAPES) {
  console.log(`\n\x1b[1m→ ${etape.titre}\x1b[0m`);
  const [programme, ...args] = etape.commande;
  const issue = spawnSync(programme, args, { cwd: RACINE, stdio: "inherit", env: process.env });
  if (issue.status === 0) {
    console.log(`   ✅ ${etape.titre}`);
  } else {
    echecs.push(etape.titre);
    console.log(`   ❌ ${etape.titre}`);
  }
}

console.log("\n─────────────────────────────────────────────────────────────");

if (echecs.length > 0) {
  // **Aucun témoin n'est déposé.** Le garde-fou refusera donc la fusion, et
  // c'est exactement ce qu'on veut : un rouge ne se contourne pas en oubliant.
  console.log(`❌ ${echecs.length} étape(s) en échec :\n`);
  for (const titre of echecs) {
    const etape = ETAPES.find((e) => e.titre === titre);
    console.log(`   • ${titre}\n     ce qu'elle attrape : ${etape?.quoi}`);
  }
  console.log("\n   Rien ne part sur « main » tant que ce n'est pas vert.");
  process.exit(1);
}

writeFileSync(FICHIER_VERDICT, JSON.stringify(verdictAEcrire(RACINE, 2), null, 2));
console.log("✅ Niveau 2 au vert — la fusion d'un lot d'outillage est ouverte.");
console.log("   (Un lot qui touche src/ ou drizzle/ exige la batterie complète.)");
