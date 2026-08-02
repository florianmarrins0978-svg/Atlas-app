import type { Ctx } from "../../repositories/context";
import { getNoteVocale } from "../../repositories/notes-vocales";
import {
  getBrouillon,
  enregistrerGeneration,
  type Brouillon,
} from "../../repositories/brouillons-informations";
import { extraire } from "./extraction-service";
import { estTranscriptionSimulee } from "../providers/transcription/dev";
import type { PropositionExtraction } from "../schemas/extraction";

export type ResultatGeneration =
  | { statut: "genere"; brouillon: Brouillon }
  // Le brouillon porte des corrections humaines : rien n'est écrit. La nouvelle
  // proposition est renvoyée pour que le patron tranche lui-même.
  | { statut: "conflit"; brouillonActuel: Brouillon; propositionNouvelle: PropositionExtraction }
  | { statut: "transcription_absente" }
  // Aucun prestataire de transcription n'est configuré : la dictée n'a pas été
  // écoutée. Rien ne peut en être extrait, et surtout rien ne doit l'être.
  | { statut: "transcription_simulee" }
  | { statut: "echec"; erreur: string };

// Produit le brouillon structuré à partir de la transcription du chantier.
//
// Point d'entrée unique de la génération, quel que soit le déclencheur. Deux
// garanties portées ici, et nulle part ailleurs :
//
// 1. La source est la transcription réellement enregistrée — jamais un texte
//    fourni par le client, qui pourrait ne rien avoir à voir avec la dictée.
// 2. Une génération n'écrase jamais silencieusement des corrections humaines :
//    si le brouillon a été retouché, la fonction refuse d'écrire et renvoie la
//    nouvelle proposition à côté de l'existant. Seul `remplacer: true`,
//    c'est-à-dire un choix explicite du patron, autorise l'écrasement.
// 3. Rien n'est extrait d'une transcription qui n'en est pas une.
export async function genererBrouillon(
  ctx: Ctx,
  chantierId: string,
  options: { remplacer?: boolean } = {}
): Promise<ResultatGeneration> {
  const note = await getNoteVocale(ctx, chantierId);
  const transcription = note?.transcription?.trim();
  if (!transcription) {
    return { statut: "transcription_absente" };
  }

  // Sans prestataire raccordé, la dictée n'a jamais été écoutée : ce qui est
  // enregistré est notre texte de remplacement. En extraire quoi que ce soit
  // reviendrait à fabriquer des prestations à partir de rien — ce qui s'est
  // produit, et que le patron a retrouvé dans son devis. La reconnaissance
  // porte sur CE texte précis, jamais sur la configuration : une transcription
  // légitime doit continuer à être analysée normalement.
  if (estTranscriptionSimulee(transcription)) {
    return { statut: "transcription_simulee" };
  }

  const existant = await getBrouillon(ctx, chantierId);

  const resultat = await extraire(transcription);
  if (!resultat.succes) {
    return { statut: "echec", erreur: resultat.erreur.message };
  }

  if (existant && existant.modifieParHumain && !options.remplacer) {
    return { statut: "conflit", brouillonActuel: existant, propositionNouvelle: resultat.proposition };
  }

  const brouillon = await enregistrerGeneration(ctx, chantierId, resultat.proposition, transcription);
  return { statut: "genere", brouillon };
}
