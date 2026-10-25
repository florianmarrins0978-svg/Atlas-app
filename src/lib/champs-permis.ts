/**
 * Ne garder d'un objet que les champs nommés, et seulement ceux qui sont là.
 *
 * **Le type TypeScript n'existe pas à l'exécution** (audit du 25 octobre 2026,
 * E2, E4, E7). Une action serveur s'appelle directement, avec l'objet qu'on
 * veut : `{ ...data }` passé à un `.set()` écrivait alors toute colonne dont la
 * clé portait le nom, autoliquidation, date d'effacement, chantier d'une ligne.
 * La liste écrite ici est la seule frontière qui existe vraiment.
 *
 * Une clé absente ou `undefined` reste absente : « non fourni » ne doit jamais
 * devenir « effacé ».
 */
export function seulement<T extends object, K extends keyof T>(objet: T, cles: readonly K[]): Pick<T, K> {
  const garde = {} as Pick<T, K>;
  for (const cle of cles) {
    if (Object.prototype.hasOwnProperty.call(objet, cle) && objet[cle] !== undefined) garde[cle] = objet[cle];
  }
  return garde;
}
