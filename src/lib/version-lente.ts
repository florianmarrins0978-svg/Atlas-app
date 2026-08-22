/**
 * Ce que le panneau « version lente » a le droit de promettre.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Le 20 août 2026 au soir.** Le patron : *« L'application est lente,
 * corrige ça. »* Puis, en regardant l'écran Réglages : *« Si il y a marqué
 * version lente. »* — c'était donc exact, et l'application le lui disait déjà.
 *
 * Sauf que la phrase se terminait ainsi : *« La version rapide prend le relais
 * dès que la construction aboutit. »* **Cette nuit-là, elle n'aboutissait pas,
 * et n'allait jamais aboutir** : sa fiche d'état n'était plus écrite depuis une
 * heure, ce qui ne peut vouloir dire qu'une chose — le veilleur était tombé
 * (`.devcontainer/veiller.sh` : le publieur meurt avec lui). Or c'est le
 * veilleur qui construit la version rapide. Personne ne construisait plus rien.
 *
 * **Le panneau lui demandait donc d'attendre quelque chose qui n'arriverait
 * pas.** C'est la faute que ce dépôt paie le plus cher : un message qui envoie
 * chercher au mauvais endroit coûte plus qu'un message absent (`CLAUDE.md` §5).
 * Il a attendu, puis il a redemandé.
 *
 * **Ici plutôt que dans l'écran**, pour la raison habituelle : une règle qui
 * décide de ce qu'on promet au patron doit s'éprouver sans banc, sans serveur
 * et sans base (`CLAUDE.md` §3).
 */

export type EtatVersionLente = {
  /**
   * Un veilleur vit-il ? **C'est lui qui construit la version rapide.** Sans
   * lui, le banc reste en version lente pour toujours, sans que rien ne bouge.
   */
  veilleurPresent: boolean;
  /** Une construction a échoué, et son témoin est encore là. */
  constructionEchouee: boolean;
};

export type PanneauVersionLente = {
  /** Ce qui est écrit sous « version lente ». */
  phrase: string;
  /**
   * Y a-t-il un geste à faire de sa part ?
   *
   * `false` veut dire « attendez, ça vient tout seul » — et cela ne se dit que
   * lorsque quelqu'un travaille vraiment à la version rapide.
   */
  gesteAttendu: boolean;
};

const CHAQUE_ECRAN =
  "Chaque écran peut mettre jusqu'à une minute la première fois, et l'adresse de GitHub " +
  "abandonne avant — c'est ce qui fait apparaître « une réponse inattendue du serveur ». ";

export function panneauVersionLente(etat: EtatVersionLente): PanneauVersionLente {
  // **Le cas de sa soirée du 20 août, et le seul qui appelle un geste.** Sans
  // veilleur, la construction ne reprendra pas d'elle-même : promettre le
  // contraire le fait attendre pour rien.
  if (!etat.veilleurPresent) {
    return {
      gesteAttendu: true,
      phrase:
        CHAQUE_ECRAN +
        "Et personne ne construit la version rapide en ce moment : elle n'arrivera pas " +
        "toute seule. Éteignez puis rouvrez votre espace de travail — il se reconstruit " +
        "au démarrage.",
    };
  }

  // Le veilleur est là et la dernière tentative est tombée : il retente seul —
  // trois fois à dix minutes, puis une fois par demi-heure (`veiller.sh`). On
  // ne l'envoie donc pas rallumer, mais on ne lui cache pas que c'est long.
  if (etat.constructionEchouee) {
    return {
      gesteAttendu: false,
      phrase:
        CHAQUE_ECRAN +
        "La dernière construction a échoué ; elle est retentée toute seule, mais cela peut " +
        "prendre une demi-heure. Rallumer l'espace de travail répare plus vite.",
    };
  }

  return {
    gesteAttendu: false,
    phrase: CHAQUE_ECRAN + "La version rapide prend le relais dès que la construction aboutit.",
  };
}
