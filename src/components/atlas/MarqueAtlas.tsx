import { colors, font } from "@/lib/design-tokens";

/**
 * La feuille d'Atlas — la marque, dessinée au trait.
 *
 * **Pourquoi un composant et pas une image.** Elle apparaît à deux endroits qui
 * n'ont pas la même taille ni la même couleur : le sceau de l'en-tête (vert pin
 * sur crème) et l'onglet actif de la barre basse (or sur vert pin). Un fichier
 * PNG aurait imposé deux exports, et le jour où le dessin change, l'un des deux
 * serait oublié.
 *
 * Le dessin : une tige verticale et trois paires de folioles, de plus en plus
 * petites vers le haut. Aucun aplat — uniquement des traits, comme le reste des
 * icônes de l'application.
 *
 * `public/icone-source.svg` n'est PAS réutilisable ici : c'est l'icône
 * d'installation, un chevron de charpente explicitement provisoire, et elle
 * porte un fond opaque.
 */
export function FeuilleAtlas({
  taille = 24,
  couleur = colors.rust,
  epaisseur = 1.5,
}: {
  taille?: number;
  couleur?: string;
  epaisseur?: number;
}) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke={couleur}
      strokeWidth={epaisseur}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 21.5V8" />
      <path d="M12 11.6C8.5 11.6 6.2 9.5 6.2 6.4c3.5 0 5.8 2.1 5.8 5.2Z" />
      <path d="M12 11.6c3.5 0 5.8-2.1 5.8-5.2-3.5 0-5.8 2.1-5.8 5.2Z" />
      <path d="M12 16.6c-2.6 0-4.3-1.6-4.3-3.9 2.6 0 4.3 1.6 4.3 3.9Z" />
      <path d="M12 16.6c2.6 0 4.3-1.6 4.3-3.9-2.6 0-4.3 1.6-4.3 3.9Z" />
    </svg>
  );
}

/**
 * Le sceau : la feuille dans son cercle d'or.
 *
 * Le cercle est un filet d'1,5 px — pas une bordure épaisse. À l'échelle du
 * téléphone, deux pixels de plus et l'ensemble bascule du bijou vers le badge.
 */
export function SceauAtlas({ taille = 56 }: { taille?: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex flex-shrink-0 items-center justify-center rounded-full"
      style={{ width: taille, height: taille, border: `1.5px solid ${colors.or}` }}
    >
      <FeuilleAtlas taille={Math.round(taille * 0.48)} />
    </span>
  );
}

/**
 * Le mot ATLAS, très espacé.
 *
 * **Sans baseline sous le mot** : le patron l'a retirée de sa maquette, et il a
 * raison — une accroche répétée à chaque ouverture n'apprend rien à celui qui
 * utilise l'outil tous les jours. Elle a sa place sur un site, pas ici.
 */
export function MotAtlas() {
  return (
    <span
      className="block text-[21px] leading-none"
      style={{ fontFamily: font.display, letterSpacing: "0.3em", color: colors.ink }}
    >
      ATLAS
    </span>
  );
}
