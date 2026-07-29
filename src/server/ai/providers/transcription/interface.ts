import type { ErreurIA } from "../../errors";

export type ResultatTranscription = { succes: true; texte: string } | { succes: false; erreur: ErreurIA };

export interface FournisseurTranscription {
  nom: string;
  transcrire(octets: Buffer, mimeType: string): Promise<ResultatTranscription>;
}
