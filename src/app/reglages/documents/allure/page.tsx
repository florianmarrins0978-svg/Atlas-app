import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { getEntreprise } from "@/server/repositories/entreprises";
import { normaliserAllure, ALLURE_PAR_DEFAUT } from "@/lib/allure-documents";
import RubriqueReservee from "../../RubriqueReservee";
import AllureClient from "./AllureClient";

export const dynamic = "force-dynamic";

/** « L'allure de mes devis » — sa demande du 23 août 2026, écran à part. */
export default async function AllurePage() {
  const ctx = await getCurrentCtx();
  if (!(await estProprietaire(ctx))) {
    return (
      <RubriqueReservee
        titre="L'allure de mes devis"
        quoi="C'est l'aspect des documents que l'entreprise envoie à ses clients."
      />
    );
  }

  const entreprise = await getEntreprise(ctx);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran
        surtitre="Devis & factures"
        titre="L'allure de mes devis"
        retour={{ href: "/reglages/documents", libelle: "Retour à Devis & factures" }}
      />
      <AllureClient
        // **Rien de réglé rend le DÉFAUT, pas du vide.** L'écran doit s'ouvrir
        // sur ce que ses documents portent aujourd'hui — sinon il croit devoir
        // tout choisir pour ne rien changer.
        allureInitiale={
          entreprise?.docTypographie || entreprise?.docFond || entreprise?.docAccent
            ? normaliserAllure({
                typographie: entreprise.docTypographie ?? undefined,
                fond: entreprise.docFond ?? undefined,
                accent: entreprise.docAccent ?? undefined,
              })
            : { ...ALLURE_PAR_DEFAUT }
        }
        logoInitial={entreprise?.logoStorageKey ?? null}
        entrepriseNom={entreprise?.nom ?? ""}
      />
    </div>
  );
}
