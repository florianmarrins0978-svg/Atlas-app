#!/usr/bin/env node
/**
 * LES RÈGLES DU PATRON NE SE RÉÉCRIVENT PAS — un garde-fou, pas une consigne.
 *
 * **Sa consigne du 11 septembre 2026 :** *« ces règles-là ne doivent pas être
 * contournées, JAMAIS ! »* — après avoir constaté qu'une règle donnée le 18 août
 * était morte le 24, quand un contrôle rouge a été réécrit au lieu d'être
 * compris.
 *
 * Une consigne en prose se lit au début d'une conversation et s'oublie au bout
 * de trois heures — or c'est au bout de trois heures qu'une session « adapte »
 * un contrôle qui la gêne (`CLAUDE.md` §1 bis). Ce déclencheur est donc branché
 * sur chaque geste de chaque session (`.claude/settings.json`, `PreToolUse`) :
 *
 *   · `scripts/test-regles-du-patron.ts` ne s'ÉCRASE pas (`Write`) ;
 *   · une entrée existante ne se MODIFIE pas (`Edit` dont l'ancien texte touche
 *     un `regle(` ou un `exige(`) ;
 *   · le fichier ne se supprime pas, ne se déplace pas, ne se corrige pas par
 *     `sed`, et ne se remet pas à une version d'avant (`git checkout`, `restore`).
 *
 * **Ce qu'il LAISSE passer, et c'est ce qui le rend tenable :** ajouter. Une
 * règle neuve s'insère sous le repère de fin, et c'est un `Edit` dont l'ancien
 * texte est ce repère seul. Lire, aussi : `cat`, `grep`, `git diff`.
 *
 * **Ce qu'il ne sait pas faire :** dire si le patron a vraiment changé d'avis.
 * Quand c'est le cas, l'ancienne entrée reste et se barre, la nouvelle s'ajoute
 * avec sa phrase et sa date — donc toujours par ajout, jamais par réécriture.
 *
 * Éprouvé par `scripts/test-garde-regles-du-patron.ts`, autant sur ce qu'il
 * refuse que sur ce qu'il laisse passer.
 */

export const FICHIER = "test-regles-du-patron.ts";
const OUTILS_QUI_ECRASENT = new Set(["Write", "NotebookEdit"]);
const OUTILS_QUI_EDITENT = new Set(["Edit", "MultiEdit"]);
/** Ce qu'un `Edit` n'a pas le droit de toucher : une règle, ou ce qu'elle exige. */
const CORPS_DUNE_REGLE = /\b(regle|exige)\(/;
const REPERE = "LA PROCHAINE RÈGLE S'AJOUTE ICI";

const viseLeFichier = (chemin) => typeof chemin === "string" && chemin.replace(/\\/g, "/").endsWith(`scripts/${FICHIER}`);

/** Une commande shell qui écrit dans le fichier, le supprime, le déplace ou le remet à hier. */
export function commandeQuiTouche(commande) {
  if (typeof commande !== "string") return false;
  // Ce qui est entre guillemets est un TEXTE — un message de commit qui cite la
  // règle, une chaîne de sed —, pas un chemin. Le chemin visé, lui, s'écrit nu.
  const nue = commande.replace(/"[^"]*"|'[^']*'/g, '""');
  if (!nue.includes(FICHIER)) return false;
  return [
    /\bsed\s+(?:-[^\s]*\s+)*-i\b/,
    />>?\s*(?:"|')?[^\s|&]*test-regles-du-patron\.ts/,
    /\btee\b/,
    /\b(rm|mv|cp|truncate)\s/,
    /\b(Remove-Item|Move-Item|Set-Content|Add-Content|Out-File|Copy-Item)\b/i,
    /\bgit\s+(?:(?:-[cC]\s+\S+|--[a-z-]+(?:=\S+)?|-[a-zA-Z]+)\s+)*(checkout|restore|rm|mv)\b/,
  ].some((r) => r.test(nue));
}

export function phraseDuRefus(quoi) {
  return (
    `${quoi} : cette suite porte les règles du patron, avec ses chiffres, et elle ne se réécrit pas.\n` +
    "Si elle est rouge, c'est le CODE qui a tort — ou c'est LUI qui a changé la règle, et alors sa phrase\n" +
    `datée s'AJOUTE sous le repère « ${REPERE} », l'ancienne entrée restant barrée.\n` +
    "Un Edit dont l'ancien texte est ce seul repère passe ; tout le reste est refusé (CLAUDE.md §4 bis)."
  );
}

/** La décision pure : `null` pour laisser passer, une phrase pour refuser. */
export function decider(outil, entree) {
  if (OUTILS_QUI_ECRASENT.has(outil) && viseLeFichier(entree?.file_path ?? entree?.notebook_path)) {
    return phraseDuRefus("Écraser le fichier");
  }
  if (OUTILS_QUI_EDITENT.has(outil) && viseLeFichier(entree?.file_path)) {
    const modifications = Array.isArray(entree?.edits) ? entree.edits : [entree];
    for (const m of modifications) {
      const ancien = String(m?.old_string ?? "");
      if (CORPS_DUNE_REGLE.test(ancien)) return phraseDuRefus("Modifier une règle existante");
      // Retirer le repère lui-même fermerait la porte aux règles suivantes.
      if (ancien.includes(REPERE) && !String(m?.new_string ?? "").includes(REPERE)) {
        return phraseDuRefus("Retirer le repère d'ajout");
      }
    }
  }
  if ((outil === "Bash" || outil === "PowerShell") && commandeQuiTouche(entree?.command)) {
    return phraseDuRefus("Toucher le fichier depuis le terminal");
  }
  return null;
}

// Le déclencheur ne se lance que quand il est le point d'entrée : la suite qui
// l'éprouve importe ses fonctions sans lire l'entrée standard.
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("garde-regles-du-patron.mjs")) {
  let brut = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => {
    brut += c;
  });
  process.stdin.on("end", () => {
    let refus = null;
    try {
      const { tool_name: outil, tool_input: entree } = JSON.parse(brut || "{}");
      refus = decider(outil, entree);
    } catch (e) {
      // Une entrée illisible n'est pas un geste sur le fichier : on laisse
      // passer, et on le dit sur la sortie d'erreur plutôt que de bloquer une
      // session pour un JSON tronqué.
      process.stderr.write(`garde-regles-du-patron : entrée illisible (${e instanceof Error ? e.message : e})\n`);
    }
    process.stdout.write(
      JSON.stringify(
        refus
          ? { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: refus } }
          : {}
      )
    );
  });
}
