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
  "coude-mf": { largeur: 1500, hauteur: 1500, x0: 274, y0: 344, x1: 1261, y1: 1193 },
  "coude-ff": { largeur: 1512, hauteur: 1512, x0: 178, y0: 124, x1: 1439, y1: 1377 },
  "te-mmf": { largeur: 1402, hauteur: 1402, x0: 186, y0: 338, x1: 1187, y1: 1155 },
  "clarinette-2v": { largeur: 1024, hauteur: 825, x0: 42, y0: 292, x1: 983, y1: 567 },
  "clarinette-3v": { largeur: 1024, hauteur: 825, x0: 26, y0: 376, x1: 995, y1: 569 },
  "clarinette-4v": { largeur: 1024, hauteur: 825, x0: 24, y0: 378, x1: 999, y1: 521 },
  "mamelon": { largeur: 800, hauteur: 800, x0: 228, y0: 228, x1: 563, y1: 551 },
  "vanne-purge": { largeur: 800, hauteur: 800, x0: 82, y0: 118, x1: 709, y1: 687 },
  "union": { largeur: 470, hauteur: 470, x0: 0, y0: 74, x1: 469, y1: 397 },
  "raccord-male25": { largeur: 600, hauteur: 600, x0: 42, y0: 92, x1: 559, y1: 477 },
  "pehd": { largeur: 500, hauteur: 500, x0: 0, y0: 200, x1: 399, y1: 305 },
  "electrovanne-100dv": { largeur: 1181, hauteur: 1699, x0: 32, y0: 36, x1: 1153, y1: 1673 },
  "electrovanne-100dv-ff": { largeur: 800, hauteur: 800, x0: 98, y0: 134, x1: 669, y1: 705 },
  "mamelon-droit-1": { largeur: 1500, hauteur: 1500, x0: 216, y0: 164, x1: 1241, y1: 1315 },
  "regulateur-ff34": { largeur: 1000, hauteur: 1000, x0: 308, y0: 116, x1: 689, y1: 917 },
};
