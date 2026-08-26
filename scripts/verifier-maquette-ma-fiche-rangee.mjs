// RANGER LA LISTE DANS PAYSAGE — la planche des deux emplacements.
//
// Sa proposition du 26 août 2026 : sortir « Fiche d'entretien » des Réglages et
// la poser sous la fiche de chantier. Deux façons, et il tranche.
//
// **Ce que ce contrôle défend.** Les vingt prestations doivent être celles du
// code (`CLAUDE.md` §4 bis) ; la page doit tenir sans JavaScript, parce qu'il
// l'ouvre sur son téléphone ; et **chaque proposition doit porter son défaut** —
// une planche qui ne dit que ses avantages ne se choisit pas, elle se subit.
//
//     node scripts/verifier-maquette-ma-fiche-rangee.mjs
import { readFileSync } from "node:fs";

const CHEMIN = "appli/ma-fiche-rangee.html";
const page = readFileSync(CHEMIN, "utf8");
const echecs = [];
const dire = (bon, quoi) => {
  console.log(`${bon ? "  ✓" : "  ✗"} ${quoi}`);
  if (!bon) echecs.push(quoi);
};

console.log("=== Ranger la liste dans Paysage ===\n");

const source = readFileSync("src/lib/prestations-entretien.ts", "utf8");
const modele = [...source.matchAll(/\{ famille: "([^"]+)", libelle: "([^"]+)" \}/g)].map((m) => ({
  famille: m[1],
  libelle: m[2],
}));
const surLaPage = [...page.matchAll(/<span class="mot">([^<]+)<\/span>/g)].map((m) => m[1]);

const manquantes = modele.filter((p) => !surLaPage.includes(p.libelle));
dire(
  manquantes.length === 0,
  manquantes.length === 0
    ? `les ${modele.length} prestations du code sont sur la planche`
    : `absentes : ${manquantes.map((p) => p.libelle).join(", ")}`
);
const inventees = surLaPage.filter((l) => !modele.some((p) => p.libelle === l));
dire(inventees.length === 0, inventees.length === 0 ? "aucune prestation inventée" : `inventées : ${inventees.join(", ")}`);

dire(!/<script/i.test(page), "aucun script : la page s'ouvre hors ligne");
dire((page.match(/type="radio"/g) ?? []).length === 2, "les deux propositions sont des boutons radio");

// **Chaque proposition porte SON défaut**, filet d'or à gauche.
dire((page.match(/class="contre"/g) ?? []).length === 2, "chaque proposition porte son défaut, pas seulement son avantage");

// La conséquence qui ne se voit pas à l'œil, et qu'il doit lire.
dire(/Réglages/.test(page), "la disparition de la rubrique des Réglages est écrite");
dire(/salarié ne la voit pas/.test(page), "la réserve au patron est écrite");

// Sa consigne du 25 août : pas de flèche décorative au bout d'un libellé.
dire(!/→\s*<\/(span|label|a)>/.test(page), "aucune flèche décorative en fin de libellé");

console.log(`\n${echecs.length === 0 ? "✅" : "❌"} ${CHEMIN} — ${echecs.length} défaut(s).`);
process.exit(echecs.length === 0 ? 0 : 1);
