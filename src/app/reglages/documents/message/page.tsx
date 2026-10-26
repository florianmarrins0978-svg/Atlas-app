import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { getEntreprise } from "@/server/repositories/entreprises";
import RubriqueReservee from "../../RubriqueReservee";
import MessagesClient from "./MessagesClient";
import { garderLaPage } from "@/server/garde-page";

export const dynamic = "force-dynamic";

/**
 * « Mon message au client » — trois messages depuis le 7 septembre 2026.
 *
 * **Un par document** : le devis, la facture, et le compte rendu de passage,
 * celui-là même qu'on a failli oublier, puisqu'il partait avec le modèle unique
 * sans que personne ne le compte (`composerMessageEntretien`).
 *
 * `null` en base veut dire « celui d'Atlas » : c'est l'écran qui le remplace
 * par le texte par défaut, jamais la base. Recopier le défaut en colonne
 * figerait l'entreprise sur la version du jour.
 */
export default async function MessagePage() {
  await garderLaPage();
  const ctx = await getCurrentCtx();
  if (!(await estProprietaire(ctx))) {
    return (
      <RubriqueReservee
        titre="Mon message au client"
        quoi="Ce texte part au nom de l'entreprise, chez ses clients."
      />
    );
  }

  const entreprise = await getEntreprise(ctx);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran
        allure="soignee"
        titre="Mon message au client"
        retour={{ href: "/reglages/documents", libelle: "Retour à Devis & factures" }}
      />
      <MessagesClient
        initiaux={{
          devis: entreprise?.messageClient ?? null,
          facture: entreprise?.messageClientFacture ?? null,
          passage: entreprise?.messageClientPassage ?? null,
        }}
        // L'aperçu signe avec SON nom, pas « votre entreprise » : c'est ce que
        // son client lira, et un exemple générique ne se juge pas.
        entrepriseNom={entreprise?.nom ?? ""}
        // Le numéro d'exemple suit le format qu'il a choisi : c'est celui que
        // son client lira dans le message de la facture (sa planche).
        formatNumero={entreprise?.formatNumero ?? null}
      />
    </div>
  );
}
