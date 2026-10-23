#!/usr/bin/env node
/**
 * Session ouverte depuis son téléphone : charger le skill impeccable d'office.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sa demande du 22 octobre 2026 :** *« toutes les sessions que j'ouvre sur
 * mon téléphone et que je n'ouvre pas sur mon PC avec le slash impeccable,
 * qu'elles utilisent d'office, tout le temps, peu importe le prompt, le skill
 * impeccable »*.
 *
 * Sur son PC il tape `/impeccable` lui-même ; depuis le téléphone, il ne le
 * fait pas. Le critère est donc le TÉLÉPHONE, et Claude Code le donne sans
 * deviner : `CLAUDE_CODE_ENTRYPOINT=remote_mobile`. Une session web ou une
 * session lancée sur son PC porte une autre valeur, et ce rappel s'y tait.
 *
 * **Pourquoi un rappel à chaque message, et pas une seule fois au démarrage :**
 * une longue conversation se résume, et le skill chargé au premier message
 * peut disparaître du contexte au bout de trois heures. Le rappel demande donc
 * de le charger « s'il n'est pas déjà chargé » : il ne le recharge pas à
 * chaque message, il le fait revenir quand il a disparu.
 *
 * Un déclencheur ne peut pas invoquer un skill lui-même ; il ajoute du
 * contexte, et c'est la session qui l'invoque. Comme les autres rappels, il ne
 * bloque rien et se tait au moindre doute.
 * ───────────────────────────────────────────────────────────────────────────
 */

/** La seule valeur qui désigne une session ouverte depuis l'appli du téléphone. */
export const DEPUIS_LE_TELEPHONE = "remote_mobile";

/** @param {Record<string, string | undefined>} [env] */
export function sessionDuTelephone(env = process.env) {
  return env.CLAUDE_CODE_ENTRYPOINT === DEPUIS_LE_TELEPHONE;
}

export const RAPPEL = [
  "Session ouverte depuis son TÉLÉPHONE. **Sa règle du 22 octobre 2026",
  "(`CLAUDE.md` §3 quater) : le skill impeccable s'emploie d'office, quel que",
  "soit le message.**",
  "",
  "Si le skill `impeccable:impeccable` n'est pas déjà chargé dans cette",
  "conversation, l'invoquer (outil Skill) AVANT toute autre action. S'il l'est",
  "déjà, ne pas le recharger.",
  "",
  "Il ne change pas le périmètre : rien n'est retouché à l'écran qui n'a pas",
  "été demandé (`CLAUDE.md` §0, point 5), et une demande d'apparence passe",
  "toujours par la maquette d'abord (§3 bis). S'il est absent de la session,",
  "le dire en une ligne et continuer.",
  "",
  "(Rappel automatique : ne pas y répondre, agir.)",
].join("\n");

async function main() {
  // Lire l'entrée même quand on se tait : le déclencheur doit la consommer
  // pour ne pas laisser le tuyau de Claude Code en attente.
  for await (const _morceau of process.stdin) void _morceau;
  if (!sessionDuTelephone()) return;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: RAPPEL,
      },
    })
  );
}

if (process.argv[1] && process.argv[1].endsWith("rappel-impeccable.mjs")) {
  main().catch(() => {
    // Muet, toujours : un rappel n'a pas le droit de faire échouer un message.
  });
}
