/**
 * Les formes juridiques, à choisir plutôt qu'à écrire.
 *
 * **Demandé par le patron le 14 août 2026** : *« pareil pour la forme
 * juridique, ça serait bien qu'il y ait un bandeau déroulant avec toutes les
 * formes juridiques et qu'on ait juste à sélectionner et cliquer. »* Il avait
 * tapé « Sas » en minuscules — un sigle mal capitalisé qui part ensuite sur
 * chaque devis.
 *
 * **Le sigle porte son nom complet, et ce n'est pas décoratif :** « EURL » et
 * « SASU » ne se retiennent pas. Sans l'explication à côté, il faudrait chercher
 * ailleurs pour choisir — c'est-à-dire quitter l'application.
 *
 * **« Autre » ferme la liste, et c'est la ligne la plus importante.** Une liste
 * fermée finit toujours par exclure quelqu'un : société civile, association,
 * GAEC, forme étrangère. L'artisan qu'elle exclurait ne pourrait plus rien
 * saisir du tout, et son devis partirait sans forme juridique.
 */

export type FormeJuridique = {
  /** Ce qui s'imprime sur le devis et la facture. */
  sigle: string;
  /** Ce que le sigle veut dire, pour choisir sans chercher ailleurs. */
  nom: string;
};

/**
 * L'ordre suit ce qu'on rencontre dans le bâtiment, pas l'alphabet.
 *
 * Un artisan qui cherche « EI » ne doit pas parcourir dix lignes ; l'ordre
 * alphabétique aurait mis « SA » — une forme qu'aucun de ses clients n'a — au
 * milieu de celles qu'il emploie.
 */
export const FORMES_JURIDIQUES: readonly FormeJuridique[] = [
  { sigle: "EI", nom: "Entreprise individuelle" },
  { sigle: "Micro-entreprise", nom: "Régime de l'entreprise individuelle" },
  { sigle: "EURL", nom: "SARL à associé unique" },
  { sigle: "SARL", nom: "Société à responsabilité limitée" },
  { sigle: "SASU", nom: "SAS à associé unique" },
  { sigle: "SAS", nom: "Société par actions simplifiée" },
  { sigle: "SA", nom: "Société anonyme" },
  { sigle: "SNC", nom: "Société en nom collectif" },
  { sigle: "SCOP", nom: "Société coopérative de production" },
  { sigle: "SCI", nom: "Société civile immobilière" },
] as const;

/** Le libellé de la ligne qui laisse écrire à la main. */
export const FORME_AUTRE = "Autre";

/**
 * La forme saisie correspond-elle à une entrée de la liste ?
 *
 * **La comparaison ignore la casse et les espaces**, parce que la base contient
 * déjà ce qui a été tapé à la main : « Sas », « sasu », « S.A.S ». Les traiter
 * comme des formes inconnues afficherait « Autre » à quelqu'un qui a bel et
 * bien une SAS, et lui ferait croire que sa saisie a été perdue.
 */
export function formeConnue(valeur: string | null | undefined): FormeJuridique | null {
  const net = (valeur ?? "").trim().replace(/[.\s]/g, "").toLowerCase();
  if (net === "") return null;
  return FORMES_JURIDIQUES.find((f) => f.sigle.replace(/[.\s-]/g, "").toLowerCase() === net) ?? null;
}
