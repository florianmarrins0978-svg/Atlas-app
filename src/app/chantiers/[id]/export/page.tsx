import { notFound } from "next/navigation";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { getChantier } from "@/server/repositories/chantiers";
import { getOuCreerDevisBrouillon, chargerDevisPourEcran } from "@/server/repositories/devis";
import { listerPrestations } from "@/server/repositories/prestations";
import ExportClient from "./ExportClient";

export const dynamic = "force-dynamic";

export default async function ExportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ctx = await getCurrentCtx();
  const chantier = await getChantier(ctx, id);
  if (!chantier) notFound();

  // Si le dernier devis a déjà été envoyé, il est chargé tel quel, en lecture
  // seule — consulter cet écran ne déclenche jamais de nouvelle révision.
  // Sinon, le brouillon est créé ou régénéré depuis les lignes de prix courantes.
  const devisRow = (await chargerDevisPourEcran(ctx, id)) ?? (await getOuCreerDevisBrouillon(ctx, id));
  const prestations = await listerPrestations(ctx, id);

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
            Devis
          </h1>
        </div>

        <ExportClient
          chantierId={id}
          devisId={devisRow.id}
          chantierNom={chantier.nom}
          adresseChantier={chantier.adresseChantier ?? "Adresse non renseignée"}
          clientNom={devisRow.clientNom ?? "Client non renseigné"}
          clientTelephone={devisRow.clientTelephone ?? ""}
          prestations={prestations.map((p) => p.libelle)}
          totalTtc={devisRow.totalTtc}
          initialEnvoye={devisRow.statut === "envoye"}
        />
      </div>
    </div>
  );
}
