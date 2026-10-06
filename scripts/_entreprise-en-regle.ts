import { PDFDocument, StandardFonts } from "pdf-lib";
import { enregistrerObjet } from "../src/server/storage";
import * as entreprisesRepo from "../src/server/repositories/entreprises";

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
  // Loi 96-603, art. 22-2 : un assureur nommé exige ses coordonnées (5 octobre 2026).
  adresseAssureurDecennale: "1 rue de l'Exemple, 44000 Nantes",
  contratDecennale: "0000000",
  couvertureDecennale: "France métropolitaine",
  // R111-1, 1° : le particulier doit pouvoir le joindre (check-up du 4 octobre 2026).
  telephone: "02 40 00 00 00",
  email: "contact@en-regle.test",
} as const;

/** Une attestation d'une page, comme un assureur en envoie : un vrai PDF, rangé. */
export async function attestationDEssai(entrepriseId: string): Promise<{ cle: string; mime: string }> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  page.drawText("Attestation d'assurance de responsabilité décennale (essai)", {
    x: 50,
    y: 780,
    size: 12,
    font: await doc.embedFont(StandardFonts.Helvetica),
  });
  const objet = await enregistrerObjet(
    `entreprises/${entrepriseId}/attestation-decennale`,
    Buffer.from(await doc.save()),
    ".pdf",
    "application/pdf"
  );
  return { cle: objet.storageKey, mime: "application/pdf" };
}

/**
 * Met l'entreprise en règle, attestation décennale comprise (C. ass. L243-2) :
 * depuis le 5 octobre 2026, un assureur nommé sans elle arrête la pièce.
 */
export async function mettreEnRegle(ctx: { utilisateurId: string; entrepriseId: string }): Promise<void> {
  await entreprisesRepo.mettreAJourEntreprise(ctx, {
    ...IDENTITE_EN_REGLE,
    attestationDecennale: await attestationDEssai(ctx.entrepriseId),
  });
}
