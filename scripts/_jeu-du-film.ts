/**
 * Ce que le film de promotion montre, écrit une seule fois.
 *
 * Deux scripts s'en servent : `preparer-jeu-du-film.mts`, qui reconstruit ce
 * jeu à la main du patron, et `capturer-ecrans-du-film.mts`, qui photographie
 * les écrans qui en résultent. Recopier ces valeurs dans l'un et l'autre, c'est
 * les voir diverger au premier chiffre retouché, et c'est précisément ce que le
 * film interdit : rien de ce qui s'affiche n'est inventé ni retouché.
 *
 * Les valeurs sont celles déjà visibles sur les premières captures
 * (appli/video-promo/film/devis-pdf.jpg, facture.jpg, planning.jpg).
 */
// Comme celle de la cliente, l'adresse de l'entreprise ne doit désigner personne :
// un numéro qu'aucune impasse ne porte (non vérifié, voir plus bas).
export const ENTREPRISE = { nom: "Les Jardins de Loire", adresse: "214 impasse des Mésanges, Nantes" };
/** Les chantiers du seed qui se voient sur l'accueil : leurs adresses sont celles d'une démonstration, pas de vraies rues. */
export const ADRESSES_DU_SEED: Record<string, string> = {
  "Pose de clôture": "146 chemin des Glycines, Vertou",
  "Rénovation salle de bain": "73 allée des Hortensias, Nantes",
  "Terrasse bois": "58 impasse des Pivoines, Nantes",
};
// La civilité est un bouton à part sur la fiche client : le nom se tape sans
// elle, sans quoi l'écran du devis écrit « Mme Mme Martin » (vu sur la
// capture de l'éditeur, 5 octobre 2026).
// Ni l'adresse ni le numéro ne doivent exister : une vraie personne n'a pas à se
// retrouver dans une vidéo de promotion. Le numéro est dans la tranche que
// l'ARCEP réserve à la fiction (06 39 98 xx xx) ; l'adresse est un numéro
// qu'aucune impasse ne porte. Non vérifié contre la Base Adresse Nationale :
// le mandataire de cet environnement ne la joint pas (5 octobre 2026).
export const CLIENTE = { civilite: "Mme", nom: "Martin", telephone: "06 39 98 21 47", adresse: "148 impasse des Pervenches, Rezé" };
export const CHANTIER_NOM = "Haie de laurier et érable";
// La dictée du film, mot pour mot : c'est elle que le devis réécrit en phrases.
export const DICTEE_DU_FILM =
  "J'ai une haie de laurier à rabattre sur 50 ml et je dois tailler les faces. Une taille de cohabitation d'un érable, et mise en sécurité par suppression des bois morts.";
// Les prix sont ceux d'une démonstration : la dictée n'en porte aucun.
export const LIGNES = [
  { libelle: "Taille de la haie de laurier, rabattage sur 50 ml et taille des deux faces", prix: "700", montant: "700.00" },
  { libelle: "Taille de cohabitation d'un érable et mise en sécurité par suppression du bois mort", prix: "380", montant: "380.00" },
];
export const TOTAUX = { ht: "1080.00", tva: "216.00", ttc: "1296.00" };
/** Le mardi 13 octobre 2026 : la date que la cliente retient, et où le chantier est posé. */
export const JOUR_DU_CHANTIER = "2026-10-13";
export const NUMERO_DEVIS = "2026-000001";
/** Les gars, tels que Réglages → Équipe les nomme : des prénoms, un par rang. */
export const SALARIES = ["Julien", "Malik"];
/** Le compte d'un des deux, pour voir la fiche comme lui la voit (sans prix). */
export const COMPTE_SALARIE = { nom: "Julien Marchand", email: "julien@jardins-de-loire.fr", motDePasse: "chene-du-mardi-13" };
/**
 * La fin du chantier et son règlement, datés du chantier et non du jour où le
 * script tourne : une facture émise avant les travaux se verrait sur le PDF.
 */
export const FIN_DU_CHANTIER = new Date("2026-10-13T16:30:00+02:00");
export const REGLEMENT = { date: "2026-10-20", montant: TOTAUX.ttc };
/** La période de TVA où tombe ce règlement (mensuelle, octobre 2026). */
export const PERIODE_TVA = { annee: 2026, numero: 10 };

export const COMPTE_DEMO = { email: "demo@atlas.local", motDePasse: process.env.ATLAS_MDP_DEMO ?? "demo1234" };
