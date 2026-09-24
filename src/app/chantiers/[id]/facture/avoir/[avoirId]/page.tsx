import Link from "next/link";
import { notFound } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font, surPlein } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { adresseDeLaVisionneuse } from "@/lib/visionneuse-pdf";
import { getCurrentCtx } from "@/server/session-ctx";
import { avoirPourEcran } from "@/server/repositories/avoirs";

/**
 * « C'est fait » — l'avoir est né, numéroté, son papier composé. Planche
 * `appli/avoir.html`, écran 5 : ce qu'il doit encore, et le document.
 */
export const dynamic = "force-dynamic";

export default async function PageAvoirFait({ params }: { params: Promise<{ id: string; avoirId: string }> }) {
  const { id, avoirId } = await params;
  const ctx = await getCurrentCtx();
  const a = await avoirPourEcran(ctx, avoirId);
  if (!a || a.chantierId !== id) notFound();
  const doitEncore = Number(a.nouveauTtc) > 0;
  const qui = a.clientNom ?? "Votre client";
  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran titre="C'est fait" surtitre={`Avoir ${a.numero}`} retour={{ href: `/chantiers/${id}/facture`, libelle: "Retour à la facture" }} allure="commune" />
      <div className="px-[26px] pb-10" data-atlas="avoir-fait">
        <p className="mt-6 text-[16px]" style={{ color: colors.inkSoft }}>
          {doitEncore ? `${qui} ne doit plus que ${enEuros(a.nouveauTtc)}.` : `${qui} ne doit plus rien.`}
        </p>
        <p className="mt-2 text-[14px]" style={{ color: colors.muted }}>
          Avoir de {enEuros(a.totalTtc)} sur la facture {a.factureNumero}. Motif : {a.motif}.
        </p>
        <Link
          href={adresseDeLaVisionneuse(`/api/avoirs/${a.id}/pdf`, { surtitre: "Avoir", titre: a.numero })}
          className="atlas-plein mx-auto mt-8 flex min-h-[56px] w-[78%] items-center justify-center rounded-full no-underline"
          style={{ backgroundColor: colors.plein, color: surPlein, fontFamily: font.display, fontSize: 21 }}
          data-atlas="avoir-voir-pdf"
        >
          Voir l&apos;avoir
        </Link>
      </div>
    </div>
  );
}
