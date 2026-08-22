"use client";

// Le corps de cet écran — la carte, la cause en développement, la référence et
// le bouton — vit dans `CorpsErreur`, partagé par les neuf écrans d'erreur. Lui
// seul sait qu'un morceau de code manquant ne se répare pas avec « Réessayer » :
// voir `src/lib/reprise-erreur.ts`.

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
      <div className="px-6 pt-5">
        <span className={smallCaps} style={{ color: colors.rust }}>
          Erreur
        </span>
        <h1 className="mt-1 text-[28px] leading-tight" style={{ fontFamily: font.display }}>
          Prix indisponible
        </h1>
      </div>
      <div className="px-6 pt-6">
        <CorpsErreur erreur={error} reset={reset} phrase="Impossible de charger le prix pour l'instant." />
      </div>
    </div>
  );
}
