#!/usr/bin/env node
/**
 * Un message qui parle d'arrosage : faire lire SES règles d'arrosage d'abord.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sa décision du 16 octobre 2026.** Les règles d'arrosage ont quitté
 * `CLAUDE.md` pour `.claude/rules/arrosage.md`, que Claude Code charge dès
 * qu'une session lit un fichier d'arrosage (`ARCHITECTURE.md` §465). Il restait
 * un trou : une session à qui il demande une planche d'arrosage NEUVE peut
 * dessiner son premier jet avant d'avoir ouvert le moindre fichier, donc sans
 * ses règles sous les yeux. Une nourrice placée par l'outil, un matériel
 * inventé, et c'est le chantier qu'on creuse au mauvais endroit.
 *
 * Ce déclencheur ferme ce trou au seul moment qui compte : le message reçu.
 * Il ne bloque rien, il ajoute du contexte. **Il se tait au moindre doute** :
 * un rappel qui parle à tort s'apprend à être ignoré.
 *
 * **Ce qu'il ne voit pas, et c'est voulu** : une phrase de suite sans mot du
 * métier (« cinq réseaux pour ça ??????? »). Elle arrive dans une conversation
 * qui a déjà ouvert les fichiers d'arrosage, donc déjà chargé les règles.
 * ───────────────────────────────────────────────────────────────────────────
 */

/** Sans accents ni casse : il dicte depuis un téléphone. */
function aplatir(texte) {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Les mots du métier, et seulement ceux qui ne servent qu'à l'arrosage.
 *
 * **« croquis » n'y est pas** : la fiche de sécurité porte aussi un croquis, et
 * le rappel parlerait à tort sur chaque message qui la concerne. **« réseau »,
 * « vanne », « tranchée », « débit » non plus** : trop larges (une vanne se
 * dit en blague, un débit se lit sur un relevé de banque).
 */
const MOTS = [
  /\barros/, // arrosage, arroser, arroseur, arrosé
  /\bbuses?\b/,
  /\bnourrices?\b/,
  /\btuyeres?\b/,
  /\bturbines?\b/,
  /\belectrovannes?\b/,
  /\bprogrammateurs?\b/,
  /\bpiquage\b/,
  /\bpluviometrie\b/,
  /\bpe[hb]d\b/,
];

export function parleDArrosage(prompt) {
  const plat = aplatir(String(prompt ?? ""));
  return MOTS.some((m) => m.test(plat));
}

export const RAPPEL = [
  "Le patron parle d'arrosage. **Avant de dessiner, calculer ou répondre :**",
  "lire `.claude/rules/arrosage.md` en entier, s'il n'est pas déjà dans le",
  "contexte. Ce sont ses règles, mot pour mot, et elles ne se chargent toutes",
  "seules qu'à l'ouverture d'un fichier d'arrosage, c'est-à-dire parfois trop",
  "tard pour une planche neuve.",
  "",
  "L'essentiel en attendant : sans croquis complet (métrés, piquage, nourrice),",
  "aucun plan ; la nourrice se place par lui, jamais par l'outil ; aucun",
  "matériel inventé, les libellés viennent de `appli/arrosage-catalogue.js` ;",
  "devant une inconnue, le moins d'arroseurs par vanne.",
  "",
  "(`CLAUDE.md` §4 ter et §4 bis. Rappel automatique : ne pas y répondre, agir.)",
].join("\n");

async function main() {
  let entree = "";
  for await (const morceau of process.stdin) entree += morceau;

  let prompt = "";
  try {
    prompt = JSON.parse(entree).prompt ?? "";
  } catch {
    return;
  }
  if (!parleDArrosage(prompt)) return;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: RAPPEL,
      },
    })
  );
}

if (process.argv[1] && process.argv[1].endsWith("rappel-arrosage.mjs")) {
  main().catch(() => {
    // Muet, toujours : un rappel n'a pas le droit de faire échouer un message.
  });
}
