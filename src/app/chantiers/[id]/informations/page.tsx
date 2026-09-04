import { notFound } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font, libelleCaps, texteSituation } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { getChantier } from "@/server/repositories/chantiers";
import { listerPrestations } from "@/server/repositories/prestations";
import { listerMateriel } from "@/server/repositories/materiel";
import { getBrouillon } from "@/server/repositories/brouillons-informations";
import { getNoteVocale } from "@/server/repositories/notes-vocales";
import { estTranscriptionSimulee } from "@/server/ai/providers/transcription/dev";
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

  // Une transcription « réussie » sans prestataire raccordé n'est pas une
  // transcription : c'est un texte de remplacement. La traiter comme telle
  // faisait afficher « Proposé à partir de votre dictée » au-dessus de
  // prestations fabriquées à partir de ce texte — le patron les a retrouvées
  // dans son devis.
  const simulee = estTranscriptionSimulee(note?.transcription);
  const transcriptionDisponible =
    !simulee && note?.transcriptionStatut === "reussie" && !!note.transcription;

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-16">
        {/* Cet écran était le seul des sept à s'être dessiné son propre en-tête :
            les six autres sont passés à `EnTeteEcran` le 10 août, il avait été
            oublié. Son titre tenait en 32 px, son surtitre en vert pin —
            l'écart sautait aux yeux dès qu'on venait de la fiche du chantier. */}
        {/* **La flèche HÉRITE de celle de la fiche du chantier**, mot pour mot,
            depuis que celle-ci a disparu (4 septembre 2026, `ARCHITECTURE.md`
            §254). Cet écran était à un cran d'elle : il prend sa place, il
            n'invente pas une destination. */}
        <EnTeteEcran
          retour={{ href: "/", libelle: "Retour à la liste des chantiers" }}
          surtitre={chantier.nom}
          titre="Informations"
        />

        {/* D'où viennent les informations affichées — désormais une phrase de
            situation, et non plus un encart teinté.
            Le teinté disait quelque chose qu'il ne voulait pas dire : la couleur
            ne désigne ici aucun geste à faire, et une couleur qui ne désigne
            rien est une couleur en trop (`HANDOVER.md`, règle née de la
            maquette 12). La phrase n'a pas changé, sa voix seulement. */}
        <div className="flex flex-col items-start gap-3 px-[26px] pt-6">
          <p className={texteSituation} style={{ color: colors.muted }}>
            {/* Sans dictée, ne pas répéter l'invitation déjà portée par la
                section Brouillon juste en dessous : dire simplement d'où
                viennent les informations affichées. */}
            {transcriptionDisponible
              ? "Proposé à partir de votre dictée — à vérifier avant de continuer."
              : simulee && note
                ? "Votre dictée est enregistrée mais n'a pas été transcrite : aucun prestataire de transcription n'est encore raccordé. Les informations ci-dessous sont celles que vous saisissez."
                : "Aucune dictée n'a encore alimenté cet écran : les informations ci-dessous sont celles que vous saisissez."}
          </p>

          {/* Ce lien était à droite du titre. Vu en capture : « Voir la
              transcription » en capitales espacées mange plus de la moitié de
              la largeur, et le nom du chantier se replie sur deux lignes pour
              lui faire place — l'en-tête, qui doit être le point calme de
              l'écran, devenait le plus encombré.
              Il est ici parce que c'est ici qu'on parle de la dictée.
              Masqué sans transcription : il ne mènerait qu'à un écran vide. */}
          {transcriptionDisponible && (
            <a href={`/chantiers/${id}/transcription`} className={libelleCaps} style={{ color: colors.rust }}>
              Voir la transcription
            </a>
          )}
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
                  lecture: brouillon.lecture,
                  fraicheur: evaluerFraicheurBrouillon({
                    sourceTranscription: brouillon.sourceTranscription,
                    transcriptionActuelle:
                      note?.transcriptionStatut === "reussie" ? (note.transcription ?? null) : null,
                  }),
                }
              : null
          }
          transcriptionDisponible={transcriptionDisponible}
          dicteeNonTranscrite={simulee && !!note}
        />
      </div>
    </div>
  );
}
