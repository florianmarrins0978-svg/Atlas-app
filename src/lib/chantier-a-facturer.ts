/**
 * QUEL CHANTIER « FAIRE LA FACTURE » DOIT-IL FACTURER ? — 3 octobre 2026.
 *
 * Sa remarque : *« j'ai voulu créer une facture avant la date de fin de
 * chantier, sauf qu'il ne reprend pas le devis du client »*. La fiche client
 * de « Créer une facture » reconnaissait le client, puis ouvrait un chantier
 * NEUF et une facture VIDE, alors que son devis envoyé attendait sur un autre
 * chantier. Le prix accepté n'était repris nulle part, et un chantier en double
 * restait derrière.
 *
 * **La facture directe n'existe que pour ce qui n'a pas de devis** (sa
 * décision du 10 septembre, `creerFactureSansDevis`). Un client dont un devis
 * envoyé n'est pas encore facturé se facture donc par la porte ordinaire, sur
 * CE chantier-là.
 *
 * | candidats | ce qu'on fait |
 * |---|---|
 * | aucun | la facture directe, comme avant |
 * | un seul, ou un seul à l'adresse saisie | sa facture, reprise du devis |
 * | plusieurs, sans que l'adresse tranche | on ne choisit pas à sa place |
 *
 * **Deviner entre deux devis serait facturer un client sur le mauvais prix** :
 * l'adresse départage, sinon on le dit.
 */

export type ChantierCandidat = { id: string; adresseChantier: string | null };

export type ChantierAFacturer =
  | { type: "aucun" }
  | { type: "un"; chantierId: string }
  | { type: "plusieurs" };

/** « 12 Rue Lecourbe » et « 12 rue  lecourbe » sont la même adresse. */
function adresseRapprochee(adresse: string | null | undefined): string {
  return (adresse ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function chantierAFacturer(
  candidats: ChantierCandidat[],
  adresseSaisie: string
): ChantierAFacturer {
  if (candidats.length === 0) return { type: "aucun" };
  if (candidats.length === 1) return { type: "un", chantierId: candidats[0].id };

  const saisie = adresseRapprochee(adresseSaisie);
  const memeAdresse = saisie
    ? candidats.filter((c) => adresseRapprochee(c.adresseChantier) === saisie)
    : [];
  if (memeAdresse.length === 1) return { type: "un", chantierId: memeAdresse[0].id };
  return { type: "plusieurs" };
}
