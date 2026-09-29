import { jourIso } from "@/lib/jour";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { avecCivilite } from "@/lib/civilite";
import { getCurrentCtx } from "@/server/session-ctx";
import { originePublique } from "@/server/origine-publique";
import { getClient } from "@/server/repositories/clients";
import { getEntreprise } from "@/server/repositories/entreprises";
import { listerPrestations } from "@/server/repositories/prestations-entretien";
import { dernierContratDuClient } from "@/server/repositories/contrats-entretien";
import { estProprietaire } from "@/server/autorisation";
import { abonnementDeLEntreprise } from "@/server/repositories/abonnements";
import { fonctionOuverte } from "@/lib/abonnements";
import ContratClient from "./ContratClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Contrat d'entretien, Atlas" };

/**
 * LE CONTRAT D'ENTRETIEN D'UN CLIENT — sa planche 129 du 26 septembre 2026.
 *
 * On y arrive par « Contrat d'entretien », à côté de « Autre chantier » sur la
 * fiche du client. L'écran rouvre le DERNIER contrat du client : un brouillon
 * se reprend, un contrat parti se relit (il ne se modifie plus).
 */
export default async function ContratPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCurrentCtx();
  const client = await getClient(ctx, id);
  if (!client) notFound();

  const [entreprise, modele, contrat, proprietaire, abonnement] = await Promise.all([
    getEntreprise(ctx),
    listerPrestations(ctx),
    dernierContratDuClient(ctx, id),
    estProprietaire(ctx),
    abonnementDeLEntreprise(ctx),
  ]);
  // Une prestation écrite ici entre dans sa fiche (29 septembre 2026) : les
  // mêmes droits que « Composer ma fiche », sans quoi l'action refuserait.
  const ficheModifiable = proprietaire && fonctionOuverte(abonnement?.formule, "fiche-chantier");

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24" data-atlas="ecran-contrat-entretien">
        <EnTeteEcran
          surtitre={avecCivilite(client.nom, client.civilite ?? undefined)}
          titre="Contrat d'entretien"
          retour={{ href: `/clients/${id}`, libelle: "Retour à la fiche du client" }}
        />
        <ContratClient
          client={{
            id: client.id,
            nom: client.nom,
            civilite: client.civilite ?? null,
            telephone: client.telephone ?? null,
            email: client.email ?? null,
            canal: client.canalCommunication ?? null,
          }}
          entrepriseNom={entreprise?.nom ?? ""}
          origine={originePublique(await headers())}
          modele={modele.map((p) => ({ famille: p.famille, libelle: p.libelle }))}
          ficheModifiable={ficheModifiable}
          contrat={
            contrat
              ? {
                  ...contrat,
                  envoyeLe: contrat.envoyeLe?.toISOString() ?? null,
                  reponduLe: contrat.reponduLe?.toISOString() ?? null,
                }
              : null
          }
          aujourdhui={jourIso(new Date())}
        />
      </div>
    </div>
  );
}
