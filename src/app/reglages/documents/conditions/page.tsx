import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { getEntreprise } from "@/server/repositories/entreprises";
import { conditionsDepuisEntreprise } from "@/lib/conditions-documents";
import RubriqueReservee from "../../RubriqueReservee";
import ConditionsClient from "./ConditionsClient";

export const dynamic = "force-dynamic";

/**
 * « Ce qui s'imprime sur le devis » — premier écran du découpage du 7 septembre
 * 2026 (`appli/couper-devis-et-factures.html`).
 *
 * **Ce qu'il débloque, et ça n'a pas changé.** « Validité : 30 jours » était une
 * constante de `devis-pdf.ts`, la même pour tous les artisans, qu'aucun écran ne
 * montrait : un couvreur qui tient ses prix quinze jours envoyait un devis qui
 * l'engageait trente (`ARCHITECTURE.md` §102).
 *
 * **Le refus d'un non-propriétaire est répété sur CHACUN des quatre écrans, et
 * ce n'est pas une redondance :** chacun a son adresse, et une adresse se tape.
 * Le garder au seul sommaire laisserait les quatre autres ouverts.
 */
export default async function ConditionsPage() {
  const ctx = await getCurrentCtx();
  if (!(await estProprietaire(ctx))) {
    return (
      <RubriqueReservee
        titre="Ce qui s'imprime sur le devis"
        quoi="Ces conditions engagent l'entreprise sur un document que le client garde."
      />
    );
  }

  const entreprise = await getEntreprise(ctx);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran
        surtitre="Devis & factures"
        titre="Ce qui s'imprime"
        retour={{ href: "/reglages/documents", libelle: "Retour à Devis & factures" }}
      />
      <ConditionsClient initial={conditionsDepuisEntreprise(entreprise)} />
    </div>
  );
}
