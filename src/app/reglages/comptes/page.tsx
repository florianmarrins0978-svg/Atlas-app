import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { garderLaPage } from "@/server/garde-page";
import { estProprietaire } from "@/server/autorisation";
import { numerosDesComptes } from "@/server/repositories/entreprises";
import NumerosDeCompte from "./NumerosDeCompte";

export const dynamic = "force-dynamic";

/**
 * NUMÉROS DE COMPTE — sa demande du 24 novembre 2026 : « un numéro de compte
 * à côté de chaque catégorie ; Cause le propose, et on peut le modifier dans
 * Réglages ; une modification se reporte dans les trois fichiers ».
 * Planche : `appli/soignee/comptable-trois-fichiers.html`, « Numéros de compte ».
 *
 * Le patron change, la facturation lit (`REGLAGES_DE_LA_FACTURATION`). Les
 * numéros proposés dépendent de la forme de l'entreprise, lue dans Mon
 * entreprise : rien ne se devine.
 */
export default async function NumerosDeComptePage() {
  await garderLaPage();
  const ctx = await getCurrentCtx();
  const [patron, { situation, choisis }] = await Promise.all([estProprietaire(ctx), numerosDesComptes(ctx)]);
  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        <EnTeteEcran allure="soignee" titre="Numéros de compte" retour={{ href: "/reglages", libelle: "Retour aux réglages" }} />
        <NumerosDeCompte patron={patron} situation={situation} choisis={choisis} />
      </div>
    </div>
  );
}
