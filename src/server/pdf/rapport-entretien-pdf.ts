import { composerDocument, type DonneesDocument, type TraceDocument } from "./document-commun";
import type { RapportPublic } from "../repositories/passages-entretien";
import { jourNumerique } from "../../lib/jour";
import { parFamilles } from "../../lib/prestations-entretien";
import { libelleMinutes } from "../../lib/passage-entretien";

// Le retour d'intervention en PDF, pour le dossier d'un client.
//
// **Sa demande du 22 octobre 2026** : tout télécharger d'un client en un appui,
// « tout en PDF ». Le rapport d'entretien n'existait qu'en page web
// (`/entretien/<jeton>`) : c'est lui qui manquait au dossier.
//
// **Il part de `RapportPublic`, et de rien d'autre** : ce que le client a lu sur
// son lien, ni plus ni moins. Les prestations non faites et le temps masqué ne
// sont donc pas même lisibles ici (`lireRapportParJeton` les a déjà retirés).
// Lire la base une seconde fois, autrement, aurait fait deux versions du même
// rapport (`CLAUDE.md` §3).
//
// **Régénéré, jamais stocké** : un rapport parti ne change plus (`figerPassage`,
// `supprimerPassage` refuse), donc le PDF refait dit ce que la page dit.

export type RapportEntretienPdfData = Omit<
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
  | "entrepriseNom"
  | "clientNom"
> & { rapport: RapportPublic };

export async function composerRapportEntretienPdf(
  data: RapportEntretienPdfData
): Promise<{ pdf: Uint8Array; trace: TraceDocument }> {
  const { rapport, ...entete } = data;
  const vide = { quantite: "", prixUnitaire: "0", montant: "0" };
  // Dans l'ordre de la page du client : famille après famille.
  const lignes = parFamilles(rapport.faites).flatMap((g) =>
    g.lignes.map((l) => ({ libelle: l.libelle, ...vide }))
  );

  const blocsTexte: [string, string][] = [];
  if (rapport.minutes !== null) blocsTexte.push(["TEMPS PASSÉ", libelleMinutes(rapport.minutes)]);

  return composerDocument(
    {
      ...entete,
      entrepriseNom: rapport.entrepriseNom,
      clientNom: rapport.clientNom,
      lignes,
      conditionsPaiement: rapport.observations,
      // Le moteur commun exige ces champs ; `sansChiffrage` n'en imprime aucun.
      devise: "EUR",
      tauxTva: "0",
      totalHt: "0",
      totalTva: "0",
      totalTtc: "0",
    },
    {
      titre: "RETOUR D'INTERVENTION",
      references: [["Date", jourNumerique(rapport.jour)]],
      enTeteLignes: "CE QUI A ÉTÉ FAIT",
      titreNotes: "OBSERVATIONS",
      mentionLegale: () =>
        "Ce document rend compte de l'intervention. Il ne vaut ni devis ni facture, et n'appelle aucun paiement.",
      cadreSignature: false,
      blocsTexte,
      sansChiffrage: true,
    }
  );
}

export async function genererPdfRapportEntretien(data: RapportEntretienPdfData): Promise<Uint8Array> {
  return (await composerRapportEntretienPdf(data)).pdf;
}
