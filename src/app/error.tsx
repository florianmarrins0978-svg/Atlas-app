"use client";

import { colors, font, smallCaps } from "@/lib/design-tokens";
import CorpsErreur from "@/components/atlas/CorpsErreur";

// Écran d'erreur de TOUTE l'application, pas seulement des chantiers.
//
// Il annonçait « Impossible de charger vos chantiers » quelle que soit la page
// en panne : une connexion qui échoue, un planning, des réglages, tout sortait
// habillé en défaut de chantiers. Le patron a cherché du côté des chantiers un
// problème qui n'y était pas. Un message qui désigne le mauvais coupable coûte
// plus cher que pas de message du tout.
//
// Le corps — la carte, la cause en développement, la référence et le bouton —
// vit dans `CorpsErreur`, partagé par les neuf écrans d'erreur. C'est lui qui
// sait qu'un morceau de code manquant ne se répare pas avec « Réessayer » :
// voir `src/lib/reprise-erreur.ts`.

export default function Erreur({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        backgroundColor: colors.cream,
        color: colors.ink,
        fontFamily: font.body,
        minHeight: "100%",
      }}
    >
      <div className="px-6 pt-9">
        <p className={smallCaps} style={{ color: colors.rust, marginBottom: 8 }}>
          Atlas
        </p>
        <h1 className="text-[36px] leading-none" style={{ fontFamily: font.display }}>
          Une erreur
        </h1>
      </div>

      <div className="mt-8 px-6">
        <CorpsErreur
          erreur={error}
          reset={reset}
          phrase="Cette page n'a pas pu s'afficher."
          aire={32}
        />
      </div>
    </div>
  );
}
