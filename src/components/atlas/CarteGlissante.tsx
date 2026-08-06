"use client";

import { useRef, useState, type ReactNode } from "react";
import { colors } from "@/lib/design-tokens";

/**
 * Une carte qu'on fait glisser vers la gauche pour découvrir une corbeille.
 *
 * Le patron, le 6 août 2026 : « je veux pouvoir le slider de la droite vers la
 * gauche et qu'une petite corbeille rouge s'affiche sur le côté, puis je clique
 * sur la corbeille rouge, ensuite il est supprimé ».
 *
 * **Deux gestes, jamais un.** Le glissement découvre, l'appui supprime. C'est
 * ce qui distingue ce mécanisme d'un bouton posé sur une carte : sur un
 * téléphone, dans une camionnette, avec des gants, un bouton de suppression
 * visible en permanence finit par être touché par accident.
 *
 * Deux prudences qui ne se voient pas mais se sentent :
 *
 * - le glissement ne s'engage qu'au-delà de 12 pixels **et** s'il est plus
 *   horizontal que vertical. Sans cela, faire défiler la liste ouvrirait des
 *   corbeilles en chemin ;
 * - un seuil de 40 pixels retient la carte ouverte ; en deçà, elle se referme.
 *   Un état intermédiaire laisserait une corbeille à moitié visible, donc à
 *   moitié touchable.
 *
 * Le contenu reste un lien ordinaire : ouvrir le chantier ne doit pas devenir
 * plus difficile parce qu'on peut aussi le supprimer.
 */
export default function CarteGlissante({
  children,
  onSupprimer,
  libelleSuppression,
  desactive,
}: {
  children: ReactNode;
  onSupprimer: () => void;
  /** Ce que lit une personne qui n'utilise pas ses yeux. */
  libelleSuppression: string;
  /** Une facture émise ne se supprime pas : la carte ne glisse alors pas. */
  desactive?: boolean;
}) {
  const [decalage, setDecalage] = useState(0);
  const [ouverte, setOuverte] = useState(false);
  // Le doigt est-il posé ? En état plutôt qu'en référence : l'affichage en
  // dépend (l'animation est coupée pendant le geste), et React interdit de lire
  // une référence au moment du rendu — à raison, elle ne le déclencherait pas.
  const [glisse, setGlisse] = useState(false);
  const depart = useRef<{ x: number; y: number } | null>(null);
  const horizontal = useRef<boolean | null>(null);

  const LARGEUR_CORBEILLE = 76;
  const SEUIL_OUVERTURE = 40;

  function onTouchStart(e: React.TouchEvent) {
    if (desactive) return;
    const t = e.touches[0];
    depart.current = { x: t.clientX, y: t.clientY };
    horizontal.current = null;
    setGlisse(true);
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!depart.current || desactive) return;
    const t = e.touches[0];
    const dx = t.clientX - depart.current.x;
    const dy = t.clientY - depart.current.y;

    // La direction se décide une fois, au premier mouvement franc : sans cela,
    // un défilement vertical un peu oblique ouvrirait la corbeille.
    if (horizontal.current === null) {
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
      horizontal.current = Math.abs(dx) > Math.abs(dy);
    }
    if (!horizontal.current) return;

    // Vers la gauche seulement, et jamais au-delà de la corbeille : une carte
    // qui part hors de l'écran donne l'impression qu'on a cassé quelque chose.
    const suivant = Math.min(0, Math.max(-LARGEUR_CORBEILLE, (ouverte ? -LARGEUR_CORBEILLE : 0) + dx));
    setDecalage(suivant);
  }

  function onTouchEnd() {
    if (!depart.current || desactive) return;
    depart.current = null;
    setGlisse(false);
    const doitOuvrir = decalage <= -SEUIL_OUVERTURE;
    setOuverte(doitOuvrir);
    setDecalage(doitOuvrir ? -LARGEUR_CORBEILLE : 0);
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* La corbeille vit SOUS la carte : elle se découvre, elle n'apparaît
          pas par-dessus — c'est ce qui rend le geste lisible. */}
      <button
        type="button"
        aria-label={libelleSuppression}
        onClick={onSupprimer}
        className="absolute inset-y-0 right-0 flex items-center justify-center"
        style={{ width: LARGEUR_CORBEILLE, backgroundColor: colors.alert, color: "#FFFFFF" }}
        tabIndex={ouverte ? 0 : -1}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translateX(${decalage}px)`,
          // Suit le doigt sans inertie pendant le geste, et se replace en
          // douceur quand il le quitte.
          transition: glisse ? "none" : "transform 160ms ease-out",
          backgroundColor: colors.card,
        }}
        className="relative rounded-2xl"
      >
        {children}
      </div>
    </div>
  );
}
