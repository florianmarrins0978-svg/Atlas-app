"use client";

// Le corps de cet écran — la carte, la cause en développement, la référence et
// le bouton — vit dans `CorpsErreur`, partagé par les neuf écrans d'erreur. Lui
// seul sait qu'un morceau de code manquant ne se répare pas avec « Réessayer » :
// voir `src/lib/reprise-erreur.ts`.

import Link from "next/link";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import CorpsErreur from "@/components/atlas/CorpsErreur";

export default function Erreur({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="px-6 pt-8">
        <Link
          href="/"
          aria-label="Retour"
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: colors.rustTint }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.rust} strokeWidth="2.4">
            <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
      <div className="px-6 pt-5">
        <span className={smallCaps} style={{ color: colors.rust }}>
          Erreur
        </span>
        <h1 className="mt-1 text-[28px] leading-tight" style={{ fontFamily: font.display }}>
          Chantier indisponible
        </h1>
      </div>
      <div className="px-6 pt-6">
        <CorpsErreur erreur={error} reset={reset} phrase="Impossible de charger ce chantier pour l'instant." />
      </div>
    </div>
  );
}
