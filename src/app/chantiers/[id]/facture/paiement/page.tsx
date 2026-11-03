import { redirect } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { jourIso } from "@/lib/jour";
import { getCurrentCtx } from "@/server/session-ctx";
import { facturesAvecPaiements } from "@/server/repositories/paiements-facture";
import PaiementClient from "./PaiementClient";
import SituationDeLaFacture from "../SituationDeLaFacture";
import { garderLaPage } from "@/server/garde-page";

/**
 * « Il vous a payé » — planche du 2 novembre 2026 (`appli/soignee/facture.html`,
 * état « A, la barre, choisie ») : le moyen sur un ruban de quatre cases, le
 * numéro du chèque, la date, le montant en grand. Le paiement noté, la facture
 * sort des non payées d'elle-même, et sa TVA entre au relevé du mois du
 * paiement.
 */
export const dynamic = "force-dynamic";

export default async function PagePaiement({ params }: { params: Promise<{ id: string }> }) {
  await garderLaPage();
  const { id } = await params;
  const ctx = await getCurrentCtx();
  const f = (await facturesAvecPaiements(ctx)).find((x) => x.chantierId === id);
  if (!f || f.etat === "soldee") redirect(`/chantiers/${id}/facture`);
  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran
        allure="soignee"
        titre="Il vous a payé"
        precision={<SituationDeLaFacture clientNom={f.clientNom} clientCivilite={f.clientCivilite} numero={f.numeroCommercial} />}
        retour={{ href: `/chantiers/${id}/facture`, libelle: "Retour à la facture" }}
      />
      <PaiementClient chantierId={id} factureId={f.id} reste={f.reste} aujourdHui={jourIso(new Date())} />
    </div>
  );
}
