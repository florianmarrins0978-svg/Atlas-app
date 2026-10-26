import { enEuros } from "@/lib/euros";
import { categorieDeLaLigne, jourEnMots, ressembleAUnVirement, type Categorie } from "@/lib/pour-mon-comptable";
import type { FactureARapprocher } from "@/lib/rapprochement-bancaire";
import type { LigneDuReleve, TicketDeLaLigne } from "@/server/repositories/pour-mon-comptable";

/**
 * UNE LIGNE QUI ATTEND SA RÉPONSE, prête pour sa carte. Une seule fabrique pour
 * le dossier en cours et pour les rejets du comptable (Mes dossiers) : deux
 * copies finiraient par ne plus proposer les mêmes gestes (`CLAUDE.md` §3).
 */

export type ARegarder = {
  id: string;
  /** `carte` : un achat sans ticket ; `virement` : un virement envoyé sans pièce ; `entree` : un virement reçu. */
  genre: "carte" | "virement" | "entree";
  qui: string;
  jour: string;
  montant: string;
  /** « 864.00 » : ce contre quoi chaque pièce proposée se compare, au centime. */
  montantBrut: string;
  categorie: Categorie;
  /** Les tickets du même montant, quand il y en a plusieurs (ou un seul, pour un rejet). */
  tickets: { id: string; fournisseur: string; jour: string }[];
  /**
   * Pour un virement reçu : les factures d'Atlas qui attendent leur paiement et
   * qu'il peut payer, c'est-à-dire émises au plus tard le jour du virement.
   * `noterPaiementDans` refuse un règlement daté d'avant sa facture : la
   * proposer serait proposer un refus.
   */
  factures: FactureEnAttente[];
  /**
   * La raison du comptable, quand il a rejeté la ligne (lot 4) : la carte
   * vit alors dans Mes dossiers, et propose aussi un ticket unique du même
   * montant, puisque celui qu'Atlas avait relié ne lui convenait pas.
   */
  rejet?: string | null;
};

/** `qui` : le client, quand la facture le nomme ; sans lui, la carte la nomme par son numéro. */
export type FactureEnAttente = { id: string; qui: string | null; numero: string; reste: string; resteBrut: string };

/** Une facture de fournisseur qu'une sortie peut prendre. */
export type Facture = { id: string; nom: string; societe: string; montant: string | null; montantBrut: string | null };

export function carteDeLaLigne(
  l: LigneDuReleve,
  tickets: readonly TicketDeLaLigne[],
  enAttente: readonly FactureARapprocher[],
  rejet?: string | null
): ARegarder {
  const genre =
    l.sens === "entree"
      ? "entree"
      : ressembleAUnVirement(l.libelle) || l.justification === "facture" || l.justification === "motif"
        ? "virement"
        : "carte";
  return {
    id: l.id,
    genre,
    qui: l.contrepartie ?? l.libelle,
    jour: jourEnMots(l.jour),
    montant: enEuros(l.montant),
    montantBrut: l.montant,
    categorie: categorieDeLaLigne({ sens: l.sens, libelle: l.libelle, natureDuTicket: l.ticket?.nature ?? null, justification: l.justification }),
    tickets: l.sens === "sortie" ? tickets.map((t) => ({ id: t.id, fournisseur: t.fournisseur, jour: `Ticket du ${jourEnMots(t.dateAchat)}` })) : [],
    factures:
      l.sens === "entree"
        ? enAttente
            .filter((f) => f.dateEmission <= l.jour)
            .map((f) => ({ id: f.id, qui: f.clientNom, numero: f.numero, reste: enEuros(f.reste), resteBrut: f.reste }))
        : [],
    ...(rejet !== undefined ? { rejet } : {}),
  };
}

export function facturesAffichees(f: readonly { id: string; nom: string; societe: string; totalTtc: string | null }[]): Facture[] {
  return f.map((x) => ({ id: x.id, nom: x.nom, societe: x.societe, montant: x.totalTtc ? enEuros(x.totalTtc) : null, montantBrut: x.totalTtc }));
}
