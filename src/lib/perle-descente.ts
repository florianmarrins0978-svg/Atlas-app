/**
 * De combien la perle quitte le milieu pour aller se poser sur le dernier jour.
 *
 * **La règle, dans les mots du patron (11 août 2026) :** *« Il faut qu'elle
 * reste à chaque fois au milieu tout le temps. Si on décide de descendre, elle
 * suit à chaque fois les jours en restant au milieu. Et par contre, quand on
 * arrive au dernier, là, elle descend et elle se met en face du dernier jour. »*
 *
 * **Pourquoi ce n'est PAS du CSS, alors que tout le reste de la perle l'est.**
 * `position: sticky` ne sait clouer un élément que d'un côté : il le pousse vers
 * le bas jusqu'au point d'accroche, jamais au-delà. Or ici, sur les derniers
 * pixels de défilement, la perle doit descendre PENDANT que le contenu monte —
 * les deux vont en sens contraire, et aucune accroche ne fait cela. Trois
 * montages ont été essayés avant de le reconnaître (perle en dernier enfant,
 * accroche par le bas, conteneur raccourci) : tous ramènent la perle au milieu
 * ou au-dessus, jamais en dessous. La descente se calcule donc.
 *
 * Elle vit ici, en fonction pure, parce que ses cas limites ne s'atteignent pas
 * en faisant glisser un écran de démonstration : une liste trop courte pour
 * défiler, une liste dont le dernier chantier atteint le milieu tout seul, le
 * tout premier pixel de la descente. Un écran ne décide de rien : il mesure et
 * il applique.
 *
 * Toutes les grandeurs sont en pixels, dans le repère de l'écran (celui de
 * `getBoundingClientRect`), sauf `restantADefiler` qui est une distance.
 */
export function descenteDeLaPerle({
  milieuDuDernier,
  milieuDuCadre,
  restantADefiler,
}: {
  /**
   * Où se trouve, maintenant, le MILIEU de la dernière ligne.
   *
   * Le milieu, et pas la rangée du nom : partout ailleurs, le point d'accroche
   * de la liste centre la ligne dans le cadre, et la perle — qui se tient au
   * milieu du cadre — tombe donc au milieu de la ligne. Viser autre chose sur
   * la dernière la ferait se poser deux centimètres plus haut que sur toutes
   * les autres, ce qui se lit comme un décalage et non comme une intention.
   */
  milieuDuDernier: number;
  /** Où la perle se tient au repos : le milieu du cadre qui défile. */
  milieuDuCadre: number;
  /** Ce qu'il reste à faire glisser avant le bout de la liste. */
  restantADefiler: number;
}): number {
  // Rien à défiler : il n'y aura pas de « moment où l'on arrive au bout », il y
  // est déjà. La perle rejoint le dernier jour tout de suite — c'est le cas
  // d'un artisan qui n'a qu'un ou deux chantiers, et sur lequel la perle
  // resterait sinon plantée au milieu, à désigner du vide.
  if (restantADefiler <= 0) return milieuDuDernier - milieuDuCadre;

  // Où tombera le milieu du dernier chantier une fois la liste au bout : c'est
  // toute la descente à faire, et elle ne dépend pas de l'endroit où l'on se
  // trouve. La mesurer plutôt que l'écrire à la main, parce qu'elle dépend de
  // la marge de fin du fil, de la hauteur d'une ligne et de celle de l'écran.
  const descenteEntiere = milieuDuDernier - restantADefiler - milieuDuCadre;

  // Le dernier chantier monte jusqu'au milieu tout seul : la perle n'a nulle
  // part où descendre, et l'y forcer la ferait remonter — l'inverse de ce qui
  // est demandé.
  if (descenteEntiere <= 0) return 0;

  // Le cœur : la perle ne bouge pas tant qu'il reste plus de chemin que de
  // descente à faire. Sur les derniers pixels, elle plonge d'autant que le
  // défilement se rapproche du bout, et arrive pile sur le dernier jour.
  return Math.max(0, descenteEntiere - restantADefiler);
}
