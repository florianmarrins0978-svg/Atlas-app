"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * **Garder sous le doigt la ligne qu'on vient de toucher.**
 *
 * *Son défaut du 22 août 2026, capture à l'appui :* « lorsque le client se
 * trouve sur la partie haute de l'écran […] et que je clique dessus, le client
 * remonte et la fiche chantier aussi. […] tout remonte d'un bloc et je suis
 * perdu, je ne sais plus où est mon client. Il disparaît sous mes yeux. »
 *
 * **Ce n'est pas un défilement, et c'est ce qui rend le défaut sournois.**
 * Personne n'appelle `scrollTo`. Ouvrir une fiche en REFERME une autre — c'est
 * la règle du 22 août, « le même nom referme ce qu'il a ouvert » —, et quand la
 * fiche refermée se trouvait PLUS HAUT dans la page, tout ce qui suit remonte
 * de sa hauteur. La ligne touchée passe alors au-dessus du bord de l'écran,
 * pendant que le doigt est encore dessus.
 *
 * **Le navigateur ne le rattrape pas.** Les navigateurs savent ancrer le
 * défilement (`overflow-anchor`), mais Safari ne l'implémente pas — et c'est
 * Safari qu'il a dans la main. Il faut donc le faire nous-mêmes.
 *
 * **Comment : on mesure avant, on rattrape après.** La position de la ligne
 * dans la fenêtre est relevée au moment du geste, puis restaurée une fois que
 * React a repeint — `useLayoutEffect`, jamais `useEffect` : le second s'exécute
 * après que le navigateur a peint, et l'on verrait alors la page sauter puis
 * revenir.
 *
 * **Ce que ça ne fait pas :** amener une ligne à l'écran quand elle n'y est
 * pas. Ce n'est pas son besoin — il touche ce qu'il voit — et un défilement de
 * confort par-dessus le sien lui reprendrait la main.
 */
export function useAncrageDuGeste() {
  const cible = useRef<{ element: HTMLElement; haut: number } | null>(null);

  useLayoutEffect(() => {
    const ancre = cible.current;
    cible.current = null;
    if (!ancre || !ancre.element.isConnected) return;

    const ecart = ancre.element.getBoundingClientRect().top - ancre.haut;
    // Un demi-pixel d'écart vient de l'arrondi du rendu, pas d'un saut : le
    // rattraper ferait vibrer la page à chaque geste.
    if (Math.abs(ecart) < 1) return;
    window.scrollBy({ top: ecart, behavior: "instant" as ScrollBehavior });
  });

  /**
   * À appeler DANS le gestionnaire, avant de changer l'état.
   *
   * L'élément passé est celui qui doit rester immobile — la ligne du chantier,
   * pas la fiche qui s'ouvre en dessous : c'est le nom du client qu'il cherche
   * des yeux.
   */
  return function ancrer(element: HTMLElement | null) {
    if (!element) return;
    cible.current = { element, haut: element.getBoundingClientRect().top };
  };
}
