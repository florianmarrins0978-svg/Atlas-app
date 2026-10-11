import { PDFDocument, PDFName } from "pdf-lib";
import { ATTESTATION_MAX_PAGES } from "@/lib/attestation-decennale";

/**
 * L'ATTESTATION DÉPOSÉE EN PDF : la vérifier avant de la ranger, et la
 * NETTOYER avant de la joindre.
 *
 * Elle part chez chaque client, dans chaque devis et chaque facture (son choix
 * A du 5 octobre 2026). Trois refus, dits pendant qu'il peut encore choisir un
 * autre fichier, plutôt que découverts au moment d'envoyer :
 *
 * | | |
 * |---|---|
 * | ce n'est pas un PDF | le type annoncé par le navigateur ne prouve rien : on lit l'en-tête |
 * | il est protégé par un mot de passe | ses pages ne se recopient pas |
 * | il a plus de quatre pages | ce n'est plus une attestation, et chaque devis gonflerait d'autant |
 */
export async function refusDuPdfDepose(octets: Uint8Array): Promise<string | null> {
  const entete = new TextDecoder().decode(octets.slice(0, 5));
  if (entete !== "%PDF-") return "Ce fichier n'est pas un PDF lisible.";
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(octets, { updateMetadata: false });
  } catch (err) {
    const chiffre = err instanceof Error && /encrypt/i.test(err.message);
    return chiffre
      ? "Ce PDF est protégé par un mot de passe. Déposez-en une copie sans protection, ou une photo."
      : "Ce PDF ne s'ouvre pas. Déposez-en une autre copie, ou une photo.";
  }
  const pages = doc.getPageCount();
  if (pages === 0) return "Ce PDF n'a aucune page.";
  if (pages > ATTESTATION_MAX_PAGES) {
    return `Ce PDF a ${pages} pages : une attestation en tient une ou deux. Déposez-la seule.`;
  }
  return null;
}

/**
 * Ce qui est recopié d'une page déposée : son dessin, rien d'autre.
 *
 * **Les annotations partent**, et c'est délibéré : liens, champs, actions
 * qu'un lecteur de PDF exécute au clic. Un fichier venu d'ailleurs ne doit pas
 * faire porter à un devis d'Atlas un lien ou une action que personne n'a vus
 * en le déposant.
 */
export function sansAnnotations(page: { node: { delete(nom: PDFName): void } }): void {
  page.node.delete(PDFName.of("Annots"));
}
