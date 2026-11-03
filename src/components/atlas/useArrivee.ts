"use client";

import { useCallback, useEffect, useRef } from "react";
import { colors, voile } from "@/lib/design-tokens";

/**
 * CE QUI VIENT D'ÊTRE AJOUTÉ S'ÉCLAIRE UN INSTANT — la planche du devis,
 * validée le 1er novembre 2026 (`appli/soignee/chantier.html?ecran=devis`) :
 * *« Ce qui vient d'être ajouté s'éclaire un instant dans le devis : on le voit
 * arriver. »* La feuille se ferme, et ce qu'elle a posé peut être deux écrans
 * plus bas : sans ce signe, rien ne dit que l'appui a servi.
 *
 * L'écran pose `data-arrivee` sur ce qui peut arriver, puis annonce ce qu'il
 * attend (`annoncer("ligne:…")`) dans le geste qui le crée. L'éclairage part au
 * premier rendu où le repère existe : une ligne n'est dans la page qu'une fois
 * que le serveur a répondu et que React l'a peinte.
 *
 * **Par le navigateur (`animate`), pas par une feuille de style** : rien dans
 * `globals.css`, et l'animation ne touche à aucun style que l'écran pose
 * lui-même (le fond d'une ligne saisie, ses transitions).
 */
const ATTRIBUT_ARRIVEE = "data-arrivee";

/** Le repère à poser sur ce qui peut arriver : `<div {...arrivee("remise")}>`. */
export function arrivee(cle: string) {
  return { [ATTRIBUT_ARRIVEE]: cle };
}

/** La durée de la planche (`.vient-d-arriver`, 1,8 s). */
const DUREE_MS = 1800;

/**
 * Au-delà, l'annonce tombe sans rien éclairer : un ajout refusé par le serveur
 * ne doit pas allumer, au rendu suivant, un bloc qui existait déjà.
 */
const PATIENCE_MS = 4000;

export function useArrivee(): (...cles: string[]) => void {
  const attendus = useRef<{ cles: readonly string[]; jusqua: number } | null>(null);

  // Après chaque rendu, et c'est voulu : celui qui peint la ligne n'est pas
  // forcément celui qui suit l'annonce.
  useEffect(() => {
    const a = attendus.current;
    if (!a) return;
    if (Date.now() > a.jusqua) {
      attendus.current = null;
      return;
    }
    const arrives = a.cles.flatMap((cle) => {
      const el = document.querySelector<HTMLElement>(`[${ATTRIBUT_ARRIVEE}="${CSS.escape(cle)}"]`);
      return el ? [el] : [];
    });
    if (arrives.length === 0) return;
    attendus.current = null;
    eclairer(arrives);
  });

  return useCallback((...cles: string[]) => {
    attendus.current = { cles, jusqua: Date.now() + PATIENCE_MS };
  }, []);
}

function eclairer(elements: HTMLElement[]) {
  // Le premier dans la page, pas le premier annoncé : la répartition rend ses
  // lignes dans l'ordre du serveur.
  const dansLOrdre = [...elements].sort((x, y) =>
    x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
  );
  const calme = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  dansLOrdre[0].scrollIntoView({ block: "center", behavior: calme ? "auto" : "smooth" });
  // Qui a demandé moins de mouvement voit la ligne amenée sous ses yeux, sans
  // l'éclat qui s'efface (la planche fait de même).
  if (calme) return;
  for (const el of dansLOrdre) {
    el.animate(
      [
        { backgroundColor: dorePale(el), borderRadius: "6px" },
        { backgroundColor: "transparent", borderRadius: "6px" },
      ],
      { duration: DUREE_MS, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" }
    );
  }
}

/**
 * Le doré pâle de la charte posée, CALCULÉ avant d'être animé. Un `var()` dans
 * une clé d'animation n'est pas lu par tous les moteurs ; la couleur que le
 * navigateur a déjà résolue l'est partout, Nuit et Sylve comprises.
 */
function dorePale(el: HTMLElement): string {
  const avant = el.style.outlineColor;
  el.style.outlineColor = voile(colors.or, 0.26);
  const calcule = getComputedStyle(el).outlineColor;
  el.style.outlineColor = avant;
  return calcule;
}
