"use client";

import { colors, font, smallCaps } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";

export default function Erreur({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="px-6 pt-9">
        <p className={smallCaps} style={{ color: colors.rust, marginBottom: 8 }}>
          Vos chantiers
        </p>
        <h1 className="text-[36px] leading-none" style={{ fontFamily: font.display }}>
          Chantiers
        </h1>
      </div>

      <div className="mt-8 px-6">
        <div className="rounded-2xl px-5 py-8 text-center" style={{ backgroundColor: colors.card }}>
          <p className="text-[14px]" style={{ color: colors.muted }}>
            Impossible de charger vos chantiers pour l&apos;instant.
          </p>
        </div>
        <div className="mt-4">
          <PrimaryButton onClick={reset}>Réessayer</PrimaryButton>
        </div>
      </div>
    </div>
  );
}
