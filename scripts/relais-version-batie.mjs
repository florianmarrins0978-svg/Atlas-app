// **La relève d'une version rapide par la suivante, sans passer par le lent.**
//
// ─────────────────────────────────────────────────────────────────────────────
// **Sa plainte du 31 août 2026 au soir — la huitième du même genre :**
// *« l'appli est lente, corrige ça »*, capture à l'appui, deux minutes après
// avoir rallumé son espace. Le bandeau disait « Version rapide en construction »
// et l'indicateur de Next.js disait « Compiling ». Rien n'était cassé : c'était
// le dessin.
//
// **Le dessin, justement.** Jusqu'ici, dès que le code changeait, `banc.mjs`
// repartait sur `next dev` le temps de bâtir. Or en mode développement un écran
// neuf met trente à cent secondes à s'ouvrir, et le relais de GitHub abandonne
// au bout d'une minute : pendant toute la construction, **il ne peut ouvrir
// aucun écran qu'il n'a pas déjà ouvert.** Ce coût était assumé comme « une
// gêne qui s'arrête » (`memoire-prechauffage.mjs`).
//
// **Elle ne s'arrêtait pas.** Six sessions poussent sur `main` dans la même
// soirée ; chacun de ses redémarrages tire du code neuf, donc rebâtit, donc le
// renvoie en mode lent. Et quand la construction échoue — mémoire trop juste,
// paquet absent, ce qui lui arrive souvent —, il y reste jusqu'au lendemain.
//
// **Ce qu'on change :** une version rapide déjà bâtie ne se jette plus. Elle
// sert pendant que la neuve se construit à côté, et la bascule est un échange
// de noms.
//
//   | | avant | après |
//   |---|---|---|
//   | pendant la construction | mode développement, rien ne s'ouvre | version d'avant, tout est immédiat |
//   | construction échouée | mode développement jusqu'au lendemain | version d'avant, jusqu'à la prochaine tentative |
//   | code servi | le neuf, inatteignable | **celui d'avant**, et l'écran le dit |
//
// **Le prix est dans la dernière ligne, et il est réel.** Pendant la
// construction il essaie le code d'AVANT. C'est le malentendu du 12 août 2026
// — « commit récupéré » contre « commit servi » —, qui a coûté deux heures.
// Trois choses le tiennent : le bandeau de l'écran le dit
// (`src/components/atlas/BandeauBanc.tsx`), la fiche de l'espace le dit, et la
// fenêtre dure une construction, pas une soirée. À comparer avec ce qu'on
// remplace : un mode où il voyait le code neuf sans pouvoir en ouvrir un écran.
//
// **Ici plutôt que dans `banc.mjs`, pour la raison habituelle** (`CLAUDE.md`
// §3) : une règle qui décide de ce que le patron a sous les yeux doit
// s'éprouver sans banc, sans serveur et sans construction.

/**
 * Que sert-on, et où bâtit-on ?
 *
 * @param {object} etat
 * @param {string | null} etat.raison Pourquoi il faut rebâtir, ou `null`.
 * @param {boolean} etat.versionDavantUtilisable Une version bâtie **complète**
 *   existe-t-elle ? On regarde `BUILD_ID`, jamais le dossier : `next build` crée
 *   sa destination dès la première seconde, et un dossier à demi rempli ne se
 *   sert pas.
 * @param {string} etat.dist Le dossier servi.
 * @param {string} etat.neuve Le dossier où bâtir quand on sert l'autre.
 */
export function quoiServir({ raison, versionDavantUtilisable, dist, neuve }) {
  // Rien à rebâtir : on sert la version bâtie, et il n'y a pas de chantier.
  if (!raison) {
    return { servirDavant: false, modeDeveloppement: false, dossierDeConstruction: dist };
  }
  // Il faut rebâtir et rien n'est bâti — le tout premier démarrage d'un espace.
  // On ne peut que servir le mode développement, comme avant ce correctif : il
  // n'y a pas de version d'avant à garder.
  if (!versionDavantUtilisable) {
    return { servirDavant: false, modeDeveloppement: true, dossierDeConstruction: dist };
  }
  // Le cas qui change tout : on garde l'ancienne en service, on bâtit à côté.
  return { servirDavant: true, modeDeveloppement: false, dossierDeConstruction: neuve };
}

/**
 * Échange la version bâtie servie contre celle qu'on vient de bâtir.
 *
 * **Deux renommages, et le second est rattrapable.** `next build` efface son
 * dossier de destination : bâtir dans celui qu'on sert retirerait le sol au
 * serveur en marche. La neuve se bâtit donc à côté, et la bascule est un
 * échange de noms — instantané, là où recopier 351 Mo prendrait sur son disque
 * les dizaines de secondes pendant lesquelles le veilleur lancerait un second
 * banc.
 *
 * **Ce qu'on garantit, et c'est le seul engagement qui compte :** on ne se
 * retrouve jamais sans version bâtie du fait de cette fonction. Si l'on ne peut
 * pas écarter l'ancienne, rien n'a bougé. Si l'on ne peut pas mettre la neuve
 * en place, on remet l'ancienne. Le pire cas reste « il garde sa version
 * d'avant » — jamais « il n'a plus d'application ».
 *
 * Les opérations de fichiers sont **injectées** : c'est ce qui permet
 * d'éprouver les deux chutes, qu'aucun disque ne produit sur commande.
 *
 * @returns {{ echange: boolean, motif: string | null }}
 */
export function echangerLesDossiers({ dist, neuve, vieille, renommer, effacer, effacerEnFond }) {
  try {
    effacer(vieille);
    renommer(dist, vieille);
  } catch (e) {
    return { echange: false, motif: `la version en service n'a pas pu être écartée (${message(e)})` };
  }
  try {
    renommer(neuve, dist);
  } catch (e) {
    const motif = `la version neuve n'a pas pu prendre la place (${message(e)})`;
    try {
      renommer(vieille, dist);
    } catch (e2) {
      // Le seul cas où il ne reste plus de version bâtie. L'appelant doit
      // alors repartir en mode développement : lent, mais vivant.
      return { echange: false, motif: `${motif}, et l'ancienne n'a pas pu revenir (${message(e2)})` };
    }
    return { echange: false, motif };
  }
  // **L'ancienne ne s'efface qu'APRÈS, et en fond.** 351 Mo à retirer sur son
  // disque bloqueraient la bascule pendant des dizaines de secondes, c'est-à-dire
  // la fenêtre exacte où le veilleur prend le banc pour mort et en lance un second.
  try {
    effacerEnFond(vieille);
  } catch {
    // Un dossier de trop n'est pas une panne : le prochain échange le retirera.
  }
  return { echange: true, motif: null };
}

const message = (e) => (e instanceof Error ? e.message : String(e));
