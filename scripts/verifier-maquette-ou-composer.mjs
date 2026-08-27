// « ON LA TROUVE DIFFICILEMENT » — les trois formes proposées.
//
// Sa remarque du 26 août 2026, sur l'écran livré une heure plus tôt : la
// rubrique est une ligne de texte au milieu d'un écran de texte.
//
// **Ce que ce contrôle défend :** la page tient sans JavaScript (il l'ouvre sur
// son téléphone), chaque proposition porte SON DÉFAUT — une planche qui ne dit
// que ses avantages ne se choisit pas, elle se subit —, et **la place ne se
// rouvre pas** : il a déjà tranché « sous le titre, en premier », seule la
// forme est en jeu.
//
//     node scripts/verifier-maquette-ou-composer.mjs
import { readFileSync } from "node:fs";

const CHEMIN = "appli/ou-composer-ma-fiche.html";
const page = readFileSync(CHEMIN, "utf8");
const echecs = [];
const dire = (bon, quoi) => {
  console.log(`${bon ? "  ✓" : "  ✗"} ${quoi}`);
  if (!bon) echecs.push(quoi);
};

console.log("=== Rendre « Composer ma fiche » visible ===\n");

dire(!/<script/i.test(page), "aucun script : la page s'ouvre hors ligne");
dire((page.match(/type="radio"/g) ?? []).length === 3, "trois propositions, en boutons radio");
dire((page.match(/class="contre"/g) ?? []).length === 3, "chaque proposition porte son défaut");

// Le nom qu'il a choisi, à l'identique dans les trois.
dire(
  (page.match(/Composer ma fiche/g) ?? []).length >= 3,
  "les trois portent le nom qu'il a retenu, « Composer ma fiche »"
);

// **La place est acquise**, et la planche doit le dire — sans quoi il croirait
// qu'on lui redemande de trancher ce qu'il a déjà tranché.
dire(/sous le titre/i.test(page), "la planche rappelle que la place ne change pas");

// Sa consigne du 25 août : pas de flèche décorative en fin de libellé.
dire(!/→\s*<\/(span|label|a)>/.test(page), "aucune flèche décorative en fin de libellé");

// Une cible qu'on touche au pouce, sur un chantier, parfois avec des gants :
// les pavés de la proposition B annoncent leur hauteur.
dire(/min-height:96px/.test(page), "les carrés de B font au moins 96 px de haut");

console.log(`\n${echecs.length === 0 ? "✅" : "❌"} ${CHEMIN} — ${echecs.length} défaut(s).`);
process.exit(echecs.length === 0 ? 0 : 1);
