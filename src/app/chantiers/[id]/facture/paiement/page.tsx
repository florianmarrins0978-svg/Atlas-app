import { redirect } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { jourIso } from "@/lib/jour";
import { getCurrentCtx } from "@/server/session-ctx";
import { facturesAvecPaiements } from "@/server/repositories/paiements-facture";
import PaiementClient from "./PaiementClient";

/**
 * « Il vous a payé » — planche `appli/il-ne-paiera-pas.html`, écran 8 : le
 * moyen dans un déroulant à chevron doré, le numéro du chèque, la date, le
 * montant. Le paiement noté, la facture sort des non payées d'elle-même, et sa
 * TVA entre au relevé du mois du paiement.
 */
export const dynamic = "force-dynamic";

export default async function PagePaiement({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCurrentCtx();
  const f = (await facturesAvecPaiements(ctx)).find((x) => x.chantierId === id);
  if (!f || f.etat === "soldee") redirect(`/chantiers/${id}/facture`);
  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran titre="Il vous a payé" surtitre={`${f.numeroCommercial}${f.clientNom ? `, ${f.clientNom}` : ""}`} retour={{ href: `/chantiers/${id}/facture`, libelle: "Retour à la facture" }} allure="commune" />
      <PaiementClient chantierId={id} factureId={f.id} reste={f.reste} aujourdHui={jourIso(new Date())} />
    </div>
  );
}
