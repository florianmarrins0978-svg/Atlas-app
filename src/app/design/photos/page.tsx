"use client";

import { useState } from "react";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";

// Maquette isolée — n'affecte aucune route existante.
// Emplacements de photos simulés par des vignettes neutres (aucune vraie image à ce stade).

const PHOTOS_DEMO = Array.from({ length: 6 }, (_, i) => i + 1);

export default function PhotosMockup() {
  const [ouverte, setOuverte] = useState<number | null>(null);
  const [photos, setPhotos] = useState<number[]>(PHOTOS_DEMO);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100dvh" }}>
      <div className="mx-auto max-w-md pb-16">
        <div className="px-6 pt-8">
          <a
            href="/design/hub"
            aria-label="Retour"
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.rustTint }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.rust} strokeWidth="2.4">
              <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>

        <div className="px-6 pt-5">
          <p className={smallCaps} style={{ color: colors.rust, marginBottom: 8 }}>
            Rénovation salle de bain
          </p>
          <h1 className="text-[32px] leading-tight" style={{ fontFamily: font.display }}>
            Photos
          </h1>
          <p className="mt-1.5 text-[14px]" style={{ color: colors.muted }}>
            {photos.length > 0 ? `${photos.length} photo${photos.length > 1 ? "s" : ""}` : "Aucune photo pour l'instant"}
          </p>
        </div>

        <div className="px-6 pt-6">
          <PrimaryButton onClick={() => setPhotos((p) => [...p, p.length + 1])}>
            <CameraIcon /> Ajouter une photo
          </PrimaryButton>
        </div>

        {photos.length > 0 && (
          <div className="mt-7 grid grid-cols-3 gap-3 px-6">
            {photos.map((n) => (
              <button
                key={n}
                onClick={() => setOuverte(n)}
                className="flex aspect-square items-center justify-center rounded-2xl"
                style={{ backgroundColor: colors.card, boxShadow: "0 1px 2px rgba(28,27,23,0.04), 0 4px 12px rgba(28,27,23,0.03)" }}
                aria-label={`Voir la photo ${n}`}
              >
                <span style={{ color: colors.chevron }}>
                  <CameraIcon size={22} />
                </span>
              </button>
            ))}
          </div>
        )}

        {photos.length === 0 && (
          <p className="mt-7 px-6 text-center text-[14px]" style={{ color: colors.muted }}>
            Ajoutez une première photo pour garder une mémoire visuelle du chantier.
          </p>
        )}
      </div>

      {/* Visionneuse plein écran */}
      {ouverte !== null && (
        <div
          className="fixed inset-0 z-30 flex flex-col"
          style={{ backgroundColor: colors.ink }}
        >
          <div className="flex items-center justify-between px-6 pt-8">
            <button
              onClick={() => setOuverte(null)}
              aria-label="Fermer"
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F6F1E6" strokeWidth="2.2">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
            <button
              onClick={() => {
                setPhotos((p) => p.filter((n) => n !== ouverte));
                setOuverte(null);
              }}
              aria-label="Supprimer cette photo"
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F6F1E6" strokeWidth="2">
                <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <span style={{ color: "rgba(246,241,230,0.35)" }}>
              <CameraIcon size={64} />
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function CameraIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="7" width="18" height="13" rx="2.5" />
      <path d="M8 7l1.4-2.4A1 1 0 0 1 10.26 4h3.48a1 1 0 0 1 .86.6L16 7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="13.5" r="3.4" />
    </svg>
  );
}
