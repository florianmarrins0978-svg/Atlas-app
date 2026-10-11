#!/usr/bin/env node
/**
 * REFUSER D'ÉCRIRE DANS LE DOSSIER PENDANT QU'UNE BATTERIE MESURE.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sa colère du 9 septembre 2026 :** *« JE NE VEUX PLUS DE PROBLÈME SUR LA
 * BATTERIE. Quand une batterie tourne, personne n'y touche. »* Trois verdicts
 * de dix minutes jetés dans la journée, tous pour la même raison : une session
 * voisine avait enregistré un fichier pendant la mesure.
 *
 * Le pourquoi du verrou est écrit dans `verrou-batterie.mjs` ; ce fichier-ci
 * n'est que la porte. Il est branché sur `PreToolUse` — donc sur CHAQUE geste
 * de CHAQUE session, y compris celles qui n'ont jamais lu `CLAUDE.md`.
 *
 * ─── CE QU'IL REFUSE, ET CE QU'IL LAISSE PASSER ────────────────────────────
 *
 * | Refusé | Laissé passer |
 * |---|---|
 * | écrire ou modifier un fichier | lire, chercher, mesurer |
 * | `git commit`, `merge`, `pull`, `checkout`, `stash`… | `git status`, `git log`, `git diff` |
 * | `npm install`, `rm`, `mv`, `sed -i`, une redirection `>` | `cat`, `grep`, `ls`, `curl` |
 *
 * **La lecture passe, et ce n'est pas une faveur.** Pendant les dix minutes
 * d'une batterie, la seule chose utile est justement de LIRE — son journal, son
 * avancement. Un verrou qui interdirait aussi cela se ferait contourner dès le
 * deuxième jour, et l'on perdrait la protection sans s'en apercevoir
 * (`CLAUDE.md` §1 bis).
 *
 * **Il vise aussi la session qui a lancé la batterie**, et c'est voulu : la
 * faute du 8 septembre a été commise par celle-là même qui mesurait.
 *
 * ─── Le contrat du déclencheur ─────────────────────────────────────────────
 *
 * Reçoit sur l'entrée standard le JSON de `PreToolUse` (`tool_name`,
 * `tool_input`) et répond sur la sortie standard. `permissionDecision: "deny"`
 * refuse l'appel ; un objet vide le laisse passer. En cas de doute — un JSON
 * qu'on ne comprend pas, un verrou illisible — **il se tait** : bloquer à tort
 * coûte plus cher que de laisser passer une écriture.
 * ───────────────────────────────────────────────────────────────────────────
 */
import { depuis, lireVerrou } from "./verrou-batterie.mjs";

/** Les outils qui écrivent un fichier, sans qu'il y ait à interpréter quoi que ce soit. */
const OUTILS_QUI_ECRIVENT = new Set(["Write", "Edit", "NotebookEdit", "MultiEdit"]);

/**
 * Ce qui, dans une ligne de commande, écrit dans le dossier.
 *
 * **On nomme ce qui écrit, on ne devine pas ce qui lit.** L'inverse — refuser
 * tout sauf une liste blanche — bloquerait `node scripts/…`, `npx tsc`, et la
 * moitié des gestes d'une session qui ne fait que regarder.
 */
const ECRITURES = [
  // git : tout ce qui déplace l'arbre ou l'historique.
  //
  // **Les options globales PRENNENT une valeur** — `-C <chemin>`, `-c k=v` —, et
  // c'est ce que la première écriture avait manqué : `git -C . add .` passait,
  // parce que le motif attendait un verbe là où se trouvait encore le chemin.
  // Son propre contrôle l'a montré dans la minute (`test-verrou-batterie.ts`).
  /\bgit\s+(?:(?:-[cC]\s+\S+|--[a-z-]+(?:=\S+)?|-[a-zA-Z]+)\s+)*(commit|merge|rebase|pull|push|checkout|switch|restore|reset|clean|stash|apply|am|cherry-pick|revert|add|rm|mv)\b/,
  // les gestes de fichier
  /\b(rm|mv|cp|mkdir|touch|truncate|chmod|chown)\s/,
  /\bsed\s+(?:-[^\s]*\s+)*-i\b/,
  /\btee\b/,
  // une redirection vers un fichier — `>` ou `>>`, mais pas `2>&1` ni `>/dev/null`
  />>?\s*(?!&|\/dev\/null)[^\s|&]/,
  // les gestionnaires de paquets
  /\bnpm\s+(install|ci|i|update|uninstall|link|pkg)\b/,
  /\b(pnpm|yarn|bun)\s+(add|install|remove)\b/,
  // PowerShell
  /\b(Set-Content|Add-Content|Out-File|New-Item|Remove-Item|Move-Item|Copy-Item|Rename-Item)\b/i,
];

/** Ce que le dossier scratch reçoit ne touche pas au dépôt : on le laisse passer. */
const HORS_DEPOT = /(\/tmp\/|AppData[\\/]Local[\\/]Temp|[\\/]scratchpad[\\/])/i;

function ecritDansLeDepot(commande) {
  if (!commande) return false;
  if (HORS_DEPOT.test(commande) && !/\bgit\s/.test(commande)) return false;
  return ECRITURES.some((r) => r.test(commande));
}

let brut = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => {
  brut += c;
});
process.stdin.on("end", () => {
  let refus = null;
  try {
    const { tool_name: outil, tool_input: entree } = JSON.parse(brut || "{}");
    const verrou = lireVerrou();
    if (verrou) {
      const commande = typeof entree?.command === "string" ? entree.command : "";
      // Le verrou lui-même se rend toujours : sans cette porte, un dossier gelé
      // par une batterie morte ne se rouvrirait qu'à la main.
      const cestLeVerrou = /verrou-batterie\.mjs/.test(commande);
      if (!cestLeVerrou && (OUTILS_QUI_ECRIVENT.has(outil) || ecritDansLeDepot(commande))) {
        refus =
          `Une batterie tourne depuis ${depuis(verrou)} (processus ${verrou.pid}, « ${verrou.quoi} »).\n` +
          `Rien ne s'écrit dans le dossier tant qu'elle mesure : un fichier qui bouge sous elle ` +
          `annule son verdict, et c'est dix minutes perdues pour tout le monde.\n` +
          `Lire reste possible — journal, git status, grep.\n` +
          `Si la batterie est morte : node scripts/verrou-batterie.mjs rendre --force`;
      }
    }
  } catch {
    // Devant le moindre doute, il se tait : un garde-fou qui parle à tort
    // s'apprend à être ignoré (`CLAUDE.md` §1 bis).
  }
  process.stdout.write(
    JSON.stringify(
      refus
        ? { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: refus } }
        : {}
    )
  );
});
