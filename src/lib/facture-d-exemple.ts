/**
 * LES LIGNES DE LA FACTURE D'EXEMPLE — sa demande du 26 septembre 2026 :
 * *« deux trois lignes factices avec des TVA différentes pour que l'utilisateur
 * se rende compte »*.
 *
 * **Trois taux, trois bases.** C'est ce qu'il veut voir : comment le papier
 * ventile la TVA sous le tableau. Les désignations le DISENT (« Ligne d'exemple
 * à 10 % ») plutôt que de nommer une prestation : un « Entretien de jardin à
 * 10 % » laisserait croire que l'application connaît le taux d'un travail, ce
 * qu'elle ne sait pas (`CLAUDE.md` §4).
 *
 * **En franchise, les mêmes lignes à 0 %**, sans le taux dans leur nom : c'est
 * ce qu'une vraie facture en franchise imprime, mention 293 B comprise.
 * L'exemple ne montre jamais un papier que la réalité n'imprimerait pas.
 */

const TAUX = ["20.00", "10.00", "5.50"] as const;

const LIGNES = [
  { quantite: "1", unite: "forfait", prixUnitaire: "250.00", montant: "250.00" },
  { quantite: "12", unite: "m²", prixUnitaire: "15.00", montant: "180.00" },
  { quantite: "3", unite: "u", prixUnitaire: "40.00", montant: "120.00" },
] as const;

/**
 * « Mr. Exemple », et pas « Client d'exemple » : le papier pose une civilité
 * devant tout nom de personne (`avecCivilite`), et « Mr. Client d'exemple » se
 * lisait comme une faute. Vu à la capture du 26 septembre 2026.
 */
export const CLIENT_D_EXEMPLE = {
  clientNom: "Exemple",
  clientCivilite: "mr",
  clientAdresse: "1 rue de l'Exemple, 84000 Avignon",
  clientTelephone: null,
  adresseChantier: "1 rue de l'Exemple, 84000 Avignon",
} as const;

function tauxEcrit(taux: string): string {
  return String(Number(taux)).replace(".", ",");
}

export function factureDExemple(regimeTva: "assujettie" | "franchise" | null) {
  const franchise = regimeTva === "franchise";
  return {
    client: CLIENT_D_EXEMPLE,
    tauxDuDocument: franchise ? "0.00" : TAUX[0],
    lignes: LIGNES.map((l, i) => ({
      ...l,
      libelle: franchise ? "Ligne d'exemple" : `Ligne d'exemple à ${tauxEcrit(TAUX[i])} %`,
      tauxTva: franchise ? "0.00" : TAUX[i],
      supplement: false,
      ordre: i,
    })),
  };
}
