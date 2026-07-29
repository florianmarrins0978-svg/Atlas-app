import { notFound } from "next/navigation";
import ScreenHeader from "@/components/ScreenHeader";
import { getCurrentCtx } from "@/server/session-ctx";
import { getChantier } from "@/server/repositories/chantiers";
import { getNoteVocale } from "@/server/repositories/notes-vocales";

// Intégration réelle. Affiche l'état réel de la transcription (lot IA-01) :
// non demandée / en cours / réussie / échouée. Le lancement/relancement de la
// transcription se fait depuis l'écran Note vocale (pas de contrôle dupliqué
// ici) — cet écran reste une consultation, conforme au modèle existant qui ne
// porte qu'une seule transcription par chantier (jamais d'historique).
export const dynamic = "force-dynamic";

export default async function TranscriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ctx = await getCurrentCtx();
  const chantier = await getChantier(ctx, id);
  if (!chantier) notFound();

  const note = await getNoteVocale(ctx, id);

  function contenu() {
    if (!note) return "Aucune note vocale pour ce chantier.";
    if (note.transcriptionStatut === "reussie" && note.transcription) return note.transcription;
    if (note.transcriptionStatut === "en_cours") return "Transcription en cours…";
    if (note.transcriptionStatut === "echouee") {
      return `Échec de la transcription : ${note.transcriptionErreur ?? "erreur inconnue"}. Le fichier audio original reste disponible sur l'écran Note vocale.`;
    }
    return "Cette note vocale n'a pas encore de transcription. Lancez-la depuis l'écran Note vocale.";
  }

  const disponible = note?.transcriptionStatut === "reussie" && !!note.transcription;

  return (
    <div>
      <ScreenHeader title="Transcription" backHref={`/chantiers/${id}/informations`} />
      <div className="p-4">
        <p className="mb-3 text-xs text-ink/40">Texte brut de la note vocale, non modifié.</p>
        <div className="ticket p-4">
          <p className={`text-sm leading-relaxed ${disponible ? "text-ink/80" : "text-ink/40"}`}>{contenu()}</p>
        </div>
      </div>
    </div>
  );
}
