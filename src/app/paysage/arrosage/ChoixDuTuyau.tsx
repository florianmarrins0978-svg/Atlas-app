"use client";

import { colors } from "@/lib/design-tokens";

/**
 * LE Ø25 OU LE Ø32 — « la C », sa réponse du 20 octobre 2026
 * (`appli/arrosage-choix-du-diametre.html`) : deux petites cases 25 et 32 à
 * droite du nom, le Ø devant, *« le rond barré synonyme du diamètre, en doré,
 * la couleur de l'appli »*. Le doré est celui du surtitre « Le piquage, au
 * compteur » (`colors.or`) : *« celui que tu m'as mis est trop foncé »*. Les
 * cases restent en noir : *« remets le bouton 25-32 en noir »*.
 */
export default function ChoixDuTuyau({
  valeur,
  onChoix,
  libelle,
}: {
  valeur: 25 | 32;
  onChoix: (d: 25 | 32) => void;
  /** Ce que le choix vise, pour qui lit l'écran à la voix. */
  libelle: string;
}) {
  return (
    <span className="flex flex-none items-center gap-1.5" data-atlas="choix-du-tuyau">
      <span aria-hidden="true" className="text-[21px] font-semibold leading-none" style={{ color: colors.or }}>
        Ø
      </span>
      <span role="group" aria-label={libelle} className="inline-flex rounded-full p-[2px]" style={{ backgroundColor: colors.card, boxShadow: `0 0 0 1px ${colors.line}` }}>
        {([25, 32] as const).map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={valeur === d}
            onClick={() => valeur !== d && onChoix(d)}
            className="min-h-[34px] min-w-[42px] rounded-full border-0 text-[14px]"
            style={valeur === d ? { backgroundColor: colors.ink, color: colors.card, fontWeight: 600 } : { backgroundColor: "transparent", color: colors.muted }}
          >
            {d}
          </button>
        ))}
      </span>
    </span>
  );
}
