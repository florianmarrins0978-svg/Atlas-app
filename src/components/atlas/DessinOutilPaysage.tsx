import type { ReactNode } from "react";

/**
 * LE DESSIN D'UN OUTIL DE PAYSAGE — celui de la page Paysage, au trait près
 * (planche `appli/paysage-les-outils.html`, retenue le 11 octobre 2026).
 *
 * **Sorti de la page Paysage le 19 novembre 2026**, quand le bloc des outils de
 * l'écran Abonnement a demandé les mêmes : deux copies d'un tracé finissent par
 * dessiner deux gouttes d'eau (`CLAUDE.md` §3).
 */
export type OutilDessine = "arrosage" | "diagnostic" | "fiche-chantier" | "fiches-securite";

/** Cet outil a-t-il un dessin ? Les absences et les retours n'en ont pas ici. */
export function estOutilDessine(outil: string): outil is OutilDessine {
  return outil in TRACES;
}

const TRACES: Record<OutilDessine, ReactNode> = {
  arrosage: (
    <>
      <path d="M12 2.5C12 2.5 4.8 10.3 4.8 14.9a7.2 7.2 0 0 0 14.4 0C19.2 10.3 12 2.5 12 2.5z" />
      <path d="M8.7 15.3a3.3 3.3 0 0 0 3.3 3.3" />
    </>
  ),
  "fiche-chantier": (
    <>
      <rect x="5" y="4.5" width="14" height="16.5" rx="2" />
      <path d="M9 3h6v3H9z" />
      <path d="M8.5 12.5l2 2 4-4.5" />
      <path d="M8.5 18h7" />
    </>
  ),
  diagnostic: (
    <>
      <path d="M4 19c0-8 5-14 15-15-0.5 4-1.6 7-3.3 9.2" />
      <path d="M4 19c2.5-4 5.5-7 9-9.5" />
      <circle cx="15.5" cy="16.5" r="3" />
      <path d="M17.7 18.7L20.5 21.5" />
    </>
  ),
  "fiches-securite": (
    <>
      <path d="M12 3l7 2.8v5.6c0 4.5-3 8.1-7 9.6-4-1.5-7-5.1-7-9.6V5.8z" />
      <path d="M8.8 12.2l2.2 2.2 4.2-4.4" />
    </>
  ),
};

export default function DessinOutilPaysage({ outil, taille = 22 }: { outil: OutilDessine; taille?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {TRACES[outil]}
    </svg>
  );
}
