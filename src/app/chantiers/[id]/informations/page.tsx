import { notFound } from "next/navigation";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { getChantier } from "@/server/repositories/chantiers";
import { listerPrestations } from "@/server/repositories/prestations";
import { listerMateriel } from "@/server/repositories/materiel";
import InformationsClient from "./InformationsClient";

export const dynamic = "force-dynamic";

export default async function InformationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ctx = await getCurrentCtx();
  const chantier = await getChantier(ctx, id);
  if (!chantier) notFound();

  const [prestations, materiel] = await Promise.all([listerPrestations(ctx, id), listerMateriel(ctx, id)]);

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
          <a href={`/chantiers/${id}/transcription`} className="text-[14px] font-medium" style={{ color: colors.rust }}>
            Voir la transcription
          </a>
        </div>

        <div className="px-6 pt-5">
          <p className={smallCaps} style={{ color: colors.rust, marginBottom: 8 }}>
            {chantier.nom}
          </p>
          <h1 className="text-[32px] leading-tight" style={{ fontFamily: font.display }}>
            Informations
          </h1>
        </div>

        <div className="mx-6 mt-5 rounded-2xl px-4 py-3" style={{ backgroundColor: colors.rustTint }}>
          <p className="text-[13px]" style={{ color: colors.rust }}>
            Proposé à partir de la dictée — à vérifier avant de continuer.
          </p>
        </div>

        <InformationsClient
          chantierId={id}
          initialPrestations={prestations.map((p) => ({ id: p.id, libelle: p.libelle }))}
          initialMateriel={materiel.map((m) => ({ id: m.id, libelle: m.libelle }))}
          initialDuree={chantier.dureePrevue ?? ""}
          initialEquipe={chantier.tailleEquipe ?? ""}
        />
      </div>
    </div>
  );
}
