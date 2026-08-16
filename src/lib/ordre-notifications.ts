/**
 * L'ordre des cartes de l'accueil — et la place que chaque sorte est sûre d'avoir.
 *
 * ─── CE QUE CETTE RÈGLE TIENT, ET POURQUOI ELLE EXISTE ──────────────────────
 *
 * L'accueil ne pose qu'un petit nombre de cartes ; le reste attend derrière
 * « N autres devis à regarder ». Deux sortes s'y disputent la place :
 *
 *   · les RAPPELS — un chantier sans devis, un devis sans réponse, un chantier
 *     fini pas facturé. Ils se fabriquent tout seuls, et ils s'accumulent tant
 *     que la situation dure ;
 *   · les RÉPONSES de clients — accepté, refusé, correction demandée, lien
 *     expiré. Ce sont des ÉVÉNEMENTS : quelqu'un a agi, et il attend.
 *
 * **Le patron a tranché deux fois, le 16 août 2026, sur photographies.**
 *
 * D'abord *« fait la B »* : les rappels passent DEVANT — ce qu'il doit faire
 * avant ce qu'on lui a répondu. Puis, la conséquence lui ayant été montrée en
 * image — trois chantiers sans devis suffisaient à masquer TOUTES les réponses
 * —, *« fait le »* pour la place garantie.
 *
 * **La raison, et elle vaut plus que la règle :** une sorte qui grossit toute
 * seule ne doit pas pouvoir enterrer une sorte rare et périssable. Un client
 * qui demande une correction attend une réaction ; un rappel, lui, attendra
 * demain sans que rien ne soit perdu.
 *
 * ─── CE QU'ELLE NE FAIT PAS ─────────────────────────────────────────────────
 *
 * Elle ne réserve rien quand il n'y a qu'une sorte à l'écran : sans réponse de
 * client, les rappels prennent toutes les places, et inversement. Réserver dans
 * le vide laisserait un trou là où il y a quelque chose à montrer.
 *
 * Pure et sans base : c'est ce qui permet à `scripts/test-ordre-notifications.ts`
 * de l'éprouver sur les cas limites qu'un écran ne produit qu'un jour sur cent.
 */

/**
 * Tresse les deux sortes pour que chacune se voie, sans changer qui vient en
 * premier.
 *
 * @param rappels   les rappels, dans leur ordre (le plus ancien d'abord)
 * @param reponses  les réponses de clients, dans leur ordre
 * @param visibles  combien de cartes l'accueil montre sans qu'on déplie
 */
export function ordonnerLesCartes<T>(rappels: T[], reponses: T[], visibles: number): T[] {
  // Une seule sorte : rien à garantir, et rien à déplacer.
  if (rappels.length === 0 || reponses.length === 0) return [...rappels, ...reponses];

  // **Au moins une place à chacun, et le RESTE aux rappels.** À deux places
  // visibles cela donne « un rappel, une réponse » ; à trois, « deux rappels,
  // une réponse » — son choix B est respecté à chaque fois, c'est la DERNIÈRE
  // place visible qui revient aux réponses.
  //
  // `Math.max(1, …)` couvre le cas d'un écran réglé à une seule carte : la
  // place garantie ne peut pas retirer au rappel la seule qu'il ait.
  const placesRappels = Math.max(1, Math.min(rappels.length, visibles - 1));
  const placesReponses = Math.max(0, visibles - placesRappels);

  return [
    ...rappels.slice(0, placesRappels),
    ...reponses.slice(0, placesReponses),
    ...rappels.slice(placesRappels),
    ...reponses.slice(placesReponses),
  ];
}
