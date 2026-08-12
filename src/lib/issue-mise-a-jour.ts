/**
 * Ce qu'on annonce au patron après avoir tiré du code neuf — et s'il faut
 * couper le serveur pour que ce code soit réellement servi.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **La panne qu'il répare, vécue le 11 août 2026 :** *« j'ai relancé le banc,
 * j'ai essayé, ça ne marche pas »*. Le code neuf était bien tiré, la ligne
 * Version affichait le commit neuf — et l'écran servi restait l'ancien.
 *
 * La cause tient en une phrase : **`next start` sert un dossier BÂTI, figé à la
 * seconde de sa construction.** Tirer du code sous ses pieds n'y change rien.
 * Or le message disait « rechargez la page, l'application se recompile » — vrai
 * en développement, faux sur la version rapide, et il pouvait le recharger
 * cent fois.
 *
 * C'est la troisième fois que ce dépôt paie le même malentendu : *le produit
 * paraît cassé alors qu'il est simplement vieux*. Les deux premières ont donné
 * la ligne Version, puis le bouton « Chercher les dernières corrections ».
 * Celle-ci donne ceci.
 *
 * **Ici plutôt que dans l'action serveur**, parce qu'une règle qui décide de
 * couper le serveur du patron doit pouvoir être éprouvée sans base, sans
 * serveur et sans banc (`CLAUDE.md` §3).
 */
export type EtatApresMiseAJour = {
  /** La version servie est-elle une version BÂTIE (`next start`) ? */
  versionBatie: boolean;
  /** Un veilleur vit-il, prêt à relever le serveur qu'on couperait ? */
  veilleurPresent: boolean;
  /** « · 11/08 21:30 · c35be23 », ou vide si le dépôt ne répond pas. */
  suffixeVersion: string;
};

export type IssueMiseAJour = {
  message: string;
  /**
   * Faut-il couper le serveur pour que le code neuf soit servi ?
   *
   * **Jamais sans veilleur.** Couper reviendrait alors à éteindre
   * l'application du patron pour lui livrer un correctif : le remède serait
   * pire que le mal, et il resterait devant un écran mort.
   */
  couperLeServeur: boolean;
};

export function issueApresMiseAJour(etat: EtatApresMiseAJour): IssueMiseAJour {
  const { versionBatie, veilleurPresent, suffixeVersion } = etat;

  // Développement : le serveur recompile de lui-même à chaque fichier changé.
  // La phrase d'origine était donc exacte, et elle reste.
  if (!versionBatie) {
    return {
      couperLeServeur: false,
      message: `Mise à jour récupérée${suffixeVersion}. Rechargez la page dans quelques secondes : l'application se recompile.`,
    };
  }

  // Version bâtie, personne pour relever le serveur : on ne coupe pas, et on
  // dit exactement ce qu'il reste à faire. Une demi-vérité ici renverrait le
  // patron recharger une page qui ne changera jamais.
  if (!veilleurPresent) {
    return {
      couperLeServeur: false,
      message:
        `Code récupéré${suffixeVersion}, mais la version en cours d'exécution a été construite ` +
        `avant : elle ne changera pas toute seule. Arrêtez puis rouvrez l'espace de travail — ` +
        `il se reconstruira au démarrage.`,
    };
  }

  return {
    couperLeServeur: true,
    message:
      `Mise à jour récupérée${suffixeVersion}. L'application se reconstruit : elle sera ` +
      `injoignable une ou deux minutes, puis reviendra d'elle-même avec le code neuf.`,
  };
}
