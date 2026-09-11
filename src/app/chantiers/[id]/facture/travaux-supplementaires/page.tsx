import { notFound, redirect } from "next/navigation";
import { getCurrentCtx } from "@/server/session-ctx";
import { getChantier } from "@/server/repositories/chantiers";
import { getFacturePourChantier } from "@/server/repositories/factures";
import TravauxSupplementairesClient from "./TravauxSupplementairesClient";

export const dynamic = "force-dynamic";

/**
 * LA FEUILLE DES TRAVAUX SUPPLÉMENTAIRES — sa demande du 9 septembre 2026.
 *
 * *« À la place de la phrase "rien n'a changé depuis le devis ?", je veux un
 * bouton "ajouter des travaux supplémentaires" ; ça ouvre la vraie page du
 * devis avec toutes les infos du devis en question, et une catégorie comme pour
 * l'ajout d'une TVA se crée direct. »*
 *
 * **Ce n'est PAS l'écran du devis, et ça ne pouvait pas l'être.** Un devis parti
 * ne se réécrit pas — `trg_devis_immuable` le refuse, et c'est ce qui garantit
 * que le document accepté par le client reste ce qu'il a accepté. Sa règle du
 * même jour : *« le devis ne se réécrit pas, seulement la case travaux
 * supplémentaires ; le reste, impossible de les modifier ».*
 *
 * Cette page montre donc la feuille — les lignes du devis, ses totaux — mais
 * elle écrit sur la FACTURE, dans les seules lignes marquées `supplement`.
 *
 * **Deux refus avant même d'ouvrir**, et ils renvoient plutôt que d'afficher un
 * écran mort : pas de facture (rien à compléter), facture déjà arrêtée (elle
 * est partie chez le client et inscrite au relevé).
 */
export default async function TravauxSupplementairesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getCurrentCtx();
  const chantier = await getChantier(ctx, id);
  if (!chantier) notFound();

  const existante = await getFacturePourChantier(ctx, id);
  // Sans facture, il n'y a rien à compléter : on le ramène là où elle se crée,
  // plutôt que de lui montrer une feuille vide qui ne mène nulle part.
  if (!existante) redirect(`/chantiers/${id}/facture`);
  if (existante.facture.statut !== "brouillon") redirect(`/chantiers/${id}/facture`);

  return (
    <TravauxSupplementairesClient
      chantierId={id}
      chantierNom={chantier.nom}
      adresseChantier={chantier.adresseChantier}
      factureId={existante.facture.id}
      numeroFacture={existante.facture.numeroCommercial}
      clientNom={existante.facture.clientNom}
      clientCivilite={existante.facture.clientCivilite}
      numeroDevis={existante.numeroDevis}
      // **Nul = faite sans devis (migration 0086), et TOUT s'y saisit.** La
      // règle n'est pas ici — elle est dans `ligneSeCorrige`, la même que le
      // dépôt applique dans le WHERE de ses écritures. L'écran transporte le
      // fait, il n'en tire aucune conclusion de son côté.
      devisId={existante.facture.devisId}
      tauxTvaFacture={existante.facture.tauxTva}
      reductionPourcent={existante.facture.reductionPourcent}
      lignes={existante.lignes.map((l) => ({
        id: l.id,
        libelle: l.libelle,
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
        montant: l.montant,
        tauxTva: l.tauxTva,
        supplement: l.supplement,
      }))}
    />
  );
}
