import { notFound } from "next/navigation";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { getChantier } from "@/server/repositories/chantiers";
import { getNoteVocale } from "@/server/repositories/notes-vocales";
import { estTranscriptionSimulee } from "@/server/ai/providers/transcription/dev";
import TexteDicte from "./TexteDicte";
import DevisDepuisDictee from "../DevisDepuisDictee";

// Consultation seule : le lancement et la relance de la transcription vivent sur
// l'écran Note vocale, jamais en double ici. Le modèle ne porte qu'une
// transcription par chantier — aucun historique n'est affiché.
export const dynamic = "force-dynamic";

export default async function TranscriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ctx = await getCurrentCtx();
  const chantier = await getChantier(ctx, id);
  if (!chantier) notFound();

  const note = await getNoteVocale(ctx, id);
  // Un texte de remplacement n'est pas une transcription : l'afficher comme
  // telle a fait croire au patron que sa dictée était comprise de travers,
  // alors qu'elle n'avait pas été écoutée.
  const simulee = estTranscriptionSimulee(note?.transcription);
  const disponible = !simulee && note?.transcriptionStatut === "reussie" && !!note.transcription;

  function contenu() {
    if (!note) return "Aucune note vocale pour ce chantier.";
    if (disponible) return note!.transcription!;
    if (simulee) {
      return "Votre dictée est enregistrée, mais elle n'a pas été transcrite : aucun prestataire de transcription n'est encore raccordé. Écrivez ci-dessous ce que vous avez dit.";
    }
    if (note.transcriptionStatut === "en_cours") return "Transcription en cours…";
    if (note.transcriptionStatut === "echouee") {
      return `La transcription a échoué : ${note.transcriptionErreur ?? "erreur inconnue"}. Votre enregistrement est intact — vous pouvez relancer depuis l'écran Note vocale.`;
    }
    return "Cette note vocale n'a pas encore été transcrite.";
  }

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-16">
        <div className="px-6 pt-8">
          <a
            href={`/chantiers/${id}`}
            aria-label="Retour à la fiche du chantier"
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.rustTint }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.rust} strokeWidth="2.4">
              <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>

        <div className="px-6 pt-5">
          <p className={smallCaps} style={{ color: colors.rust, marginBottom: 8 }}>
            {chantier.nom}
          </p>
          <h1 className="text-[32px] leading-tight" style={{ fontFamily: font.display }}>
            Transcription
          </h1>
        </div>

        <p className="px-6 pt-4 text-[13px]" style={{ color: colors.muted }}>
          Texte brut de votre dictée, tel qu&apos;il a été transcrit — jamais retouché.
        </p>

        <div className="mx-6 mt-3 rounded-2xl px-5 py-5" style={{ backgroundColor: colors.card }}>
          <p
            className="whitespace-pre-wrap text-[15px] leading-relaxed"
            style={{ color: disponible ? colors.ink : colors.muted }}
          >
            {contenu()}
          </p>
        </div>

        {/* La dictée reste le but ; écrire est le filet — quand elle n'est pas
            transcrite, ou quand elle l'est de travers. */}
        {note && (
          <TexteDicte chantierId={id} texteActuel={note.transcription ?? ""} simulee={simulee} />
        )}

        {/* La suite du parcours, et non un simple lien vers l'écran suivant.
            Une dictée transcrite contient déjà tout ce qu'il faut pour écrire
            le devis : la lui faire re-saisir écran par écran était le « problème
            qui traîne » du 4 août. */}
        {disponible && (
          <div className="mt-6 px-6">
            <DevisDepuisDictee chantierId={id} transcriptionDisponible />
            <a
              href={`/chantiers/${id}/informations`}
              className="mt-4 block text-center text-[14px] font-medium"
              style={{ color: colors.muted }}
            >
              Ou vérifier les informations une par une →
            </a>
          </div>
        )}

        {note && !disponible && note.transcriptionStatut !== "en_cours" && (
          <a
            href={`/chantiers/${id}/note-vocale`}
            className="mt-5 block px-6 text-center text-[14px] font-medium"
            style={{ color: colors.rust }}
          >
            Aller à la note vocale →
          </a>
        )}
      </div>
    </div>
  );
}
