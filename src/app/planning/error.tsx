"use client";

import { colors, font } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";

export default function Erreur({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="px-6 pt-9">
        <h1 className="text-[36px] leading-none" style={{ fontFamily: font.display }}>
          Planning
        </h1>
      </div>
      <div className="px-6 pt-6">
        <div className="rounded-[4px] px-5 py-6 text-center" style={{ backgroundColor: colors.card }}>
          <p className="text-[14px]" style={{ color: colors.muted }}>
            Impossible de charger le planning pour l&apos;instant.
          </p>
        </div>
        <div className="mt-4">
          <PrimaryButton onClick={reset}>Réessayer</PrimaryButton>
        </div>
      </div>
    </div>
  );
}
