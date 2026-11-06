import { notFound } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { estEditeur } from "@/server/editeur";
import { ideesRecues } from "@/server/repositories/idees";
import { garderLaPage } from "@/server/garde-page";
import IdeesRecues from "./IdeesRecues";

export const dynamic = "force-dynamic";

/**
 * « Les idées reçues » — l'écran de l'éditeur, et de lui seul (sa question du
 * 5 novembre 2026 : *« ça va arriver où chez moi ? »*).
 *
 * **`notFound()` plutôt qu'un refus**, comme Mon vocabulaire : pour tout autre
 * compte, l'adresse n'existe pas. La garde est côté serveur, avant toute
 * lecture ; la ligne des Réglages, elle, ne s'affiche qu'à lui.
 */
export default async function IdeesRecuesPage() {
  await garderLaPage();
  const ctx = await getCurrentCtx();
  if (!(await estEditeur(ctx))) notFound();

  const idees = await ideesRecues(ctx);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        <EnTeteEcran allure="soignee" titre="Les idées reçues" retour={{ href: "/reglages", libelle: "Retour aux réglages" }} />
        <IdeesRecues
          idees={idees.map((i) => ({
            id: i.id,
            texte: i.texte,
            etat: i.etat,
            reponse: i.reponse,
            envoyeeLe: i.envoyeeLe.toISOString(),
            auteurNom: i.auteurNom,
            auteurRole: i.auteurRole,
            entrepriseNom: i.entrepriseNom,
          }))}
        />
      </div>
    </div>
  );
}
