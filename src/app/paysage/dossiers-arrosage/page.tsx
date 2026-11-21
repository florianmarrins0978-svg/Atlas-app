import { colors, font } from "@/lib/design-tokens";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { garderLaPage } from "@/server/garde-page";
import { getCurrentCtx } from "@/server/session-ctx";
import { listerDossiers } from "@/server/repositories/dossiers-arrosage";
import MesDossiers from "./MesDossiers";

/**
 * « Mes dossiers » du plan d'arrosage — sa planche du 21 novembre 2026
 * (`appli/arrosage-dossiers.html`). **Hors de `/paysage/arrosage`**, donc hors
 * de la porte de l'option : sa réponse 5, revoir et télécharger restent
 * ouverts sans elle. Seul un nouveau plan la demande.
 */
export const metadata = { title: "Mes dossiers, Cause" };
export const dynamic = "force-dynamic";

export default async function MesDossiersPage() {
  await garderLaPage();
  const dossiers = await listerDossiers(await getCurrentCtx());
  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran retour={{ href: "/paysage/arrosage", libelle: "Retour au plan d’arrosage" }} surtitre="Plan d’arrosage" titre="Mes dossiers" />
      <MesDossiers dossiers={dossiers.map((d) => ({ id: d.id, nom: d.nom, client: d.client?.nom ?? null, plans: d.plans, dernier: d.dernier?.toISOString() ?? null }))} />
    </div>
  );
}
