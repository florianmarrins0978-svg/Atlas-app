#!/usr/bin/env node
/**
 * « Ça ne marche pas » : rappeler d'ALLER REGARDER, avant de supposer.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sa demande, le 12 août 2026 :** *« Il faudrait que si j'écris ça ne marche
 * pas, d'elle-même elle aille regarder la fiche. »*
 *
 * La consigne existait déjà en toutes lettres dans `CLAUDE.md` §1 bis. Mais une
 * consigne en prose se lit au début d'une conversation et s'oublie au bout de
 * trois heures — et c'est précisément au bout de trois heures qu'il signale une
 * panne. Ce déclencheur la remet sous les yeux **au moment exact où elle sert**,
 * dans chacune de ses trois ou quatre sessions, sans qu'aucune n'ait rien à
 * retenir.
 *
 * Ce qu'il a coûté de ne pas l'avoir : la nuit du 11 au 12 août, quatre
 * allers-retours à formuler des hypothèses sur une machine qu'on ne voyait pas —
 * un service de transcription absent, une mauvaise branche, un mot de passe.
 * **Toutes fausses.** Pendant ce temps sa machine savait tout, et c'est lui qui
 * recopiait des terminaux depuis un téléphone.
 *
 * **Il n'interdit rien et ne bloque rien** : il ajoute du contexte. Une session
 * qui a déjà lu la fiche n'en souffre pas ; une session qui allait deviner s'en
 * trouve arrêtée. En cas de doute, il se tait — un déclencheur qui parle à tort
 * finit par être ignoré, et c'est ainsi qu'on perd un garde-fou.
 * ───────────────────────────────────────────────────────────────────────────
 */

/**
 * Sans accents, sans casse, sans espaces en trop : le patron dicte, et la
 * dictée ponctue au hasard. Un « ça  ne marche pas » à deux espaces — vu en
 * vrai — raterait une comparaison littérale, et le rappel se tairait au seul
 * moment où il sert.
 */
function aplatir(texte) {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Les tournures par lesquelles il signale une panne.
 *
 * **Choisies pour ce qu'elles ont de commun : elles CONSTATENT sans expliquer.**
 * C'est exactement le moment où l'on est tenté de deviner. On évite en revanche
 * les mots trop larges (« erreur », « problème ») : ils apparaissent dans des
 * demandes ordinaires, et un rappel qui se déclenche à tort s'apprend à être
 * ignoré — on aurait alors perdu le garde-fou pour de bon.
 */
const TOURNURES = [
  "ca ne marche pas",
  "ca marche pas",
  "ca ne fonctionne pas",
  "ca fonctionne pas",
  "ne fonctionne toujours pas",
  "marche toujours pas",
  "ca ne marche toujours pas",
  "ca plante",
  "ca bug",
  "ca bugue",
  "j'arrive pas",
  "je n'arrive pas",
  "arrive pas a me connecter",
  "peux pas me connecter",
  "impossible de me connecter",
  "ca s'affiche pas",
  "ca ne s'affiche pas",
  "rien ne se passe",
  "l'appli est cassee",
  "appli cassee",
];

export function signaleUnePanne(prompt) {
  const plat = aplatir(String(prompt ?? ""));
  return TOURNURES.some((t) => plat.includes(t));
}

export const RAPPEL = [
  "Le patron signale une panne. **Avant toute hypothèse, et avant de lui faire",
  "taper quoi que ce soit :**",
  "",
  "1. **Lire la fiche d'état de son espace** — son espace de travail la publie",
  "   tout seul, à l'allumage puis tous les quarts d'heure. Titre exact dans",
  "   `TITRE_FICHE` (`scripts/rapporter-espace.mjs`) ; elle se lit avec les",
  "   outils GitHub du dépôt. Elle porte le commit récupéré, le commit",
  "   réellement SERVI, l'état des services et la fin du journal de démarrage.",
  "2. **Regarder sa date en premier.** Périmée, elle ment comme une",
  "   documentation périmée — on s'y fie encore.",
  "3. N'avancer une hypothèse qu'ensuite, et la dire comme telle.",
  "4. Si un geste sur SA machine est nécessaire, lui faire lancer `claude` dans",
  "   son espace plutôt que de lui dicter dix commandes depuis un téléphone.",
  "",
  "Pourquoi cette consigne existe : dans la nuit du 11 au 12 août 2026, quatre",
  "allers-retours ont été perdus à supposer — service absent, mauvaise branche,",
  "mot de passe — **toutes fausses**, pendant que sa machine savait tout.",
  "",
  "(`CLAUDE.md` §1 bis. Rappel automatique : ne pas y répondre, agir.)",
].join("\n");

async function main() {
  // Le contrat du déclencheur : du JSON sur l'entrée standard. S'il manque ou
  // s'il est illisible, on se tait — un rappel n'a pas le droit de gêner une
  // conversation, encore moins de la faire échouer.
  let entree = "";
  for await (const morceau of process.stdin) entree += morceau;

  let prompt = "";
  try {
    prompt = JSON.parse(entree).prompt ?? "";
  } catch {
    return;
  }
  if (!signaleUnePanne(prompt)) return;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: RAPPEL,
      },
    })
  );
}

if (process.argv[1] && process.argv[1].endsWith("rappel-panne.mjs")) {
  main().catch(() => {
    // Muet, toujours : voir plus haut.
  });
}
