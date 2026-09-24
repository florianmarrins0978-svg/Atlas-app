import { redirect } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { preparerAvoir } from "@/server/repositories/avoirs";
import AvoirClient from "./AvoirClient";

/**
 * « Je fais un avoir » — planche `appli/avoir.html`, ses décisions du 24
 * septembre 2026 : la ligne visée (ou toute la facture), le montant ÉCRIT, le
 * motif obligatoire, et le calcul lisible, facture TTC moins avoir égale le
 * nouveau montant TTC.
 */
export const dynamic = "force-dynamic";

export default async function PageAvoir({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCurrentCtx();
  const prep = await preparerAvoir(ctx, id);
  // Pas de facture partie : il n'y a rien à rectifier, la facture se corrige
  // encore sur son écran.
  if (prep === null) redirect(`/chantiers/${id}/facture`);
  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran
        titre="Vous lui enlevez combien ?"
        surtitre={prep.clientNom ?? undefined}
        retour={{ href: `/chantiers/${id}/facture`, libelle: "Retour à la facture" }}
        allure="commune"
      />
      <AvoirClient chantierId={id} factureId={prep.factureId} facture={prep.facture} dejaFaits={prep.dejaFaits} />
    </div>
  );
}
