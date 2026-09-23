#!/usr/bin/env node
/**
 * PAS DE TIRET AU MILIEU D'UNE PHRASE — refusé À L'ÉCRITURE, pas à la batterie.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sa demande du 22 septembre 2026, au soir :** *« il faut mettre cette règle
 * en garde-fou que les sessions futures ne recommencent pas à mettre des
 * tirets inutiles là où elles peuvent faire des phrases »*.
 *
 * `scripts/test-aucun-tiret.ts` tient déjà la règle, mais il ne parle qu'à la
 * batterie : une session peut écrire trente écrans avant de l'entendre, et
 * c'est alors trente réécritures. Ce déclencheur-ci parle **à la seconde où la
 * phrase s'écrit**, dans chacune de ses sessions, sans qu'aucune n'ait rien à
 * retenir (`CLAUDE.md` §3, `ARCHITECTURE.md` §410).
 *
 * **CE QU'IL REGARDE, et rien d'autre : ce qui s'AFFICHERA.** Un tiret cadratin
 * ou un point médian, entre deux mots, dans une chaîne de caractères ou dans le
 * texte d'un écran, sous `src/`, `appli/` ou `public/`.
 *
 * **CE QU'IL ÉPARGNE, et c'est ce qui le rend tenable :**
 *
 *   · les **commentaires** — ils citent ses phrases à lui, tirets compris, et
 *     un garde-fou qui refuserait de les recopier serait contourné le jour
 *     même ;
 *   · la **mémoire du dépôt** (`.md`, `docs/`) : elle cite ses messages ;
 *   · le **trait d'union** : « sous-traitant », « 2026-09-22 », le moins d'un
 *     `calc()` ;
 *   · un tiret **seul** dans une case : c'est un montant absent
 *     (`CLAUDE.md` §4), pas une phrase coupée ;
 *   · tout ce qui ne s'affiche pas : `scripts/`, la configuration, les tests.
 *
 * **Il refuse, il ne corrige pas.** La bonne ponctuation dépend de la phrase —
 * une virgule, un deux-points, un point, deux parenthèses —, et un script qui
 * choisirait à la place de celui qui écrit poserait des virgules là où il
 * fallait un point. Le refus donne donc la règle et rend la main.
 *
 * Éprouvé par `scripts/test-garde-tirets.ts`, autant sur ce qu'il refuse que
 * sur ce qu'il laisse passer.
 * ───────────────────────────────────────────────────────────────────────────
 */

import { fautesDansDuCode, fautesDansDuHtml, autorise, fichierQuiSAffiche, CE_QUI_REMPLACE } from "./_tirets.mjs";

export { fichierQuiSAffiche };

const OUTILS_QUI_ECRIVENT = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);

/**
 * La phrase fautive d'un texte, ou `null`.
 *
 * **La règle vit dans `_tirets.mjs`**, partagée avec le contrôle de la
 * batterie : deux lectures du même tiret finiraient par se contredire, et
 * celle qui écrit laisserait passer ce que celle qui livre refuse
 * (`CLAUDE.md` §3).
 */
export function phraseFautive(texte, html = false, tsx = true, chemin = "") {
  const fautes = (html ? fautesDansDuHtml(texte) : fautesDansDuCode(texte, { tsx })).filter(
    (f) => !autorise(chemin, f.texte)
  );
  return fautes.length > 0 ? fautes[0].texte : null;
}

export function phraseDuRefus(faute) {
  return [
    `« ${faute} »`,
    "",
    "**Sa règle du 22 septembre 2026 : des phrases normales, pas de tiret en",
    "plein milieu** (`CLAUDE.md` §3). Le « — » et le « · » sont de la",
    "typographie de rapport ; à l'écran, il lit une phrase.",
    "",
    "Ce qui se met à la place, selon ce que la phrase fait :",
    CE_QUI_REMPLACE,
    "",
    "Gardent le leur : le trait d'union (« sous-traitant »), une date, et un",
    "tiret SEUL dans une case, qui dit un montant absent. Les commentaires",
    "aussi : ils citent ses phrases à lui.",
    "",
    "(`scripts/test-aucun-tiret.ts` le refuse aussi dans la batterie.)",
  ].join("\n");
}

/** La décision pure : `null` pour laisser passer, une phrase pour refuser. */
export function decider(outil, entree) {
  if (!OUTILS_QUI_ECRIVENT.has(outil)) return null;
  const chemin = entree?.file_path ?? entree?.notebook_path;
  if (!fichierQuiSAffiche(chemin)) return null;
  const html = /\.html$/.test(String(chemin));
  // **Un `.ts` se lit en TS, jamais en TSX** : « const f = <E>(a, b) => … » est
  // un générique, et le lire comme une balise transformait la suite du fichier
  // en « texte d'écran ». Quatre fichiers justes étaient refusés pour ça.
  const tsx = /\.(tsx|jsx)$/.test(String(chemin));

  const aLire = [];
  if (typeof entree?.content === "string") aLire.push(entree.content);
  if (typeof entree?.new_source === "string") aLire.push(entree.new_source);
  if (typeof entree?.new_string === "string") aLire.push(entree.new_string);
  for (const m of Array.isArray(entree?.edits) ? entree.edits : []) {
    if (typeof m?.new_string === "string") aLire.push(m.new_string);
  }

  for (const texte of aLire) {
    const faute = phraseFautive(texte, html, tsx, String(chemin));
    if (faute) return phraseDuRefus(faute);
  }
  return null;
}

// Il ne se lance que quand il est le point d'entrée : la suite qui l'éprouve
// importe ses fonctions sans lire l'entrée standard.
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("garde-tirets.mjs")) {
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
      // Une entrée illisible n'est pas une phrase à refuser : on laisse passer,
      // et on le dit sur la sortie d'erreur plutôt que de bloquer une session
      // pour un JSON tronqué.
      process.stderr.write(`garde-tirets : entrée illisible (${e instanceof Error ? e.message : e})\n`);
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
