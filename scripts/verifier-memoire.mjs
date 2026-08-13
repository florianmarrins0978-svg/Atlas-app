import { existsSync, readFileSync } from "node:fs";

// Vérifie que la mémoire du dépôt ne pointe pas dans le vide.
//
// Les six fichiers de mémoire (voir CLAUDE.md §2) citent des chemins : un
// fichier renommé, un dossier déplacé, et la documentation envoie le lecteur
// suivant vers une porte fermée. Or c'est précisément quand on arrive sans
// contexte qu'on n'a aucun moyen de deviner le bon chemin.
//
// Lancé par `npm run verifier:memoire`, et par la CI.

const FICHIERS = [
  "README.md",
  "CLAUDE.md",
  "AGENTS.md",
  "HANDOVER.md",
  "PROJECT_STATE.md",
  "ARCHITECTURE.md",
  "TODO.md",
  "CHANGELOG.md",
];

/** Les six fichiers de mémoire doivent exister — c'est le minimum. */
const OBLIGATOIRES = [
  "CLAUDE.md",
  "PROJECT_STATE.md",
  "ARCHITECTURE.md",
  "HANDOVER.md",
  "CHANGELOG.md",
  "TODO.md",
];

const problemes = [];

for (const f of OBLIGATOIRES) {
  if (!existsSync(f)) problemes.push(`${f} — fichier de mémoire manquant`);
}

for (const fichier of FICHIERS) {
  if (!existsSync(fichier)) continue;
  const contenu = readFileSync(fichier, "utf8");

  // **Un conflit de fusion avalé, committé, et poussé.**
  //
  // Trouvé le 13 août 2026 sur `main` : `ARCHITECTURE.md` y portait ses
  // `<<<<<<< HEAD` en clair, sur quatre-vingts lignes. Plusieurs sessions
  // écrivent ce dépôt en même temps (`CLAUDE.md` §6) ; l'une d'elles a résolu à
  // moitié, et personne ne l'a vu — la mémoire du dépôt était cassée en ligne,
  // et c'est le fichier qu'on lit en arrivant.
  //
  // Aucun contrôle ne regardait cela : ni le typage, ni le lint, ni les suites
  // ne lisent le Markdown. Celui-ci coûte trois lignes.
  for (const marqueur of ["<<<<<<<", "=======", ">>>>>>>"]) {
    const ligne = contenu.split("\n").findIndex((l) => l.startsWith(marqueur));
    // `=======` seul est un soulignement Markdown légitime ; on ne le compte
    // que s'il accompagne un vrai marqueur de conflit.
    if (ligne !== -1 && (marqueur !== "=======" || /^<<<<<<< /m.test(contenu))) {
      problemes.push(
        `${fichier} — marqueur de conflit « ${marqueur} » ligne ${ligne + 1} : ` +
          "une fusion a été résolue à moitié puis committée."
      );
      break;
    }
  }

  // Liens Markdown relatifs.
  for (const [, cible] of contenu.matchAll(/\]\(([^)#][^)]*)\)/g)) {
    if (/^(https?:|mailto:)/.test(cible)) continue;
    const chemin = cible.split("#")[0];
    if (chemin && !existsSync(chemin)) {
      problemes.push(`${fichier} — lien mort : ${cible}`);
    }
  }

  // Chemins de fichiers cités entre accents graves. Les motifs à joker et les
  // dépendances externes sont hors sujet : on ne vérifie que ce dépôt.
  for (const [, chemin] of contenu.matchAll(
    /`([a-zA-Z0-9_.\/\[\]-]+\.(?:ts|tsx|sql|md|mjs|yml|json))`/g
  )) {
    if (chemin.includes("*") || chemin.startsWith("node_modules")) continue;
    if (!chemin.includes("/")) continue; // simple nom de fichier en prose
    // Un chemin ABSOLU n'est pas un fichier de ce dépôt : c'est un chemin
    // d'exécution, écrit par la machine et absent tant que rien ne tourne.
    // `ARCHITECTURE.md` en cite un — l'état du préchauffage, dans `/tmp` —, et
    // le contrôle le déclarait mort une fois sur deux, selon qu'un banc était
    // en marche ou non. Un contrôle qui accuse au hasard coûte plus cher que
    // pas de contrôle du tout : ce qu'on éprouve ici, ce sont les renvois vers
    // le dépôt, et eux seuls.
    if (chemin.startsWith("/")) continue;
    if (!existsSync(chemin)) {
      problemes.push(`${fichier} — chemin inexistant : ${chemin}`);
    }
  }
}

// --- Les rappels armés ne doivent pas disparaître par distraction -----------
//
// **Sa consigne du 9 août 2026 :** *« note-toi-le, enregistre-le, car lorsqu'on
// sera arrivé à la partie commercialisation, je veux que tu me le ressortes
// automatiquement parce que je ne vais pas m'en souvenir. »*
//
// Un rappel qui vit dans un fichier de prose se supprime d'un coup de ciseaux
// lors d'un remaniement, et personne ne s'en aperçoit — surtout pas celui à qui
// il devait servir, puisque justement il ne s'en souvient pas.
//
// Ce contrôle ne juge pas le contenu du bloc : il vérifie que la section existe
// encore et qu'elle porte au moins une ligne de déclencheur. Le supprimer
// exigera de le faire exprès, en rendant cette suite rouge.
const RAPPELS_ATTENDUS = [
  {
    fichier: "HANDOVER.md",
    titre: "## ⚠ À RESSORTIR AU PATRON quand le sujet arrive",
    // Le déclencheur, pas la réponse : c'est lui qui se perd en premier.
    declencheur: "commercialiser",
    pourquoi:
      "le rappel sur la validation Google (docs/A-FAIRE.md §8) doit ressortir " +
      "de lui-même le jour où la commercialisation revient sur la table",
  },
];

for (const rappel of RAPPELS_ATTENDUS) {
  if (!existsSync(rappel.fichier)) continue;
  const contenu = readFileSync(rappel.fichier, "utf8");
  if (!contenu.includes(rappel.titre)) {
    problemes.push(
      `${rappel.fichier} — la section « ${rappel.titre.replace(/^#+\s*/, "")} » a disparu : ${rappel.pourquoi}`
    );
  } else if (!contenu.includes(rappel.declencheur)) {
    problemes.push(
      `${rappel.fichier} — la section des rappels ne porte plus son déclencheur ` +
        `« ${rappel.declencheur} » : ${rappel.pourquoi}`
    );
  }
}

if (problemes.length > 0) {
  console.error("❌ La mémoire du dépôt pointe dans le vide :\n");
  for (const p of problemes) console.error(`   ${p}`);
  console.error(
    "\nCorriger le chemin, ou le fichier de mémoire — mais pas laisser en l'état :"
  );
  console.error("une référence morte trompe exactement celui qui arrive sans contexte.\n");
  process.exit(1);
}

console.log(
  `✅ Mémoire du dépôt cohérente (${FICHIERS.length} fichiers vérifiés, ` +
    `${RAPPELS_ATTENDUS.length} rappel(s) armé(s)).`
);
