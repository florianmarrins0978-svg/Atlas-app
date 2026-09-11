import { inflateSync } from "node:zlib";
import { PDFArray, PDFDict, PDFName, PDFNumber, PDFRawStream, type PDFContext } from "pdf-lib";

/**
 * UNE POLICE EMBARQUÉE DOIT ANNONCER LA LONGUEUR DE SON PROGRAMME.
 *
 * ─── LE DÉFAUT (11 septembre 2026) ──────────────────────────────────────────
 *
 * **Sa capture, pour la troisième fois :** *« lorsque je télécharge la facture
 * je ne peux toujours pas la lire »* — un PDF de 64 ko, ouvert depuis ses
 * téléchargements, et une page entièrement blanche.
 *
 * Le fichier est intact : `pypdf`, `qpdf` et PDFium (le moteur de Chrome) le
 * déchiffrent et le peignent entier. Ce qu'il lui manque tient en une entrée du
 * dictionnaire.
 *
 * Depuis le 8 septembre, ses documents embarquent une vraie typographie
 * (`src/server/pdf/polices/`). `pdf-lib` écrit le programme TrueType dans un
 * flux `/FontFile2` **sans jamais poser `/Length1`** — l'entrée est pourtant
 * REQUISE par la norme (ISO 32000-1, tableau 127) : elle donne la taille du
 * programme une fois décompressé, et c'est ce que lit un moteur avant de
 * charger la police.
 *
 * Les lecteurs tolérants s'en passent — Chrome, Acrobat, `qpdf` : ils mesurent
 * le flux eux-mêmes. Les lecteurs stricts, non. **Et celui d'un iPhone est le
 * plus strict** : sans police chargée, il ne dessine aucun glyphe, et comme
 * TOUT le texte du document emploie cette police, il ne reste que la page.
 * Blanche, sans un message.
 *
 * **Ce qui est ÉPROUVÉ ici, et ce qui ne l'est pas.** Que l'entrée manque, que
 * la norme l'exige et que la pose la rende conforme : mesuré
 * (`scripts/test-polices-embarquees.ts`). Qu'un iPhone la réclame : déduit de
 * la chronologie — la typographie est arrivée le 8 septembre, la première page
 * blanche le 10 — et **non reproductible ici**, ce poste n'ayant pas de moteur
 * Apple. C'est le patron qui tranche, deux documents sous les yeux.
 *
 * ─── POURQUOI ICI, ET PAS DANS `pdf-lib` ────────────────────────────────────
 *
 * La racine est dans la bibliothèque, hors de portée d'un correctif de ce
 * dépôt. Ce fichier ne recouvre rien : il **complète** le dictionnaire là où il
 * naît, avant que le document ne soit scellé, et il n'existe aucune couche
 * antérieure à retirer.
 */

/** Le programme d'une police, tel qu'il sera relu par un moteur. */
function longueurDuProgramme(flux: PDFRawStream): number | null {
  const filtre = flux.dict.get(PDFName.of("Filter"));

  // Aucun filtre : le flux EST le programme.
  if (filtre === undefined) return flux.contents.length;

  const nom =
    filtre instanceof PDFArray && filtre.size() === 1 ? filtre.get(0) : filtre;
  if (!(nom instanceof PDFName) || nom.asString() !== "/FlateDecode") {
    // Un filtre qu'on ne sait pas défaire : on n'invente pas une longueur.
    // Mieux vaut une entrée absente qu'une entrée fausse — celle-là ferait
    // refuser la police par les lecteurs qui la lisent vraiment.
    return null;
  }
  return inflateSync(Buffer.from(flux.contents)).length;
}

/**
 * Pose `/Length1` sur chaque programme TrueType embarqué qui n'en porte pas.
 *
 * À appeler **après `pdfDoc.flush()`** — c'est lui qui matérialise les polices
 * dans le contexte — et avant la sauvegarde.
 *
 * `/FontFile3` (OpenType, CFF) n'est pas visé : la norme n'y demande pas de
 * longueur, c'est `/Subtype` qui y dit ce que le flux contient.
 *
 * @returns le nombre de programmes complétés.
 */
export function annoncerLaLongueurDesPolices(contexte: PDFContext): number {
  let completes = 0;
  for (const [, objet] of contexte.enumerateIndirectObjects()) {
    if (!(objet instanceof PDFDict)) continue;
    if (objet.get(PDFName.of("Type"))?.toString() !== "/FontDescriptor") continue;

    const programme = objet.lookup(PDFName.of("FontFile2"));
    if (!(programme instanceof PDFRawStream)) continue;
    if (programme.dict.has(PDFName.of("Length1"))) continue;

    const longueur = longueurDuProgramme(programme);
    if (longueur === null) continue;
    programme.dict.set(PDFName.of("Length1"), PDFNumber.of(longueur));
    completes++;
  }
  return completes;
}
