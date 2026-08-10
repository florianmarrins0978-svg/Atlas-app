import Link from "next/link";
import { colors, font } from "@/lib/design-tokens";

/**
 * L'en-tête d'un écran, dans la grammaire retenue le 10 août 2026.
 *
 * **Il existe pour que les écrans ne divergent plus.** Chacun se dessinait son
 * propre titre — corps différents, marges différentes, filets présents ou non.
 * Sur l'accueil refait, l'écart sautait aux yeux d'un onglet à l'autre. Une
 * seule pièce, et la refonte se propage sans être recopiée.
 *
 * **Trois règles, et pas une de plus :**
 *
 *   - un surtitre en capitales espacées, en or — ce qu'on LIT ;
 *   - un titre en serif, 36 px, sur une seule ligne ;
 *   - un cheveu qui FERME l'en-tête, en retrait de 26 px des bords. Jamais de
 *     trait au-dessus du titre : le patron l'a refusé explicitement sur
 *     l'accueil, et un écran qui en porterait un jurerait avec les autres.
 */
export default function EnTeteEcran({
  surtitre,
  titre,
  precision,
  retour,
  action,
}: {
  /** Le mot d'accroche, en capitales d'or. Absent, la ligne disparaît. */
  surtitre?: string;
  titre: string;
  /** Une ligne de contexte sous le titre : un compte, une période. */
  precision?: string;
  /** Où revient la flèche. Absente sur les écrans de la barre du bas. */
  retour?: { href: string; libelle: string };
  /** Ce qui se pose à droite du titre — un bouton de dictée, par exemple. */
  action?: React.ReactNode;
}) {
  return (
    <header>
      {retour && (
        <div className="px-[26px] pt-7">
          <Link
            href={retour.href}
            aria-label={retour.libelle}
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.rustTint }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.rust} strokeWidth="2.4">
              <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      )}

      <div className={`flex items-start justify-between gap-4 px-[26px] ${retour ? "pt-5" : "pt-[34px]"}`}>
        <div className="min-w-0">
          {surtitre && (
            <p
              className="text-[9.5px] font-medium uppercase"
              style={{ color: colors.or, letterSpacing: "0.28em" }}
            >
              {surtitre}
            </p>
          )}
          <h1
            className="mt-3.5 text-[36px] leading-[1.02]"
            style={{ fontFamily: font.display, letterSpacing: "-0.018em" }}
          >
            {titre}
          </h1>
          {precision && (
            <p
              className="mt-3.5 text-[9.5px] font-medium uppercase"
              style={{ color: colors.muted, letterSpacing: "0.28em" }}
            >
              {precision}
            </p>
          )}
        </div>
        {action}
      </div>

      {/* Le seul trait de l'en-tête : celui qui le ferme. */}
      <div className="mx-[26px] mt-[26px] h-px" style={{ backgroundColor: colors.line }} />
    </header>
  );
}
