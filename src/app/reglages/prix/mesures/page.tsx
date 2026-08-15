import Link from "next/link";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { lireGrilles, prixParTranche } from "@/server/repositories/grilles-reglables";
import type { NomAxe } from "@/lib/grille-prix";
import MesMesuresClient from "./MesMesuresClient";

export const dynamic = "force-dynamic";

/**
 * « Mes mesures » — l'écran où les tranches se règlent une fois pour toutes.
 *
 * **Sa demande du 14 août 2026 :** *« je dois pouvoir ajouter ou retirer des
 * cases. »* Les tranches sont réglables depuis « Mes prix » aussi, là où il
 * remplit ; cet écran-ci existe pour la raison inverse — **voir qu'elles sont
 * uniques**. La même tranche de diamètre sert à abattre, à fendre et à
 * dessoucher, et la régler trois fois n'aurait aucun sens.
 */
export default async function MesMesuresPage() {
  const ctx = await getCurrentCtx();
  const grilles = await lireGrilles(ctx);

  const axes: NomAxe[] = ["diametre", "hauteur", "technique"];
  const comptes = await Promise.all(axes.map((axe) => prixParTranche(ctx, axe)));
  const prixParAxe = Object.fromEntries(
    axes.map((axe, i) => [axe, Object.fromEntries(comptes[i])])
  ) as Record<NomAxe, Record<string, number>>;

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        <div className="px-6 pt-8">
          <Link
            href="/reglages/prix"
            aria-label="Retour à mes prix"
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.rustTint }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.rust} strokeWidth="2.4">
              <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        <div className="px-6 pt-5">
          <p className={smallCaps} style={{ color: colors.rust, marginBottom: 8 }}>
            Mes prix
          </p>
          <h1 className="text-[32px] leading-tight" style={{ fontFamily: font.display }}>
            Mes mesures
          </h1>
          <p className="mt-3 text-[14px] leading-snug" style={{ color: colors.muted }}>
            Les tranches se règlent ici, une fois. Toutes les grilles les suivent — c&apos;est le même diamètre qui
            sert à abattre, à fendre et à dessoucher.
          </p>
          <p className="mt-2 text-[14px] leading-snug" style={{ color: colors.muted }}>
            Retirer une tranche <strong>n&apos;efface aucun prix</strong> : les cases sont rangées, et reviennent si
            vous la remettez.
          </p>
        </div>

        <MesMesuresClient grilles={grilles} prixParAxe={prixParAxe} />
      </div>
    </div>
  );
}
