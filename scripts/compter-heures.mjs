/* =======================================================================
   Combien de temps a coûté cette application ?

   Pourquoi un script plutôt qu'un chiffre écrit dans un document : la
   réponse vieillit à chaque commit. Un nombre recopié à la main serait
   faux le lendemain, et personne ne saurait dire d'où il sortait
   (`CLAUDE.md` §4 bis : « un récapitulatif se RECALCULE, il ne se
   recopie pas »).

   Le piège que ce script contourne, et qui rend la question difficile :
   **l'historique git ne commence pas au début du projet.** Le premier
   commit du 10 août 2026 est un écrasement — 684 fichiers, 129 867
   lignes d'un coup. Tout ce qui précède a disparu de `git log`, et une
   réponse tirée de `git log --reverse` seul répondrait « 15 jours »
   alors que le CHANGELOG remonte au 31 juillet.

   La période visible se MESURE ; la période effacée s'ESTIME, par trois
   règles de trois indépendantes. Elles ne tombent pas d'accord — c'est
   dit, plutôt que moyenné en un faux chiffre rond.

   Usage :
     node scripts/compter-heures.mjs
     node scripts/compter-heures.mjs --pause=90   (minutes, défaut 120)
   ======================================================================= */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28 });

const arg = (nom, defaut) => {
  const trouve = process.argv.find((a) => a.startsWith(`--${nom}=`));
  return trouve ? Number(trouve.split("=")[1]) : defaut;
};

/* Une pause plus longue que ce seuil sépare deux séances de travail.
   Deux heures : en dessous, une réflexion un peu longue coupe une séance
   en deux et le total s'effondre ; au-dessus, une soirée et le lendemain
   matin n'en font plus qu'une. */
const PAUSE_MIN = arg("pause", 120);
/* Ce qui précède le premier commit d'une séance — lire le dépôt, monter
   la base, comprendre la demande — ne laisse aucune trace. Un quart
   d'heure est modeste et assumé comme tel. */
const AMORCE_MIN = 15;

// --------------------------------------------------------------- mesure
const horodatages = git("log", "--pretty=format:%ad", "--date=unix", "--all")
  .split("\n")
  .filter(Boolean)
  .map(Number)
  .sort((a, b) => a - b);

let seances = 1;
let secondes = 0;
let debut = horodatages[0];
for (let i = 1; i < horodatages.length; i++) {
  if (horodatages[i] - horodatages[i - 1] > PAUSE_MIN * 60) {
    secondes += horodatages[i - 1] - debut + AMORCE_MIN * 60;
    seances++;
    debut = horodatages[i];
  }
}
secondes += horodatages.at(-1) - debut + AMORCE_MIN * 60;

const heuresVues = secondes / 3600;
const jour = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const premierJourVu = jour(horodatages[0]);
const dernierJour = jour(horodatages.at(-1));

// ------------------------------------------------------------- estimation
/* Le CHANGELOG est la seule trace datée de la période effacée. Chaque
   `### titre` sous une date est un lot de travail : c'est plus régulier
   que de compter les puces, dont certaines sections n'ont pas. */
const lotsParJour = new Map();
let dateCourante = null;
/* Sans le journal, la période effacée n'a plus AUCUNE trace : le script
   rendrait alors la seule mesure visible, qui fait commencer le projet
   onze jours trop tard. Mieux vaut le dire que de rendre ce chiffre-là
   tout seul — une erreur qui accuse le mauvais coupable coûte plus cher
   que pas d'erreur du tout. */
let journal;
try {
  journal = readFileSync("CHANGELOG.md", "utf8");
} catch {
  console.error(
    "\nCHANGELOG.md est introuvable — à jouer depuis la racine du dépôt.\n" +
      "C'est la seule trace datée d'avant l'écrasement du 10 août 2026 :\n" +
      "sans lui, la période effacée ne peut pas être estimée du tout.\n",
  );
  process.exit(1);
}
for (const ligne of journal.split("\n")) {
  const entete = ligne.match(/^## (\d{4}-\d{2}-\d{2})/);
  if (entete) dateCourante = entete[1];
  else if (dateCourante && ligne.startsWith("### "))
    lotsParJour.set(dateCourante, (lotsParJour.get(dateCourante) ?? 0) + 1);
}

const dates = [...lotsParJour.keys()].sort();
const avant = dates.filter((d) => d < premierJourVu);
const apres = dates.filter((d) => d >= premierJourVu);
const somme = (liste) => liste.reduce((t, d) => t + lotsParJour.get(d), 0);

const lotsAvant = somme(avant);
const lotsApres = somme(apres);

/* Volume de code : ce qui existait au moment de l'écrasement a bien été
   écrit par quelqu'un, pendant la période effacée. */
const lignesDe = (ref) =>
  git("ls-tree", "-r", "--name-only", ref, "src", "scripts")
    .split("\n")
    .filter(Boolean)
    .reduce((t, f) => t + git("show", `${ref}:${f}`).split("\n").length, 0);

const racine = git("rev-list", "--max-parents=0", "--all").trim().split("\n").at(-1);
const lignesAuDepart = lignesDe(racine);
const lignesMaintenant = lignesDe("HEAD");
const lignesEcritesDepuis = lignesMaintenant - lignesAuDepart;

/* Un journal qui ne remonterait pas avant l'écrasement — ou une division
   par zéro déguisée en « 0 h » : les deux rendent un total rassurant et
   faux. On refuse de conclure plutôt que d'annoncer un chiffre. */
if (!avant.length || !apres.length || !lotsApres || !lignesEcritesDepuis) {
  console.error(
    "\nImpossible d'estimer la période effacée : le journal ne porte rien\n" +
      `avant le ${premierJourVu}, ou rien depuis. Seule la mesure vaut : ${heuresVues.toFixed(0)} h.\n`,
  );
  process.exit(1);
}

const estimations = [
  {
    nom: "au volume de code",
    heures: (heuresVues / lignesEcritesDepuis) * lignesAuDepart,
    detail: `${lignesAuDepart.toLocaleString("fr")} lignes déjà là contre ${lignesEcritesDepuis.toLocaleString("fr")} écrites depuis`,
  },
  {
    nom: "aux lots du CHANGELOG",
    heures: (heuresVues / lotsApres) * lotsAvant,
    detail: `${lotsAvant} lots avant contre ${lotsApres} depuis`,
  },
  {
    nom: "au nombre de jours",
    heures: (heuresVues / apres.length) * avant.length,
    detail: `${avant.length} jours avant contre ${apres.length} depuis`,
  },
];

// ---------------------------------------------------------------- verdict
const h = (n) => `${n.toFixed(0)} h`;
const basse = Math.min(...estimations.map((e) => e.heures));
const haute = Math.max(...estimations.map((e) => e.heures));

console.log(`\nMESURÉ — du ${premierJourVu} au ${dernierJour}`);
console.log(
  `  ${horodatages.length} commits, ${seances} séances (pause > ${PAUSE_MIN} min)  →  ${h(heuresVues)}`,
);

console.log(`\nESTIMÉ — du ${dates[0] ?? "?"} au ${premierJourVu}, effacé par l'écrasement`);
for (const e of estimations)
  console.log(`  ${e.nom.padEnd(24)} ${h(e.heures).padStart(6)}   (${e.detail})`);

console.log(`\nTOTAL  ${h(heuresVues + basse)} à ${h(heuresVues + haute)}`);
console.log(
  `\nEt avant tout cela, Arborea — le produit dont Atlas est la reprise\n` +
    `(CHANGELOG, 2026-07-31). Son temps n'est dans aucun fichier d'ici.\n`,
);
