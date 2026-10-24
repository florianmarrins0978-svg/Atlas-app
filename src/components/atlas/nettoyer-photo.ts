import { nettoyerTicket } from "@/lib/redresser-ticket";

/** Une photo de téléphone fait 4 000 pixels de haut ; 1 600 suffisent à trouver le ticket et à le lire. */
const COTE_MAX = 1600;
/** La largeur du ticket redressé : chaque caractère d'un ticket de caisse y reste net. */
const LARGEUR_TICKET = 1000;

function enJpeg(toile: HTMLCanvasElement, nom: string): Promise<File | null> {
  return new Promise((resolve) =>
    toile.toBlob((b) => resolve(b ? new File([b], nom.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }) : null), "image/jpeg", 0.85)
  );
}

/**
 * La photo d'un ticket, prête à partir : trouvée sur le fond, redressée,
 * l'ombre effacée (`redresser-ticket.ts`), en JPEG d'environ 300 Ko au lieu
 * d'un mégaoctet. Lot 5 de « Pour mon comptable » ; sa question du
 * 24 octobre : *« les photos, tu vas arriver à les réduire ? »*.
 *
 * **Quand le ticket ne se trouve pas avec assurance, la photo part entière,
 * seulement réduite** : un ticket mal découpé perdrait une ligne de la preuve.
 * Et quand le navigateur ne sait pas la décoder (certains HEIC), elle part
 * telle quelle : le serveur sait la refuser avec la bonne phrase
 * (`photo-entrante.ts`), ce que ce module ne saurait pas dire.
 */
export async function nettoyerPhotoDuTicket(fichier: File): Promise<File> {
  let image: ImageBitmap;
  try {
    // L'orientation de la prise de vue est appliquée par défaut
    // (`imageOrientation: "from-image"`) : un ticket pris en portrait reste debout.
    image = await createImageBitmap(fichier);
  } catch {
    // Le navigateur ne sait pas lire ce format : la photo part entière, le
    // serveur dira quoi faire.
    return fichier;
  }
  const echelle = Math.min(1, COTE_MAX / Math.max(image.width, image.height));
  const largeur = Math.round(image.width * echelle);
  const hauteur = Math.round(image.height * echelle);
  const toile = document.createElement("canvas");
  toile.width = largeur;
  toile.height = hauteur;
  const ctx = toile.getContext("2d");
  if (!ctx) return fichier;
  ctx.drawImage(image, 0, 0, largeur, hauteur);
  image.close();

  const pixels = ctx.getImageData(0, 0, largeur, hauteur);
  const propre = nettoyerTicket({ data: pixels.data, largeur, hauteur }, LARGEUR_TICKET);
  if (propre) {
    toile.width = propre.largeur;
    toile.height = propre.hauteur;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(propre.data), propre.largeur, propre.hauteur), 0, 0);
  }
  return (await enJpeg(toile, fichier.name || "ticket")) ?? fichier;
}
