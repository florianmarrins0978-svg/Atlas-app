import { notFound } from "next/navigation";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { getChantier } from "@/server/repositories/chantiers";
import { listerPrestations } from "@/server/repositories/prestations";
import { listerMateriel } from "@/server/repositories/materiel";
import { getBrouillon } from "@/server/repositories/brouillons-informations";
import { getNoteVocale } from "@/server/repositories/notes-vocales";
import { evaluerFraicheurBrouillon } from "@/lib/brouillon-etat";
import InformationsClient from "./InformationsClient";

export const dynamic = "force-dynamic";

export default async function InformationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ctx = await getCurrentCtx();
  const chantier = await getChantier(ctx, id);
  if (!chantier) notFound();

  const [prestations, materiel, brouillon, note] = await Promise.all([
    listerPrestations(ctx, id),
    listerMateriel(ctx, id),
    getBrouillon(ctx, id),
    getNoteVocale(ctx, id),
  ]);

  const transcriptionDisponible = note?.transcriptionStatut === "reussie" && !!note.transcription;

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-16">
        <div className="flex items-center justify-between px-6 pt-8">
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
          {/* Lien masqué sans transcription : il ne mènerait qu'à un écran vide. */}
          {transcriptionDisponible && (
            <a href={`/chantiers/${id}/transcription`} className="text-[14px] font-medium" style={{ color: colors.rust }}>
              Voir la transcription
            </a>
          )}
        </div>

        <div className="px-6 pt-5">
          <p className={smallCaps} style={{ color: colors.rust, marginBottom: 8 }}>
            {chantier.nom}
          </p>
          <h1 className="text-[32px] leading-tight" style={{ fontFamily: font.display }}>
            Informations
          </h1>
        </div>

        {/* Le bandeau n'a de sens que si une dictée a réellement alimenté cet
            écran : l'afficher sans transcription laisserait croire que ce qui
            suit vient d'une analyse. */}
        <div className="mx-6 mt-5 rounded-2xl px-4 py-3" style={{ backgroundColor: colors.rustTint }}>
          <p className="text-[13px]" style={{ color: colors.rust }}>
            {/* Sans dictée, ne pas répéter l'invitation déjà portée par la
                section Brouillon juste en dessous : dire simplement d'où
                viennent les informations affichées. */}
            {transcriptionDisponible
              ? "Proposé à partir de votre dictée — à vérifier avant de continuer."
              : "Aucune dictée n'a encore alimenté cet écran : les informations ci-dessous sont celles que vous saisissez."}
          </p>
        </div>

        <InformationsClient
          chantierId={id}
          initialPrestations={prestations.map((p) => ({ id: p.id, libelle: p.libelle }))}
          initialMateriel={materiel.map((m) => ({ id: m.id, libelle: m.libelle }))}
          initialDuree={chantier.dureePrevue ?? ""}
          initialEquipe={chantier.tailleEquipe ?? ""}
          brouillonInitial={
            brouillon
              ? {
                  contenu: brouillon.contenu,
                  statut: brouillon.statut,
                  modifieParHumain: brouillon.modifieParHumain,
                  fraicheur: evaluerFraicheurBrouillon({
                    sourceTranscription: brouillon.sourceTranscription,
                    transcriptionActuelle:
                      note?.transcriptionStatut === "reussie" ? (note.transcription ?? null) : null,
                  }),
                }
              : null
          }
          transcriptionDisponible={transcriptionDisponible}
        />
      </div>
    </div>
  );
}
