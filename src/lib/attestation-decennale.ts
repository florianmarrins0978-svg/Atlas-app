/**
 * L'ATTESTATION D'ASSURANCE DÉCENNALE, JOINTE AU DEVIS ET À LA FACTURE — son
 * choix A du 5 octobre 2026 (`appli/assurance-et-sous-traitance.html`) :
 * jointe à tous les devis et factures dès qu'elle est déposée.
 *
 * Le Code des assurances (L243-2) veut l'attestation elle-même jointe aux
 * devis et factures, pas seulement une ligne qui la cite
 * (`docs/check-up-legal-documents.md`, point 2). Elle arrive comme l'assureur
 * l'envoie, en PDF, ou photographiée.
 *
 * **Trois formats, et pas un de plus** : ce que le PDF du devis sait embarquer
 * (pdf-lib copie les pages d'un PDF, et n'incruste que le JPEG et le PNG).
 * Un format qu'il ne sait pas joindre se refuse ici, pendant qu'il peut en
 * choisir un autre, plutôt que de partir sans l'attestation.
 */

export const ATTESTATION_FORMATS = ["application/pdf", "image/jpeg", "image/png"] as const;

/** Une attestation tient sur une ou deux pages : 5 Mo laissent de la marge à une photo. */
export const ATTESTATION_MAX_OCTETS = 5 * 1024 * 1024;

/**
 * Au-delà, ce n'est plus une attestation : c'est un autre document, et il
 * gonflerait chaque devis envoyé.
 */
export const ATTESTATION_MAX_PAGES = 4;

export function refusDeLAttestation(mime: string, octets: number): string | null {
  if (!(ATTESTATION_FORMATS as readonly string[]).includes(mime)) {
    return "Ce format ne se joint pas à un devis. Choisissez un PDF, ou une photo JPEG ou PNG.";
  }
  if (octets === 0) return "Ce fichier est vide.";
  if (octets > ATTESTATION_MAX_OCTETS) return "Ce fichier est trop lourd. Prenez-en un de moins de 5 Mo.";
  return null;
}
