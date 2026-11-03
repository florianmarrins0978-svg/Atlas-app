import { redirect } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { ttcApresAvoirs } from "@/lib/avoir";
import { avecCivilite } from "@/lib/civilite";
import { colors, font } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { getCurrentCtx } from "@/server/session-ctx";
import { preparerAvoir } from "@/server/repositories/avoirs";
import AvoirClient from "./AvoirClient";
import { garderLaPage } from "@/server/garde-page";

/**
 * « Vous lui enlevez combien ? » : les décisions du 24 septembre 2026
 * (`appli/avoir.html` : la ligne visée ou toute la facture, le montant ÉCRIT,
 * le motif obligatoire, le nouveau montant lisible), dessinées depuis le
 * 2 novembre sur la planche soignée de la facture (`appli/soignee/facture.html`).
 */
export const dynamic = "force-dynamic";

export default async function PageAvoir({ params }: { params: Promise<{ id: string }> }) {
  await garderLaPage();
  const { id } = await params;
  const ctx = await getCurrentCtx();
  const prep = await preparerAvoir(ctx, id);
  // Pas de facture partie : il n'y a rien à rectifier, la facture se corrige
  // encore sur son écran.
  if (prep === null) redirect(`/chantiers/${id}/facture`);
  // Le montant que la carte « Toute la facture » reprend : ce que la facture
  // vaut aujourd'hui, avoirs déjà faits retirés.
  const montant = enEuros(ttcApresAvoirs(prep.facture.totalTtc, prep.dejaFaits));
  const qui = avecCivilite(prep.clientNom, prep.clientCivilite);
  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran
        allure="soignee"
        titre={"Vous lui enlevez combien\u00a0?"}
        precision={qui ? `${qui}, facture de ${montant} TTC` : `Facture de ${montant} TTC`}
        retour={{ href: `/chantiers/${id}/facture`, libelle: "Retour à la facture" }}
      />
      <AvoirClient chantierId={id} factureId={prep.factureId} facture={prep.facture} dejaFaits={prep.dejaFaits} />
    </div>
  );
}
