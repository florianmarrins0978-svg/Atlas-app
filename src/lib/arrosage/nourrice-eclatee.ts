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
  /** Dessinée à l'envers (le té MMF) ou en miroir (le coude FF, photographié dans l'autre sens). */
  demi?: boolean;
  miroir?: boolean;
};
export const HAUT: Record<string, FormeHaut> = {
  "coude-mf": { h: 46, vertical: 0.259, horizontal: 0.226 },
  "coude-ff": { h: 52, vertical: 0.732, horizontal: 0.295, miroir: true },
  "te-mmf": { h: 44, vertical: 0.52, horizontal: 0.225, demi: true },
  "clarinette-2v": { w: 150, sorties: [0.307, 0.778], tube: 0.338 },
  "clarinette-3v": { w: 220, sorties: [0.21, 0.535, 0.85], tube: 0.336 },
  "clarinette-4v": { w: 296, sorties: [0.16, 0.4, 0.64, 0.88], tube: 0.345 },
};

/** Une pièce de colonne : ses deux bouts de vissage (a en haut, b en bas), et sa longueur de dessin. */
type FormeColonne = { a: [number, number]; b: [number, number]; L: number; src?: string };
export const COLONNE: Record<string, FormeColonne> = {
  mamelon: { a: [0.491, 0.02], b: [0.504, 0.98], L: 28 },
  "mamelon-demi": { a: [0.504, 0.98], b: [0.491, 0.02], L: 28, src: "mamelon" },
  // Retournée, sa demande du 18 octobre 2026 : la vis de purge en haut, la poignée rouge à gauche.
  "vanne-purge": { a: [0.606, 0.714], b: [0.033, 0.857], L: 40 },
  union: { a: [0.092, 0.717], b: [0.935, 0.253], L: 46 },
  "raccord-male25": { a: [0.092, 0.66], b: [0.931, 0.326], L: 40 },
  pehd: { a: [0, 0.509], b: [1, 0.509], L: 44 },
  "electrovanne-100dv": { a: [0.037, 0.776], b: [0.982, 0.912], L: 50 },
  "electrovanne-100dv-ff": { a: [0.26, 0.733], b: [0.983, 0.564], L: 50 },
  "mamelon-droit-1": { a: [0.478, 0.02], b: [0.51, 0.98], L: 26 },
  "regulateur-ff34": { a: [0.493, 0.02], b: [0.484, 0.98], L: 44 },
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
};
export type Pose = PoseHaut | PoseColonne;

export type EtatPose = "" | "retiree" | "changee";

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
  if (f.w) return { w: f.w, h: (f.w * b.h) / b.w };
  const h = f.h ?? 40;
  return { w: (h * b.w) / b.h, h };
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
    const pose: PoseHaut = { haut: true, ref, numero: numero(ref), x, y, w: t.w, h: t.h, demi: Boolean(f.demi), miroir: Boolean(f.miroir) };
    poses.push(pose);
    pris(ref);
    return pose;
  };
  const colonne = (cle: string, x: number, y: number): number => {
    const f = COLONNE[cle];
    const ref = f.src ?? cle;
    const b = boite(ref);
    // Sans photo mesurée, la pièce occupe sa longueur sans se dessiner : le
    // numéro reste, la place aussi, et l'écran montre un cadre vide.
    let angle = 0, echelle = 1, ax = 0, ay = 0;
    if (b) {
      ax = f.a[0] * b.w; ay = f.a[1] * b.h;
      const bx = f.b[0] * b.w, by = f.b[1] * b.h;
      echelle = f.L / Math.hypot(bx - ax, by - ay);
      angle = ((Math.PI / 2 - Math.atan2(by - ay, bx - ax)) * 180) / Math.PI;
    }
    poses.push({ haut: false, ref, numero: numero(ref), x, y, L: f.L, angle, echelle, ax, ay });
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
