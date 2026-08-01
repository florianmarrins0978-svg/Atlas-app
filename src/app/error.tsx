"use client";

import { colors, font, smallCaps } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";

// Écran d'erreur de TOUTE l'application, pas seulement des chantiers.
//
// Il annonçait « Impossible de charger vos chantiers » quelle que soit la page
// en panne : une connexion qui échoue, un planning, des réglages, tout sortait
// habillé en défaut de chantiers. Le patron a cherché du côté des chantiers un
// problème qui n'y était pas. Un message qui désigne le mauvais coupable coûte
// plus cher que pas de message du tout.
//
// En développement, la cause réelle est affichée : sans elle, diagnostiquer
// depuis un téléphone suppose d'aller lire un terminal qu'on n'a pas sous les
// yeux. En production, Next.js ne transmet qu'un identifiant — c'est voulu, un
// message d'erreur serveur peut divulguer la structure de la base.

const EN_DEVELOPPEMENT = process.env.NODE_ENV !== "production";

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
        <div className="rounded-2xl px-5 py-8 text-center" style={{ backgroundColor: colors.card }}>
          <p className="text-[14px]" style={{ color: colors.muted }}>
            Cette page n&apos;a pas pu s&apos;afficher.
          </p>
        </div>

        {EN_DEVELOPPEMENT && error.message ? (
          <div
            className="mt-4 overflow-x-auto rounded-2xl px-5 py-4 text-left"
            style={{ backgroundColor: colors.card }}
          >
            <p className={smallCaps} style={{ color: colors.rust, marginBottom: 8 }}>
              Cause
            </p>
            <pre
              className="whitespace-pre-wrap break-words text-[12px] leading-snug"
              style={{ color: colors.ink, fontFamily: "ui-monospace, monospace" }}
            >
              {error.message}
            </pre>
          </div>
        ) : null}

        {error.digest ? (
          <p className="mt-3 text-center text-[11px]" style={{ color: colors.muted }}>
            Référence : {error.digest}
          </p>
        ) : null}

        <div className="mt-4">
          <PrimaryButton onClick={reset}>Réessayer</PrimaryButton>
        </div>
      </div>
    </div>
  );
}
