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
 * ─────────────────────────────────────────────────────────────────────────────
 * **La faute de la première version, trouvée par le patron sur son téléphone le
 * 11 août 2026 au soir :** *« la perle reste accolée en bas au numéro dix-huit. »*
 *
 * Elle faisait plonger la perle sur les `descenteEntiere` derniers pixels de
 * défilement — sans se demander s'il y en avait autant. Sur un écran haut, où
 * la liste ne défile presque plus, la plongée commençait donc **dès le premier
 * pixel** : la perle arrivait déjà tombée. Et quand la liste tenait entièrement
 * dans l'écran, une règle écrite ici l'envoyait carrément se coller au dernier
 * chantier. Mesuré : écran de 1100 px, 77 px à défiler, perle 148 px sous le
 * milieu alors qu'on était tout en haut.
 *
 * La leçon vaut plus que le correctif : **la suite de cas éprouvait cette règle
 * fausse et la trouvait juste**, parce qu'elle ne lui donnait jamais une liste
 * qui défile moins que la descente à faire. Un cas manquant ne rougit pas.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Toutes les grandeurs sont en pixels, dans le repère de l'écran (celui de
 * `getBoundingClientRect`), sauf les deux distances de défilement.
 */
export function descenteDeLaPerle({
  milieuDuDernier,
  milieuDuCadre,
  restantADefiler,
  hauteurADefiler,
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
  /**
   * Tout ce que la liste peut faire glisser, du haut au bas.
   *
   * C'est la grandeur qui manquait à la première version, et son absence a
   * envoyé la perle en bas de l'écran du patron : sans elle, impossible de
   * savoir si la liste a seulement assez de chemin pour porter la plongée.
   */
  hauteurADefiler: number;
}): number {
  // **La liste tient dans l'écran : il n'y a pas de bout à atteindre.** Rester
  // au milieu est alors la seule chose juste — la perle y désigne un chantier,
  // et rien ne se « termine ». Une version précédente la collait au dernier :
  // c'est le défaut que le patron a vu.
  //
  // Une exception, et une seule : si le dernier chantier est lui-même AU-DESSUS
  // du milieu (deux chantiers, un écran haut), le milieu ne montre plus rien.
  // La perle remonte alors le rejoindre — d'où le `min`, jamais un `max`.
  if (hauteurADefiler <= 0) return Math.min(0, milieuDuDernier - milieuDuCadre);

  // Où tombera le milieu du dernier chantier une fois la liste au bout : c'est
  // toute la descente à faire, et elle ne dépend pas de l'endroit où l'on se
  // trouve. La mesurer plutôt que l'écrire à la main, parce qu'elle dépend de
  // la marge de fin du fil, de la hauteur d'une ligne et de celle de l'écran.
  const descenteEntiere = milieuDuDernier - restantADefiler - milieuDuCadre;

  // Le dernier chantier monte jusqu'au milieu tout seul : la perle n'a nulle
  // part où descendre, et l'y forcer la ferait remonter — l'inverse de ce qui
  // est demandé.
  if (descenteEntiere <= 0) return 0;

  // **La plongée occupe les derniers pixels — au plus tout ce qu'on peut
  // défiler.** C'est ce `min` qui manquait. Quand la liste a du chemin, la perle
  // ne bouge pas tant qu'il en reste plus que de descente à faire ; quand elle
  // n'en a presque plus, la plongée s'étale sur ce peu de chemin au lieu de
  // commencer avant le départ.
  const plongee = Math.min(descenteEntiere, hauteurADefiler);
  const avancement = (plongee - restantADefiler) / plongee;

  // Borné des deux côtés : à zéro tant qu'on n'est pas entré dans la plongée, à
  // un au-delà du bout — `restantADefiler` passe sous zéro au rebond élastique
  // d'iOS, et sans borne la perle continuerait sous le dernier chantier.
  return descenteEntiere * Math.min(1, Math.max(0, avancement));
}
