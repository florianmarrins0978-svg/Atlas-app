import { avisSurLaPhoto, nettoyerTicket, type ImageRvba } from "@/lib/redresser-ticket";

/** La photo d'origine part réduite : 1 600 pixels suffisent à la garder comme pièce, sans peser un mégaoctet. */
const COTE_ORIGINALE = 1600;
/**
 * La photo lue pour trouver et redresser le ticket : la pleine finesse du
 * téléphone, bornée pour sa mémoire. Le ticket gardé monte à 2 400 pixels
 * (`COTE_GARDE`) : le ramener à 1 000, c'était perdre la moitié de sa netteté
 * (sa photo du 24 novembre 2026).
 */
const COTE_LU = 4000;

function enJpeg(toile: HTMLCanvasElement, nom: string): Promise<File | null> {
  return new Promise((resolve) =>
    toile.toBlob((b) => resolve(b ? new File([b], nom.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }) : null), "image/jpeg", 0.85)
  );
}

function toile(largeur: number, hauteur: number): { toile: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  const t = document.createElement("canvas");
  t.width = largeur;
  t.height = hauteur;
  const ctx = t.getContext("2d");
  return ctx ? { toile: t, ctx } : null;
}

/** Ce qui part au serveur pour un ticket photographié. */
export type PhotoDuTicket = {
  /** La photo telle que prise, réduite : c'est la pièce. */
  originale: File;
  /** Le ticket seul, redressé et nettoyé comme un scan ; `null` quand le téléphone n'est pas sûr de lui. */
  nette: File | null;
  /** Ce que la photo ne donnera jamais : floue, ou ticket trop loin. Dit avant de la garder. */
  avis: string | null;
};

/**
 * La photo d'un ticket, prête à partir : l'originale réduite, et à côté le
 * ticket trouvé sur le fond, redressé, nettoyé (`redresser-ticket.ts`). Tout
 * se calcule dans le téléphone : **aucun jeton d'IA** (sa question du
 * 24 novembre 2026, « ça coûte de l'IA ou pas ? »).
 *
 * **Quand le ticket ne se trouve pas avec assurance, seule l'originale part** :
 * un ticket mal découpé perdrait une ligne de la preuve. Et quand le
 * navigateur ne sait pas la décoder (certains HEIC), elle part telle quelle :
 * le serveur sait la refuser avec la bonne phrase (`photo-entrante.ts`), ce que
 * ce module ne saurait pas dire.
 */
export async function preparerPhotoDuTicket(fichier: File): Promise<PhotoDuTicket> {
  let image: ImageBitmap;
  try {
    // L'orientation de la prise de vue est appliquée par défaut
    // (`imageOrientation: "from-image"`) : un ticket pris en portrait reste debout.
    image = await createImageBitmap(fichier);
  } catch {
    // Le navigateur ne sait pas lire ce format : la photo part entière, le
    // serveur dira quoi faire.
    return { originale: fichier, nette: null, avis: null };
  }
  const nom = fichier.name || "ticket";
  const dessiner = (cote: number) => {
    const e = Math.min(1, cote / Math.max(image.width, image.height));
    const t = toile(Math.round(image.width * e), Math.round(image.height * e));
    t?.ctx.drawImage(image, 0, 0, t.toile.width, t.toile.height);
    return t;
  };

  const petite = dessiner(COTE_ORIGINALE);
  const lue = dessiner(COTE_LU);
  image.close();
  const originale = (petite && (await enJpeg(petite.toile, nom))) ?? fichier;
  if (!lue) return { originale, nette: null, avis: null };

  const pixels = lue.ctx.getImageData(0, 0, lue.toile.width, lue.toile.height);
  const img: ImageRvba = { data: pixels.data, largeur: pixels.width, hauteur: pixels.height };
  const propre = nettoyerTicket(img);
  if (!propre) return { originale, nette: null, avis: null };
  const sortie = toile(propre.image.largeur, propre.image.hauteur);
  if (!sortie) return { originale, nette: null, avis: null };
  sortie.ctx.putImageData(new ImageData(new Uint8ClampedArray(propre.image.data), propre.image.largeur, propre.image.hauteur), 0, 0);
  return { originale, nette: await enJpeg(sortie.toile, `${nom.replace(/\.[^.]+$/, "")}-net`), avis: avisSurLaPhoto(propre) };
}
