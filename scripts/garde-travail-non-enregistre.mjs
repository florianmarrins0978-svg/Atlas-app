#!/usr/bin/env node
/**
 * NE PAS JETER LE TRAVAIL D'UNE AUTRE SESSION.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Payé le 4 septembre 2026.** Trois sessions travaillaient dans le MÊME
 * dossier — un seul arbre git, une seule branche, un seul port. Pendant qu'une
 * quatrième livrait la feuille d'envoi, ses modifications de `CHANGELOG.md` ont
 * disparu de l'arbre : elles ont dû être réécrites de mémoire, et l'on ne s'en
 * est aperçu qu'en relisant. Rien n'a été perdu au bout du compte, mais
 * personne n'a vu passer le geste qui les a effacées.
 *
 * **Le patron l'a tranché le même jour**, devant deux propositions : le
 * garde-fou automatique plutôt qu'une consigne. Et il a raison — `CLAUDE.md`
 * §1 bis le dit déjà pour une autre règle : *« une consigne en prose se lit au
 * début d'une conversation et s'oublie au bout de trois heures »*, or c'est au
 * bout de trois heures qu'une session nettoie son arbre.
 *
 * ─── CE QU'IL SURVEILLE, ET POURQUOI PAS AUTRE CHOSE ───────────────────────
 *
 * **La première idée visait à côté**, et l'écrire l'a montré : on allait
 * refuser les CHANGEMENTS DE BRANCHE. Or `git switch -c` **emporte** les
 * modifications avec lui — il ne perd rien. Ce qui efface, c'est la famille des
 * gestes qui JETTENT :
 *
 *   git reset --hard        · git checkout -- <fichier>
 *   git restore <fichier>   · git clean -f
 *
 * Un garde-fou posé sur le mauvais geste aurait gêné tout le monde tous les
 * jours sans jamais éviter la panne qu'il prétend éviter — et un garde-fou qui
 * parle à tort s'apprend à être ignoré (`CLAUDE.md` §1 bis).
 *
 * **Il ne dit rien sur un arbre propre.** Sans travail en cours, il n'y a rien
 * à perdre : le geste passe sans un mot.
 *
 * **Et il ne ferme aucune porte.** Ce qu'il propose à la place — `git stash push`
 * — fait exactement la même chose et se défait. Une session qui veut vraiment
 * jeter son propre essai le peut toujours ; elle le fait alors d'un geste qui
 * laisse une trace, plutôt que d'un geste sans retour.
 *
 * ─── Le contrat du déclencheur ─────────────────────────────────────────────
 *
 * Reçoit sur l'entrée standard le JSON de `PreToolUse` (`tool_name`,
 * `tool_input`) et répond sur la sortie standard. `permissionDecision: "deny"`
 * refuse l'appel ; un objet vide le laisse passer.
 *
 * `scripts/test-garde-travail-non-enregistre.ts` le confronte aux deux états
 * qu'il doit distinguer — et il a été vu refuser, puis laisser passer.
 * ───────────────────────────────────────────────────────────────────────────
 */
import { execFileSync } from "node:child_process";

/**
 * Les options globales de `git`, avant le verbe : `-C <chemin>`, `-c k=v`…
 *
 * Écrit ainsi parce que `git -C . reset --hard` ne se reconnaissait pas — la
 * suite l'a attrapé, et c'est un geste que le dépôt emploie pour de bon.
 */
const OPTIONS_GLOBALES = "(?:-{1,2}\\S+(?:\\s+\\S+)?\\s+)*";

/**
 * Les gestes qui JETTENT du travail non enregistré.
 *
 * Chacun est ancré sur `git` **et lu hors des guillemets** : un message de
 * commit qui PARLE de `git reset --hard` n'est pas un `git reset --hard`. La
 * première version s'y trompait, et sa suite l'a montrée fausse avant qu'elle
 * ne serve — c'est exactement le bruit qui apprend à ignorer un garde-fou.
 */
const GESTES_QUI_JETTENT = [
  {
    motif: new RegExp(`\\bgit\\s+${OPTIONS_GLOBALES}reset\\b[^&;|]*--hard`),
    quoi: "git reset --hard",
  },
  {
    // `git checkout -- <chemin>` et `git checkout .` : les deux jettent.
    // `git checkout <branche>` n'est PAS visé — il emporte les modifications.
    motif: new RegExp(`\\bgit\\s+${OPTIONS_GLOBALES}checkout\\s+(?:--\\s|\\.(?:\\s|$))`),
    quoi: "git checkout -- …",
  },
  {
    // `git restore --staged` ne fait que désindexer : il ne perd rien.
    motif: new RegExp(`\\bgit\\s+${OPTIONS_GLOBALES}restore\\b(?![^&;|]*--staged)`),
    quoi: "git restore …",
  },
  {
    motif: new RegExp(`\\bgit\\s+${OPTIONS_GLOBALES}clean\\b[^&;|]*-\\w*f`),
    quoi: "git clean -f",
  },
];

/**
 * La commande DÉBARRASSÉE de ses textes cités.
 *
 * Un message de commit, une phrase de `echo`, un motif de `grep` : tout ce qui
 * vit entre guillemets est du texte, pas un geste. Sans ce nettoyage, le
 * garde-fou refusait `git commit -m "… on ne fait jamais git reset --hard ici"`
 * — un cas que ce dépôt écrit vraiment, et qui l'aurait fait détester.
 */
function horsDesGuillemets(commande) {
  return commande.replace(/'[^']*'|"[^"]*"|`[^`]*`/g, " ");
}

/** Ce que le geste s'apprête à effacer — vide si l'arbre est propre. */
export function travailEnCours(executer = git) {
  // `--porcelain` seul ignore les fichiers ignorés, jamais les non suivis :
  // `git clean -f` les emporte, et le contrôle neuf de ce lot en était un.
  const sortie = executer(["status", "--porcelain"]);
  return sortie
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

/** Le geste visé par cette commande, s'il y en a un. */
export function gesteQuiJette(commande) {
  if (typeof commande !== "string") return null;
  const nue = horsDesGuillemets(commande);
  return GESTES_QUI_JETTENT.find((g) => g.motif.test(nue))?.quoi ?? null;
}

/**
 * La phrase du refus.
 *
 * Elle NOMME ce qui serait perdu — pas « des modifications », mais les fichiers,
 * comptés. Un refus qui ne dit pas ce qu'il protège se lit comme un caprice, et
 * la session cherche à le contourner au lieu de le comprendre.
 */
export function phraseDuRefus(quoi, fichiers) {
  const liste = fichiers.slice(0, 8).map((f) => `   ${f}`).join("\n");
  const reste = fichiers.length > 8 ? `\n   … et ${fichiers.length - 8} autre(s)` : "";
  return [
    `**\`${quoi}\` est refusé : ${fichiers.length} fichier(s) portent du travail non enregistré.**`,
    "",
    liste + reste,
    "",
    "Plusieurs sessions partagent ce dossier. Ce travail peut être celui d'une",
    "autre — le 4 septembre 2026, un lot entier a dû être réécrit de mémoire",
    "parce que personne n'a vu passer le geste qui l'avait effacé.",
    "",
    "**Ce qui fait la même chose et se défait :**",
    "",
    '   git stash push --include-untracked -m "ce que je mets de côté"',
    "",
    "Puis `git stash pop` pour le reprendre. Si le travail est le vôtre et qu'il",
    "est fini, enregistrez-le plutôt : `git add … && git commit`.",
  ].join("\n");
}

function principal() {
  let entree = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (bloc) => (entree += bloc));
  process.stdin.on("end", () => {
    let donnees;
    try {
      donnees = JSON.parse(entree || "{}");
    } catch {
      // **Devant le moindre doute, se taire.** Un déclencheur qui refuse sur une
      // entrée qu'il n'a pas comprise bloque le travail sans rien protéger.
      process.exit(0);
    }

    const commande = donnees?.tool_input?.command;
    const quoi = gesteQuiJette(commande);
    if (!quoi) process.exit(0);

    let fichiers;
    try {
      fichiers = travailEnCours();
    } catch {
      process.exit(0); // Pas de dépôt, ou git indisponible : rien à protéger.
    }
    if (fichiers.length === 0) process.exit(0);

    const message = phraseDuRefus(quoi, fichiers);
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: message,
        },
        systemMessage: message,
      })
    );
    process.exit(0);
  });
}

// Le fichier sert aussi de bibliothèque à sa suite : on ne lit l'entrée
// standard que lorsqu'il est lancé comme déclencheur.
if (process.argv[1] && process.argv[1].endsWith("garde-travail-non-enregistre.mjs")) {
  principal();
}
