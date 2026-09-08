#!/usr/bin/env node
/**
 * « Corrige-moi ça » : rappeler qu'on répare À LA RACINE, pas par-dessus.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sa règle d'or, le 7 septembre 2026 :** *« lorsque tu fais une correction,
 * je ne veux pas de pansement. Je veux que tu ailles corriger le problème
 * directement à la racine — pas de superposition de couches de code. »* Puis :
 * *« je veux que ça soit une règle incontournable, non franchissable. »*
 *
 * Elle est écrite en toutes lettres dans `CLAUDE.md` §4 quater. Mais une
 * consigne en prose se lit au début d'une conversation et s'oublie au bout de
 * trois heures — et c'est au bout de trois heures qu'on est fatigué, qu'un
 * `catch` vide paraît raisonnable et qu'un lot presse. Ce déclencheur la remet
 * sous les yeux **au moment exact où elle sert** : quand il demande une
 * correction, dans chacune de ses sessions, sans qu'aucune n'ait rien à
 * retenir.
 *
 * **Il ne remplace pas le contrôle** (`scripts/test-pas-de-pansement.ts`, joué
 * par la batterie) : celui-là refuse les gestes mécaniques, celui-ci vise le
 * jugement — l'endroit qu'on choisit de corriger, qu'aucun script ne sait
 * lire. Les deux tiennent chacun une moitié de la règle.
 *
 * **Il n'interdit rien et ne bloque rien** : il ajoute du contexte. En cas de
 * doute il se tait, comme `rappel-panne.mjs` — un rappel qui parle à tort
 * s'apprend à être ignoré, et l'on perd alors le garde-fou sans s'en
 * apercevoir.
 * ───────────────────────────────────────────────────────────────────────────
 */

/** Sans accents ni casse : il dicte, et la dictée ponctue au hasard. */
function aplatir(texte) {
  return String(texte ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Les tournures par lesquelles il demande une RÉPARATION.
 *
 * **Choisies pour ce qu'elles ont de commun : elles désignent un défaut à
 * faire disparaître.** On évite les mots trop larges — « change », « ajoute »,
 * « fais » — qui ouvrent des demandes ordinaires : un rappel qui se déclenche
 * à chaque message ne serait plus lu au bout d'une journée.
 */
const TOURNURES = [
  "corrige",
  "corriger ca",
  "repare",
  "reparer ca",
  "repare moi",
  "regle le probleme",
  "regle moi ca",
  "il y a un bug",
  "y a un bug",
  "c'est casse",
  "resous",
  "debug",
  "ca deconne",
  "refais le fonctionner",
];

export function demandeUneCorrection(prompt) {
  const plat = aplatir(prompt);
  return TOURNURES.some((t) => plat.includes(t));
}

export const RAPPEL = [
  "Le patron demande une correction. **Sa règle d'or, non négociable",
  "(`CLAUDE.md` §4 quater) : pas de pansement — on corrige à la RACINE.**",
  "",
  "1. **Trouver d'où ça part**, pas le premier endroit où ça se voit. Devant un",
  "   défaut muet, le rendre bavard AVANT de corriger : réparer une panne",
  "   imaginée a déjà coûté une demi-journée à ce dépôt (`AGENTS.md`).",
  "2. **Corriger là**, quitte à toucher une signature, un dépôt, une migration.",
  "3. **Retirer la couche qui compensait** — un pansement laissé en place",
  "   masquera la correction suivante.",
  "",
  "Le signe qui doit alerter : **une correction qui n'enlève rien**. Un défaut",
  "réparé à sa racine remplace du code ; un défaut recouvert en ajoute.",
  "",
  "Sont refusés par la batterie (`scripts/test-pas-de-pansement.ts`) : un",
  "`catch` vide, `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `as any`,",
  "`!important`. Racine hors d'atteinte de ce lot : l'écrire",
  "« pansement assumé : <la raison> » ET dans `TODO.md`.",
  "",
  "(Rappel automatique : ne pas y répondre, agir.)",
].join("\n");

async function main() {
  // Même contrat que `rappel-panne.mjs` : du JSON sur l'entrée standard, et le
  // silence si quoi que ce soit manque. Un rappel n'a pas le droit de gêner
  // une conversation, encore moins de la faire échouer.
  let entree = "";
  for await (const morceau of process.stdin) entree += morceau;

  let prompt = "";
  try {
    prompt = JSON.parse(entree).prompt ?? "";
  } catch {
    return;
  }
  if (!demandeUneCorrection(prompt)) return;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: RAPPEL,
      },
    })
  );
}

if (process.argv[1] && process.argv[1].endsWith("rappel-racine.mjs")) {
  main().catch(() => {
    // Muet, toujours : voir plus haut.
  });
}
