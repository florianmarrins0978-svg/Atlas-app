/* =======================================================================
   La phrase de la franchise de TVA : une seule, et celle de son jour.

   **Sa consigne du 6 novembre 2026 :** *« si t'as vérifié, change la phrase
   tout de suite »*. Vérifié le même jour (Légifrance, par la recherche ; le
   BOFiP et impots.gouv.fr, lus) : l'article L. 233-3 du CIBS, créé par
   l'ordonnance n° 2026-671 du 27 juillet 2026, est en vigueur le 1er janvier
   2027, et les renvois au CGI restent permis sur les factures jusqu'au
   31 décembre 2027 (BOFiP, BOI-RES-TVA-000253, version du 7 octobre 2026).
   La phrase change donc d'elle-même, au jour de la pièce.

   Ce contrôle tient deux choses :
     1. la bascule, aux deux jours qui la bordent ;
     2. la phrase ne s'écrit qu'à UN endroit : l'avoir la portait en dur, et
        aurait gardé l'ancienne le jour du changement (`CLAUDE.md` §3).
   ======================================================================= */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { mentionFranchise, PASSAGE_AU_CIBS } from "../src/lib/franchise-tva";

const ANCIENNE = "TVA non applicable, art. 293 B du CGI.";
const NOUVELLE = "TVA non applicable, article L. 233-3 du code des impositions sur les biens et services (CIBS).";

assert.equal(PASSAGE_AU_CIBS, "2027-01-01");
assert.equal(mentionFranchise("2026-08-03"), ANCIENNE);
assert.equal(mentionFranchise("2026-12-31"), ANCIENNE, "Le 31 décembre 2026, l'article L. 233-3 n'est pas en vigueur.");
assert.equal(mentionFranchise("2027-01-01"), NOUVELLE, "Le 1er janvier 2027, la phrase passe au CIBS.");
assert.equal(mentionFranchise("2031-06-15"), NOUVELLE);
console.log("  ✓ la phrase bascule le 1er janvier 2027, ni avant ni après");

// Une seule source pour la phrase : aucun autre fichier de src/ ne l'écrit.
const RACINE = path.join(__dirname, "..", "src");
const SOURCE = path.join("src", "lib", "franchise-tva.ts");
function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = path.join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : /\.(ts|tsx)$/.test(nom) ? [chemin] : [];
  });
}
const tous = fichiers(RACINE);
assert.ok(tous.length > 100, `Seulement ${tous.length} fichiers lus : le contrôle ne mesure rien.`);
const fautifs = tous
  .filter((f) => path.relative(path.join(__dirname, ".."), f) !== SOURCE)
  .filter((f) => /TVA non applicable/.test(readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")));
assert.deepEqual(fautifs.map((f) => path.relative(path.join(__dirname, ".."), f)), [], "La phrase de la franchise est écrite ailleurs que dans src/lib/franchise-tva.ts.");
console.log(`  ✓ la phrase ne s'écrit qu'à un endroit (${tous.length} fichiers lus)`);

console.log("\n✅ La phrase de la franchise est une seule, et celle de son jour.");
