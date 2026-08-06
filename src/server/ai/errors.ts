export type TypeErreurIA =
  | "fournisseur_indisponible"
  | "timeout"
  | "reponse_invalide"
  | "schema_invalide"
  | "quota_depasse"
  | "cle_api_absente"
  // Distinct de `cle_api_absente`, et la distinction vaut son existence : une
  // clé refusée se corrige en la remplaçant, une clé absente en la posant.
  // Confondre les deux, c'est envoyer chercher au mauvais endroit — un
  // « fournisseur indisponible » sur un HTTP 401 a fait croire à une panne du
  // prestataire alors que la clé était simplement mauvaise.
  | "cle_api_refusee";

export type ErreurIA = { type: TypeErreurIA; message: string };

export function erreurIA(type: TypeErreurIA, message: string): ErreurIA {
  return { type, message };
}
