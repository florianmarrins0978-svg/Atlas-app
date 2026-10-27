import { colors, voile } from "@/lib/design-tokens";

/**
 * L'ACTION PRINCIPALE d'un écran de réglages, collée au-dessus de la barre du
 * bas : toujours au même endroit, sous le pouce.
 *
 * **Un seul bouton plein par écran**, à cette place-là (planches du 25 octobre
 * 2026, « Ce qui change partout »). Voir un exemple attendait au bout de cinq
 * écrans de défilement ; il se trouve désormais sans chercher.
 *
 * La cale réserve sa hauteur dans la page : sans elle, le dernier paquet
 * passerait sous le bouton et ne se lirait plus.
 */
export default function ActionBas({ children, dataAtlas }: { children: React.ReactNode; dataAtlas?: string }) {
  return (
    <>
      <div aria-hidden style={{ height: 96 }} />
      <div
        data-atlas={dataAtlas}
        className="atlas-colonne-fixe z-10 px-[22px] pb-3 pt-3"
        style={{
          bottom: "var(--atlas-barre)",
          background: `linear-gradient(to top, ${colors.cream} 72%, ${voile(colors.cream, 0)})`,
        }}
      >
        {children}
      </div>
    </>
  );
}
