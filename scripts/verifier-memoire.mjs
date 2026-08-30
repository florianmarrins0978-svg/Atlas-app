import { existsSync, readFileSync, readdirSync } from "node:fs";

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

  // **DEUX PARAGRAPHES SOUS LE MÊME NUMÉRO** — le prix de sept sessions qui
  // écrivent `ARCHITECTURE.md` en même temps.
  //
  // Le 26 août 2026, un seul lot a dû renuméroter son paragraphe TROIS fois :
  // §189, §191, puis §192, à chaque refusion. Et ce n'est pas le pire cas —
  // celui-là se voit, parce que git lève un conflit quand les deux titres
  // tombent au même endroit. **Quand ils tombent à des endroits différents, la
  // fusion réussit sans rien dire**, et le fichier se retrouve avec deux
  // paragraphes de même numéro : c'est ainsi que six doublons se sont accumulés
  // et ont dû être démêlés à la main.
  //
  // Ce contrôle ne les empêche pas de naître ; il les fait voir **avant la
  // poussée**, au moment où l'on sait encore lequel est le sien.
  // `CLAUDE.md` §6, règle B : c'est le nôtre qu'on renumérote, jamais celui de
  // `main`, et il s'ajoute à la FIN.
  if (fichier === "ARCHITECTURE.md") {
    // **Les huit doublons DÉJÀ sur `main` au 26 août 2026.** Les renuméroter
    // aujourd'hui voudrait dire toucher huit paragraphes d'un fichier que sept
    // sessions écrivent en même temps, et faire mentir tous les renvois qui les
    // citent : le remède serait pire que le mal, un soir de forte circulation.
    // Ils sont donc NOMMÉS ici et inscrits dans `TODO.md`.
    //
    // **La liste doit rester EXACTE, et c'est ce qui l'empêche de pourrir** :
    // un numéro qu'on y laisserait après l'avoir démêlé fait rougir le contrôle
    // au même titre qu'un doublon neuf. On ne peut donc pas oublier de la
    // raccourcir en nettoyant.
    const DOUBLONS_CONNUS = new Set(["127", "128", "129", "134", "135", "136", "164", "165"]);

    const vus = new Map();
    for (const [, numero] of contenu.matchAll(
      /^## §?([0-9]+(?: (?:bis|ter|quater|quinquies))?)\./gm
    )) {
      vus.set(numero, (vus.get(numero) ?? 0) + 1);
    }
    for (const [numero, combien] of vus) {
      if (combien > 1 && !DOUBLONS_CONNUS.has(numero)) {
        problemes.push(
          `ARCHITECTURE.md — le paragraphe §${numero} existe ${combien} fois : ` +
            "une fusion a laissé deux sessions sous le même numéro. Renuméroter LE SIEN " +
            "(celui qui n'est pas encore sur `main`), et le poser à la fin (`CLAUDE.md` §6, règle B)."
        );
      }
    }
    for (const numero of DOUBLONS_CONNUS) {
      if ((vus.get(numero) ?? 0) <= 1) {
        problemes.push(
          `scripts/verifier-memoire.mjs — §${numero} n'est plus en double : ` +
            "le retirer de DOUBLONS_CONNUS, sinon la liste protège un doublon qui reviendrait."
        );
      }
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
  {
    fichier: "HANDOVER.md",
    titre: "## ⏰ IL ATTEND QU'ON LE RELANCE : LA LISTE DES TRAVAUX QU'IL VEND",
    // Le mot du travail manquant, pas la consigne : c'est lui qui disparaît le
    // jour où quelqu'un abrège la section sans savoir ce qu'elle tenait.
    declencheur: "plantation",
    pourquoi:
      "il a demandé le 27 août 2026 qu'on le relance sur la liste complète des " +
      "travaux qu'il vend — trois modules classent encore les prestations sur un " +
      "vocabulaire qui ignore la plantation et la clôture",
  },
];

RAPPELS_ATTENDUS.push({
  fichier: "CLAUDE.md",
  titre: "**LE DOCUMENT DE RETOUR SE FAIT TOUT SEUL, À LA FIN DE CHAQUE LOT.**",
  // Sa phrase, pas la consigne reformulée : c'est elle qui disparaîtrait si
  // quelqu'un « allégeait » la section sans savoir ce qu'elle a coûté.
  declencheur: "sans avoir besoin de te le demander",
  pourquoi:
    "il a dû redemander ce document au lot 2, au lot 2B, à M11, au lot 3, le " +
    "26 août 2026 en colère, puis encore le 30 août — la règle n'a jamais " +
    "manqué d'être écrite, elle a manqué d'être tenue",
});

// --- Tout dossier écrit doit être ATTEIGNABLE depuis son index -------------
//
// **Payé le 29 août 2026.** Les dossiers 08 et 09 ont vécu deux jours sans
// figurer dans `docs/pour-chatgpt/README.md`. Un dossier absent de son index
// n'existe pas pour qui arrive après : la table est le seul endroit qui dise
// lequel remplace lequel, et le patron y cherche ce qu'il doit retransmettre.
//
// Ce contrôle ne juge pas ce qu'un dossier dit — un instantané ne se corrige
// pas (`CLAUDE.md` §2 bis). Il vérifie seulement qu'aucun ne dort hors de la
// liste.
{
  const dossier = "docs/pour-chatgpt";
  const index = `${dossier}/README.md`;
  if (existsSync(index)) {
    const table = readFileSync(index, "utf8");
    const ecrits = readdirSync(dossier)
      .filter((f) => /^\d{2}-.+\.md$/.test(f))
      .sort();
    for (const nom of ecrits) {
      if (!table.includes(nom)) {
        problemes.push(
          `${index} — le dossier « ${nom} » n'est dans aucune ligne de la table. ` +
            "Un dossier hors de son index n'existe pas pour la session suivante, " +
            "ni pour le patron qui vient y chercher quoi retransmettre."
        );
      }
    }
  }
}

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
