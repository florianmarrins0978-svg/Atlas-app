/**
 * L'identité d'une entreprise EN RÈGLE, pour les suites qui envoient un devis
 * ou émettent une facture par la porte du patron.
 *
 * Depuis le 3 octobre 2026, une mention obligatoire absente arrête la pièce
 * (`src/lib/mentions-manquantes.ts`). Une entreprise d'essai créée avec son
 * seul nom serait refusée à juste titre, et la suite rougirait sur ce refus
 * au lieu de ce qu'elle éprouve.
 */
export const IDENTITE_EN_REGLE = {
  adresse: "10 rue des Artisans, Nantes",
  siret: "123 456 789 00012",
  formeJuridique: "EI",
  numeroTva: "FR12123456789",
  mediateurNom: "Médiateur d'essai",
  mediateurCoordonnees: "1 place de la Médiation, Nantes",
  assureurDecennale: "Assureur d'essai",
  contratDecennale: "0000000",
  couvertureDecennale: "France métropolitaine",
  // R111-1, 1° : le particulier doit pouvoir le joindre (check-up du 4 octobre 2026).
  telephone: "02 40 00 00 00",
  email: "contact@en-regle.test",
} as const;
