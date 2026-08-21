/**
 * Quelle version l'application EXÉCUTE — et non celle qui dort sur le disque.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Le patron, le 21 août 2026 :** *« Ça n'a pas marché, j'ai encore l'ancienne
 * version. Pourtant j'ai rechargé les mises à jour. »*
 *
 * Il avait raison sur les deux points, et c'est ce qui rend le défaut méchant :
 * la mise à jour avait bien eu lieu, ET son écran affichait bien l'ancienne
 * application. Les deux à la fois.
 *
 * **La cause.** `versionExecutee` lisait le DÉPÔT — `git log -1` dans le
 * dossier. Or son banc, une fois qu'il a réussi à construire, sert une version
 * **bâtie** : du code figé au moment de la construction. Récupérer du code neuf
 * fait avancer le dépôt sans toucher à ce qui tourne. La ligne « Version »
 * annonçait donc le commit du jour pendant que les écrans servis dataient de la
 * veille.
 *
 * **Pourquoi c'est plus grave qu'un simple affichage faux.** Cette ligne existe
 * précisément pour répondre à la question « qu'est-ce que j'exécute ? » sans
 * qu'on ait à la lui poser (`CLAUDE.md` §6). Elle répondait à une autre
 * question — « qu'est-ce qui est sur le disque ? » — et les deux réponses ne
 * divergent QUE dans le cas où on l'interroge. Un contrôle qui ment pile au
 * moment où on s'en sert coûte plus cher que pas de contrôle du tout : il a
 * envoyé chercher la panne du côté de la livraison, qui était irréprochable.
 *
 * ── CE QUE CETTE RÈGLE SAIT, ET CE QU'ELLE REFUSE DE DEVINER ────────────────
 *
 * Deux façons de servir, deux vérités différentes :
 *
 * - **En développement** (`next dev`), chaque écran se recompile depuis les
 *   fichiers à l'ouverture : le dépôt EST ce qui s'exécute. Sa version est donc
 *   la bonne, et du code neuf apparaît tout seul au rechargement.
 * - **En version bâtie** (`next start`), le code servi a été figé au démarrage.
 *   Seule la marque posée à ce moment-là dit la vérité — et si le dépôt a
 *   avancé depuis, **il faut le dire**, pas le taire ni le confondre.
 *
 * On ne compare que ce qui est comparable : les deux marques sont écrites par
 * le même format (`%cd · %h · branche`), l'une par `demarrer.sh`, l'autre par
 * `version-executee.ts`. Les faire diverger, c'est rendre cette règle aveugle.
 */

export type EtatDesVersions = {
  /** Ce que le dépôt porte sur le disque, à l'instant. `null` s'il est muet. */
  duDepot: string | null;
  /**
   * La marque posée au démarrage du serveur (`ATLAS_VERSION`), c'est-à-dire la
   * version avec laquelle il a été bâti. `null` hors du banc.
   */
  duDemarrage: string | null;
  /**
   * Le serveur sert-il une version BÂTIE ? En développement, non : il compile à
   * la demande, et le dépôt fait foi.
   */
  versionBatie: boolean;
};

export type VersionServie = {
  /** Ce que l'écran annonce. `null` quand rien n'est connu. */
  ligne: string | null;
  /**
   * Du code neuf attend-il une reconstruction ?
   *
   * Quand c'est vrai, l'écran doit le DIRE : c'est exactement la situation où
   * le patron croit essayer la nouvelle version et essaie l'ancienne.
   */
  enRetard: boolean;
  /** Le code qui attend, pour pouvoir le nommer. `null` s'il n'y en a pas. */
  enAttente: string | null;
};

export function versionServie(etat: EtatDesVersions): VersionServie {
  const { duDepot, duDemarrage, versionBatie } = etat;

  // Le dépôt est ce qui s'exécute : rien ne peut être en retard sur lui-même.
  if (!versionBatie) {
    return { ligne: duDepot ?? duDemarrage, enRetard: false, enAttente: null };
  }

  // Bâtie, mais sans marque de démarrage : on ne sait pas avec quoi elle a été
  // bâtie. **On ne prétend pas le savoir** — le dépôt est alors le seul chiffre
  // disponible, et l'annoncer sans promettre qu'il est exécuté vaut mieux que
  // « inconnue », qui n'aide personne.
  if (!duDemarrage) {
    return { ligne: duDepot, enRetard: false, enAttente: null };
  }

  // Le cas qui l'a fait perdre une soirée : le disque a avancé, pas le serveur.
  if (duDepot && duDepot !== duDemarrage) {
    return { ligne: duDemarrage, enRetard: true, enAttente: duDepot };
  }

  return { ligne: duDemarrage, enRetard: false, enAttente: null };
}
