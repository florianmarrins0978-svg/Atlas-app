"use client";

import { colors, surPlein, voile } from "@/lib/design-tokens";
import IconeTrait from "@/components/atlas/IconeTrait";

/**
 * Le saut de page, vu dans l'écran du devis : sa réponse du 4 novembre 2026
 * sur `appli/soignee/devis-mise-en-page-questions.html`, question 2, « B ».
 *
 * **Il s'y voit, il ne s'y pose pas.** L'écran du devis ne montre pas où
 * tombent les pages : poser un saut d'ici, ce serait le poser à l'aveugle. Il
 * se pose dans l'aperçu ; ici, la même puce verte que là-bas rappelle qu'il
 * existe, là où il coupera, et sa croix le retire. Sans croix sur un devis
 * envoyé : il est parti avec.
 */
export default function SautDuDevis({
  onRetirer,
  enCours = false,
  refus = null,
}: {
  onRetirer?: () => void;
  enCours?: boolean;
  refus?: string | null;
}) {
  return (
    <div data-atlas="saut-du-devis" className="py-3">
      <div className="relative flex justify-center">
        <span
          aria-hidden
          className="absolute inset-x-0 top-1/2 border-t-[1.5px] border-dashed"
          style={{ borderColor: voile(colors.plein, 0.7) }}
        />
        <span
          className={`relative inline-flex min-h-9 items-center gap-1 rounded-full py-0.5 pl-3.5 text-[14px] font-semibold ${onRetirer ? "pr-1" : "pr-3.5"}`}
          style={{ background: colors.plein, color: surPlein }}
        >
          Saut de page
          {onRetirer && (
            <button
              type="button"
              aria-label="Retirer le saut de page"
              onClick={onRetirer}
              disabled={enCours}
              className="grid h-8 w-8 place-items-center rounded-full disabled:opacity-60"
            >
              <IconeTrait nom="croix" taille={16} />
            </button>
          )}
        </span>
      </div>
      {refus && (
        <p role="alert" className="mt-2 text-center text-[14px]" style={{ color: colors.alert }}>
          {refus}
        </p>
      )}
    </div>
  );
}
