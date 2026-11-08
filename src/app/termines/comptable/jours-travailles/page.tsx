import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { garderLaPage } from "@/server/garde-page";
import JoursTravailles from "./JoursTravailles";
import { chargerJoursTravailles } from "./charger";

export const dynamic = "force-dynamic";

/**
 * JOURS TRAVAILLÉS — un compteur par salarié, pour la paie.
 *
 * Sa demande du 5 novembre 2026, et sa planche A
 * (`appli/soignee/jours-travailles.html`) : le compte se fait tout seul, se
 * corrige toujours, et dit pourquoi quand le chiffre bouge. Ses zones de
 * déplacement, réglées dans Équipe, paraissent d'office sous chaque salarié
 * (`appli/soignee/zones-deplacement.html`).
 *
 * **Le même écran vit aussi dans Équipe** (8 novembre 2026), par
 * `chargerJoursTravailles` : une préparation, deux portes.
 *
 * **Cet écran ne compte rien** : `moisDesSalaries` rassemble, les règles pures
 * comptent, et le PDF du comptable lit le même chargement.
 */
export default async function PageJoursTravailles({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await garderLaPage();
  const ctx = await getCurrentCtx();
  const vue = await chargerJoursTravailles(ctx, (await searchParams).mois);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-16">
        <EnTeteEcran retour={{ href: "/termines/comptable", libelle: "Pour mon comptable" }} titre="Jours travaillés" />
        <JoursTravailles {...vue} ou="comptable" />
      </div>
    </div>
  );
}
