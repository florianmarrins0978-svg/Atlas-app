"use client";

import { useEffect, useRef } from "react";
import { colors, libelleCaps, texteSituation } from "@/lib/design-tokens";
import type { Retrait } from "./useRetraits";

/**
 * Le tiroir des retirés — un par écran, entre le contenu et le bas de page.
 *
 * « Retiré à l'instant — Annuler ». Il tient la ligne le temps qu'on se ravise,
 * et c'est sa fermeture qui rend le retrait définitif.
 *
 * **Il pousse le contenu, il ne le recouvre pas.** Posé en `fixed` par-dessus
 * — ce que faisait `UndoToast` —, il masque la dernière ligne de la liste, qui
 * est précisément celle qu'on vient de toucher. Le même défaut est déjà arrivé
 * avec une pile de notifications, et il ne s'est vu que sur une capture.
 *
 * **« Annuler » vise le DERNIER retrait, jamais un autre.** Un libellé unique
 * pointant toujours la même ligne rendrait la première quand on retire la
 * deuxième : l'annulation supprimerait. Le tiroir reçoit donc le retrait lui-
 * même, identifiant compris, et son libellé accessible le nomme.
 */
export default function TiroirDesRetires({
  dernier,
  nombre,
  onAnnuler,
  className,
}: {
  /** Le dernier retrait en attente, ou `null` : le tiroir se referme. */
  dernier: Retrait | null;
  /** Combien attendent en tout — « Retiré » ou « Retirés ». */
  nombre: number;
  onAnnuler: () => void;
  className?: string;
}) {
  const ouvert = dernier !== null;

  // **« L'écran est vivant », et ce n'est pas décoratif.** Le HTML rendu par le
  // serveur porte déjà les boutons « Retirer » ; React ne leur attache ses
  // écouteurs qu'à l'hydratation, qui en développement arrive une seconde plus
  // tard. Une capture prise entre les deux clique dans le vide et accuse le
  // retrait d'être cassé — une heure perdue à chercher un défaut inexistant.
  // Cet attribut n'apparaît qu'APRÈS le premier effet : il ne peut donc pas
  // mentir, et `scripts/capture-retrait.mts` l'attend.
  // Posé sur le nœud lui-même, hors de l'état de React : c'est une marque de
  // diagnostic, elle n'a rien à faire dans un rendu — et un `setState` dans un
  // effet ferait rendre l'écran deux fois pour rien.
  const nœud = useRef<HTMLDivElement>(null);
  useEffect(() => {
    nœud.current?.setAttribute("data-atlas-vivant", "oui");
  }, []);

  return (
    <div
      ref={nœud}
      className={`atlas-tiroir mx-[26px] ${className ?? ""}`}
      data-ouvert={ouvert ? "oui" : "non"}
      style={{ borderTopColor: ouvert ? colors.line : "transparent" }}
      // Le retrait s'annonce à qui ne regarde pas l'écran. « polite » et non
      // « assertive » : cela ne doit pas couper la lecture en cours.
      aria-live="polite"
    >
      <span className={texteSituation} style={{ color: colors.muted }}>
        {nombre > 1 ? "Retirés à l'instant" : "Retiré à l'instant"}
      </span>
      <button
        type="button"
        onClick={onAnnuler}
        // Le libellé visible reste « Annuler » ; celui que lit un lecteur
        // d'écran nomme la ligne, sans quoi « Annuler » ne dit pas quoi.
        aria-label={dernier ? `Annuler le retrait de ${dernier.libelle}` : "Annuler le retrait"}
        // Hors du tiroir fermé, il ne doit pas être atteignable au clavier :
        // un bouton invisible dans l'ordre de tabulation est un piège.
        tabIndex={ouvert ? 0 : -1}
        // `-mr-2` : le retrait intérieur donne au doigt sa cible de 44 px, la
        // marge négative le reprend à l'affichage. Sans elle, « Annuler » se
        // décale de huit pixels vers l'intérieur et ne s'aligne plus sur la
        // marge de 26 px que tout l'écran respecte.
        className={`-mr-2 px-2 py-2 ${libelleCaps}`}
        style={{ color: colors.or, letterSpacing: "0.24em" }}
      >
        Annuler
      </button>
    </div>
  );
}
