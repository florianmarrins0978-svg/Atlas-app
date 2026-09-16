/**
 * LA DÉCENNALE ET LE MÉDIATEUR — deux mentions que la loi attend d'un devis
 * adressé à un particulier.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **Son accord du 14 septembre 2026**, planche `appli/decennale-et-mediateur.html`,
 * codé le 16 : elles vivaient jusque-là comme deux **crochets à remplir à la
 * main** dans le texte des conditions générales — `[assureur, n° de contrat,
 * couverture géographique]` et `[nom et coordonnées]`.
 *
 * **Pourquoi les crochets ne pouvaient pas rester.** Il a demandé qu'on les
 * colore en rouge pour les retrouver : c'est impossible, la case est un champ
 * de saisie et n'affiche que du texte nu. Et surtout, les colorer aurait
 * traité le symptôme : le vrai défaut est qu'une information d'entreprise
 * — celle qui ne change qu'une fois par an — se ressaisit dans un texte, donc
 * se recopie, donc diverge du jour où il change d'assureur.
 *
 * Elles se saisissent désormais **une fois**, dans Mon entreprise, comme le
 * SIRET ; les articles 9 et 11 se remplissent tout seuls, et le bas du devis
 * comme celui de la facture les portent.
 *
 * **Rien ne s'invente.** Sans le nom de l'assureur ou du médiateur, la mention
 * ne s'imprime pas et le crochet RESTE dans le texte : un artisan qui n'a rien
 * saisi doit voir qu'il manque quelque chose, pas lire une phrase incomplète
 * partie chez son client (`docs/AGENT.md` §3).
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type DonneesMentionsObligatoires = {
  assureurDecennale?: string | null;
  contratDecennale?: string | null;
  couvertureDecennale?: string | null;
  mediateurNom?: string | null;
  mediateurCoordonnees?: string | null;
};

const propre = (v: string | null | undefined): string => (v ?? "").trim();

/**
 * Ce qui remplace le crochet de l'article 9 — sans préfixe ni point final,
 * parce que la phrase qui l'accueille porte déjà les deux.
 *
 * **Le nom de l'assureur commande.** Un numéro de contrat seul ne désigne
 * aucune compagnie : imprimé sans elle, il ne prouve rien et ne se vérifie
 * pas. Les deux autres champs s'ajoutent s'ils sont là.
 */
export function contenuDecennale(d: DonneesMentionsObligatoires): string | null {
  const assureur = propre(d.assureurDecennale);
  if (assureur === "") return null;
  const contrat = propre(d.contratDecennale);
  return [assureur, contrat === "" ? "" : `contrat n° ${contrat}`, propre(d.couvertureDecennale)]
    .filter(Boolean)
    .join(", ");
}

/** Ce qui remplace le crochet de l'article 11. Le nom commande, pour la même raison. */
export function contenuMediateur(d: DonneesMentionsObligatoires): string | null {
  const nom = propre(d.mediateurNom);
  if (nom === "") return null;
  return [nom, propre(d.mediateurCoordonnees)].filter(Boolean).join(", ");
}

/**
 * Les lignes telles qu'elles s'impriment en bas du devis ET de la facture.
 *
 * Zéro, une ou deux — jamais une phrase à trou. C'est la même fonction pour
 * les deux documents : deux façons de composer la même mention finiraient par
 * diverger, et c'est le client qui lirait deux versions du même engagement
 * (`CLAUDE.md` §3).
 */
export function lignesMentionsObligatoires(d: DonneesMentionsObligatoires): string[] {
  const decennale = contenuDecennale(d);
  const mediateur = contenuMediateur(d);
  return [
    decennale === null ? null : `Assurance décennale : ${decennale}.`,
    mediateur === null ? null : `Médiateur de la consommation : ${mediateur}.`,
  ].filter((l): l is string => l !== null);
}
