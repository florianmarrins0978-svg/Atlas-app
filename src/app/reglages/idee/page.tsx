import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { NOM_DES_IDEES } from "@/lib/idees";
import { getCurrentCtx } from "@/server/session-ctx";
import { mesIdees } from "@/server/repositories/idees";
import { garderLaPage } from "@/server/garde-page";
import UneIdee from "./UneIdee";

export const dynamic = "force-dynamic";

/**
 * « Une idée pour l'appli » — sa planche du 5 novembre 2026
 * (`appli/soignee/une-idee-pour-l-appli.html`), ses choix 1 A et 2 B.
 *
 * **Ouvert à tous les rôles** (`acces-roles.ts`, `REGLAGES_A_SOI`) : chacun dit
 * ce qui lui manque, et ne relit que SES idées.
 */
export default async function IdeePage() {
  await garderLaPage();
  const ctx = await getCurrentCtx();
  const idees = await mesIdees(ctx);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        <EnTeteEcran allure="soignee" titre={NOM_DES_IDEES} retour={{ href: "/reglages", libelle: "Retour aux réglages" }} />
        <UneIdee
          idees={idees.map((i) => ({
            id: i.id,
            texte: i.texte,
            etat: i.etat,
            reponse: i.reponse,
            envoyeeLe: i.envoyeeLe.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
