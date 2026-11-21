import { CATALOGUE } from "./catalogue.js";
import { PHOTOS_NOURRICE, type PhotoMesuree } from "./photos-nourrice";
import type { Retouches } from "./retouches";

/**
 * LA NOURRICE ÉCLATÉE — le dessin qu'il a validé le 18 octobre 2026
 * (`appli/arrosage-nourrice-eclatee.html`, puis `appli/arrosage-plan.html`),
 * composé ici en pur, sans navigateur.
 *
 * *« Parfait, c'est exactement ça ; lorsqu'on est sur des électrovannes MM,
 * c'est ce schéma-là. »* Le haut : coude MF à gauche, le collecteur, le coude
 * FF à droite. L'arrivée à gauche, de haut en bas : mamelon réduit retourné,
 * vanne de purge (vis en haut, poignée à gauche), mamelon réduit, manchon
 * union FF, raccord mâle Plasson, PEHD. Chaque voie : électrovanne, union,
 * raccord, PEHD ; une voie de goutte-à-goutte intercale mamelon, électrovanne
 * FF, mamelon réduit, régulateur, mamelon réduit, et vient en dernier, à
 * droite. L'arrivée est numérotée d'abord, puis les voies de gauche à droite.
 *
 * **« Les taraudés en face des taraudés. »** Chaque photo est tournée de
 * l'angle exact qui met ses deux bouts de vissage l'un sous l'autre, sur l'axe
 * de sa sortie : c'est ce que portent `COLONNE` (les deux bouts, en fraction de
 * la photo détourée) et `HAUT` (où tombe l'axe d'une pièce du haut). Ces
 * fractions ont été relevées sur SES photos ; une photo qui change les
 * invalide, et `scripts/mesurer-photos-nourrice.mjs` redonne au moins la boîte.
 *
 * **Ses photos vues du dessus, du 21 novembre 2026** (`appli/arrosage-nourrice-vue-du-dessus.html`,
 * ARCHITECTURE.md §475) : gardées dans le sens où il les a prises, puisque les
 * listes de pièces les montrent aussi. Le coude FF se tourne d'un quart
 * (`quart`), le té se retourne (`miroir`), et les pièces de colonne couchées
 * sur la photo (électrovanne FF, vanne, union) tournent de l'angle de leurs
 * deux bouts. Les pièces du haut sont à la taille de leur écrou 1" (28 px de
 * dessin) ; chaque bout a été remesuré sur le rendu à 3x, à moins d'1 px de
 * l'axe de sa colonne.
 *
 * **Une seule échelle pour toutes les pièces** (sa demande du même soir,
 * « mets toutes les pièces à la même dimension ») : un filetage ou un tube 1"
 * fait 17,7 px de dessin, un écrou union 27 px, le PEHD Ø25 13,3 px. Les
 * longueurs `L` des colonnes en sortent ; celles du 18 octobre les faisaient
 * 30 % plus petites que la rangée du haut.
 *
 * **Pourquoi une fonction pure et non un canvas.** La planche détourait et
 * dessinait dans le navigateur ; l'écran de l'application rend un SVG que les
 * contrôles peuvent lire et capturer sans serveur. Les boîtes détourées sont
 * mesurées d'avance (`photos-nourrice.ts`), et tout le reste est de la
 * géométrie : à mêmes photos, même dessin, partout.
 */

/** Une pièce du haut : sa hauteur ou sa largeur de dessin, et où tombe son axe. */
type FormeHaut = {
  h?: number;
  w?: number;
  /** L'axe vertical de la pièce, en fraction de sa largeur : c'est là qu'une colonne descend. */
  vertical?: number;
  /** L'axe horizontal (le tube du collecteur) en fraction de sa hauteur. */
  horizontal?: number;
  sorties?: number[];
  tube?: number;
  /** Dessinée à l'envers, en miroir (le té, photographié mâle à gauche), ou d'un quart de tour
   *  horaire (le coude FF, photographié ses écrous à droite et en bas). */
  demi?: boolean;
  miroir?: boolean;
  quart?: boolean;
};
export const HAUT: Record<string, FormeHaut> = {
  "coude-mf": { h: 47, vertical: 0.2557, horizontal: 0.2389 },
  "coude-ff": { h: 46, vertical: 0.7276, horizontal: 0.2613, quart: true },
  "te-mmf": { h: 47, vertical: 0.5137, horizontal: 0.247, miroir: true },
  "clarinette-2v": { w: 145, sorties: [0.3154, 0.7679], tube: 0.3294 },
  "clarinette-3v": { w: 231, sorties: [0.2198, 0.5354, 0.8482], tube: 0.2809 },
  "clarinette-4v": { w: 271, sorties: [0.1679, 0.4038, 0.6373, 0.8721], tube: 0.3125 },
};

/** Une pièce de colonne : ses deux bouts de vissage (a en haut, b en bas), et sa longueur de dessin. */
/** `dessus` : ce que la photo monte au-dessus de son bout `a` (la bobine et les fils de
 *  l'électrovanne FF vue du dessus) ; l'écart d'avant s'agrandit d'autant, sans quoi elle
 *  couvre la pièce posée au-dessus. */
type FormeColonne = { a: [number, number]; b: [number, number]; L: number; src?: string; dessus?: number };
export const COLONNE: Record<string, FormeColonne> = {
  mamelon: { a: [0.495, 0], b: [0.4883, 1], L: 25.6 },
  "mamelon-demi": { a: [0.4883, 1], b: [0.495, 0], L: 25.6, src: "mamelon" },
  // Retournée, sa demande du 18 octobre 2026 : la vis de purge en haut, la poignée rouge à gauche.
  "vanne-purge": { a: [0.5093, 0.6645], b: [0, 0.6821], L: 36.4 },
  union: { a: [0, 0.4929], b: [1, 0.4999], L: 63.1 },
  // À plat, sa photo du 32 x 1" : le filetage à gauche, l'écrou blanc à droite. Le PEHD, le
  // mamelon 1" et le régulateur gardent leur photo d'avant.
  "raccord-male25": { a: [0, 0.497], b: [1, 0.4955], L: 66.3 },
  pehd: { a: [0, 0.509], b: [1, 0.509], L: 50.6 },
  // Ses fils montent de 18 px au-dessus de son filetage : sans cet écart, ils entrent dans l'écrou du dessus.
  "electrovanne-100dv": { a: [0.4255, 0.2149], b: [0.4801, 0.9983], L: 66.6, dessus: 18 },
  "electrovanne-100dv-ff": { a: [0.2679, 0.6664], b: [1, 0.577], L: 71, dessus: 25.6 },
  "mamelon-droit-1": { a: [0.478, 0.02], b: [0.51, 0.98], L: 28.6 },
  "regulateur-ff34": { a: [0.493, 0.02], b: [0.484, 0.98], L: 51.6 },
};

/** Un écart constant entre deux pièces, comme sur la planche. */
const ECART = 9;
/** La largeur de référence du dessin : celle de l'écran, en pixels de dessin. */
export const LARGEUR_DESSIN = 358;

export type PoseHaut = {
  haut: true;
  ref: string;
  numero: number;
  x: number;
  y: number;
  w: number;
  h: number;
  demi: boolean;
  miroir: boolean;
  quart: boolean;
};
export type PoseColonne = {
  haut: false;
  ref: string;
  numero: number;
  /** Le point où la pièce commence, sur l'axe de sa colonne. */
  x: number;
  y: number;
  L: number;
  /** L'angle (en degrés) et l'échelle qui mettent le bout `a` en `x, y` et le bout `b` `L` plus bas. */
  angle: number;
  echelle: number;
  /** Le bout `a` dans la photo détourée, en pixels. */
  ax: number;
  ay: number;
  /** Jusqu'où la pièce dessinée va à droite de son axe : sa pastille se pose au-delà. */
  droite: number;
};
export type Pose = PoseHaut | PoseColonne;

/**
 * `absente` : une pièce qu'un devis importé n'apporte pas (sa planche du
 * 18 octobre 2026, `appli/arrosage-import-devis.html`) ; grisée comme une
 * pièce supprimée, mais sans la barre rouge : il ne l'a pas retirée.
 */
export type EtatPose = "" | "retiree" | "changee" | "absente";

/**
 * CE QU'IL A FAIT DE CHAQUE PIÈCE DESSINÉE — sa demande du 19 octobre 2026 :
 * *« quand je modifie une pièce sur les réseaux ou que je la supprime, elle se
 * met en grisé et barré rouge ; pour la vue éclatée de la nourrice, je voulais
 * que ça fasse la même chose »*.
 *
 * Un numéro entier supprimé ou changé : toutes ses pièces. Sinon, les `nrUne`
 * sorties d'un numéro sont les premières dans l'ordre du dessin, comme pour la
 * chaîne d'une tête : d'abord les supprimées, puis les changées (celles dont la
 * remplaçante est entrée dans la liste, `de` ce numéro).
 */
export function etatsDesPoses(poses: Pose[], r: Retouches): EtatPose[] {
  const vues: Record<string, number> = {};
  return poses.map((p) => {
    const j = vues[p.ref] ?? 0;
    vues[p.ref] = j + 1;
    if (r.blocsRetires.nourrice || r.retirees[`nr:${p.ref}`]) return "retiree";
    if (r.remplacees[`nr:${p.ref}`]) return "changee";
    const sorties = r.nrUne[p.ref] ?? 0;
    const changees = r.ajoutees.filter((a) => a.de === p.ref).reduce((s, a) => s + a.q, 0);
    const supprimees = Math.max(0, sorties - changees);
    return j < supprimees ? "retiree" : j < sorties ? "changee" : "";
  });
}

export type Etiquette =
  | { x: number; y: number; texte: string }
  | { x: number; y: number; reseau: number; goutte: number };

export type NourriceComposee = {
  nom: string;
  /** Le cadre du dessin, en pixels de dessin ; l'écran le met à l'échelle de sa largeur. */
  largeur: number;
  hauteur: number;
  poses: Pose[];
  /** Les références dans l'ordre de leur numéro (1 = la première). */
  ordre: string[];
  /** Ce que la fiche compte et que le dessin ne pose pas : le bac « Avec la nourrice ». */
  reste: Record<string, number>;
  /** L'axe de l'arrivée d'eau et le bas de son PEHD : le mot et la flèche s'y posent. */
  arrivee: { x: number; bas: number };
  etiquettes: Etiquette[];
};

/** La boîte détourée d'une photo, ou `null` quand elle n'a pas été mesurée. */
function boite(ref: string): (PhotoMesuree & { w: number; h: number }) | null {
  const m = PHOTOS_NOURRICE[ref];
  return m ? { ...m, w: m.x1 - m.x0, h: m.y1 - m.y0 } : null;
}

/** La taille de dessin d'une pièce du haut : une cote imposée, l'autre suit la photo. */
function tailleHaut(ref: string): { w: number; h: number } {
  const f = HAUT[ref];
  const b = boite(ref);
  if (!b) return { w: f.w ?? 40, h: f.h ?? 40 };
  // Tournée d'un quart, la photo dessinée a la largeur de sa hauteur.
  const bw = f.quart ? b.h : b.w, bh = f.quart ? b.w : b.h;
  if (f.w) return { w: f.w, h: (f.w * bh) / bw };
  const h = f.h ?? 40;
  return { w: (h * bw) / bh, h };
}

type Fiche = { nom: string; pieces: { ref: string; q: number }[] };
const CAT = CATALOGUE as unknown as { ficheNourrice(n: number, goutte: number): Fiche | null };

/**
 * Composer la nourrice de `voies` voies, dont `nbGoutte` alimentent du
 * goutte-à-goutte. `null` quand le catalogue n'a pas de fiche pour ce nombre.
 */
export function composerNourrice(voies: number, nbGoutte: number): NourriceComposee | null {
  const fiche = CAT.ficheNourrice(voies, nbGoutte);
  if (!fiche) return null;
  const reste: Record<string, number> = {};
  for (const p of fiche.pieces) reste[p.ref] = (reste[p.ref] ?? 0) + p.q;
  const pris = (ref: string) => { if ((reste[ref] ?? 0) > 0) reste[ref] -= 1; };
  const ordre: string[] = [];
  const numero = (ref: string) => { let i = ordre.indexOf(ref); if (i < 0) { ordre.push(ref); i = ordre.length - 1; } return i + 1; };
  const poses: Pose[] = [];

  const haut = (ref: string, x: number, y: number): PoseHaut => {
    const t = tailleHaut(ref);
    const f = HAUT[ref];
    const pose: PoseHaut = { haut: true, ref, numero: numero(ref), x, y, w: t.w, h: t.h, demi: Boolean(f.demi), miroir: Boolean(f.miroir), quart: Boolean(f.quart) };
    poses.push(pose);
    pris(ref);
    return pose;
  };
  const colonne = (cle: string, x: number, y0: number): number => {
    const f = COLONNE[cle];
    const y = y0 + (f.dessus ? Math.max(0, f.dessus + 3 - ECART) : 0);
    const ref = f.src ?? cle;
    const b = boite(ref);
    // Sans photo mesurée, la pièce occupe sa longueur sans se dessiner : le
    // numéro reste, la place aussi, et l'écran montre un cadre vide.
    let angle = 0, echelle = 1, ax = 0, ay = 0, droite = 0;
    if (b) {
      ax = f.a[0] * b.w; ay = f.a[1] * b.h;
      const bx = f.b[0] * b.w, by = f.b[1] * b.h;
      echelle = f.L / Math.hypot(bx - ax, by - ay);
      const t = Math.PI / 2 - Math.atan2(by - ay, bx - ax);
      angle = (t * 180) / Math.PI;
      // Les coins de la photo, tournés autour du bout a : le plus à droite borne la pièce.
      for (const [cx, cy] of [[0, 0], [b.w, 0], [0, b.h], [b.w, b.h]]) {
        droite = Math.max(droite, echelle * ((cx - ax) * Math.cos(t) - (cy - ay) * Math.sin(t)));
      }
    }
    poses.push({ haut: false, ref, numero: numero(ref), x, y, L: f.L, angle, echelle, ax, ay, droite });
    pris(ref);
    return y + f.L;
  };

  // ── Le haut : coude MF, le collecteur ou le té, le coude FF ───────────────
  const clar = (["clarinette-2v", "clarinette-3v", "clarinette-4v"] as const).filter((r) => reste[r])[0];
  const avecTe = Boolean(reste["te-mmf"]);
  // La poignée de la vanne retournée dépasse à gauche de son axe : la marge la garde dans le dessin.
  let x = 34;
  const yTop = 12;
  const axe = yTop + (clar ? tailleHaut(clar).h * (HAUT[clar].tube ?? 0.34) : 22);
  const axes: number[] = [];
  const cg = haut("coude-mf", x, 0);
  cg.y = axe - cg.h * (HAUT["coude-mf"].horizontal ?? 0);
  const xL = x + cg.w * (HAUT["coude-mf"].vertical ?? 0.5);
  x += cg.w + ECART;
  if (clar) {
    const cl = haut(clar, x, yTop);
    for (const s of HAUT[clar].sorties ?? []) axes.push(x + s * cl.w);
    x += cl.w + ECART;
  }
  if (avecTe) {
    const te = haut("te-mmf", x, 0);
    te.y = axe - te.h * (HAUT["te-mmf"].horizontal ?? 0);
    axes.push(x + te.w * (HAUT["te-mmf"].vertical ?? 0.5));
    x += te.w + ECART;
  }
  const cd = haut("coude-ff", x, 0);
  cd.y = axe - cd.h * (HAUT["coude-ff"].horizontal ?? 0);
  axes.push(x + cd.w * (HAUT["coude-ff"].vertical ?? 0.5));
  let bas = 0;
  for (const p of poses) if (p.haut) bas = Math.max(bas, p.y + p.h);
  bas += ECART;

  // ── L'arrivée d'eau, à gauche, de haut en bas ─────────────────────────────
  let y = colonne("mamelon-demi", xL, bas) + ECART;
  y = colonne("vanne-purge", xL, y) + ECART;
  y = colonne("mamelon", xL, y) + ECART;
  y = colonne("union", xL, y) + ECART;
  y = colonne("raccord-male25", xL, y) + ECART;
  const finArrivee = colonne("pehd", xL, y);
  let fin = finArrivee;
  const etiquettes: Etiquette[] = [
    { x: xL, y: finArrivee + 28, texte: "Arrivée" },
    { x: xL, y: finArrivee + 40, texte: "d’eau" },
  ];

  // ── Chaque voie, le goutte-à-goutte en dernier ────────────────────────────
  axes.forEach((xv, i) => {
    const goutte = i >= axes.length - nbGoutte;
    let yv = bas;
    if (goutte) {
      yv = colonne("mamelon-droit-1", xv, yv) + ECART;
      yv = colonne("electrovanne-100dv-ff", xv, yv) + ECART;
      yv = colonne("mamelon-demi", xv, yv) + ECART;
      yv = colonne("regulateur-ff34", xv, yv) + ECART;
      yv = colonne("mamelon", xv, yv) + ECART;
    } else {
      yv = colonne("electrovanne-100dv", xv, yv) + ECART;
    }
    yv = colonne("union", xv, yv) + ECART;
    yv = colonne("raccord-male25", xv, yv) + ECART;
    yv = colonne("pehd", xv, yv);
    // La voie porte le numéro de son réseau, et sa couleur sur le plan.
    etiquettes.push({ x: xv, y: yv, reseau: i, goutte: goutte ? i - (axes.length - nbGoutte) : -1 });
    fin = Math.max(fin, yv);
  });
  fin = Math.max(fin, finArrivee + 40);

  const largeur = Math.max(x + cd.w, axes[axes.length - 1] + 70) + 8;
  // Sous la dernière voie, la place du numéro et du mot « goutte-à-goutte »
  // (deux lignes, qui s'écartent quand deux voies de goutte-à-goutte sont voisines).
  const hauteur = fin + (nbGoutte ? 34 + (nbGoutte > 1 ? 50 : 22) : 34);
  return { nom: fiche.nom, largeur, hauteur, poses, ordre, reste, arrivee: { x: xL, bas: finArrivee }, etiquettes };
}
