/**
 * LE PLAN DESSINÉ AU DOIGT, au lieu du croquis photographié.
 *
 * *Sa demande du 18 octobre 2026 :* « au moment de faire la photo du plan,
 * est-ce qu'on pourrait pas mettre un petit outil de création du plan ? »
 * Deux planches lui ont été montrées ; il a choisi la B, *« parce qu'il faut que
 * ça soit à l'échelle »* : on tape les cotes, la zone se pose à sa taille, on la
 * glisse à sa place (`appli/arrosage-dessiner-plan-b.html`).
 *
 * **Le dessin rend ce que la photo rend** : un `CroquisLu`. Tout ce qui suit la
 * lecture (les trois éléments obligatoires, la mesure, l'amenée, le terrain, le
 * calcul) est donc le MÊME chemin, sans une ligne de plus — et sans l'IA : il
 * n'y a rien à lire, tout est déjà en mètres.
 *
 * **Pure** : l'écran s'en sert pour dire ce qui ne tient pas pendant qu'il
 * dessine, le serveur pour relire ce qui arrive. Une seule règle des deux côtés
 * (`CLAUDE.md` §3).
 */
import type { CroquisLu, ZoneLue } from "@/server/ai/services/lire-croquis";
import {
  cadreDe,
  COINS,
  COTES,
  echantillonsRangee,
  formeLibre,
  pointsDeLaForme,
  rangeeDansLeTerrain,
  type CourbeRangee,
  type Forme,
  type PointMetres,
  type Rangee,
  type Rectangle,
} from "@/lib/arrosage/formes-du-dessin";

export type { PointMetres } from "@/lib/arrosage/formes-du-dessin";

/** Les mêmes plafonds que la lecture du croquis et les paramètres du plan. */
export const COTE_MAX_M = 100;
/** Plafond des zones envoyées ET des morceaux qui partent au calcul : une
 *  maison et des allées découpent, et chaque morceau est une zone de plus. */
const ZONES_MAX = 40;
const MAISONS_MAX = 20;
const DALLES_MAX = 40;
const LIGNES_HAIE_MAX = 20;
const NOM_MAX = 80;
const TYPES: readonly ZoneLue["type"][] = ["gazon", "massif", "haie", "potager"];

/** Le nom d'une zone qu'il n'a pas nommée : celui de son bouton. */
export const NOMS_DES_ZONES: Record<ZoneLue["type"] | "maison", string> = {
  gazon: "Pelouse",
  potager: "Potager",
  massif: "Massif",
  haie: "Haie",
  maison: "Maison",
};

/**
 * Une zone posée sur le terrain, EN MÈTRES : son coin en haut à gauche, sa
 * longueur couchée (L), sa largeur debout (l). Pour une haie, L est sa
 * longueur et l sa largeur — la largeur qu'il a demandée le 18 octobre (« pas
 * simplement la longueur »). Ses côtés peuvent être courbés et ses coins tirés
 * (`formes-du-dessin.ts`).
 */
export type ZoneDessinee = Forme & {
  type: ZoneLue["type"];
  nom: string | null;
  /** Une haie : combien de lignes de goutte-à-goutte. Il le choisit. */
  lignesHaie?: number;
};

/** *« La maison, oui, tu peux l'ajouter »* (19 octobre 2026) : un rectangle
 *  qui ne s'arrose pas, ne part pas au calcul, et coupe ce qu'il chevauche. */
export type MaisonDessinee = Rectangle & { nom: string | null };

/** Une rangée de dalles QU'ON N'ARROSE PAS : seule celle-là change le plan.
 *  `l` est la largeur d'une dalle, en travers de la rangée. */
export type DallesNonArrosees = Rangee & { l: number };

export type DessinDuPlan = {
  terrain: { L: number; l: number };
  zones: ZoneDessinee[];
  maisons: MaisonDessinee[];
  dalles: DallesNonArrosees[];
  /** **Placée par lui, jamais par l'outil** (`CLAUDE.md` §4 bis). */
  nourrice: PointMetres | null;
  piquage: PointMetres | null;
};

/**
 * Combien de lignes de goutte-à-goutte PROPOSER pour une haie de cette largeur.
 *
 * **Sa règle** (relais d'arrosage, « le calcul du goutte-à-goutte ») : une ligne
 * arrose 50 cm de part et d'autre, une bande de 1 m. Donc une ligne par mètre de
 * large, arrondi au-dessus. Une proposition, jamais une décision : l'écran la
 * présélectionne, il la change d'un doigt (sa réponse « la 2 »).
 */
export const BANDE_PAR_LIGNE_M = 1;
export function lignesProposees(largeur: number | null): number | null {
  if (largeur === null || !(largeur > 0)) return null;
  // Le millionième retiré : 2 ÷ 1 doit rester 2, pas devenir 3 par l'arrondi.
  return Math.max(1, Math.ceil(largeur / BANDE_PAR_LIGNE_M - 1e-9));
}

/**
 * Les zones qui ne tiennent pas dans le terrain — *« je peux poser un carré de
 * pelouse de 12 par 12 alors que mon cadre fait 10 par 10, il faut pouvoir
 * bloquer ça »*. Une cote plus grande que le terrain est une cote fausse, l'une
 * ou l'autre ; une zone posée au-delà du bord aussi.
 */
export function zonesQuiDebordent<Z extends Forme>(d: { terrain: DessinDuPlan["terrain"]; zones: Z[] }): Z[] {
  const e = 1e-6;
  const dehors = (p: PointMetres) => p.x < -e || p.y < -e || p.x > d.terrain.L + e || p.y > d.terrain.l + e;
  // Un coin tiré ou une courbe qui sortirait du terrain : la forme ne tient pas
  // plus qu'une cote trop grande.
  return d.zones.filter(
    (z) => z.x < -e || z.y < -e || z.x + z.L > d.terrain.L + e || z.y + z.l > d.terrain.l + e || pointsDeLaForme(z).some(dehors)
  );
}

/* ── Ce qui coupe une zone ──────────────────────────────────────────────── */

/** Presque droite (moins de 10° d'un axe), la rangée se redresse en gardant sa
 *  distance ; au-delà, elle ne se découpe pas : le calcul ne connaît que des
 *  rectangles. */
export const REDRESSE_MAX_DEGRES = 10;
const REDRESSE_MAX = Math.tan((REDRESSE_MAX_DEGRES * Math.PI) / 180);
export function redressee(a: PointMetres, b: PointMetres): PointMetres | null {
  const dx = b.x - a.x, dy = b.y - a.y, n = Math.hypot(dx, dy);
  if (Math.abs(dy) <= REDRESSE_MAX * Math.abs(dx)) return { x: a.x + Math.sign(dx) * n, y: a.y };
  if (Math.abs(dx) <= REDRESSE_MAX * Math.abs(dy)) return { x: a.x, y: a.y + Math.sign(dy) * n };
  return null;
}
export const PHRASE_RANGEE_DROITE = "Pour ne pas les arroser, posez la rangée droite, couchée ou debout.";

/**
 * **L'aimant, validé par lui le 19 octobre 2026** : le doigt ne touche jamais
 * le bord exact d'une pelouse. Un bout de rangée à moins de 50 cm du bord de la
 * zone va jusqu'au bord, au lieu de laisser une lanière de gazon que le calcul
 * arroserait à part. Sa réponse : *« vaut mieux qu'il y ait 30 cm de dalle qui
 * soit arrosée par des arroseurs que l'autre problème »*.
 */
export const AIMANT_M = 0.5;

/** La bande d'une rangée droite : toute la distance, d'un point touché à
 *  l'autre, sur la largeur d'une dalle. La borner aux dalles laissait un bout de
 *  gazon à chaque extrémité. */
function bandeDesDalles(d: DallesNonArrosees): Rectangle {
  if (Math.abs(d.b.y - d.a.y) <= Math.abs(d.b.x - d.a.x)) {
    return { x: Math.min(d.a.x, d.b.x), y: d.a.y - d.l / 2, L: Math.abs(d.b.x - d.a.x), l: d.l };
  }
  return { x: d.a.x - d.l / 2, y: Math.min(d.a.y, d.b.y), L: d.l, l: Math.abs(d.b.y - d.a.y) };
}

/** Ce qu'occupe une rangée, courbe comprise. */
export function empriseDesDalles(d: Rangee & { l: number }): Rectangle {
  if (!d.courbe) return bandeDesDalles(d);
  const pts = echantillonsRangee(d).pts, demi = d.l / 2;
  const x = Math.min(...pts.map((q) => q.x)) - demi, y = Math.min(...pts.map((q) => q.y)) - demi;
  return { x, y, L: Math.max(...pts.map((q) => q.x)) + demi - x, l: Math.max(...pts.map((q) => q.y)) + demi - y };
}

/**
 * Ce qui coupe une zone : les rangées qu'on n'arrose pas, droites, et les
 * maisons. **Une rangée courbe ne coupe pas** : le découpage ne donnerait pas
 * des rectangles, et l'écran le dit (`phrasesDuDessin`). L'aimant se prend sur
 * le rectangle que le calcul reçoit (`cadreDe`), pas sur la forme.
 */
function coupeursDe(cadre: Rectangle, d: DessinDuPlan): { b: Rectangle; nom: string }[] {
  const liste: { b: Rectangle; nom: string }[] = [];
  for (const r of d.dalles) {
    if (r.courbe) continue;
    const b = { ...bandeDesDalles(r) };
    if (b.L >= b.l) {
      if (b.x > cadre.x && b.x - cadre.x < AIMANT_M) { b.L += b.x - cadre.x; b.x = cadre.x; }
      const droite = cadre.x + cadre.L - (b.x + b.L);
      if (droite > 0 && droite < AIMANT_M) b.L += droite;
    } else {
      if (b.y > cadre.y && b.y - cadre.y < AIMANT_M) { b.l += b.y - cadre.y; b.y = cadre.y; }
      const bas = cadre.y + cadre.l - (b.y + b.l);
      if (bas > 0 && bas < AIMANT_M) b.l += bas;
    }
    liste.push({ b, nom: "les dalles" });
  }
  for (const m of d.maisons) liste.push({ b: m, nom: m.nom ?? NOMS_DES_ZONES.maison });
  return liste;
}

/**
 * Les morceaux d'une zone une fois retirés ses coupeurs : au-dessus, au-dessous,
 * puis à gauche et à droite de chaque coupeur. Chacun part au calcul comme une
 * zone, et le calcul pose déjà ses arroseurs aux angles et le long des bords :
 * donc le long des dalles et de la maison. Un morceau de moins d'un centimètre
 * n'est pas une zone.
 */
export function morceauxDe(z: ZoneDessinee, d: DessinDuPlan): { parts: Rectangle[]; coupeurs: string[] } {
  const cadre = cadreDe(z);
  const e = 0.01;
  let parts: Rectangle[] = [cadre];
  const coupeurs: string[] = [];
  for (const c of coupeursDe(cadre, d)) {
    const b = c.b;
    const suite: Rectangle[] = [];
    let coupe = false;
    for (const p of parts) {
      const x1 = Math.max(p.x, b.x), y1 = Math.max(p.y, b.y);
      const x2 = Math.min(p.x + p.L, b.x + b.L), y2 = Math.min(p.y + p.l, b.y + b.l);
      if (x2 - x1 <= e || y2 - y1 <= e) { suite.push(p); continue; }
      coupe = true;
      for (const q of [
        { x: p.x, y: p.y, L: p.L, l: y1 - p.y },
        { x: p.x, y: y2, L: p.L, l: p.y + p.l - y2 },
        { x: p.x, y: y1, L: x1 - p.x, l: y2 - y1 },
        { x: x2, y: y1, L: p.x + p.L - x2, l: y2 - y1 },
      ]) {
        if (q.L > e && q.l > e) suite.push(q);
      }
    }
    parts = suite;
    if (coupe && !coupeurs.includes(c.nom)) coupeurs.push(c.nom);
  }
  return { parts, coupeurs };
}

function nomDe(z: { type: ZoneLue["type"]; nom: string | null }): string {
  return z.nom ?? NOMS_DES_ZONES[z.type];
}
function dims(r: Rectangle): string {
  return `${virgule(r.L)} × ${virgule(r.l)} m`;
}
function chevauche(a: Rectangle, b: Rectangle): boolean {
  return a.x < b.x + b.L && a.x + a.L > b.x && a.y < b.y + b.l && a.y + a.l > b.y;
}

/**
 * Ce que l'écran dit du découpage et des courbes. **Sa règle du 19 octobre :
 * expliquer, ne pas refuser, et dire que ce sera arrosé quand même.**
 */
export function phrasesDuDessin(d: DessinDuPlan): string[] {
  const phrases: string[] = [];
  for (const z of d.zones) {
    const { parts, coupeurs } = morceauxDe(z, d);
    if (coupeurs.length === 0) continue;
    const qui = coupeurs.join(" et ");
    const sujet = qui.charAt(0).toUpperCase() + qui.slice(1);
    const pluriel = coupeurs.length > 1 || qui === "les dalles";
    if (parts.length === 0) phrases.push(`${sujet} ${pluriel ? "couvrent" : "couvre"} ${nomDe(z)} entièrement, cette zone n’entre pas dans le plan.`);
    else if (parts.length > 1) phrases.push(`${sujet} ${pluriel ? "coupent" : "coupe"} ${nomDe(z)} en ${parts.length} parts.`);
  }
  for (const z of d.zones) {
    if (!formeLibre(z)) continue;
    const c = cadreDe(z);
    phrases.push(
      z.type === "gazon"
        ? `La forme de ${nomDe(z)} est arrosée comme le rectangle qui l’entoure, ${dims(c)}. Les arroseurs du bord peuvent mouiller un peu au-delà.`
        : `Le goutte-à-goutte de ${nomDe(z)} est compté sur le rectangle qui l’entoure, ${dims(c)}, un peu plus de tube que la forme.`
    );
  }
  for (const r of d.dalles) {
    if (!r.courbe) continue;
    const b = empriseDesDalles(r);
    for (const z of d.zones) {
      if (chevauche(b, cadreDe(z))) phrases.push(`Les dalles en courbe ne coupent pas ${nomDe(z)} : elles sont arrosées avec cette zone.`);
    }
  }
  return phrases;
}

function cote(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 && v <= COTE_MAX_M ? v : null;
}
function place(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function point(v: unknown, terrain: { L: number; l: number }): PointMetres | null | "faux" {
  if (v === null || v === undefined) return null;
  if (typeof v !== "object") return "faux";
  const o = v as Record<string, unknown>;
  const x = place(o.x), y = place(o.y);
  if (x === null || y === null) return "faux";
  const e = 1e-6;
  if (x < -e || y < -e || x > terrain.L + e || y > terrain.l + e) return "faux";
  return { x, y };
}

/**
 * **Ce qui vient du navigateur se relit** : il peut envoyer n'importe quoi, et
 * ce qui passe ici part au calcul. Une cote absurde, un type inconnu, une zone
 * hors du terrain sont refusés en le disant, jamais corrigés au jugé.
 */
export function lireLeDessin(brut: unknown): { ok: true; dessin: DessinDuPlan } | { ok: false; raison: string } {
  const illisible = { ok: false as const, raison: "Ce dessin n’est pas lisible. Reprenez-le." };
  if (typeof brut !== "object" || brut === null) return illisible;
  const o = brut as Record<string, unknown>;

  const t = (o.terrain ?? {}) as Record<string, unknown>;
  const terrain = { L: cote(t.L), l: cote(t.l) };
  if (terrain.L === null || terrain.l === null) {
    return { ok: false, raison: `Les métrés du terrain manquent, ou dépassent ${COTE_MAX_M} m.` };
  }
  const cadre = { L: terrain.L, l: terrain.l };

  if (!Array.isArray(o.zones)) return illisible;
  if (o.zones.length > ZONES_MAX) {
    return { ok: false, raison: `Ce dessin porte plus de ${ZONES_MAX} zones : il ne peut pas être calculé.` };
  }
  const zones: ZoneDessinee[] = [];
  for (const brute of o.zones) {
    if (typeof brute !== "object" || brute === null) return illisible;
    const z = brute as Record<string, unknown>;
    if (!(TYPES as readonly unknown[]).includes(z.type)) {
      // Un type inconnu ne se traduit pas au jugé : « verger » rangé en
      // pelouse recevrait des turbines.
      return { ok: false, raison: "Une zone du dessin n’est d’aucun type connu." };
    }
    const type = z.type as ZoneLue["type"];
    const nom = typeof z.nom === "string" && z.nom.trim() !== "" ? z.nom.trim().slice(0, NOM_MAX) : null;
    const L = cote(z.L), l = cote(z.l), x = place(z.x), y = place(z.y);
    const appel = nom ?? "une zone";
    if (L === null || l === null) {
      return { ok: false, raison: `Les cotes de « ${appel} » manquent, ou dépassent ${COTE_MAX_M} m.` };
    }
    if (x === null || y === null) return illisible;
    const zone: ZoneDessinee = { type, nom, L, l, x, y };
    if (type === "haie" && z.lignesHaie !== undefined && z.lignesHaie !== null) {
      const n = z.lignesHaie;
      if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > LIGNES_HAIE_MAX) {
        return { ok: false, raison: `Le nombre de lignes de « ${appel} » va de 1 à ${LIGNES_HAIE_MAX}.` };
      }
      zone.lignesHaie = n;
    }
    const courbes = lireTable(z.courbes, COTES, courbure);
    const coins = lireTable(z.coins, COINS, decalage);
    if (courbes === "faux" || coins === "faux") return { ok: false, raison: `La forme de « ${appel} » n’est pas lisible. Reprenez-la.` };
    if (courbes) zone.courbes = courbes;
    if (coins) zone.coins = coins;
    zones.push(zone);
  }

  const maisons: MaisonDessinee[] = [];
  const maisonsBrutes = o.maisons ?? [];
  if (!Array.isArray(maisonsBrutes)) return illisible;
  if (maisonsBrutes.length > MAISONS_MAX) {
    return { ok: false, raison: `Ce dessin porte plus de ${MAISONS_MAX} maisons : il ne peut pas être calculé.` };
  }
  for (const brute of maisonsBrutes) {
    if (typeof brute !== "object" || brute === null) return illisible;
    const m = brute as Record<string, unknown>;
    const nom = typeof m.nom === "string" && m.nom.trim() !== "" ? m.nom.trim().slice(0, NOM_MAX) : null;
    const L = cote(m.L), l = cote(m.l), x = place(m.x), y = place(m.y);
    if (L === null || l === null) {
      return { ok: false, raison: `Les cotes de « ${nom ?? NOMS_DES_ZONES.maison} » manquent, ou dépassent ${COTE_MAX_M} m.` };
    }
    if (x === null || y === null) return illisible;
    maisons.push({ nom, L, l, x, y });
  }

  const deborde = zonesQuiDebordent({ terrain: cadre, zones: [...zones, ...maisons] });
  if (deborde.length > 0) {
    const z = deborde[0];
    return {
      ok: false,
      raison: `« ${z.nom ?? "Une zone"} » ne tient pas dans le terrain, qui fait ${virgule(cadre.L)} × ${virgule(cadre.l)} m.`,
    };
  }

  const dalles: DallesNonArrosees[] = [];
  const dallesBrutes = o.dalles ?? [];
  if (!Array.isArray(dallesBrutes)) return illisible;
  if (dallesBrutes.length > DALLES_MAX) {
    return { ok: false, raison: `Ce dessin porte plus de ${DALLES_MAX} rangées de dalles : il ne peut pas être calculé.` };
  }
  for (const brute of dallesBrutes) {
    if (typeof brute !== "object" || brute === null) return illisible;
    const r = brute as Record<string, unknown>;
    const a = point(r.a, cadre), b = point(r.b, cadre), l = cote(r.l);
    if (a === "faux" || b === "faux") return { ok: false, raison: "Des dalles sont posées hors du terrain." };
    if (!a || !b || l === null) return illisible;
    if (r.courbe !== undefined) {
      const k = r.courbe;
      if (!Array.isArray(k) || k.length !== 2) return illisible;
      const c0 = courbure(k[0], 3), c1 = courbure(k[1], 3);
      if (!c0 || !c1) return illisible;
      const courbe: CourbeRangee = [c0, c1];
      if (!rangeeDansLeTerrain({ a, b, courbe }, cadre)) return { ok: false, raison: "Des dalles sortent du terrain." };
      dalles.push({ a, b, l, courbe });
      continue;
    }
    // Le même redressement que l'écran : ce qu'il a posé droit le reste, ce qui
    // est en biais ne se découpe pas.
    const droite = redressee(a, b);
    if (!droite) return { ok: false, raison: PHRASE_RANGEE_DROITE };
    if (!rangeeDansLeTerrain({ a, b: droite }, cadre)) return { ok: false, raison: "Des dalles sortent du terrain." };
    dalles.push({ a, b: droite, l });
  }

  const nourrice = point(o.nourrice, cadre);
  const piquage = point(o.piquage, cadre);
  if (nourrice === "faux") return { ok: false, raison: "La nourrice est posée hors du terrain." };
  if (piquage === "faux") return { ok: false, raison: "Le piquage est posé hors du terrain." };

  const dessin: DessinDuPlan = { terrain: cadre, zones, maisons, dalles, nourrice, piquage };
  // Chaque morceau est une zone pour le calcul : le plafond vaut pour eux aussi.
  const morceaux = zones.reduce((n, z) => n + morceauxDe(z, dessin).parts.length, 0);
  if (morceaux > ZONES_MAX) {
    return { ok: false, raison: `Ce dessin se découpe en plus de ${ZONES_MAX} zones : il ne peut pas être calculé.` };
  }
  return { ok: true, dessin };
}

/** Une table de courbes ou de coins : absente, ou chaque clé connue et lisible. */
function lireTable<K extends string, V>(v: unknown, cles: readonly K[], lire: (x: unknown) => V | null): Partial<Record<K, V>> | null | "faux" {
  if (v === undefined || v === null) return null;
  if (typeof v !== "object" || Array.isArray(v)) return "faux";
  const table: Partial<Record<K, V>> = {};
  for (const [cle, brut] of Object.entries(v as Record<string, unknown>)) {
    if (!(cles as readonly string[]).includes(cle)) return "faux";
    const lu = lire(brut);
    if (lu === null) return "faux";
    table[cle as K] = lu;
  }
  return Object.keys(table).length > 0 ? table : null;
}
function fini(v: unknown, max: number): number | null {
  return typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= max ? v : null;
}
/** `u` le long du côté, en part de lui ; `v` en travers, en mètres (en part de
 *  la corde pour une rangée : `max` le dit). */
function courbure(v: unknown, max = COTE_MAX_M): { u: number; v: number } | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  const u = fini(o.u, 3), w = fini(o.v, max);
  return u === null || w === null ? null : { u, v: w };
}
function decalage(v: unknown): PointMetres | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  const x = fini(o.x, COTE_MAX_M), y = fini(o.y, COTE_MAX_M);
  return x === null || y === null ? null : { x, y };
}

function virgule(n: number): string {
  return String(Math.round(n * 100) / 100).replace(".", ",");
}

/**
 * Le dessin, rendu comme la photo le rend.
 *
 * **Les fractions se prennent sur un CARRÉ** dont le côté est le plus grand côté
 * du terrain. Sur le rectangle, un terrain de 34 × 16 donnerait une unité de
 * fraction de 34 m en largeur et de 16 m en hauteur, que `echelleDuCroquis`
 * mélangerait. Sur le carré, une seule échelle, et elle est exacte.
 *
 * Le point d'eau suit le choix « Le piquage se fait… » de l'écran : c'est lui
 * qui commande le débit, et le dessin ne doit pas le contredire.
 *
 * **Une zone coupée part en MORCEAUX** (« Pelouse 1 », « Pelouse 2 »), chacun
 * avec ses cotes à lui ; **une zone courbe** part avec celles du rectangle qui
 * l'entoure. La maison ne part pas : elle ne s'arrose pas.
 */
export function croquisDuDessin(d: DessinDuPlan, pointDEau: "compteur" | "robinet"): CroquisLu {
  const s = Math.max(d.terrain.L, d.terrain.l);
  const f = (m: number) => Math.round((m / s) * 1e6) / 1e6;
  const m4 = (m: number) => Math.round(m * 1e4) / 1e4;
  const zones: ZoneLue[] = d.zones.flatMap((z) => {
    const haie = z.type === "haie";
    const { parts } = morceauxDe(z, d);
    const coupee = parts.length > 1;
    return parts.map((q, i) => {
      const L = m4(q.L), l = m4(q.l);
      const lue: ZoneLue = {
        type: z.type,
        nom: coupee ? `${nomDe(z)} ${i + 1}` : z.nom,
        L: haie ? null : L,
        l: haie ? null : l,
        ml: haie ? L : null,
        x: f(q.x + q.L / 2),
        y: f(q.y + q.l / 2),
        largeurFraction: f(q.L),
        hauteurFraction: f(q.l),
      };
      if (haie && z.lignesHaie !== undefined) lue.lignesHaie = z.lignesHaie;
      return lue;
    });
  });
  const reserves: string[] = [];
  // Les mêmes phrases que la lecture de la photo : l'écran du refus les connaît.
  if (!d.nourrice) reserves.push("le croquis ne montre pas où la nourrice est posée");
  if (!d.piquage) reserves.push("le croquis ne montre pas où le piquage se fait");
  return {
    zones,
    pointDEau,
    nourrice: d.nourrice ? { x: f(d.nourrice.x), y: f(d.nourrice.y) } : null,
    piquage: d.piquage ? { x: f(d.piquage.x), y: f(d.piquage.y) } : null,
    reserves,
  };
}
