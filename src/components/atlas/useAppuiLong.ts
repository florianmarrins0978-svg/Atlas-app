"use client";

import { useRef } from "react";

/**
 * L'APPUI LONG — le geste qu'il a choisi le 1ᵉʳ septembre 2026.
 *
 * Il fallait pouvoir déplacer une ligne de devis d'une TVA à l'autre. Deux
 * chemins lui ont été proposés — un appui long, ou un bouton sur la ligne — et
 * il a répondu : *« un appui long »*. La planche
 * `appli/devis-tva-deplacer-ligne.html` a servi à l'essayer avant de le coder.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LES TROIS RÉGLAGES NE SONT PAS DÉCORATIFS, ET CHACUN ÉVITE UNE PANNE.
 *
 * **500 ms.** En dessous, un doigt qui hésite sur une ligne ouvre la feuille
 * sans l'avoir voulu — sur un écran où chaque ligne porte un prix, une feuille
 * qui s'ouvre toute seule fait craindre d'avoir cassé quelque chose. Au-dessus,
 * on croit que rien ne répond et l'on relâche avant.
 *
 * **10 px de tolérance.** Sans annulation au glissement, on ne pourrait plus
 * FAIRE DÉFILER la page en partant d'une ligne — et le tableau du devis occupe
 * presque tout l'écran. C'est la première chose qu'il aurait signalée.
 *
 * **Les champs de saisie sont épargnés.** Un appui long sur une zone de texte
 * appartient au téléphone : c'est ainsi qu'on sélectionne, copie, colle. Le lui
 * confisquer casserait la saisie du devis pour ajouter un geste — mauvais
 * échange. Le reste de la ligne (les intitulés de cellule, le montant, les
 * marges) porte le geste.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * **UN SEUL APPUI À LA FOIS, et c'est pourquoi ce n'est pas un hook par ligne.**
 * Un doigt ne peut pas appuyer longuement sur deux lignes ; l'état vit donc au
 * niveau de la liste, et `pour()` fabrique les gestionnaires de chaque ligne.
 * Un hook appelé dans une boucle aurait été interdit par React de toute façon —
 * et aurait laissé croire que deux appuis peuvent coexister.
 *
 * **`pointer*` et non `touch*`** : le même code sert le doigt, la souris et le
 * stylet, et les suites navigateur peuvent l'éprouver à la souris.
 */
export const DELAI_APPUI_LONG_MS = 500;
const TOLERANCE_PX = 10;

/** Ce qu'on répand sur l'élément qui doit répondre à l'appui long. */
export type LiensAppuiLong = {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onPointerLeave: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
};

export function useAppuiLong(): {
  pour: (
    action: () => void,
    options?: {
      /** Faux : le geste ne s'arme pas du tout (devis figé, une seule catégorie). */
      actif?: boolean;
      /** Prévenu au début et à la fin de l'appui, pour que la ligne se soulève. */
      onEtat?: (enCours: boolean) => void;
    }
  ) => LiensAppuiLong;
} {
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const depart = useRef<{ x: number; y: number } | null>(null);
  const finir = useRef<(() => void) | null>(null);

  const arreter = () => {
    if (minuteur.current !== null) {
      clearTimeout(minuteur.current);
      minuteur.current = null;
    }
    depart.current = null;
    finir.current?.();
    finir.current = null;
  };

  return {
    pour: (action, options) => {
      const actif = options?.actif ?? true;
      return {
        onPointerDown: (e: React.PointerEvent) => {
          if (!actif) return;
          // Le geste du téléphone reste au téléphone dans les champs de saisie.
          if ((e.target as HTMLElement).closest("input, textarea, button, a")) return;
          // Un second doigt ne relance pas un appui déjà en cours.
          arreter();
          depart.current = { x: e.clientX, y: e.clientY };
          options?.onEtat?.(true);
          finir.current = () => options?.onEtat?.(false);
          minuteur.current = setTimeout(() => {
            minuteur.current = null;
            depart.current = null;
            options?.onEtat?.(false);
            finir.current = null;
            action();
          }, DELAI_APPUI_LONG_MS);
        },
        onPointerMove: (e: React.PointerEvent) => {
          if (minuteur.current === null || depart.current === null) return;
          const d = Math.hypot(e.clientX - depart.current.x, e.clientY - depart.current.y);
          if (d > TOLERANCE_PX) arreter();
        },
        onPointerUp: arreter,
        onPointerCancel: arreter,
        onPointerLeave: arreter,
        // Sans cela, un appui long à la souris ouvre le menu du navigateur
        // par-dessus la feuille qu'on vient d'ouvrir.
        onContextMenu: (e: React.MouseEvent) => {
          if (actif) e.preventDefault();
        },
      };
    },
  };
}
