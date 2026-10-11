import { redirect } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { getCurrentCtx } from "@/server/session-ctx";
import { facturesAvecPaiements } from "@/server/repositories/paiements-facture";
import NoterNonPayee from "./NoterNonPayee";

/**
 * « Il ne me paiera pas » — planche `appli/il-ne-paiera-pas.html`, écran 3.
 * La facture reste entière (BOFiP §310) : rien ne part chez lui, le rappel se
 * tait, et elle se range dans « Non payées ».
 */
export const dynamic = "force-dynamic";

export default async function PageNonPayee({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCurrentCtx();
  const f = (await facturesAvecPaiements(ctx)).find((x) => x.chantierId === id);
  if (!f || f.etat === "soldee") redirect(`/chantiers/${id}/facture`);
  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran titre="Il ne vous paiera pas" surtitre={`${f.numeroCommercial}${f.clientNom ? `, ${f.clientNom}` : ""}`} retour={{ href: "/termines", libelle: "Retour aux chantiers terminés" }} allure="commune" />
      <div className="px-3 pb-10">
        <section className="mt-5 rounded-[10px] px-5 py-5" style={{ backgroundColor: colors.card }}>
          <div className="flex items-baseline justify-between gap-3">
            <span>Il vous doit toujours</span>
            <span style={{ fontFamily: font.display, fontSize: 20 }} data-atlas="non-payee-reste">{enEuros(f.reste)}</span>
          </div>
          <p className="mt-3 text-[14px]" style={{ color: colors.muted }}>
            Rien ne part chez lui. Atlas arrête de vous le rappeler.
          </p>
        </section>
        <NoterNonPayee factureId={f.id} />
      </div>
    </div>
  );
}
