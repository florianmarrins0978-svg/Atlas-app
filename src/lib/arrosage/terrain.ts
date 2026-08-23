import type { Point } from "./trace";

/**
 * LA FORME DU TERRAIN, DÉDUITE DES ZONES — et non dessinée à la main.
 *
 * **Ce que ce fichier remplace.** Les maquettes du plan portaient le contour du
 * jardin écrit en dur : `0,0 20,0 20,4 12,4 12,12 0,12`, les cotes de SON
 * jardin du 21 août. Un outil ne peut pas fonctionner ainsi — le contour doit
 * sortir des zones que le croquis donne, quelles qu'elles soient.
 *
 * **Le contour est l'UNION des zones arrosables**, pas leur juxtaposition. Deux
 * pelouses qui se touchent forment un seul terrain, et la ligne qui les sépare
 * n'existe pas sur place : la laisser dans le contour ferait croire au tracé
 * qu'il longe un bord alors qu'il coupe en plein milieu — et toute la règle
 * « on ne traverse pas le jardin » reposerait sur une frontière imaginaire.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * COMMENT, ET POURQUOI PAS AUTREMENT.
 *
 * Réunir des polygones quelconques demande une bibliothèque et des cas
 * dégénérés sans fin. Ici les zones sont des RECTANGLES à côtés droits — un
 * croquis de jardin ne donne rien d'autre —, ce qui autorise la méthode la plus
 * simple qui soit juste : on découpe le plan sur toutes les abscisses et toutes
 * les ordonnées présentes, on marque les cases couvertes, et l'on suit le bord
 * des cases marquées. Aucun calcul flottant délicat, aucun cas particulier.
 */

export type Rectangle = { x: number; y: number; L: number; l: number };

export type Terrain = {
  /** Les contours extérieurs, un par morceau de terrain d'un seul tenant. */
  contours: Point[][];
  /** Les trous — une terrasse au milieu de la pelouse, si le croquis en montre. */
  trous: Point[][];
};

const CLE = (p: Point) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`;

/**
 * Le contour du terrain, tiré des rectangles qui le composent.
 *
 * **Plusieurs contours n'est pas une anomalie** : une pelouse devant et une
 * derrière, séparées par la maison, c'est le cas le plus courant. Ce qui serait
 * une faute, c'est de les recoller en un seul terrain — le tuyau passerait
 * alors sous la maison.
 */
export function contourDesZones(rectangles: Rectangle[]): Terrain {
  const rects = rectangles.filter((r) => r.L > 0 && r.l > 0);
  if (rects.length === 0) return { contours: [], trous: [] };

  const xs = [...new Set(rects.flatMap((r) => [r.x, r.x + r.L]))].sort((a, b) => a - b);
  const ys = [...new Set(rects.flatMap((r) => [r.y, r.y + r.l]))].sort((a, b) => a - b);

  const dedans = (i: number, j: number) => {
    if (i < 0 || j < 0 || i >= xs.length - 1 || j >= ys.length - 1) return false;
    const cx = (xs[i] + xs[i + 1]) / 2;
    const cy = (ys[j] + ys[j + 1]) / 2;
    return rects.some((r) => cx > r.x && cx < r.x + r.L && cy > r.y && cy < r.y + r.l);
  };

  // ── Les arêtes du bord, orientées ────────────────────────────────────────
  //
  // Chaque case couverte est parcourue dans le même sens (haut, droite, bas,
  // gauche). N'émettre que les côtés exposés donne des arêtes qui s'enchaînent
  // d'elles-mêmes : à chaque sommet, une seule sortie possible — c'est ce qui
  // permet de suivre le bord sans jamais avoir à choisir.
  const sorties = new Map<string, Point[]>();
  const emettre = (de: Point, a: Point) => {
    const liste = sorties.get(CLE(de));
    if (liste) liste.push(a);
    else sorties.set(CLE(de), [a]);
  };

  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      if (!dedans(i, j)) continue;
      const A = { x: xs[i], y: ys[j] };
      const B = { x: xs[i + 1], y: ys[j] };
      const C = { x: xs[i + 1], y: ys[j + 1] };
      const D = { x: xs[i], y: ys[j + 1] };
      if (!dedans(i, j - 1)) emettre(A, B);
      if (!dedans(i + 1, j)) emettre(B, C);
      if (!dedans(i, j + 1)) emettre(C, D);
      if (!dedans(i - 1, j)) emettre(D, A);
    }
  }

  // ── Suivre les bords jusqu'à refermer ────────────────────────────────────
  const boucles: Point[][] = [];
  for (const [depart] of sorties) {
    while ((sorties.get(depart) ?? []).length > 0) {
      const boucle: Point[] = [];
      let ici = depart;
      for (;;) {
        const suivants = sorties.get(ici);
        if (!suivants || suivants.length === 0) break;
        const prochain = suivants.shift()!;
        boucle.push(prochain);
        ici = CLE(prochain);
        if (ici === depart) break;
      }
      if (boucle.length >= 4) boucles.push(simplifier(boucle));
    }
  }

  // **Le signe de l'aire sépare un contour d'un trou**, sans avoir à tester
  // l'inclusion : toutes les boucles sont parcourues dans le même sens autour
  // de la matière, donc un trou tourne à l'envers d'un contour.
  const contours: Point[][] = [];
  const trous: Point[][] = [];
  for (const b of boucles) (aireSignee(b) > 0 ? contours : trous).push(b);
  return { contours, trous };
}

/** Les points alignés se fondent : trois points sur une droite, c'est un côté. */
function simplifier(boucle: Point[]): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < boucle.length; i++) {
    const avant = boucle[(i - 1 + boucle.length) % boucle.length];
    const ici = boucle[i];
    const apres = boucle[(i + 1) % boucle.length];
    const aligne =
      (avant.x === ici.x && ici.x === apres.x) || (avant.y === ici.y && ici.y === apres.y);
    if (!aligne) out.push(ici);
  }
  return out;
}

function aireSignee(boucle: Point[]): number {
  let a = 0;
  for (let i = 0; i < boucle.length; i++) {
    const p = boucle[i];
    const q = boucle[(i + 1) % boucle.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/** Le rectangle qui enferme tout ce qu'on lui donne — pour cadrer le dessin. */
export function cadre(points: Point[]): { x: number; y: number; L: number; l: number } {
  if (points.length === 0) return { x: 0, y: 0, L: 0, l: 0 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, L: Math.max(...xs) - x, l: Math.max(...ys) - y };
}
