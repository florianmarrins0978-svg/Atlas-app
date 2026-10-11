import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { getEntreprise } from "@/server/repositories/entreprises";
import RubriqueReservee from "../../RubriqueReservee";
import NumeroClient from "./NumeroClient";

export const dynamic = "force-dynamic";

/** « Le numéro de mes documents » — sa demande du 26 août 2026, écran à part. */
export default async function NumeroPage() {
  const ctx = await getCurrentCtx();
  if (!(await estProprietaire(ctx))) {
    return (
      <RubriqueReservee
        titre="Le numéro de mes documents"
        quoi="La suite des numéros engage la comptabilité de l'entreprise."
      />
    );
  }

  const entreprise = await getEntreprise(ctx);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran
        surtitre="Devis & factures"
        titre="Le numéro de mes documents"
        retour={{ href: "/reglages/documents", libelle: "Retour à Devis & factures" }}
      />
      <NumeroClient formatInitial={entreprise?.formatNumero ?? null} />
    </div>
  );
}
