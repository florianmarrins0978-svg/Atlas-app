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

/** Les mêmes plafonds que la lecture du croquis et les paramètres du plan. */
export const COTE_MAX_M = 100;
const ZONES_MAX = 40;
const LIGNES_HAIE_MAX = 20;
const NOM_MAX = 80;
const TYPES: readonly ZoneLue["type"][] = ["gazon", "massif", "haie", "potager"];

export type PointMetres = { x: number; y: number };

/**
 * Une zone posée sur le terrain, EN MÈTRES : son coin en haut à gauche, sa
 * longueur couchée (L), sa largeur debout (l). Pour une haie, L est sa
 * longueur et l sa largeur — la largeur qu'il a demandée le 18 octobre (« pas
 * simplement la longueur »).
 */
export type ZoneDessinee = {
  type: ZoneLue["type"];
  nom: string | null;
  L: number;
  l: number;
  x: number;
  y: number;
  /** Une haie : combien de lignes de goutte-à-goutte. Il le choisit. */
  lignesHaie?: number;
};

export type DessinDuPlan = {
  terrain: { L: number; l: number };
  zones: ZoneDessinee[];
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
export function zonesQuiDebordent(d: Pick<DessinDuPlan, "terrain" | "zones">): ZoneDessinee[] {
  const e = 1e-6;
  return d.zones.filter(
    (z) => z.x < -e || z.y < -e || z.x + z.L > d.terrain.L + e || z.y + z.l > d.terrain.l + e
  );
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
    zones.push(zone);
  }

  const deborde = zonesQuiDebordent({ terrain: cadre, zones });
  if (deborde.length > 0) {
    const z = deborde[0];
    return {
      ok: false,
      raison: `« ${z.nom ?? "Une zone"} » ne tient pas dans le terrain, qui fait ${virgule(cadre.L)} × ${virgule(cadre.l)} m.`,
    };
  }

  const nourrice = point(o.nourrice, cadre);
  const piquage = point(o.piquage, cadre);
  if (nourrice === "faux") return { ok: false, raison: "La nourrice est posée hors du terrain." };
  if (piquage === "faux") return { ok: false, raison: "Le piquage est posé hors du terrain." };

  return { ok: true, dessin: { terrain: cadre, zones, nourrice, piquage } };
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
 */
export function croquisDuDessin(d: DessinDuPlan, pointDEau: "compteur" | "robinet"): CroquisLu {
  const s = Math.max(d.terrain.L, d.terrain.l);
  const f = (m: number) => Math.round((m / s) * 1e6) / 1e6;
  const zones: ZoneLue[] = d.zones.map((z) => {
    const haie = z.type === "haie";
    const lue: ZoneLue = {
      type: z.type,
      nom: z.nom,
      L: haie ? null : z.L,
      l: haie ? null : z.l,
      ml: haie ? z.L : null,
      x: f(z.x + z.L / 2),
      y: f(z.y + z.l / 2),
      largeurFraction: f(z.L),
      hauteurFraction: f(z.l),
    };
    if (haie && z.lignesHaie !== undefined) lue.lignesHaie = z.lignesHaie;
    return lue;
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
