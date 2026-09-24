import Link from "next/link";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";

/**
 * « Que voulez-vous faire ? » — la question du lien doré de la facture. Ses
 * mots du 24 septembre 2026 : « Je fais un avoir », « Il ne me paiera pas »,
 * sans explication dessous.
 */
export default async function PageImpaye({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reponse = (href: string, cle: string, mot: string) => (
    <Link
      href={href}
      data-atlas={`impaye-${cle}`}
      className="mt-3 flex min-h-[60px] w-full items-center rounded-[10px] px-[18px] no-underline"
      style={{ fontFamily: font.display, fontSize: 19, color: colors.ink, backgroundColor: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
    >
      {mot}
    </Link>
  );
  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran titre="Que voulez-vous faire ?" retour={{ href: `/chantiers/${id}/facture`, libelle: "Retour à la facture" }} allure="commune" />
      <div className="px-3 pt-3">
        {reponse(`/chantiers/${id}/facture/avoir`, "avoir", "Je fais un avoir")}
        {reponse(`/chantiers/${id}/facture/non-payee`, "non-payee", "Il ne me paiera pas")}
      </div>
    </div>
  );
}
