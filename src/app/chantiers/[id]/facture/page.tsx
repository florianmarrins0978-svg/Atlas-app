import { headers } from "next/headers";
import { originePublique } from "@/server/origine-publique";
import { notFound } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { getChantier } from "@/server/repositories/chantiers";
import { getFacturePourChantier } from "@/server/repositories/factures";
import { devisQuiFaitFoi } from "@/server/repositories/devis";
import { repriseDuDevis } from "@/lib/facture-face-au-devis";
import { getClient } from "@/server/repositories/clients";
import { getEntreprise } from "@/server/repositories/entreprises";
import { exigibiliteDe } from "@/server/repositories/paiements-facture";
import { dernierEnvoiFacture } from "@/server/repositories/envois-factures";
import FactureClient from "./FactureClient";

export const dynamic = "force-dynamic";

export default async function FacturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ctx = await getCurrentCtx();
  const chantier = await getChantier(ctx, id);
  if (!chantier) notFound();

  // Ce que la facture arrêtée devient dépend du régime : au relevé tout de
  // suite, ou en attente de règlement (migration 0045).
  const regimeTva = await exigibiliteDe(ctx);

  // La facture n'est PAS bâtie à l'ouverture de l'écran : consulter n'est pas
  // clôturer. Elle naît de l'appui sur « Créer la facture », jamais d'un regard.
  const existante = await getFacturePourChantier(ctx, id);

  const [entreprise, client] = await Promise.all([
    getEntreprise(ctx),
    chantier.clientId ? getClient(ctx, chantier.clientId) : Promise.resolve(null),
  ]);

  // L'adresse complète est bâtie ICI, côté serveur, et non depuis `window` :
  // composée dans le navigateur, elle diffère de ce que le serveur a rendu, et
  // React régénère alors tout l'arbre. Le patron doit pouvoir copier une
  // adresse entière — un chemin seul ne s'ouvre nulle part.
  // **Le lien déjà préparé, lu ICI plutôt que redemandé à l'écran.**
  //
  // Depuis le 22 août 2026, « Envoyer la facture » arrête ET prépare le lien en
  // un seul appui (`ARCHITECTURE.md` §152). L'écran d'après ne le savait pas :
  // il repropusait « Envoyer la facture au client », c'est-à-dire un second
  // appui pour refaire ce qui venait d'être fait. Le patron l'aurait retrouvé
  // le jour où sa messagerie refuse de s'ouvrir — précisément le jour où cet
  // écran doit le rattraper.
  const envoiDejaFait = existante ? await dernierEnvoiFacture(ctx, existante.facture.id) : null;

  // **LE DEVIS QUI FAIT FOI, CONFRONTÉ À CELUI QUE LA FACTURE REPREND.**
  //
  // Une facture bâtie à la fin du chantier ne bouge plus : un devis corrigé et
  // renvoyé ensuite ne l'atteignait jamais, et le second arrêt du parcours se
  // franchissait sur l'ancien prix. La comparaison est une fonction pure
  // (`src/lib/facture-face-au-devis.ts`), et elle ne fait que DIRE — c'est un
  // geste du patron qui reprend.
  const devisFoi = existante ? await devisQuiFaitFoi(ctx, id) : null;
  const reprise = existante
    ? repriseDuDevis(
        { devisId: existante.facture.devisId, statut: existante.facture.statut },
        devisFoi
          ? {
              id: devisFoi.id,
              numeroCommercial: devisFoi.numeroCommercial,
              numeroVersion: devisFoi.numeroVersion,
            }
          : null
      )
    : { aJour: true as const };

  const origine = originePublique(await headers());

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
          regimeTva={regimeTva}
          reprise={reprise}
          origine={origine}
          entrepriseNom={entreprise?.nom ?? ""}
          modeleMessage={entreprise?.messageClient ?? null}
          // Sans lui, une coordonnée manquante ne peut se saisir nulle part :
          // il n'existe aucun écran de fiche client (voir `TransmettreLaFacture`).
          clientId={chantier.clientId ?? null}
          clientTelephone={client?.telephone ?? null}
          clientEmail={client?.email ?? null}
          canalClient={(client?.canalCommunication as "sms" | "email" | null) ?? null}
          jetonDejaPrepare={envoiDejaFait?.jeton ?? null}
          initialFacture={
            existante
              ? {
                  id: existante.facture.id,
                  numeroCommercial: existante.facture.numeroCommercial,
                  statut: existante.facture.statut,
                  // De quel devis viennent ces lignes. Le PDF l'écrit depuis
                  // toujours ; l'écran du patron, non.
                  numeroDevis: existante.numeroDevis,
                  versionDevis: existante.versionDevis,
                  clientNom: existante.facture.clientNom,
                  clientCivilite: existante.facture.clientCivilite,
                  dateEmission: existante.facture.dateEmission,
                  dateEcheance: existante.facture.dateEcheance,
                  tauxTva: existante.facture.tauxTva,
                  // **Le prix accordé au client voyage jusqu'à l'écran.** Sans
                  // lui, la somme des lignes affichées ne faisait pas le Total
                  // HT affiché, et rien ne disait pourquoi — au second arrêt,
                  // sur le montant qu'il défend devant son client.
                  reductionPourcent: existante.facture.reductionPourcent,
                  lignes: existante.lignes.map((l) => ({
                    id: l.id,
                    libelle: l.libelle,
                    montant: l.montant,
                    // Le taux de sa catégorie, comme sur le papier
                    // (migration 0073) : sans lui, l'écran ventilait tout sur
                    // le taux du document.
                    tauxTva: l.tauxTva,
                  })),
                }
              : null
          }
        />
      </div>
    </div>
  );
}
