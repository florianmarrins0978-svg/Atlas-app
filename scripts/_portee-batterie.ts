/**
 * FAUT-IL VRAIMENT REJOUER LES 484 SUITES ?
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE CE FICHIER RÉPARE, ET IL A COÛTÉ UNE HEURE — 10 septembre 2026.**
 *
 * Sa phrase, à la fin : *« mais là tu faisais tourner une batterie pour pousser
 * quoi ? »*, puis *« tu viens de passer 1 h dessus »*. L'écran demandé avait
 * pris vingt minutes ; l'heure est partie dans **cinq batteries dont quatre
 * n'ont rien mesuré** — et les trois dernières ont été rejouées **en entier**
 * alors que, d'un tour à l'autre, seuls deux ou trois `scripts/test-*.ts`
 * avaient changé.
 *
 * **La règle existait déjà**, dans `CLAUDE.md` §6 : *« rejouer la batterie
 * SEULEMENT si le code arrivé touche ce qu'on vient de faire »*, avec un
 * tableau à dérouler à la main. Et c'est exactement le mode de défaillance que
 * ce dépôt connaît par cœur (`CLAUDE.md` §1 bis) : **une consigne en prose se
 * lit au début d'une conversation et s'oublie au bout de trois heures** — or
 * c'est au bout de trois heures qu'on relance une batterie de trop.
 *
 * Ce n'est donc plus un jugement à refaire : c'est une fonction pure, qui
 * répond, qu'on peut mettre en rouge, et que la batterie interroge avant de
 * partir pour vingt minutes.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE CETTE RÈGLE NE FAIT PAS, ET C'EST DÉLIBÉRÉ.** Elle ne rétrécit
 * jamais une batterie toute seule. Elle ne connaît que deux refus, et le doute
 * tranche **toujours** vers la batterie complète (`CLAUDE.md` §5) :
 *
 *   1. **rien n'a bougé** depuis le dernier verdict concluant — il n'y a
 *      littéralement rien de neuf à mesurer ;
 *   2. **seules des suites ont bougé** — on joue ces suites-là, pas les autres.
 *
 * Tout le reste — une ligne de `src/`, une migration, un fichier qu'on ne
 * reconnaît pas — vaut batterie complète. Un garde-fou qui parle à tort
 * s'apprend à être ignoré, et l'on perd la protection sans s'en apercevoir.
 */

/** Le verdict rendu à la batterie avant qu'elle ne parte pour vingt minutes. */
export type Portee =
  | { quoi: "complete"; pourquoi: string }
  | { quoi: "rien"; pourquoi: string }
  | { quoi: "suites"; pourquoi: string; suites: string[] };

/**
 * Le même chemin, écrit d'une seule façon.
 *
 * L'empreinte rend des chemins de la machine — `scripts\test-x.ts` sous
 * Windows. Ce qu'on en fait est une **commande à recopier** : une barre
 * inversée y est un caractère d'échappement, et la commande ne marche pas.
 * On normalise donc AVANT de comparer et avant d'écrire, jamais après.
 */
function chemin_(chemin: string): string {
  return chemin.split("\\").join("/");
}

/** Une suite, et rien d'autre : `scripts/test-…​.ts`, jouée telle quelle. */
function estUneSuite(chemin: string): boolean {
  return /^scripts\/test-[^/]+\.(ts|mts)$/.test(chemin_(chemin));
}

/**
 * Ce qui a bougé depuis le dernier verdict décide de ce qu'on rejoue.
 *
 * `remues` vient de `fichiersRemues` (`_batterie-solitaire.ts`) : les mêmes
 * chemins, la même façon de les comparer. **Une seconde façon de dire « ce
 * fichier a changé » finirait par diverger** (`CLAUDE.md` §3).
 */
export function porteeDuLot(remues: string[]): Portee {
  if (remues.length === 0) {
    return {
      quoi: "rien",
      pourquoi:
        "aucun fichier n'a bougé depuis le dernier verdict : la mesure rendrait le même résultat",
    };
  }

  const suites = remues.filter(estUneSuite);
  if (suites.length === remues.length) {
    return {
      quoi: "suites",
      pourquoi:
        suites.length === 1
          ? "une seule suite a changé, et rien d'autre"
          : `${suites.length} suites ont changé, et rien d'autre`,
      suites: suites.map(chemin_).sort(),
    };
  }

  const autres = remues.filter((f) => !estUneSuite(f));
  return {
    quoi: "complete",
    pourquoi:
      autres.length === 1
        ? `${autres[0]} a changé`
        : `${autres.length} fichiers hors des suites ont changé (dont ${autres.sort()[0]})`,
  };
}

/** Ce qu'on écrit à l'écran quand la batterie refuse de repartir pour rien. */
export function phraseDuRefusDePortee(portee: Portee, verdictPrecedent: string, quand: string): string {
  const entete =
    portee.quoi === "rien"
      ? "⛔ RIEN N'A BOUGÉ — cette batterie mesurerait deux fois la même chose."
      : "⛔ SEULES DES SUITES ONT CHANGÉ — les 484 autres diraient ce qu'elles viennent de dire.";

  const quoiFaire =
    portee.quoi === "suites"
      ? [
          "",
          "   Ce qu'il y a à jouer, et rien de plus :",
          ...portee.suites.map((s) => `     npx tsx ${s}`),
        ]
      : [];

  return [
    entete,
    `   ${portee.pourquoi}.`,
    "",
    `   Dernier verdict (${quand}) : ${verdictPrecedent}`,
    ...quoiFaire,
    "",
    "   Pour la jouer quand même : npm run verifier:avant-livraison -- --forcer",
    "   (une heure a été payée le 10 septembre 2026 à rejouer trois fois",
    "    vingt minutes pour trois fichiers de suites — voir _portee-batterie.ts)",
  ].join("\n");
}
