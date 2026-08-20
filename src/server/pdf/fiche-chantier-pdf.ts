import {
  composerDocument,
  type DonneesDocument,
  type TraceDocument,
} from "./document-commun";
import { jourNumerique } from "../../lib/jour";

// La fiche de chantier — le TROISIÈME document qu'Atlas fabrique.
//
// **D'où elle vient.** Le patron, le 20 août 2026 : *« fais en sorte que les
// fiches chantiers soient au format PDF maintenant »*. Jusque-là, deux pièces
// seulement existaient en PDF — le devis et la facture. Ce que le dépôt
// appelait « fiche chantier » était un ÉCRAN, celui où il voit les photos, la
// note vocale et les étapes ; rien qu'on puisse envoyer ni classer.
//
// **Ce que la fiche est, et ce qu'elle n'est pas.** Elle dit ce qui a été fait,
// avec quoi, et ce qu'on a observé. Elle ne dit AUCUN prix : le client l'a su
// par le devis et le saura par la facture. C'est aussi ce qui la rend
// transmissible — on peut la donner à un locataire, à un syndic, à l'assurance
// d'un voisin, sans divulguer ce que le propriétaire a payé.
//
// D'où `sansChiffrage` : ni colonnes de prix, ni totaux, ni TVA, ni IBAN. Le
// reste de la feuille est exactement celle du devis et de la facture — même
// en-tête, même bloc émetteur/client, même pied —, parce que ces trois papiers
// sortent du même artisan et doivent se ressembler.
//
// **Rien ne s'invente ici** (`CLAUDE.md` §4). Une fiche dont le chantier n'a
// aucune prestation saisie le DIT, plutôt que d'inventer une ligne plausible ;
// un créneau absent ne devient pas « journée entière ». La première version de
// la maquette annonçait « 8 h 30 → 16 h 00 · 2 personnes » : ces horaires
// n'existent nulle part en base, et le document n'aurait jamais pu les remplir.

/**
 * **Les champs de chiffrage sont retirés du type, pas remplis de zéros.**
 *
 * Le typage a refusé la première version, et il avait raison : une fiche de
 * chantier n'a ni total, ni TVA, ni devise, ni remise. Les laisser dans le type
 * aurait obligé chaque appelant à écrire `totalHt: "0"` — c'est-à-dire à
 * affirmer un montant nul là où il n'y a pas de montant du tout. Les zéros sont
 * posés une seule fois, ici, pour satisfaire le moteur commun, et nulle part
 * ailleurs.
 *
 * `conditionsPaiement` disparaît de la même façon : le bloc de notes porte les
 * observations, et son nom d'origine induirait en erreur.
 */
export type FicheChantierPdfData = Omit<
  DonneesDocument,
  | "lignes"
  | "totalHt"
  | "totalTva"
  | "totalTtc"
  | "tauxTva"
  | "devise"
  | "reductionPourcent"
  | "reductionMontant"
  | "conditionsPaiement"
> & {
  /** Le nom du chantier — « Élagage de trois chênes ». */
  chantierNom: string;
  /**
   * Le jour de l'intervention : la fin du chantier, sinon le jour posé au
   * planning. Absent tant que le chantier n'est ni planifié ni terminé — la
   * fiche s'imprime alors sans date plutôt qu'avec celle du jour, qui serait
   * fausse dès le lendemain.
   */
  jour?: string | null;
  /** « matin » / « apres-midi », tel que le planning le retient. */
  creneau?: string | null;
  /** Le nombre de demi-journées réservées. */
  demiJournees?: number | null;
  /** Le nom de l'équipe qui est passée, quand une équipe est affectée. */
  equipe?: string | null;
  /** Le numéro du devis d'origine, pour rapprocher les deux pièces. */
  numeroDevis?: string | null;
  /** Ce qui a été fait — les prestations du chantier, dans leur ordre. */
  prestations: string[];
  /** Le matériel employé. */
  materiel: string[];
  /** Ce qui a été dicté sur place, une fois transcrit. */
  observations?: string | null;
  /** Combien de photos accompagnent la fiche. */
  photos?: number | null;
};

/**
 * « Matin · 2 demi-journées · équipe Nord » — et rien de ce qui manque.
 *
 * **Chaque morceau est facultatif, et son absence ne se comble pas.** Un
 * chantier posé sans créneau était, avant la migration 0019, une journée
 * entière commençant le matin (`src/server/disponibilites.ts`) : l'écrire ici
 * reviendrait à imprimer une supposition sur un document que le client garde.
 */
function ligneIntervention(data: FicheChantierPdfData): string | null {
  const morceaux: string[] = [];
  if (data.creneau === "matin") morceaux.push("Matin");
  else if (data.creneau === "apres-midi") morceaux.push("Après-midi");
  if (data.demiJournees != null && data.demiJournees > 0) {
    morceaux.push(`${data.demiJournees} demi-journée${data.demiJournees > 1 ? "s" : ""}`);
  }
  if (data.equipe) morceaux.push(`équipe ${data.equipe}`);
  return morceaux.length > 0 ? morceaux.join(" · ") : null;
}

/**
 * La mention du pied.
 *
 * **Elle ne promet rien de juridique**, et c'est délibéré : une fiche de
 * chantier n'est ni un devis accepté ni une facture. Lui prêter la force de
 * l'un des deux — « bon pour accord », « payable à réception » — tromperait
 * celui qui la reçoit.
 */
function mentionLegaleFiche(): string {
  return (
    "Ce document rend compte des travaux réalisés. Il ne vaut ni devis ni facture, " +
    "et n'appelle aucun paiement : les montants figurent sur les pièces correspondantes."
  );
}

export async function composerFicheChantierPdf(
  data: FicheChantierPdfData
): Promise<{ pdf: Uint8Array; trace: TraceDocument }> {
  const references: [string, string][] = [["Chantier", data.chantierNom]];
  // Une date absente laisse sa ligne de côté plutôt que d'en afficher une
  // plausible : c'est le jour où l'on est venu, et personne ne peut le deviner.
  if (data.jour) references.push(["Date", jourNumerique(data.jour)]);
  const intervention = ligneIntervention(data);
  if (intervention) references.push(["Intervention", intervention]);
  if (data.numeroDevis) references.push(["Devis n°", data.numeroDevis]);

  // ─── Le corps, en lignes sans prix ────────────────────────────────────────
  //
  // Le moteur ne connaît qu'une liste de lignes : les blocs de la fiche s'y
  // écrivent donc à la file, chacun ouvert par son intertitre. C'est moins
  // souple qu'un vrai système de blocs — et c'est le prix à payer pour que les
  // trois documents restent une seule mise en page, plutôt que deux qui
  // divergent.
  const vide = { quantite: "", prixUnitaire: "0", montant: "0" };
  const lignes = [
    ...data.prestations.map((libelle) => ({ libelle, ...vide })),
    // **Un chantier sans prestation saisie le dit.** Une fiche muette laisse
    // croire à un document tronqué, et c'est celui que le client garde.
    ...(data.prestations.length === 0
      ? [{ libelle: "Aucune prestation n'a été notée sur ce chantier.", ...vide }]
      : []),
  ];

  const blocsTexte: [string, string][] = [];
  if (data.materiel.length > 0) {
    blocsTexte.push(["MATÉRIEL EMPLOYÉ", data.materiel.join(" · ")]);
  }
  // Le compte des photos, jamais les photos elles-mêmes : elles pèsent, elles
  // sont purgées au bout de deux ans (sa décision du 17 août 2026), et une
  // fiche qui les porterait cesserait d'être lisible le jour de la purge.
  if (data.photos != null && data.photos > 0) {
    const s = data.photos > 1 ? "s" : "";
    blocsTexte.push(["PHOTOS", `${data.photos} photo${s} jointe${s} au chantier.`]);
  }

  return composerDocument(
    {
      ...data,
      lignes,
      // Le bloc de notes porte ce qui a été dicté sur place, une fois transcrit.
      conditionsPaiement: data.observations ?? null,
      // Les seuls zéros du document, et ils ne s'impriment jamais : le moteur
      // commun exige ces champs, `sansChiffrage` les ignore tous.
      devise: "EUR",
      tauxTva: "0",
      totalHt: "0",
      totalTva: "0",
      totalTtc: "0",
    },
    {
      titre: "FICHE DE CHANTIER",
      references,
      enTeteLignes: "CE QUI A ÉTÉ FAIT",
      titreNotes: "OBSERVATIONS",
      mentionLegale: mentionLegaleFiche,
      // Elle ne se signe pas : il n'y a rien à accepter, les travaux sont faits.
      cadreSignature: false,
      blocsTexte,
      sansChiffrage: true,
    }
  );
}

export async function genererPdfFicheChantier(data: FicheChantierPdfData): Promise<Uint8Array> {
  return (await composerFicheChantierPdf(data)).pdf;
}
