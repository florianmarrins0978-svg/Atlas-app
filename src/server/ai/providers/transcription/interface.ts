import type { ErreurIA } from "../../errors";

export type ResultatTranscription = { succes: true; texte: string } | { succes: false; erreur: ErreurIA };

export interface FournisseurTranscription {
  nom: string;
  /**
   * @param indice Les mots qu'on s'attend à entendre — le vocabulaire du métier
   *   et celui du patron (`src/lib/vocabulaire-dictee.ts`).
   *
   *   **Ajouté le 28 août 2026, et il manquait depuis le début.** Sa colère :
   *   *« je lui ai dit désherbage mais il comprend mal »* — la dictée écrivait
   *   « herbages ». Atlas connaissait pourtant son vocabulaire, mais ne s'en
   *   servait qu'APRÈS, pour relire le texte. Une connaissance qui arrive après
   *   le mot mal entendu n'a jamais servi à rien.
   *
   *   **Optionnel, et ignoré sans dommage** par un fournisseur qui ne sait pas
   *   s'en servir : il transcrit alors comme avant.
   */
  transcrire(octets: Buffer, mimeType: string, indice?: string): Promise<ResultatTranscription>;
}
