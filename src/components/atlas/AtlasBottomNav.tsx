"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { colors } from "@/lib/design-tokens";
import { FeuilleAtlas } from "./MarqueAtlas";

// La barre basse, refaite le 9 août 2026 d'après la maquette du patron.
//
// **Une pilule, et un seul onglet plein.** Avant : quatre icônes posées sur une
// bande, séparées du contenu par un filet. Sa maquette en fait un objet — un
// conteneur clair légèrement arrondi, dans lequel l'onglet courant est un petit
// bloc vert plein à l'icône et au texte dorés. Les trois autres restent sur le
// fond clair, sans encadrement.
//
// **Le vert plein ne se met qu'à un seul endroit à la fois**, et c'est ce qui
// le rend lisible : l'œil trouve où il est sans lire. Le doubler d'un second
// aplat — un bouton d'action, un badge — le tuerait.
//
// La feuille de l'onglet Chantiers est **la même** que le sceau de l'en-tête
// (`MarqueAtlas`) : deux dessins voisins auraient divergé au premier retouchage.

const tabs = [
  { href: "/", label: "Chantiers", icon: "feuille" as const },
  { href: "/planning", label: "Planning", icon: "calendar" as const },
  { href: "/termines", label: "Terminés", icon: "check" as const },
  // « Réglages » depuis que cet écran porte aussi le nombre d'équipes : un
  // onglet nommé « Tarifs » cacherait le réglage qui commande le planning.
  { href: "/reglages", label: "Réglages", icon: "reglages" as const },
];

export default function AtlasBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="atlas-nav-basse fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md px-3 pt-2"
      aria-label="Navigation principale"
    >
      <div
        className="grid grid-cols-4 gap-1 p-1.5 backdrop-blur"
        style={{ backgroundColor: `${colors.rustTint}F2`, borderRadius: 24 }}
      >
        {tabs.map((t) => {
          const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className="flex flex-col items-center gap-1 py-2.5"
              style={{
                backgroundColor: active ? colors.rust : "transparent",
                borderRadius: 18,
              }}
            >
              <NavIcon icon={t.icon} couleur={active ? colors.orClair : colors.muted} />
              <span
                className="text-[10.5px] font-medium"
                style={{ color: active ? colors.orClair : colors.muted, letterSpacing: "0.02em" }}
              >
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function NavIcon({
  icon,
  couleur,
}: {
  icon: "feuille" | "calendar" | "check" | "reglages";
  couleur: string;
}) {
  if (icon === "feuille") return <FeuilleAtlas taille={20} couleur={couleur} epaisseur={1.5} />;

  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: couleur,
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (icon === "check")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12 2.5 2.5 4.5-5" />
      </svg>
    );
  if (icon === "calendar")
    return (
      <svg {...common}>
        <rect x="4" y="5" width="16" height="15" rx="2.4" />
        <path d="M4 10h16M8 3v4M16 3v4" />
      </svg>
    );
  // Réglages : un rouage fin, plus proche du vocabulaire iOS que l'étiquette
  // qui s'y trouvait — celle-ci évoquait un prix, alors que l'écran porte
  // désormais bien plus que les tarifs.
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.1 14.3a1.5 1.5 0 0 0 .3 1.7l.1.1a1.9 1.9 0 1 1-2.6 2.6l-.1-.1a1.5 1.5 0 0 0-2.5 1v.2a1.9 1.9 0 1 1-3.7 0v-.1a1.5 1.5 0 0 0-1-1.4 1.5 1.5 0 0 0-1.7.3l-.1.1a1.9 1.9 0 1 1-2.6-2.6l.1-.1a1.5 1.5 0 0 0-1-2.5h-.2a1.9 1.9 0 1 1 0-3.7h.1a1.5 1.5 0 0 0 1.4-1 1.5 1.5 0 0 0-.3-1.7l-.1-.1a1.9 1.9 0 1 1 2.6-2.6l.1.1a1.5 1.5 0 0 0 1.7.3h.1a1.5 1.5 0 0 0 .9-1.4v-.2a1.9 1.9 0 1 1 3.7 0v.1a1.5 1.5 0 0 0 .9 1.4 1.5 1.5 0 0 0 1.7-.3l.1-.1a1.9 1.9 0 1 1 2.6 2.6l-.1.1a1.5 1.5 0 0 0-.3 1.7v.1a1.5 1.5 0 0 0 1.4.9h.2a1.9 1.9 0 1 1 0 3.7h-.1a1.5 1.5 0 0 0-1.4.9Z" />
    </svg>
  );
}
