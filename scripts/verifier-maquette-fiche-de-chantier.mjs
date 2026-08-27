// LA FICHE DE CHANTIER ESSAYABLE — ce qu'elle doit tenir.
//
// Sa demande du 27 août 2026 : *« je veux un lien cliquable »*, après trois
// captures. L'application demande un compte et un serveur ; cette page reprend
// les trois écrans TELS QU'ILS SONT et se touche du doigt.
//
// **Ce que ce contrôle défend :**
//   · les vingt prestations sont celles du code — pas des exemples inventés
//     (`CLAUDE.md` §4 bis) ;
//   · les cases se cochent VRAIMENT (de vraies `<input type="checkbox">`) —
//     une page qui ne fait que dessiner des cases n'est pas essayable, et c'est
//     précisément ce qu'il refuse depuis six fois ;
//   · elle tient sans JavaScript, pour s'ouvrir hors ligne ;
//   · et elle DIT ce qu'elle ne fait pas — une copie d'écran qui se fait passer
//     pour l'application lui ferait croire qu'il vient d'envoyer un rapport.
//
//     node scripts/verifier-maquette-fiche-de-chantier.mjs
import { readFileSync } from "node:fs";

const CHEMIN = "appli/fiche-de-chantier.html";
const page = readFileSync(CHEMIN, "utf8");
const echecs = [];
const dire = (bon, quoi) => {
  console.log(`${bon ? "  ✓" : "  ✗"} ${quoi}`);
  if (!bon) echecs.push(quoi);
};

console.log("=== La fiche de chantier, essayable ===\n");

const source = readFileSync("src/lib/prestations-entretien.ts", "utf8");
const modele = [...source.matchAll(/\{ famille: "([^"]+)", libelle: "([^"]+)" \}/g)].map((m) => m[2]);
const surLaPage = [...page.matchAll(/<span class="mot">([^<]+)<\/span>/g)].map((m) => m[1]);

const manquantes = modele.filter((l) => !surLaPage.includes(l));
dire(
  manquantes.length === 0,
  manquantes.length === 0
    ? `les ${modele.length} prestations du code sont sur la page`
    : `absentes : ${manquantes.join(", ")}`
);
const inventees = surLaPage.filter((l) => !modele.includes(l));
dire(inventees.length === 0, inventees.length === 0 ? "aucune prestation inventée" : `inventées : ${inventees.join(", ")}`);

// **Essayable pour de bon.** Des cases dessinées ne se cochent pas.
const cases = (page.match(/type="checkbox"/g) ?? []).length;
dire(cases >= 6, `${cases} vraies cases à cocher — elle se touche, elle ne se regarde pas`);
dire(/type="date"/.test(page) && /<textarea/.test(page), "le jour et les observations se saisissent");
dire((page.match(/<select/g) ?? []).length === 2, "le temps passé se règle à la molette");

dire(!/<script/i.test(page), "aucun script : la page s'ouvre hors ligne");
dire((page.match(/type="radio"/g) ?? []).length === 3, "les trois écrans se changent en CSS");

// **Elle dit ce qu'elle n'est pas.** Sinon il croit avoir envoyé un rapport.
dire(/Rien n'est enregistré/.test(page), "elle dit que rien n'est enregistré ni envoyé");

// Sa consigne du 25 août : pas de flèche décorative au bout d'un libellé.
dire(!/→\s*<\/(span|label|a|button)>/.test(page), "aucune flèche décorative en fin de libellé");

console.log(`\n${echecs.length === 0 ? "✅" : "❌"} ${CHEMIN} — ${echecs.length} défaut(s).`);
process.exit(echecs.length === 0 ? 0 : 1);
