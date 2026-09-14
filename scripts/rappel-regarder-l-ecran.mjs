#!/usr/bin/env node
/**
 * « Où est passé… ? » : REGARDER l'écran avant de répondre.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **Sa colère du 14 septembre 2026 :** *« ça arrive trop souvent que tu me
 * donnes une info fausse parce que t'es pas vraiment allé regarder les écrans
 * de l'appli ! »*
 *
 * Le jour même : j'avais affirmé que la porte du devis avait disparu de son
 * planning. Elle était là. Mon `grep` cherchait `data-atlas="porte-devis"` en
 * toutes lettres, alors que le repère se compose — `porte-${porte.cle}`. J'ai
 * conclu d'une recherche vide, et il a dû me reprendre.
 *
 * **Ce déclencheur ne vise pas la paresse, il vise le COÛT.** Regarder
 * demandait d'écrire un script de capture — ce dépôt en porte quatre-vingts,
 * un par écran. `npm run voir` l'a ramené à une ligne ; ce rappel remet la
 * commande sous les yeux au moment exact où elle sert : quand il demande où est
 * quelque chose, ou affirme qu'un écran a changé.
 *
 * **Il n'interdit rien et ne bloque rien** : il ajoute du contexte. Devant le
 * moindre doute il se tait — un rappel qui parle à tort s'apprend à être
 * ignoré, et l'on perd alors le garde-fou sans s'en apercevoir.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const RAPPEL = `Il pose une question sur un ÉCRAN. **Règle permanente
(\`CLAUDE.md\` §0.10, \`.claude/rules/regarder-l-ecran.md\`) : on le REGARDE
avant de répondre.**

    npm run voir -- /planning          # l'image ET le texte de l'écran
    npm run voir -- /reglages --large  # l'écran entier

Un \`grep\` ne prouve RIEN de ce qu'il voit : les repères se composent
(\`data-atlas={\\\`porte-\${cle}\\\`}\`), un composant peut être monté ailleurs, et une
recherche vide n'est pas une absence — c'est ainsi qu'on lui a annoncé, à tort,
la disparition de la porte du devis (14 septembre 2026).

Si l'écran ne peut pas être ouvert ici, le dire : « pas vérifiable ICI » — jamais
une affirmation présentée comme un constat.`;

/**
 * Les tournures qui disent qu'il parle d'un écran — relevées de ses vrais
 * messages, jamais inventées. Au moindre doute, on se tait.
 */
const TOURNURES = [
  // **Pas de `\b` après « ù ».** En JavaScript, la limite de mot ne connaît que
  // l'ASCII : « où » suivi d'un espace ne franchit aucune frontière, et la
  // tournure la plus fréquente de ses messages — « il est où le bouton » —
  // passait à travers. Attrapé par la suite avant que le rappel ne serve.
  /\b(o[ùu]|ou)\s+(est|sont|se trouve|a disparu)/i,
  /\bil (est|sont) o[ùu]/i,
  /\bcomment [çc]a\b.*\b(existe|marche|disparu|plus)\b/i,
  /\bn['’ ]existe (plus|pas)\b/i,
  /\ba disparu\b/i,
  /\bje (ne )?(vois|trouve) (pas|plus)\b/i,
  /\bsur (l['’]|mon )?[ée]cran\b/i,
  /\b[ée]cran (de|du|des)\b/i,
  /\bpourquoi.*\b(bouton|[ée]cran|page|onglet|lien)\b/i,
  /\bcapture\b/i,
];

export function parleDUnEcran(prompt) {
  const texte = String(prompt ?? "");
  if (texte.trim().length < 6) return false;
  return TOURNURES.some((t) => t.test(texte));
}

async function main() {
  let prompt = "";
  try {
    let entree = "";
    for await (const bloc of process.stdin) entree += bloc;
    prompt = JSON.parse(entree)?.prompt ?? "";
  } catch {
    return; // Rien de lisible : on ne gêne personne.
  }
  if (!parleDUnEcran(prompt)) return;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: RAPPEL },
    })
  );
}

if (process.argv[1] && process.argv[1].endsWith("rappel-regarder-l-ecran.mjs")) {
  main().catch(() => {
    // Muet, toujours : voir plus haut.
  });
}
