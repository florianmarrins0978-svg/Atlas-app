import { notFound } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { garderLaPage } from "@/server/garde-page";
import { getCurrentCtx } from "@/server/session-ctx";
import { lirePlan } from "@/server/repositories/dossiers-arrosage";
import PlanRevu from "../../PlanRevu";

/**
 * UN PLAN ENREGISTRÉ, REVU — sa planche du 21 novembre 2026. Ce que le serveur
 * a figé ce jour-là, relu tel quel : *« revoir un plan ne le recalcule
 * jamais »*. Ouvert sans l'option (sa réponse 5).
 */
export const metadata = { title: "Plan d’arrosage enregistré, Cause" };
export const dynamic = "force-dynamic";

export default async function PlanRevuPage({ params }: { params: Promise<{ dossier: string; plan: string }> }) {
  await garderLaPage();
  const { dossier, plan } = await params;
  const p = await lirePlan(await getCurrentCtx(), dossier, plan);
  if (!p) notFound();
  return (
    <div>
      <EnTeteEcran retour={{ href: `/paysage/dossiers-arrosage/${dossier}`, libelle: "Retour au dossier" }} surtitre="Mes dossiers" titre="Plan d’arrosage" />
      <PlanRevu
        dossier={{ id: dossier, nom: p.dossierNom }}
        plan={{ id: p.id, le: p.createdAt.toISOString(), avecPhoto: p.photoCle !== null, avecPdf: p.pdfCle !== null }}
        saisie={p.saisie}
        resultat={p.resultat}
      />
    </div>
  );
}
