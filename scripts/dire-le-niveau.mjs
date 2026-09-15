#!/usr/bin/env node
/**
 * QUEL NIVEAU CE LOT EXIGE-T-IL ? — la question, sans pousser pour l'apprendre.
 *
 * **Pourquoi elle existe.** Le garde-fou ne parle qu'au moment de la fusion :
 * l'apprendre là, c'est l'apprendre après avoir joué le mauvais contrôle. Cette
 * commande rend le MÊME calcul, avant d'avoir rien lancé.
 *
 * Elle ne décide de rien et n'écrit rien : elle dit.
 *
 *     npm run niveau
 */
import { cheminsDuLot, commandeDuNiveau, evaluerLeLot } from "./_niveau-de-risque.mjs";
import { suitesDesRoutes } from "./_suites-ciblees.mjs";

const RACINE = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const chemins = cheminsDuLot(RACINE);

if (chemins.length === 0) {
  console.log("Rien ne diffère de « main » : il n'y a pas de lot à situer.");
  process.exit(0);
}

const lot = evaluerLeLot(chemins, { racine: RACINE });
const suites = lot.niveau === 2 ? suitesDesRoutes(RACINE, lot.routes) : [];

console.log(`Risque : ${lot.risque}`);
console.log(`Niveau requis : ${lot.niveau}`);
console.log(`Raison : ${lot.raison}`);
console.log(
  `Contrôles exigés : ${commandeDuNiveau(lot.niveau) ?? "aucun — relire le rendu suffit"}` +
    (suites.length ? `\n                   suites navigateur : ${suites.join(", ")}` : "")
);

if (lot.routes.length) console.log(`Écrans atteints : ${lot.routes.join(", ")}`);

console.log(`\n${chemins.length} fichier(s) dans ce lot. Ce qui a décidé du niveau :`);
for (const m of lot.motifs.filter((x) => x.niveau === lot.niveau).slice(0, 6)) {
  console.log(`  • ${m.chemin}\n      ${m.pourquoi}`);
}
