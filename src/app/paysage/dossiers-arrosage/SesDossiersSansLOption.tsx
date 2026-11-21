import Link from "next/link";
import { colors } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { listerDossiers } from "@/server/repositories/dossiers-arrosage";

/**
 * SANS L'OPTION, SES PLANS RESTENT À LUI — sa réponse 5 du 21 novembre 2026.
 * Sous la fermeture de l'outil, la porte de ses dossiers, s'il en a : une
 * trace sert au moment d'un litige, souvent après avoir arrêté l'option.
 * Sans dossier, rien : une porte vers une liste vide n'apprend rien.
 */
export default async function SesDossiersSansLOption() {
  const dossiers = await listerDossiers(await getCurrentCtx());
  if (dossiers.length === 0) return null;
  return (
    <div className="mx-[26px] mt-[18px]">
      <Link
        href="/paysage/dossiers-arrosage"
        data-atlas="mes-dossiers"
        className="flex min-h-[56px] w-full items-center justify-center rounded-full text-[17px] font-semibold"
        style={{ boxShadow: `inset 0 0 0 1.5px ${colors.line}`, color: colors.ink }}
      >
        Mes dossiers
      </Link>
    </div>
  );
}
