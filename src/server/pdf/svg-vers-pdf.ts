/**
 * TRACER UN DESSIN SVG DANS UN PDF — pour le plan d'arrosage enregistré
 * (sa demande du 21 novembre 2026 : un réseau par page, en couleur).
 *
 * **Le dessin n'est pas refait pour le papier.** L'écran dessine un réseau par
 * `PlanDessine` ; l'écran qui compose le PDF parcourt ce même composant et en
 * tire un arbre de nœuds (`NoeudSvg`), que ce fichier trace. Redessiner le plan
 * ici aurait fait deux dessins du même jardin, qui finiraient par différer.
 *
 * **Le sous-ensemble tracé est celui que `PlanDessine` emploie, et lui seul** :
 * `g`, `defs`/`clipPath`, `polygon`, `line`, `circle`, `rect` (tourné), `path`,
 * `text`. Un élément inconnu n'est pas deviné : il est compté dans `ignores`,
 * que le test lit (`test-pdf-du-plan-arrosage.ts`), pour qu'un dessin qui
 * changerait de forme ne perde pas des traits en silence.
 *
 * Les couleurs de l'écran passent par des variables de charte : le papier prend
 * leur valeur de repli, la charte d'origine, comme tous les documents de Cause
 * (`couleursDocument`) : un PDF ne part pas en noir parce que l'artisan a
 * choisi « Nuit ».
 */
import {
  LineCapStyle,
  clip,
  closePath,
  endPath,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import { pourLePapier } from "@/lib/texte-pdf";

export type NoeudSvg = { type: string; props: Record<string, unknown>; enfants: (NoeudSvg | string)[] };

/** Où poser le dessin sur la page : le coin HAUT gauche, en points PDF (y vers le haut). */
export type Cadre = { gauche: number; haut: number; largeur: number; hauteur: number };

export type Trace = { largeur: number; hauteur: number; ignores: string[] };

type Style = {
  fill: string;
  stroke: string;
  strokeWidth: number;
  fillOpacity: number;
  strokeOpacity: number;
  opacity: number;
  strokeLinecap: string | null;
  strokeDasharray: string | null;
  fontSize: number;
  fontFamily: string | null;
  textAnchor: string;
  fontWeight: string | null;
  clipPath: string | null;
};

const STYLE_DE_DEPART: Style = {
  fill: "#000000",
  stroke: "none",
  strokeWidth: 1,
  fillOpacity: 1,
  strokeOpacity: 1,
  opacity: 1,
  strokeLinecap: null,
  strokeDasharray: null,
  fontSize: 16,
  fontFamily: null,
  textAnchor: "start",
  fontWeight: null,
  clipPath: null,
};

/**
 * Une couleur de l'écran, pour le papier : `#rrggbb`, `var(--x, #rrggbb)`
 * (sa valeur de repli), `color-mix(in srgb, X n%, transparent)` (X, à n %),
 * `rgb(r, g, b)` ou `rgba(r, g, b, a)`. `none` : rien à peindre.
 */
export function couleurPourLePapier(valeur: string): { couleur: RGB; opacite: number } | null {
  const v = valeur.trim();
  if (v === "none" || v === "transparent") return null;
  const melange = /^color-mix\(in srgb,\s*(.+?)\s+([\d.]+)%,\s*transparent\)$/.exec(v);
  if (melange) {
    const base = couleurPourLePapier(melange[1]);
    return base && { couleur: base.couleur, opacite: base.opacite * (Number(melange[2]) / 100) };
  }
  const variable = /^var\(--[\w-]+,\s*(.+)\)$/.exec(v);
  if (variable) return couleurPourLePapier(variable[1]);
  const hexa = /^#([0-9a-f]{6})$/i.exec(v);
  if (hexa) {
    const n = parseInt(hexa[1], 16);
    return { couleur: rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255), opacite: 1 };
  }
  const court = /^#([0-9a-f]{3})$/i.exec(v);
  if (court) return couleurPourLePapier(`#${[...court[1]].map((c) => c + c).join("")}`);
  const triplet = /^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(v);
  if (triplet) return { couleur: rgb(Number(triplet[1]) / 255, Number(triplet[2]) / 255, Number(triplet[3]) / 255), opacite: triplet[4] === undefined ? 1 : Number(triplet[4]) };
  return null;
}

const nombre = (x: unknown, defaut = 0) => {
  const n = typeof x === "number" ? x : typeof x === "string" ? parseFloat(x) : NaN;
  return Number.isFinite(n) ? n : defaut;
};

function heriter(parent: Style, props: Record<string, unknown>): Style {
  const s = { ...parent };
  if (typeof props.fill === "string") s.fill = props.fill;
  if (typeof props.stroke === "string") s.stroke = props.stroke;
  if (props.strokeWidth !== undefined) s.strokeWidth = nombre(props.strokeWidth, s.strokeWidth);
  if (props.fillOpacity !== undefined) s.fillOpacity = nombre(props.fillOpacity, 1);
  if (props.strokeOpacity !== undefined) s.strokeOpacity = nombre(props.strokeOpacity, 1);
  if (props.opacity !== undefined) s.opacity = s.opacity * nombre(props.opacity, 1);
  if (typeof props.strokeLinecap === "string") s.strokeLinecap = props.strokeLinecap;
  if (props.strokeDasharray !== undefined) s.strokeDasharray = String(props.strokeDasharray);
  if (props.fontSize !== undefined) s.fontSize = nombre(props.fontSize, s.fontSize);
  if (typeof props.fontFamily === "string") s.fontFamily = props.fontFamily;
  if (typeof props.textAnchor === "string") s.textAnchor = props.textAnchor;
  if (props.fontWeight !== undefined) s.fontWeight = String(props.fontWeight);
  if (typeof props.clipPath === "string") s.clipPath = props.clipPath;
  return s;
}

type Point = { x: number; y: number };

/** Un `rotate(a)` ou `rotate(a cx cy)` : le seul que `PlanDessine` emploie. */
function tourner(transform: unknown): (p: Point) => Point {
  const m = typeof transform === "string" ? /rotate\(\s*([-\d.]+)(?:[ ,]+([-\d.]+)[ ,]+([-\d.]+))?\s*\)/.exec(transform) : null;
  if (!m) return (p) => p;
  const a = (Number(m[1]) * Math.PI) / 180;
  const cx = m[2] ? Number(m[2]) : 0;
  const cy = m[3] ? Number(m[3]) : 0;
  return (p) => ({ x: cx + (p.x - cx) * Math.cos(a) - (p.y - cy) * Math.sin(a), y: cy + (p.x - cx) * Math.sin(a) + (p.y - cy) * Math.cos(a) });
}

const enPoints = (points: unknown): Point[] =>
  String(points ?? "")
    .trim()
    .split(/\s+/)
    .map((p) => p.split(",").map(Number))
    .filter((c) => c.length === 2 && c.every(Number.isFinite))
    .map(([x, y]) => ({ x, y }));

const chemin = (pts: Point[], ferme: boolean) => pts.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ") + (ferme ? " Z" : "");

/**
 * Trace `racine` (un `svg` à `viewBox`) dans le cadre, en gardant ses
 * proportions (`meet`), centré. Rend la place réellement occupée.
 */
export function tracerSvg(page: PDFPage, racine: NoeudSvg, cadre: Cadre, polices: { texte: PDFFont; titres: PDFFont }): Trace {
  const [minX, minY, w, h] = String(racine.props.viewBox ?? "0 0 100 100").split(/[\s,]+/).map(Number);
  const echelle = Math.min(cadre.largeur / w, cadre.hauteur / h);
  const largeur = w * echelle;
  const hauteur = h * echelle;
  const ox = cadre.gauche + (cadre.largeur - largeur) / 2;
  const haut = cadre.haut - (cadre.hauteur - hauteur) / 2;
  const versPage = (p: Point): Point => ({ x: ox + (p.x - minX) * echelle, y: haut - (p.y - minY) * echelle });
  // `drawSvgPath` pose l'origine du chemin en (x, y) et retourne l'axe vertical lui-même.
  const origine = { x: ox - minX * echelle, y: haut + minY * echelle };
  const ignores: string[] = [];

  const decoupes = new Map<string, Point[][]>();
  const recolter = (n: NoeudSvg) => {
    if (n.type === "clipPath" && typeof n.props.id === "string") {
      decoupes.set(n.props.id, n.enfants.filter((e): e is NoeudSvg => typeof e !== "string" && e.type === "polygon").map((e) => enPoints(e.props.points)));
    }
    n.enfants.forEach((e) => typeof e !== "string" && recolter(e));
  };
  recolter(racine);

  const peindre = (d: string, s: Style) => {
    const fond = couleurPourLePapier(s.fill);
    const trait = s.strokeWidth > 0 ? couleurPourLePapier(s.stroke) : null;
    if (!fond && !trait) return;
    page.drawSvgPath(d, {
      x: origine.x,
      y: origine.y,
      scale: echelle,
      ...(fond ? { color: fond.couleur, opacity: fond.opacite * s.fillOpacity * s.opacity } : {}),
      ...(trait
        ? {
            borderColor: trait.couleur,
            borderOpacity: trait.opacite * s.strokeOpacity * s.opacity,
            // `drawSvgPath` trace dans le repère MIS À L'ÉCHELLE : l'épaisseur et
            // les pointillés se donnent en unités du dessin. Les multiplier par
            // l'échelle les comptait deux fois (traits épais, symboles bouchés).
            borderWidth: s.strokeWidth,
            ...(s.strokeLinecap === "round" ? { borderLineCap: LineCapStyle.Round } : {}),
            ...(s.strokeDasharray ? { borderDashArray: s.strokeDasharray.split(/[\s,]+/).map(Number) } : {}),
          }
        : {}),
    });
  };

  const avecDecoupe = (s: Style, tracer: () => void) => {
    const id = s.clipPath ? /url\(#([^)]+)\)/.exec(s.clipPath)?.[1] : undefined;
    const formes = id ? decoupes.get(id) : undefined;
    if (!formes) {
      tracer();
      return;
    }
    const ops = [pushGraphicsState()];
    for (const forme of formes) {
      forme.forEach((p, i) => {
        const q = versPage(p);
        ops.push(i ? lineTo(q.x, q.y) : moveTo(q.x, q.y));
      });
      ops.push(closePath());
    }
    ops.push(clip(), endPath());
    page.pushOperators(...ops);
    tracer();
    page.pushOperators(popGraphicsState());
  };

  const tracerNoeud = (n: NoeudSvg, parent: Style) => {
    const s = heriter(parent, n.props);
    const t = tourner(n.props.transform);
    switch (n.type) {
      case "svg":
      case "g":
        avecDecoupe(s, () => n.enfants.forEach((e) => typeof e !== "string" && tracerNoeud(e, { ...s, clipPath: null })));
        return;
      case "defs":
      case "clipPath":
      case "title":
        return;
      case "polygon":
        avecDecoupe(s, () => peindre(chemin(enPoints(n.props.points).map(t), true), s));
        return;
      case "line": {
        const a = t({ x: nombre(n.props.x1), y: nombre(n.props.y1) });
        const b = t({ x: nombre(n.props.x2), y: nombre(n.props.y2) });
        avecDecoupe(s, () => peindre(chemin([a, b], false), { ...s, fill: "none" }));
        return;
      }
      case "circle": {
        const c = t({ x: nombre(n.props.cx), y: nombre(n.props.cy) });
        const r = nombre(n.props.r);
        avecDecoupe(s, () => peindre(`M${c.x - r} ${c.y} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`, s));
        return;
      }
      case "rect": {
        const x = nombre(n.props.x), y = nombre(n.props.y), lw = nombre(n.props.width), lh = nombre(n.props.height);
        avecDecoupe(s, () => peindre(chemin([{ x, y }, { x: x + lw, y }, { x: x + lw, y: y + lh }, { x, y: y + lh }].map(t), true), s));
        return;
      }
      case "path":
        if (n.props.transform) {
          ignores.push("path tourné");
          return;
        }
        avecDecoupe(s, () => peindre(String(n.props.d ?? ""), s));
        return;
      case "text": {
        const texte = pourLePapier(n.enfants.filter((e): e is string => typeof e === "string").join("")).texte;
        const couleur = couleurPourLePapier(s.fill);
        if (!texte || !couleur) return;
        const police = s.fontFamily?.includes("display") ? polices.titres : polices.texte;
        const taille = s.fontSize * echelle;
        const large = police.widthOfTextAtSize(texte, taille);
        const p = versPage(t({ x: nombre(n.props.x), y: nombre(n.props.y) }));
        const x = s.textAnchor === "middle" ? p.x - large / 2 : s.textAnchor === "end" ? p.x - large : p.x;
        page.drawText(texte, { x, y: p.y, size: taille, font: police, color: couleur.couleur, opacity: couleur.opacite * s.opacity });
        return;
      }
      default:
        ignores.push(n.type);
    }
  };

  // **Le cadre du dessin le coupe**, comme le `svg` de l'écran : ce qui sort de
  // la `viewBox` (les zones voisines d'un réseau) n'est pas montré.
  const coin = versPage({ x: minX, y: minY });
  page.pushOperators(pushGraphicsState(), moveTo(coin.x, coin.y), lineTo(coin.x + largeur, coin.y), lineTo(coin.x + largeur, coin.y - hauteur), lineTo(coin.x, coin.y - hauteur), closePath(), clip(), endPath());
  tracerNoeud(racine, STYLE_DE_DEPART);
  page.pushOperators(popGraphicsState());
  return { largeur, hauteur, ignores };
}
