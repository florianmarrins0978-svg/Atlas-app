export type TypeErreurIA =
  | "fournisseur_indisponible"
  | "timeout"
  | "reponse_invalide"
  | "schema_invalide"
  | "quota_depasse"
  | "cle_api_absente";

export type ErreurIA = { type: TypeErreurIA; message: string };

export function erreurIA(type: TypeErreurIA, message: string): ErreurIA {
  return { type, message };
}
