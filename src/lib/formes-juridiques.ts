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
  /**
   * A-t-elle un capital social, et un RCS (migration 0072) ? Une entreprise
   * individuelle ou une micro-entreprise n'en ont pas légalement — les deux
   * seules dont on soit certain. Ni l'un ni l'autre ne se devinent pour une
   * forme tapée à la main (voir `formeADuCapital`).
   */
  capital: boolean;
};

/**
 * L'ordre suit ce qu'on rencontre dans le bâtiment, pas l'alphabet.
 *
 * Un artisan qui cherche « EI » ne doit pas parcourir dix lignes ; l'ordre
 * alphabétique aurait mis « SA » — une forme qu'aucun de ses clients n'a — au
 * milieu de celles qu'il emploie.
 */
export const FORMES_JURIDIQUES: readonly FormeJuridique[] = [
  { sigle: "EI", nom: "Entreprise individuelle", capital: false },
  { sigle: "Micro-entreprise", nom: "Régime de l'entreprise individuelle", capital: false },
  { sigle: "EURL", nom: "SARL à associé unique", capital: true },
  { sigle: "SARL", nom: "Société à responsabilité limitée", capital: true },
  { sigle: "SASU", nom: "SAS à associé unique", capital: true },
  { sigle: "SAS", nom: "Société par actions simplifiée", capital: true },
  { sigle: "SA", nom: "Société anonyme", capital: true },
  { sigle: "SNC", nom: "Société en nom collectif", capital: true },
  { sigle: "SCOP", nom: "Société coopérative de production", capital: true },
  { sigle: "SCI", nom: "Société civile immobilière", capital: true },
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
  // Le tiret doit tomber DES DEUX CÔTÉS : sans lui ici, « Micro-entreprise »
  // tapé exactement comme le propose la liste ne se retrouvait plus jamais —
  // trouvé en écrivant `formeADuCapital` (migration 0072), qui la traitait
  // alors comme une forme libre.
  const net = (valeur ?? "").trim().replace(/[.\s-]/g, "").toLowerCase();
  if (net === "") return null;
  return FORMES_JURIDIQUES.find((f) => f.sigle.replace(/[.\s-]/g, "").toLowerCase() === net) ?? null;
}

/**
 * Le capital social et le RCS ont-ils un sens pour cette forme ?
 *
 * **Une forme libre (« Autre ») répond OUI**, faute de savoir : une société
 * civile ou un GAEC en ont, une association non, et rien ici ne permet de
 * trancher à la place de l'artisan qui l'a tapée. Seules l'EI et la
 * micro-entreprise, dont on est certain qu'elles n'en ont pas, répondent NON.
 */
export function formeADuCapital(formeJuridique: string | null | undefined): boolean {
  const valeur = (formeJuridique ?? "").trim();
  if (valeur === "") return false;
  const connue = formeConnue(valeur);
  return connue ? connue.capital : true;
}
