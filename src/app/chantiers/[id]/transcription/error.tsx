"use client";

import ScreenHeader from "@/components/ScreenHeader";

export default function Erreur({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div>
      <ScreenHeader title="Transcription" />
      <div className="p-4">
        <p className="mb-3 text-xs text-ink/40">Impossible de charger la transcription pour l&apos;instant.</p>
        <button
          type="button"
          onClick={reset}
          className="w-full rounded-md bg-accent py-3 text-center font-display text-sm font-bold uppercase tracking-wide text-white"
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}
