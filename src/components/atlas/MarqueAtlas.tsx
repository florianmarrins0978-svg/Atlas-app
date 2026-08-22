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
 * La rose des vents — le motif que le patron a retenu pour la porte, le 12 août
 * 2026, parmi huit gravures (`docs/maquettes/37-le-motif-du-sceau.html`).
 *
 * **Une étoile à quatre branches, et c'est une raison de plus que l'esthétique :**
 * l'entrée fait TOURNER le sceau, et un motif à quatre branches identiques se
 * lit d'un bout à l'autre du tour sans jamais paraître de travers. La feuille,
 * elle, a un haut et un bas.
 *
 * Elle ne remplace PAS la feuille ailleurs : la feuille reste la marque de
 * l'application (en-tête, barre basse). C'est une décision à prendre à part —
 * elle n'a pas été prise.
 */
export function RoseDesVents({
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
      <path d="M12 2.8 13.7 10.3 21.2 12 13.7 13.7 12 21.2 10.3 13.7 2.8 12 10.3 10.3Z" />
    </svg>
  );
}

/**
 * Le sceau : la marque dans son cercle d'or.
 *
 * Le cercle est un filet d'1,5 px — pas une bordure épaisse. À l'échelle du
 * téléphone, deux pixels de plus et l'ensemble bascule du bijou vers le badge.
 *
 * `motif` choisit la gravure. La feuille reste le défaut — soixante endroits
 * l'affichent, et l'écran de connexion est le seul à porter la rose des vents.
 */
export function SceauAtlas({
  taille = 56,
  motif = "feuille",
  className,
}: {
  taille?: number;
  motif?: "feuille" | "rose";
  className?: string;
}) {
  const Gravure = motif === "rose" ? RoseDesVents : FeuilleAtlas;
  return (
    <span
      aria-hidden="true"
      className={`flex flex-shrink-0 items-center justify-center rounded-full${className ? ` ${className}` : ""}`}
      style={{ width: taille, height: taille, border: `1.5px solid ${colors.or}` }}
    >
      <Gravure taille={Math.round(taille * 0.48)} />
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
