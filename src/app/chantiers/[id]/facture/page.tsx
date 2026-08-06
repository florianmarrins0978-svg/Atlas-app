import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { getChantier } from "@/server/repositories/chantiers";
import { getFacturePourChantier } from "@/server/repositories/factures";
import { getClient } from "@/server/repositories/clients";
import { getEntreprise } from "@/server/repositories/entreprises";
import FactureClient from "./FactureClient";

export const dynamic = "force-dynamic";

export default async function FacturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ctx = await getCurrentCtx();
  const chantier = await getChantier(ctx, id);
  if (!chantier) notFound();

  // La facture n'est PAS bâtie à l'ouverture de l'écran : consulter n'est pas
  // clôturer. Elle naît de l'appui sur « Fin de chantier », jamais d'un regard.
  const existante = await getFacturePourChantier(ctx, id);

  const [entreprise, client] = await Promise.all([
    getEntreprise(ctx),
    chantier.clientId ? getClient(ctx, chantier.clientId) : Promise.resolve(null),
  ]);

  // L'adresse complète est bâtie ICI, côté serveur, et non depuis `window` :
  // composée dans le navigateur, elle diffère de ce que le serveur a rendu, et
  // React régénère alors tout l'arbre. Le patron doit pouvoir copier une
  // adresse entière — un chemin seul ne s'ouvre nulle part.
  const entetes = await headers();
  const hote = entetes.get("x-forwarded-host") ?? entetes.get("host") ?? "";
  const protocole = entetes.get("x-forwarded-proto") ?? (hote.startsWith("localhost") ? "http" : "https");
  const origine = hote ? `${protocole}://${hote}` : "";

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-16">
        <div className="px-6 pt-8">
          <a
            href="/termines"
            aria-label="Retour aux chantiers terminés"
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
            Facture
          </h1>
        </div>

        <FactureClient
          chantierId={id}
          origine={origine}
          entrepriseNom={entreprise?.nom ?? ""}
          clientTelephone={client?.telephone ?? null}
          clientEmail={client?.email ?? null}
          canalClient={(client?.canalCommunication as "sms" | "email" | null) ?? null}
          initialFacture={
            existante
              ? {
                  id: existante.facture.id,
                  numeroCommercial: existante.facture.numeroCommercial,
                  statut: existante.facture.statut,
                  clientNom: existante.facture.clientNom,
                  dateEcheance: existante.facture.dateEcheance,
                  tauxTva: existante.facture.tauxTva,
                  totalHt: existante.facture.totalHt,
                  totalTva: existante.facture.totalTva,
                  totalTtc: existante.facture.totalTtc,
                  lignes: existante.lignes.map((l) => ({
                    id: l.id,
                    libelle: l.libelle,
                    montant: l.montant,
                  })),
                }
              : null
          }
        />
      </div>
    </div>
  );
}
