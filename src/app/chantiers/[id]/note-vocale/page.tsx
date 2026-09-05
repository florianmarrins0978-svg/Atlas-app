import { notFound } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { getChantier } from "@/server/repositories/chantiers";
import { getNoteVocale } from "@/server/repositories/notes-vocales";
import NoteVocaleClient from "./NoteVocaleClient";

export const dynamic = "force-dynamic";

export default async function NoteVocalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ctx = await getCurrentCtx();
  const chantier = await getChantier(ctx, id);
  if (!chantier) notFound();

  const note = await getNoteVocale(ctx, id);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-16">
        {/* **La flèche HÉRITE de celle de la fiche du chantier**, mot pour mot,
            depuis que celle-ci a disparu (4 septembre 2026, `ARCHITECTURE.md`
            §254). Cet écran était à un cran d'elle : il prend sa place, il
            n'invente pas une destination. */}
        <EnTeteEcran
          retour={{ href: "/", libelle: "Retour à la liste des chantiers" }}
          surtitre={chantier.nom}
          titre="Note vocale"
        />

        <NoteVocaleClient
          chantierId={id}
          noteInitiale={
            note
              ? {
                  storageKey: note.storageKey,
                  dureeSecondes: note.dureeSecondes,
                  transcriptionStatut: note.transcriptionStatut as "non_demandee" | "en_cours" | "reussie" | "echouee",
                  transcriptionErreur: note.transcriptionErreur,
                }
              : null
          }
        />
      </div>
    </div>
  );
}
