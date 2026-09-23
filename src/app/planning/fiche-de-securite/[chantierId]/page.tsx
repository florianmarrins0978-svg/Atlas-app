import Link from "next/link";
import { getCurrentCtx } from "@/server/session-ctx";
import { getRole } from "@/server/autorisation";
import { cheminAutorise } from "@/lib/acces-roles";
import { colors, font } from "@/lib/design-tokens";
import { ouvrirLaFicheAction } from "../../fiche-securite-actions";
import FormulaireFicheDeSecurite from "./FormulaireFicheDeSecurite";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fiche de sécurité, Atlas" };

/**
 * LA FICHE DE SÉCURITÉ D'UN CHANTIER — sous /planning, ouverte à tous ceux qui
 * voient le planning : la loi veut qu'elle soit présentée aux travailleurs, et
 * Paysage leur est fermé.
 */
export default async function FicheDeSecuritePage({
  params,
}: {
  params: Promise<{ chantierId: string }>;
}) {
  const { chantierId } = await params;
  const ouverte = await ouvrirLaFicheAction(chantierId);
  const ctx = await getCurrentCtx();
  const role = await getRole(ctx);
  const paysageOuvert = role !== null && cheminAutorise(role, "/paysage");
  if ("ok" in ouverte) {
    return (
      <div className="px-6 py-10" style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
        <p className="m-0 text-[15px]" style={{ color: colors.muted }}>{ouverte.raison}</p>
        <Link href="/planning" className="mt-4 block text-[14px] font-bold no-underline" style={{ color: colors.ink }}>Retour au planning</Link>
      </div>
    );
  }
  return <FormulaireFicheDeSecurite chantierId={chantierId} ouverte={ouverte} paysageOuvert={paysageOuvert} />;
}
