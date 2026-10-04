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
export const ENTREPRISE = { nom: "Les Jardins de Loire", adresse: "10 rue des Tilleuls, Nantes" };
export const CLIENTE = { nom: "Mme Martin", telephone: "07 11 22 33 44", adresse: "8 impasse du Moulin, Rezé" };
export const CHANTIER_NOM = "Élagage d'un chêne";
export const LIGNES = [
  { libelle: "Élagage d'un chêne de 15 m, taille douce", prix: "1200", montant: "1200.00" },
  { libelle: "Main d'œuvre, 2 hommes × 2 jours", prix: "960", montant: "960.00" },
  { libelle: "Broyage et évacuation des branches", prix: "180", montant: "180.00" },
];
export const TOTAUX = { ht: "2340.00", tva: "468.00", ttc: "2808.00" };
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
