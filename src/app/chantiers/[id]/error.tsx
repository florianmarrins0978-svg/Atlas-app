"use client";

import Link from "next/link";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";

export default function Erreur({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
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
        <div className="rounded-[4px] px-5 py-6 text-center" style={{ backgroundColor: colors.card }}>
          <p className="text-[14px]" style={{ color: colors.muted }}>
            Impossible de charger ce chantier pour l&apos;instant.
          </p>
        </div>
        <div className="mt-4">
          <PrimaryButton onClick={reset}>Réessayer</PrimaryButton>
        </div>
      </div>
    </div>
  );
}
