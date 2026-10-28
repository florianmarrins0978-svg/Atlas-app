/**
 * LES FORMES DU PLAN DESSINÉ : les côtés courbes, les rangées en S, le pas du
 * doigt et les cotes jusqu'aux bords.
 *
 * *Sa demande du 19 octobre 2026 :* « si je reste appuyé au milieu d'un carré
 * de pelouse et que je le décale vers l'intérieur ou l'extérieur, que ça crée
 * une courbure ; pareil pour le dallage, ça peut créer un dallage en S ». Puis
 * « le bout en pointe de la pelouse, si je veux le rabattre, je ne peux pas » :
 * chaque coin se tirait aussi.
 *
 * **Les coins tirés sont RETIRÉS le 27 octobre 2026**, à sa demande : *« on va
 * retirer la possibilité de faire des coins tirés pour la pelouse et les
 * massifs »*. Un coin attrapé en glissant sa zone d'arroseurs l'avait étirée de
 * 12 à 15,06 m sans que les cotes affichées bougent, et le plan était calculé
 * sur 15,06. Un coin rendait la zone plus grande que ce qu'il avait tapé ; une
 * courbe, elle, se voit et se dit (`phrasesDuDessin`).
 *
 * **Sa règle, le même soir :** « il faut juste qu'ils l'expliquent, mais qu'ils
 * ne refusent pas ». Le calcul ne connaît que des rectangles : une zone courbe y
 * part comme le rectangle qui l'entoure (`cadreDe`). C'est la même fonction qui
 * dessine la forme à l'écran et qui la mesure au serveur.
 *
 * Tout est en MÈTRES, depuis le coin en haut à gauche du terrain (y vers le bas).
 */

export type PointMetres = { x: number; y: number };
export type Rectangle = { x: number; y: number; L: number; l: number };

export type Cote = "haut" | "droite" | "bas" | "gauche";
type Coin = "hg" | "hd" | "bd" | "bg";
export const COTES: readonly Cote[] = ["haut", "droite", "bas", "gauche"];
const COINS: readonly Coin[] = ["hg", "hd", "bd", "bg"];

/**
 * Un côté courbé, gardé RELATIF au côté : `u` le long (en part du côté), `v` en
 * travers vers l'extérieur (en mètres). La zone bouge ou change de cotes, la
 * courbe suit.
 */
export type Courbure = { u: number; v: number };

/** Ce qui se courbe : une zone, posée par son rectangle tapé. */
export type Forme = Rectangle & {
  courbes?: Partial<Record<Cote, Courbure>>;
};

/** Reposé à moins de 5 cm de sa place, un point tiré y reste. */
const RETOUR_M = 0.05;

function borne(v: number, max: number): number {
  return Math.max(0, Math.min(max, v));
}

function sommetsDe(f: Forme): Record<Coin, PointMetres> {
  return {
    hg: { x: f.x, y: f.y },
    hd: { x: f.x + f.L, y: f.y },
    bd: { x: f.x + f.L, y: f.y + f.l },
    bg: { x: f.x, y: f.y + f.l },
  };
}

/** Les côtés tournent dans le sens des aiguilles : la normale sort de la zone. */
function cotesDe(f: Forme): Record<Cote, [PointMetres, PointMetres]> {
  const s = sommetsDe(f);
  return { haut: [s.hg, s.hd], droite: [s.hd, s.bd], bas: [s.bd, s.bg], gauche: [s.bg, s.hg] };
}
function normale(p0: PointMetres, p1: PointMetres): PointMetres {
  const dx = p1.x - p0.x, dy = p1.y - p0.y, n = Math.hypot(dx, dy) || 1;
  return { x: dy / n, y: -dx / n };
}

/** Le point de contrôle d'un côté courbé, ou `null` s'il est droit. */
export function controleDe(f: Forme, c: Cote): PointMetres | null {
  const k = f.courbes?.[c];
  if (!k) return null;
  const [p0, p1] = cotesDe(f)[c];
  const n = normale(p0, p1);
  return { x: p0.x + (p1.x - p0.x) * k.u + n.x * k.v, y: p0.y + (p1.y - p0.y) * k.u + n.y * k.v };
}

function bez2(p0: PointMetres, k: PointMetres, p1: PointMetres, t: number): PointMetres {
  const m = 1 - t;
  return { x: m * m * p0.x + 2 * m * t * k.x + t * t * p1.x, y: m * m * p0.y + 2 * m * t * k.y + t * t * p1.y };
}

/** Une forme qui n'est plus le rectangle tapé : un côté courbe. */
export function formeLibre(f: Forme): boolean {
  return COTES.some((c) => f.courbes?.[c]);
}

/** Les points qui tiennent la forme : ses coins et ses points de contrôle. Une
 *  courbe reste dans leur enveloppe, donc ils suffisent à dire si elle sort. */
export function pointsDeLaForme(f: Forme): PointMetres[] {
  const s = sommetsDe(f);
  const k = COTES.map((c) => controleDe(f, c)).filter((p): p is PointMetres => p !== null);
  return [...COINS.map((c) => s[c]), ...k];
}

/**
 * **Le rectangle qui entoure la forme : c'est lui que le calcul reçoit.** Les
 * extrémités d'une Bézier du second degré se calculent exactement (la dérivée
 * s'annule en un seul point par axe), sans l'échantillonner.
 */
export function cadreDe(f: Forme): Rectangle {
  if (!formeLibre(f)) return { x: f.x, y: f.y, L: f.L, l: f.l };
  const s = sommetsDe(f);
  const xs = COINS.map((c) => s[c].x), ys = COINS.map((c) => s[c].y);
  const cotes = cotesDe(f);
  for (const c of COTES) {
    const k = controleDe(f, c);
    if (!k) continue;
    const [p0, p1] = cotes[c];
    for (const axe of ["x", "y"] as const) {
      const den = p0[axe] - 2 * k[axe] + p1[axe];
      if (Math.abs(den) < 1e-12) continue;
      const t = (p0[axe] - k[axe]) / den;
      if (t > 0 && t < 1) {
        const q = bez2(p0, k, p1, t);
        xs.push(q.x);
        ys.push(q.y);
      }
    }
  }
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, L: Math.max(...xs) - x, l: Math.max(...ys) - y };
}

/** Le contour à dessiner, le même qui est mesuré. */
export function cheminDe(f: Forme): string {
  const p = cotesDe(f);
  let d = `M${p.haut[0].x} ${p.haut[0].y}`;
  for (const c of COTES) {
    const fin = p[c][1], k = controleDe(f, c);
    d += k ? `Q${k.x} ${k.y} ${fin.x} ${fin.y}` : `L${fin.x} ${fin.y}`;
  }
  return `${d}Z`;
}

/** Le point rond qu'il tient : au milieu du côté, sur la courbe. */
export function pointDuCote(f: Forme, c: Cote): PointMetres {
  const [p0, p1] = cotesDe(f)[c];
  const k = controleDe(f, c);
  return k ? bez2(p0, k, p1, 0.5) : { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
}

/**
 * Tirer le côté : la courbe passe par le doigt, B(1/2) = H. Le point de
 * contrôle reste dans le terrain, donc la courbe aussi. Reposé sur le côté
 * droit, il redevient droit.
 */
export function tirerCote(f: Forme, c: Cote, h: PointMetres, terrain: { L: number; l: number }): Forme["courbes"] {
  const [p0, p1] = cotesDe(f)[c];
  const hc = { x: borne(h.x, terrain.L), y: borne(h.y, terrain.l) };
  const k = { x: borne(2 * hc.x - (p0.x + p1.x) / 2, terrain.L), y: borne(2 * hc.y - (p0.y + p1.y) / 2, terrain.l) };
  const dx = p1.x - p0.x, dy = p1.y - p0.y, len2 = dx * dx + dy * dy || 1, n = normale(p0, p1);
  const u = ((k.x - p0.x) * dx + (k.y - p0.y) * dy) / len2;
  const v = (k.x - p0.x) * n.x + (k.y - p0.y) * n.y;
  const courbes = { ...f.courbes };
  if (Math.abs(v) < RETOUR_M) delete courbes[c];
  else courbes[c] = { u, v };
  return courbes;
}

/* ── Les rangées de dalles ────────────────────────────────────────────── */

/**
 * Une rangée courbée : deux points de contrôle (une Bézier du troisième degré,
 * d'où le S), RELATIFS à sa corde, `u` le long et `v` en travers, tous deux en
 * part de la corde. Corriger la distance agrandit la rangée tout entière.
 */
export type CourbeRangee = [Courbure, Courbure];
export type Rangee = { a: PointMetres; b: PointMetres; courbe?: CourbeRangee };

function controlesRangee(r: Rangee): [PointMetres, PointMetres] {
  const dx = r.b.x - r.a.x, dy = r.b.y - r.a.y, len = Math.hypot(dx, dy), n = normale(r.a, r.b);
  const k = r.courbe ?? [{ u: 1 / 3, v: 0 }, { u: 2 / 3, v: 0 }];
  const p = (c: Courbure) => ({ x: r.a.x + dx * c.u + n.x * c.v * len, y: r.a.y + dy * c.u + n.y * c.v * len });
  return [p(k[0]), p(k[1])];
}
function bez3(a: PointMetres, c1: PointMetres, c2: PointMetres, b: PointMetres, t: number): PointMetres {
  const m = 1 - t;
  return {
    x: m * m * m * a.x + 3 * m * m * t * c1.x + 3 * m * t * t * c2.x + t * t * t * b.x,
    y: m * m * m * a.y + 3 * m * m * t * c1.y + 3 * m * t * t * c2.y + t * t * t * b.y,
  };
}

/** La rangée en points serrés, et la longueur parcourue jusqu'à chacun. */
export function echantillonsRangee(r: Rangee): { pts: PointMetres[]; cum: number[]; total: number } {
  const [k0, k1] = controlesRangee(r);
  const pts: PointMetres[] = [], cum = [0];
  for (let i = 0; i <= 80; i++) {
    pts.push(bez3(r.a, k0, k1, r.b, i / 80));
    if (i > 0) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  return { pts, cum, total: cum[cum.length - 1] };
}

/** La longueur de la rangée, le long de sa courbe : c'est la « Distance » de la feuille. */
export function longueurDeLaRangee(r: Rangee): number {
  return r.courbe ? echantillonsRangee(r).total : Math.hypot(r.b.x - r.a.x, r.b.y - r.a.y);
}

/** Le point de la rangée à `s` mètres du départ, et son angle. */
export function surLaRangee(e: ReturnType<typeof echantillonsRangee>, s: number): PointMetres & { angle: number } {
  for (let i = 1; i < e.cum.length; i++) {
    if (e.cum[i] >= s || i === e.cum.length - 1) {
      const a = e.pts[i - 1], b = e.pts[i], seg = e.cum[i] - e.cum[i - 1] || 1, f = (s - e.cum[i - 1]) / seg;
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, angle: Math.atan2(b.y - a.y, b.x - a.x) };
    }
  }
  return { ...e.pts[0], angle: 0 };
}

/** Les deux points ronds d'une rangée choisie : au tiers et aux deux tiers. */
export function poigneesRangee(r: Rangee): [PointMetres, PointMetres] {
  const [k0, k1] = controlesRangee(r);
  return [bez3(r.a, k0, k1, r.b, 1 / 3), bez3(r.a, k0, k1, r.b, 2 / 3)];
}

/** Tirer un des deux points : la courbe passe par le doigt, l'autre point reste.
 *  Revenue droite, la rangée perd sa courbe. */
export function tirerRangee(r: Rangee, i: 0 | 1, h: PointMetres): CourbeRangee | undefined {
  const t = i === 0 ? 1 / 3 : 2 / 3, m = 1 - t;
  const k = controlesRangee(r);
  const autre = k[i === 0 ? 1 : 0];
  const poids = i === 0 ? 3 * m * m * t : 3 * m * t * t;
  const poidsAutre = i === 0 ? 3 * m * t * t : 3 * m * m * t;
  const axe = (q: "x" | "y") => (h[q] - m * m * m * r.a[q] - poidsAutre * autre[q] - t * t * t * r.b[q]) / poids;
  k[i] = { x: axe("x"), y: axe("y") };
  const dx = r.b.x - r.a.x, dy = r.b.y - r.a.y, len2 = dx * dx + dy * dy || 1, len = Math.sqrt(len2), n = normale(r.a, r.b);
  const rel = (c: PointMetres): Courbure => ({
    u: ((c.x - r.a.x) * dx + (c.y - r.a.y) * dy) / len2,
    v: ((c.x - r.a.x) * n.x + (c.y - r.a.y) * n.y) / len,
  });
  const courbe: CourbeRangee = [rel(k[0]), rel(k[1])];
  return courbe.every((c) => Math.abs(c.v) < 0.01) ? undefined : courbe;
}

/** Une rangée qui ne sort pas du terrain, sur toute sa courbe. */
export function rangeeDansLeTerrain(r: Rangee, terrain: { L: number; l: number }): boolean {
  const e = 1e-6;
  const pts = r.courbe ? echantillonsRangee(r).pts : [r.a, r.b];
  return pts.every((q) => q.x >= -e && q.y >= -e && q.x <= terrain.L + e && q.y <= terrain.l + e);
}

/** L'arrivée qui met la rangée à la distance tapée ; le départ ne bouge pas.
 *  Courbée, elle garde sa forme et s'agrandit. */
export function arriveeA(r: Rangee, metres: number): PointMetres {
  let dx = r.b.x - r.a.x, dy = r.b.y - r.a.y;
  let n = Math.hypot(dx, dy);
  if (n < 1e-9) { dx = 1; dy = 0; n = 1; }
  const k = metres / (r.courbe ? longueurDeLaRangee(r) : n);
  return { x: r.a.x + dx * k, y: r.a.y + dy * k };
}

/**
 * Combien de dalles tiennent sur la rangée, centrées, jamais étirées.
 *
 * **La longueur d'une dalle se pose dans le sens de la rangée, sa largeur en
 * travers** : sa remarque du 19 octobre 2026, « les dalles se mettent d'office
 * à l'envers, on est obligé de les tourner ».
 */
export function dallesDeLaRangee(r: Rangee & { L: number; e: number | null }): { n: number; dist: number; depart: number } {
  const dist = longueurDeLaRangee(r);
  const e = r.e ?? 0;
  const n = r.L > 0 ? Math.max(1, Math.floor((dist + e) / (r.L + e) + 1e-9)) : 0;
  const occupe = n * r.L + Math.max(0, n - 1) * e;
  return { n, dist, depart: (dist - occupe) / 2 };
}

/* ── Le doigt et les cotes ────────────────────────────────────────────── */

/**
 * Le doigt avance par pas, pour que les cotes tombent juste : 10 cm sur tout le
 * terrain, plus fin quand on regarde de plus près (son « oui » du 19 octobre,
 * donné pour l'échelle en centièmes). L'échelle a laissé la place au zoom le
 * 22 octobre 2026 : 5 cm à partir de deux fois plus près, 1 cm à quatre fois.
 */
export function pasDuDoigt(zoom: number): number {
  return zoom >= 4 ? 0.01 : zoom >= 2 ? 0.05 : 0.1;
}
export function auPas(metres: number, zoom: number): number {
  const pas = pasDuDoigt(zoom);
  return Math.round(Math.round(metres / pas) * pas * 1e6) / 1e6;
}

/** Les quatre distances d'un objet aux bords du terrain : « plus je le décale,
 *  plus les mètres descendent ». */
export function cotesAuxBords(b: Rectangle, terrain: { L: number; l: number }): Record<"gauche" | "droite" | "haut" | "bas", number> {
  return { gauche: b.x, droite: terrain.L - (b.x + b.L), haut: b.y, bas: terrain.l - (b.y + b.l) };
}
