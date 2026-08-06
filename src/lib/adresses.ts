/**
 * Deux adresses saisies à la main désignent-elles le même endroit ?
 *
 * **Pourquoi cette règle existe, et pourquoi elle est ici.** Sur un devis,
 * l'adresse du client et celle du chantier sont le plus souvent la même — le
 * formulaire de création le dit d'ailleurs en toutes lettres : « si différente
 * de l'adresse du chantier ». L'imprimer deux fois donne un document où la même
 * rue apparaît en haut, puis en bas, sans qu'on comprenne pourquoi. Le patron
 * l'a vu le 6 août 2026 : « l'adresse n'est pas au bon endroit ».
 *
 * Elle vit dans `src/lib/` parce que **deux endroits en ont besoin** : l'écran
 * du devis et le PDF que le client reçoit. Deux implémentations auraient fini
 * par diverger, et c'est le PDF — le moins relu — qui serait resté faux
 * (`CLAUDE.md` §3).
 *
 * La comparaison est indulgente : ce sont deux champs tapés à deux moments
 * différents, une majuscule, un point ou un espace de plus ne font pas une
 * seconde adresse. Elle ne l'est pas au point de rapprocher deux rues
 * différentes : seuls la casse, les espaces et la ponctuation sont ignorés.
 */
export function memeAdresse(a?: string | null, b?: string | null): boolean {
  const x = normaliser(a);
  const y = normaliser(b);
  // Deux adresses absentes ne sont pas « la même adresse » : sans quoi un devis
  // sans aucune adresse masquerait une ligne qu'il faut au contraire proposer
  // de remplir.
  return x !== "" && x === y;
}

function normaliser(a?: string | null): string {
  return (a ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.,;]/g, " ")
    .replace(/\s+/g, " ");
}
