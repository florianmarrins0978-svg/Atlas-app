import { notFound } from "next/navigation";
import { colors, font } from "@/lib/design-tokens";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { garderLaPage } from "@/server/garde-page";
import { getCurrentCtx } from "@/server/session-ctx";
import { ouvrirDossier } from "@/server/repositories/dossiers-arrosage";
import DossierOuvert from "../DossierOuvert";

/** Un dossier ouvert : ses plans, le plus récent en tête (sa planche du 21 novembre 2026). */
export const metadata = { title: "Dossier d’arrosage, Cause" };
export const dynamic = "force-dynamic";

export default async function DossierPage({ params }: { params: Promise<{ dossier: string }> }) {
  await garderLaPage();
  const { dossier } = await params;
  const d = await ouvrirDossier(await getCurrentCtx(), dossier);
  if (!d) notFound();
  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran retour={{ href: "/paysage/dossiers-arrosage", libelle: "Retour à mes dossiers" }} surtitre="Mes dossiers" titre={d.nom} />
      <DossierOuvert
        dossier={{
          id: d.id,
          nom: d.nom,
          client: d.client,
          versions: d.versions.map((v) => ({ id: v.id, version: v.version, resume: v.resume, avecPhoto: v.avecPhoto, le: v.createdAt.toISOString() })),
        }}
      />
    </div>
  );
}
