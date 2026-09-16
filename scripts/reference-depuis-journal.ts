import { readFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { bilanDuJournal } from "./_bilan-suites.mjs";
import { ecrireReference, lireReference } from "./_reference-batterie.mjs";

/**
 * AMORCER L'ÉTAT DE RÉFÉRENCE DEPUIS LE JOURNAL D'UNE BATTERIE JOUÉE SUR `main`.
 *
 *   npx tsx scripts/reference-depuis-journal.ts <journal> --commit <sha de main>
 *
 * **Quand on s'en sert, et quand on ne s'en sert pas.** En temps normal, la
 * batterie enregistre elle-même la référence dès qu'elle mesure un arbre
 * propre sur `origin/main` (`verifier-avant-livraison.ts`). Ce script sert au
 * premier tour d'une machine — ou quand la batterie de `main` ne sait pas
 * encore nommer ses rouges (avant le 16 septembre 2026) : on la joue sur un
 * `main` propre, on garde son journal, et ce script le relit **avec le même
 * lecteur** que la batterie (`_bilan-suites.mjs`). Ce n'est pas une seconde
 * façon de compter : c'est la même, appliquée après coup.
 *
 * **Ce qu'il refuse, parce qu'une référence fausse tolérerait un vrai rouge :**
 *   · un commit qui n'est pas sur `origin/main` — un lot ne s'absout pas ;
 *   · un journal sans les deux moteurs de suites, ou dont un bilan ne tombe
 *     pas juste — un rouge sans nom ne devient jamais « connu » ;
 *   · une étape hors suites tombée (types, construction, connexion) — ce
 *     `main`-là est en panne, pas une référence.
 */

const RACINE = path.join(__dirname, "..");
const [journalChemin, drapeau, commit] = process.argv.slice(2);
if (!journalChemin || drapeau !== "--commit" || !commit) {
  console.error("usage : npx tsx scripts/reference-depuis-journal.ts <journal> --commit <sha>");
  process.exit(2);
}

function git(...args: string[]): string | null {
  try {
    return execFileSync("git", ["-C", RACINE, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

const sha = git("rev-parse", "--verify", `${commit}^{commit}`);
if (!sha) {
  console.error(`❌ « ${commit} » n'est pas un commit de ce dépôt.`);
  process.exit(1);
}
if (git("merge-base", "--is-ancestor", sha, "origin/main") === null) {
  console.error(`❌ ${sha.slice(0, 8)} n'est pas sur origin/main : une référence se mesure sur main, jamais sur un lot.`);
  process.exit(1);
}

const journal = readFileSync(journalChemin, "utf8");

/** Les étapes de la batterie, découpées à leurs en-têtes « → Nom ». */
function etapesDuJournal(texte: string): Map<string, string> {
  const etapes = new Map<string, string>();
  const entete = /^(?:\x1b\[1m)?→ ([^\x1b\n]+?)(?:\x1b\[0m)?\r?$/gm;
  const positions: { nom: string; debut: number }[] = [];
  for (const m of texte.matchAll(entete)) positions.push({ nom: m[1].trim(), debut: m.index! + m[0].length });
  positions.forEach((p, i) => {
    const fin = i + 1 < positions.length ? positions[i + 1].debut : texte.length;
    etapes.set(p.nom, texte.slice(p.debut, fin));
  });
  return etapes;
}

const etapes = etapesDuJournal(journal);
const rouges: string[] = [];
let refus = false;
for (const nom of ["Suites base de données", "Suites navigateur"]) {
  const sortie = etapes.get(nom);
  const bilan = sortie ? bilanDuJournal(sortie) : null;
  if (!bilan) {
    console.error(`❌ Le journal ne porte pas l'étape « ${nom} » jusqu'à son compte.`);
    refus = true;
  } else if (!bilan.complet) {
    console.error(`❌ « ${nom} » : le compte des rouges ne correspond pas aux suites nommées — bilan incomplet.`);
    refus = true;
  } else {
    rouges.push(...bilan.rouges);
  }
}
// Les étapes tombées sont listées par la batterie à la fin, une par « • ».
// C'est cette liste qu'on relit — pas les ❌ du milieu, qu'une suite peut
// aussi écrire pour son propre compte.
const bilanFinal = journal.slice(journal.lastIndexOf("étape(s) en échec"));
const horsSuites = [...bilanFinal.matchAll(/^\s+• (.+?)\r?$/gm)]
  .map((m) => m[1].trim())
  .filter((n) => n !== "Suites base de données" && n !== "Suites navigateur");
if (horsSuites.length > 0) {
  console.error(`❌ Étape(s) tombée(s) hors des suites : ${horsSuites.join(", ")} — ce main est en panne, pas une référence.`);
  refus = true;
}
if (refus) process.exit(1);

const reference = { quand: Date.now(), commit: sha, rouges: [...new Set(rouges)].sort(), niveau: 3 as const };
if (!ecrireReference(RACINE, reference)) {
  console.error("❌ Impossible d'écrire dans le .git commun.");
  process.exit(1);
}
const relue = lireReference(RACINE);
console.log(
  `✅ Référence de main ${sha.slice(0, 8)} enregistrée : ${relue?.rouges.length ?? 0} suite(s) rouge(s)` +
    (relue?.rouges.length ? `\n   ${relue.rouges.join("\n   ")}` : "")
);
