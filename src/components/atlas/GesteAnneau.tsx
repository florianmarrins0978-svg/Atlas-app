"use client";

import Link from "next/link";
import { type CSSProperties } from "react";
import { colors } from "@/lib/design-tokens";

/**
 * ─── LE MOT, L'ANNEAU, ET LA GERBE ─────────────────────────────────────────
 *
 * Le geste que le patron a arrêté après onze maquettes le 11 août 2026 : le mot
 * en capitales, un anneau d'un cheveu à sa droite qui BAT tant qu'on ne l'a pas
 * touché, et à l'appui trois tours avec onze grains d'or.
 *
 * **Pourquoi il vit ici depuis le 10 septembre 2026.** L'accueil en porte
 * DEUX — « Créer un devis » et « Créer une facture » —, et sa consigne sur la
 * planche est sans ambiguïté : *« exactement le même style en gras avec
 * l'anneau vraiment tout pareil »*. Deux copies du même dessin auraient tenu
 * une semaine : le premier ajustement de l'un ne serait pas allé sur l'autre,
 * et l'écart se serait vu à l'œil sur le seul écran qu'il ouvre vingt fois par
 * jour (`CLAUDE.md` §3).
 *
 * **Rien du dessin n'a bougé en déménageant.** Les mesures restent celles de
 * `docs/maquettes/24-le-bouton-retenu.html` et de `globals.css`, où elles sont
 * chiffrées une à une — il les a resserrées lui-même (l'onde d'attente, la
 * taille du rond, le nombre de grains). Ne pas les réinventer ici : les deux
 * finiraient par diverger, ce qui est exactement le défaut qu'on vient de
 * fermer.
 *
 * **C'est un LIEN, et il le reste.** Sans JavaScript, ou ouvert dans un nouvel
 * onglet, il mène à l'écran entier. Le clic ordinaire est détourné par
 * l'appelant pour jouer le geste puis faire monter la feuille — la route ne
 * disparaît pas, elle change de porte.
 */

/** Les onze grains d'or projetés à l'appui : point d'arrivée, taille, retard.
 *
 *  **Ces nombres sont ceux de la maquette retenue**, repris tels quels. Ils sont
 *  volontairement irréguliers : onze grains à la même distance dessinent une
 *  roue de vélo, pas une gerbe. Le patron a lui-même ramené leur nombre de seize
 *  à onze et leur portée de 58 à 46 px — ne pas les « arrondir ». */
const GRAINS = [
  { x: 7.7, y: -36.9, l: 2.3, t: 9 },
  { x: 17.0, y: -44.8, l: 1.6, t: 43 },
  { x: 34.9, y: -22.6, l: 1.7, t: 22 },
  { x: 35.2, y: 2.1, l: 1.8, t: 0 },
  { x: 35.0, y: 29.0, l: 1.9, t: 34 },
  { x: 9.5, y: 38.0, l: 2.0, t: 13 },
  { x: -18.7, y: 45.7, l: 2.2, t: 47 },
  { x: -36.7, y: 22.4, l: 2.3, t: 26 },
  { x: -36.5, y: -3.1, l: 2.4, t: 5 },
  { x: -45.5, y: -11.3, l: 1.6, t: 39 },
  { x: -25.9, y: -31.2, l: 1.8, t: 18 },
] as const;

export default function GesteAnneau({
  href,
  mot,
  repere,
  anime,
  onAppui,
}: {
  href: string;
  /** Ce qu'on va faire — « Créer un devis », « Créer une facture ». */
  mot: string;
  /** Le repère que les suites visent : il désigne CE geste-ci, pas l'autre. */
  repere: string;
  /** Le tour et la gerbe sont en train de jouer. */
  anime: boolean;
  /** Le clic ordinaire — l'appelant joue le geste puis ouvre. */
  onAppui: () => void;
}) {
  return (
    <Link
      href={href}
      data-atlas={repere}
      data-geste={anime ? "part" : undefined}
      onClick={(e) => {
        // Un clic du milieu, ou avec une touche de modification, garde le
        // comportement d'un lien : nouvel onglet, nouvelle fenêtre.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onAppui();
      }}
      className="atlas-geste-nouveau"
    >
      <span className="atlas-mot">{mot}</span>
      <span className="atlas-rond">
        {/* **Trois ondes depuis le 6 septembre 2026** — sa décision sur la
            planche, « le 2, l'anneau resserré ». Les deux suivantes ne
            diffèrent que du retard (`globals.css`) : une seule règle
            d'animation pour les trois, donc une seule à corriger. */}
        <span className="atlas-pouls" aria-hidden="true" />
        <span className="atlas-pouls atlas-pouls-2" aria-hidden="true" />
        <span className="atlas-pouls atlas-pouls-3" aria-hidden="true" />
        <span className="atlas-cerne" aria-hidden="true" />
        <span className="atlas-gerbe" aria-hidden="true">
          {GRAINS.map(({ x, y, l, t }) => (
            <i
              key={`${x}-${y}`}
              style={
                {
                  "--x": `${x}px`,
                  "--y": `${y}px`,
                  "--l": `${l}px`,
                  "--t": `${t}ms`,
                } as CSSProperties
              }
            />
          ))}
        </span>
        <svg className="atlas-signe" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path d="M16 9.6v12.8M9.6 16h12.8" stroke={colors.or} strokeWidth="1.25" />
        </svg>
      </span>
    </Link>
  );
}
