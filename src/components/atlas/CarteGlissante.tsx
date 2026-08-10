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
 * ---
 *
 * **Repris le 7 août 2026 : « fais-moi quelque chose de plus esthétique et
 * plus fluide que ce que tu as fait pour planifier ».**
 *
 * La première version fonctionnait et se sentait raide. Quatre choses lui
 * manquaient, et chacune se remarque au doigt bien avant de se voir :
 *
 * 1. **L'élan.** Un geste vif et court n'ouvrait rien : seule comptait la
 *    distance parcourue. Or c'est ainsi qu'on balaye une liste sur un
 *    téléphone — d'une chiquenaude, pas d'un trait mesuré. La vitesse décide
 *    désormais autant que la distance.
 * 2. **La résistance.** Au-delà de la corbeille, la carte s'arrêtait net,
 *    comme si elle avait heurté un mur. Elle continue maintenant de suivre le
 *    doigt en freinant — c'est ce qui donne l'impression d'une matière plutôt
 *    que d'un curseur.
 * 3. **L'apparition progressive.** La corbeille se découvrait d'un bloc, à
 *    pleine taille dès le premier pixel. Elle grandit et s'éclaircit à mesure
 *    que la carte s'écarte : on voit *arriver* ce qu'on est en train de faire,
 *    et on peut renoncer.
 * 4. **Le retour.** Une seule durée pour tous les cas. Le retour au repos est
 *    désormais plus lent que l'ouverture, et amorti — une carte qui se referme
 *    trop vite donne l'impression d'avoir été refusée.
 *
 * Le contenu reste un lien ordinaire : ouvrir le chantier ne doit pas devenir
 * plus difficile parce qu'on peut aussi le supprimer.
 */
export default function CarteGlissante({
  children,
  onSupprimer,
  libelleSuppression,
  desactive,
  fond,
  rayon,
}: {
  children: ReactNode;
  onSupprimer: () => void;
  /** Ce que lit une personne qui n'utilise pas ses yeux. */
  libelleSuppression: string;
  /** Une facture émise ne se supprime pas : la carte ne glisse alors pas. */
  desactive?: boolean;
  /** Le fond de la couche qui glisse. Sur le fil des chantiers il n'y a plus
      de carte : la ligne doit porter le fond de la PAGE, sinon elle réapparaît
      en pavé clair sur un écran qui n'en veut plus. */
  fond?: string;
  /** Le rayon des coins, en pixels. Zéro sur le fil, où rien n'est arrondi. */
  rayon?: number;
}) {
  const [decalage, setDecalage] = useState(0);
  const [ouverte, setOuverte] = useState(false);
  // Le doigt est-il posé ? En état plutôt qu'en référence : l'affichage en
  // dépend (l'animation est coupée pendant le geste), et React interdit de lire
  // une référence au moment du rendu — à raison, elle ne le déclencherait pas.
  const [glisse, setGlisse] = useState(false);
  const depart = useRef<{ x: number; y: number; t: number } | null>(null);
  const horizontal = useRef<boolean | null>(null);
  // Le dernier point connu, pour mesurer la vitesse à la levée du doigt. Un
  // `touchend` ne porte pas la position : sans cette mémoire, l'élan serait
  // invérifiable.
  const dernier = useRef<{ x: number; t: number } | null>(null);

  const LARGEUR_CORBEILLE = 80;
  const SEUIL_OUVERTURE = 40;
  /** Au-delà, on considère que c'est une chiquenaude, pas un déplacement. */
  const VITESSE_CHIQUENAUDE = 0.45; // pixels par milliseconde

  /**
   * Au-delà de la corbeille, la carte freine au lieu de s'arrêter net.
   *
   * Une carte qui bute donne l'impression d'un mécanisme cassé ; une carte qui
   * résiste dit « c'est le bout » sans jamais le dire.
   */
  function freiner(x: number): number {
    if (x >= -LARGEUR_CORBEILLE) return x;
    const excedent = -x - LARGEUR_CORBEILLE;
    return -(LARGEUR_CORBEILLE + excedent * 0.28);
  }

  function onTouchStart(e: React.TouchEvent) {
    if (desactive) return;
    const t = e.touches[0];
    depart.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    dernier.current = { x: t.clientX, t: Date.now() };
    horizontal.current = null;
    setGlisse(true);
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!depart.current || desactive) return;
    const t = e.touches[0];
    const dx = t.clientX - depart.current.x;
    const dy = t.clientY - depart.current.y;
    dernier.current = { x: t.clientX, t: Date.now() };

    // La direction se décide une fois, au premier mouvement franc : sans cela,
    // un défilement vertical un peu oblique ouvrirait la corbeille.
    if (horizontal.current === null) {
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
      horizontal.current = Math.abs(dx) > Math.abs(dy);
    }
    if (!horizontal.current) return;

    // Vers la gauche seulement : une carte qui part vers la droite n'a rien à
    // découvrir de ce côté-là.
    setDecalage(Math.min(0, freiner((ouverte ? -LARGEUR_CORBEILLE : 0) + dx)));
  }

  function onTouchEnd() {
    if (!depart.current || desactive) return;

    // L'élan du geste, mesuré sur son dernier segment. C'est lui qui distingue
    // « j'ai poussé la carte » de « j'ai balayé la liste ».
    const dureeMs = Math.max(1, (dernier.current?.t ?? 0) - depart.current.t);
    const vitesse = ((depart.current.x - (dernier.current?.x ?? depart.current.x)) / dureeMs) || 0;

    depart.current = null;
    dernier.current = null;
    setGlisse(false);

    const assezLoin = decalage <= -SEUIL_OUVERTURE;
    const assezVif = vitesse >= VITESSE_CHIQUENAUDE && decalage < -8;
    const doitOuvrir = assezLoin || assezVif;
    setOuverte(doitOuvrir);
    setDecalage(doitOuvrir ? -LARGEUR_CORBEILLE : 0);
  }

  // De 0 (au repos) à 1 (corbeille entièrement découverte). Sert à faire
  // *arriver* la corbeille plutôt qu'à la faire apparaître.
  const avancement = Math.min(1, Math.abs(decalage) / LARGEUR_CORBEILLE);

  return (
    <div className="relative overflow-hidden" style={{ borderRadius: rayon ?? 16 }}>
      {/* La corbeille vit SOUS la carte : elle se découvre, elle n'apparaît
          pas par-dessus — c'est ce qui rend le geste lisible. */}
      <button
        type="button"
        aria-label={libelleSuppression}
        onClick={onSupprimer}
        className="absolute inset-y-0 right-0 flex items-center justify-center"
        style={{
          width: LARGEUR_CORBEILLE,
          backgroundColor: colors.alert,
          color: "#FFFFFF",
          // Le fond ne se teinte qu'à mesure : à mi-course, on voit ce qu'on
          // s'apprête à faire, et on peut encore renoncer.
          opacity: 0.35 + avancement * 0.65,
        }}
        tabIndex={ouverte ? 0 : -1}
      >
        <span
          className="flex items-center justify-center"
          style={{
            // L'icône grandit avec le geste. Un détail qu'on ne remarque pas,
            // et dont l'absence rend le mouvement mécanique.
            transform: `scale(${0.72 + avancement * 0.28})`,
            transition: glisse ? "none" : "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translateX(${decalage}px)`,
          // Suit le doigt sans inertie pendant le geste. À la levée, la courbe
          // décélère franchement puis s'installe : c'est ce qui fait la
          // différence entre « ça se replace » et « ça claque ».
          transition: glisse
            ? "none"
            : `transform ${ouverte ? 200 : 280}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          backgroundColor: fond ?? colors.card,
          borderRadius: rayon ?? 16,
        }}
        className="relative"
      >
        {children}
      </div>
    </div>
  );
}
