import Link from "next/link";
import { redirect } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { getCurrentCtx } from "@/server/session-ctx";
import { facturesAvecPaiements } from "@/server/repositories/paiements-facture";
import NoterNonPayee from "./NoterNonPayee";
import SituationDeLaFacture from "../SituationDeLaFacture";
import { garderLaPage } from "@/server/garde-page";

/**
 * « Il ne me paiera pas » — planche `appli/il-ne-paiera-pas.html`, écran 3,
 * soignée le 2 novembre 2026 (`appli/soignee/facture.html`).
 * La facture reste entière (BOFiP §310) : rien ne part chez lui, le rappel se
 * tait, et elle se range dans « Non payées ».
 *
 * **Ce qu'il doit, en très grand, au milieu** : sa remarque sur l'écran
 * d'avant, *« montant trop petit »*. Et la mise en demeure s'atteint d'ici,
 * sans repasser par la facture.
 */
export const dynamic = "force-dynamic";

export default async function PageNonPayee({ params }: { params: Promise<{ id: string }> }) {
  await garderLaPage();
  const { id } = await params;
  const ctx = await getCurrentCtx();
  const f = (await facturesAvecPaiements(ctx)).find((x) => x.chantierId === id);
  if (!f || f.etat === "soldee") redirect(`/chantiers/${id}/facture`);
  // 56 px jusqu'à « 12 126,40 € » ; au-delà, le corps descend juste assez pour
  // que le montant tienne sur une ligne de téléphone plutôt que de déborder.
  const reste = enEuros(f.reste);
  const corps = Math.min(56, Math.floor(616 / reste.length));
  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran
        allure="soignee"
        titre="Il ne vous paiera pas"
        precision={<SituationDeLaFacture clientNom={f.clientNom} clientCivilite={f.clientCivilite} numero={f.numeroCommercial} />}
        retour={{ href: "/termines", libelle: "Retour aux chantiers terminés" }}
      />
      <div className="px-[22px] pb-10 pt-5">
        <section className="rounded-[6px] px-[18px] py-6 text-center" style={{ backgroundColor: colors.card }}>
          <p className="text-[15px]" style={{ color: colors.inkSoft }}>
            Il vous doit toujours
          </p>
          <p
            className="mt-2.5 whitespace-nowrap leading-none"
            style={{ fontFamily: font.display, fontSize: corps, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums lining-nums", color: colors.ink }}
            data-atlas="non-payee-reste"
          >
            {reste}
          </p>
        </section>
        <p className="mt-4 text-center text-[13px]" style={{ color: colors.inkSoft }}>
          Rien ne part chez lui. La facture passe dans Non payées, et Atlas arrête de vous la rappeler.
        </p>
        <p className="text-center">
          <Link
            href={`/chantiers/${id}/facture/mise-en-demeure`}
            className="mt-3.5 inline-flex min-h-[44px] items-center text-[15px] font-semibold no-underline"
            style={{ color: colors.inkSoft }}
            data-atlas="non-payee-mise-en-demeure"
          >
            Lui envoyer une mise en demeure
          </Link>
        </p>
        <NoterNonPayee factureId={f.id} />
      </div>
    </div>
  );
}
