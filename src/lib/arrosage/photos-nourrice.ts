/**
 * LES PHOTOS DE LA NOURRICE, MESURÉES — écrit par scripts/mesurer-photos-nourrice.mjs,
 * ne pas retoucher à la main.
 *
 * Pour chaque photo : sa taille, et la boîte de la pièce (sans les marges
 * blanches), en pixels. La nourrice éclatée (nourrice-eclatee.ts) pose ses axes
 * de vissage en fractions de CETTE boîte, comme la planche validée le faisait
 * en détourant dans le navigateur.
 */
export type PhotoMesuree = { largeur: number; hauteur: number; x0: number; y0: number; x1: number; y1: number };

export const PHOTOS_NOURRICE: Record<string, PhotoMesuree> = {
  "coude-mf": { largeur: 640, hauteur: 549, x0: 4, y0: 4, x1: 635, y1: 545 },
  "coude-ff": { largeur: 617, hauteur: 640, x0: 6, y0: 6, x1: 611, y1: 633 },
  "te-mmf": { largeur: 640, hauteur: 463, x0: 4, y0: 4, x1: 637, y1: 459 },
  "clarinette-2v": { largeur: 900, hauteur: 254, x0: 6, y0: 6, x1: 895, y1: 249 },
  "clarinette-3v": { largeur: 475, hauteur: 120, x0: 6, y0: 6, x1: 469, y1: 113 },
  "clarinette-4v": { largeur: 900, hauteur: 154, x0: 6, y0: 6, x1: 895, y1: 149 },
  "mamelon": { largeur: 640, hauteur: 633, x0: 6, y0: 6, x1: 631, y1: 627 },
  "vanne-purge": { largeur: 640, hauteur: 381, x0: 2, y0: 2, x1: 637, y1: 379 },
  "union": { largeur: 640, hauteur: 314, x0: 4, y0: 4, x1: 635, y1: 283 },
  "raccord-male25": { largeur: 640, hauteur: 375, x0: 4, y0: 4, x1: 637, y1: 371 },
  "pehd": { largeur: 500, hauteur: 500, x0: 0, y0: 200, x1: 399, y1: 305 },
  "electrovanne-100dv": { largeur: 344, hauteur: 640, x0: 6, y0: 6, x1: 339, y1: 635 },
  "electrovanne-100dv-ff": { largeur: 640, hauteur: 389, x0: 4, y0: 4, x1: 635, y1: 385 },
  "mamelon-droit-1": { largeur: 1500, hauteur: 1500, x0: 216, y0: 164, x1: 1241, y1: 1315 },
  "regulateur-ff34": { largeur: 1000, hauteur: 1000, x0: 308, y0: 116, x1: 689, y1: 917 },
};
