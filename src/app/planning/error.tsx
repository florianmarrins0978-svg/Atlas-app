"use client";

// Le corps de cet écran — la carte, la cause en développement, la référence et
// le bouton — vit dans `CorpsErreur`, partagé par les neuf écrans d'erreur. Lui
// seul sait qu'un morceau de code manquant ne se répare pas avec « Réessayer » :
// voir `src/lib/reprise-erreur.ts`.

import { colors, font } from "@/lib/design-tokens";
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
      <div className="px-6 pt-9">
        <h1 className="text-[36px] leading-none" style={{ fontFamily: font.display }}>
          Planning
        </h1>
      </div>
      <div className="px-6 pt-6">
        <CorpsErreur erreur={error} reset={reset} phrase="Impossible de charger le planning pour l'instant." />
      </div>
    </div>
  );
}
