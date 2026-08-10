import { notFound } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { getChantier } from "@/server/repositories/chantiers";
import { listerPhotos } from "@/server/repositories/photos";
import PhotosClient from "./PhotosClient";

export const dynamic = "force-dynamic";

export default async function PhotosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ctx = await getCurrentCtx();
  const chantier = await getChantier(ctx, id);
  if (!chantier) notFound();

  const photos = await listerPhotos(ctx, id);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-16">
        <EnTeteEcran
          retour={{ href: `/chantiers/${id}`, libelle: "Retour à la fiche du chantier" }}
          surtitre={chantier.nom}
          titre="Photos"
        />

        <PhotosClient
          chantierId={id}
          initialPhotos={photos.map((p) => ({ id: p.id, storageKey: p.storageKey }))}
        />
      </div>
    </div>
  );
}
