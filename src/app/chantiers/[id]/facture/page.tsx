import { headers } from "next/headers";
import { notFound } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
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
        <EnTeteEcran
          retour={{ href: "/termines", libelle: "Retour aux chantiers terminés" }}
          surtitre={chantier.nom}
          titre="Facture"
        />

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
