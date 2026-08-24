import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { getEntreprise } from "@/server/repositories/entreprises";
import { conditionsDepuisEntreprise } from "@/lib/conditions-documents";
import RubriqueReservee from "../RubriqueReservee";
import DocumentsClient from "./DocumentsClient";

export const dynamic = "force-dynamic";

/**
 * « Devis & factures » — ce qui s'imprime en plus, et ce qui est scellé.
 *
 * **Ce qu'elle débloque.** « Validité : 30 jours » était une constante de
 * `devis-pdf.ts`, la même pour tous les artisans, qu'aucun écran ne montrait :
 * un couvreur qui tient ses prix quinze jours envoyait un devis qui l'engageait
 * trente (`ARCHITECTURE.md` §102).
 *
 * **L'écran refuse un non-propriétaire avant de lire quoi que ce soit** : ces
 * conditions engagent l'entreprise sur un document que le client garde
 * (`docs/QUESTIONS.md` §10).
 */
export default async function DocumentsPage() {
  const ctx = await getCurrentCtx();
  if (!(await estProprietaire(ctx))) {
    return (
      <RubriqueReservee
        titre="Devis & factures"
        quoi="Ces conditions engagent l'entreprise sur un document que le client garde."
      />
    );
  }

  const entreprise = await getEntreprise(ctx);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran
        surtitre="Réglages"
        titre="Devis & factures"
        retour={{ href: "/reglages", libelle: "Retour aux réglages" }}
      />
      <DocumentsClient
        initial={conditionsDepuisEntreprise(entreprise)}
        messageInitial={entreprise?.messageClient ?? null}
        // L'aperçu signe avec SON nom, pas « votre entreprise » : c'est ce que
        // son client lira, et un exemple générique ne se juge pas.
        entrepriseNom={entreprise?.nom ?? ""}
      />
    </div>
  );
}
