// Les zones de déplacement : le réglage de l'entreprise, et le compte des
// jours de chaque salarié par zone.
//
// **Ses demandes du 5 et du 6 novembre 2026** (planche
// `appli/soignee/zones-deplacement.html`) : *« celle pour la MSA et pour le
// bâtiment, avec possibilité de switch entre les deux, ou de pas la mettre si
// l'utilisateur ne travaille pas par zone ; et modifiable »* ; les noms qui se
// changent (« Zone 3C ») ; le dépôt compte en zone 1 ; un chantier qu'on ne
// sait pas situer ne compte dans aucune zone et se dit en rouge ; un jour sur
// deux chantiers compte la zone la plus loin.
//
// **Atlas COMPTE, il ne paie pas.** Les montants changent selon la région et
// deux fois par an : le comptable les connaît (`docs/AGENT.md` §3, rien ne
// s'invente).
//
// **Les deux modèles sont à vérifier sur les textes de l'année** (le barème
// MSA des entreprises du paysage, l'accord régional du bâtiment) : ils ont été
// relevés dans des résultats de recherche, ce poste ne joint pas msa.fr. C'est
// pour cela que chaque borne et chaque nom se changent.

import type { JourIso, Moment } from "@/lib/disponibilites";
import { distanceOiseauKm } from "@/lib/appariement-demi-journees";
import { momentDuJour, type AbsenceEquipe } from "@/lib/absences-equipe";
import { compteTravaille } from "@/lib/nature-absence";

export const CONVENTIONS = ["aucune", "paysage", "batiment"] as const;
export type Convention = (typeof CONVENTIONS)[number];

/** Une zone : son nom (« Zone 1 », « Zone 3C ») et sa borne HAUTE, en km. */
export type Zone = { nom: string; km: number };

export const MODELES: Record<Exclude<Convention, "aucune">, { nom: string; sous: string; zones: Zone[] }> = {
  paysage: {
    nom: "Paysage",
    sous: "Barème MSA des entreprises du paysage",
    zones: [
      { nom: "Zone 1", km: 5 },
      { nom: "Zone 2", km: 20 },
      { nom: "Zone 3", km: 30 },
      { nom: "Zone 4", km: 50 },
    ],
  },
  batiment: {
    nom: "Bâtiment",
    sous: "Zones de 10 km, accord de votre région",
    zones: [
      { nom: "Zone 1A", km: 5 },
      { nom: "Zone 1B", km: 10 },
      { nom: "Zone 2", km: 20 },
      { nom: "Zone 3", km: 30 },
      { nom: "Zone 4", km: 40 },
      { nom: "Zone 5", km: 50 },
    ],
  },
};

/** Les teintes du dégradé, de la zone proche (claire) à la plus loin (foncée). */
export const TEINTES_ZONES = ["turquoise", "vert", "bleu", "violet", "rose", "orange", "gris"] as const;
export type TeinteZones = (typeof TEINTES_ZONES)[number];

export type Position = { latitude: number; longitude: number };

export type ReglageZones = {
  convention: Convention;
  zones: Zone[];
  teinte: TeinteZones;
  /** D'où partent les zones : le siège, situé quand le réglage est posé. */
  depart: (Position & { adresse: string }) | null;
};

/** Le plafond du nombre de zones : sept marches de couleur se distinguent encore. */
export const ZONES_MAX = 6;
const NOM_MAX = 12;

/**
 * Le réglage lu en base (une colonne `jsonb`), ou `null` s'il n'a jamais été
 * posé. Une valeur abîmée ne casse rien : ce qui ne se lit pas se replie sur
 * « Pas de zones », jamais sur des zones inventées.
 */
export function reglageLu(valeur: unknown): ReglageZones | null {
  if (!valeur || typeof valeur !== "object") return null;
  const v = valeur as Record<string, unknown>;
  const convention = (CONVENTIONS as readonly string[]).includes(String(v.convention)) ? (v.convention as Convention) : "aucune";
  const teinte = (TEINTES_ZONES as readonly string[]).includes(String(v.teinte)) ? (v.teinte as TeinteZones) : "turquoise";
  const zones = zonesLues(v.zones) ?? (convention === "aucune" ? [] : MODELES[convention].zones);
  const d = v.depart as Record<string, unknown> | null | undefined;
  const depart =
    d && typeof d.latitude === "number" && typeof d.longitude === "number" && Number.isFinite(d.latitude) && Number.isFinite(d.longitude)
      ? { latitude: d.latitude, longitude: d.longitude, adresse: String(d.adresse ?? "") }
      : null;
  return { convention, zones: convention === "aucune" ? [] : zones, teinte, depart };
}

/** « Paysage, 4 zones », « Pas de zones », « À régler » : la ligne d'Équipe. */
export function resumeDesZones(r: ReglageZones | null): string {
  if (!r) return "À régler";
  if (r.convention === "aucune") return "Pas de zones";
  const n = r.zones.length;
  return `${MODELES[r.convention].nom}, ${n} ${n > 1 ? "zones" : "zone"}`;
}

/**
 * Des zones venues de l'écran, relues : un nom non vide de douze signes au
 * plus, des bornes qui MONTENT strictement, entre 0 et 500 km, six au plus.
 * Autre chose rend `null`, et l'écran garde ce qu'il avait.
 */
export function zonesLues(valeur: unknown): Zone[] | null {
  if (!Array.isArray(valeur) || valeur.length === 0 || valeur.length > ZONES_MAX) return null;
  const zones: Zone[] = [];
  let avant = 0;
  for (const z of valeur) {
    if (!z || typeof z !== "object") return null;
    const nom = String((z as Record<string, unknown>).nom ?? "").trim();
    const km = Number((z as Record<string, unknown>).km);
    if (!nom || nom.length > NOM_MAX) return null;
    if (!Number.isFinite(km) || km <= avant || km > 500) return null;
    zones.push({ nom, km });
    avant = km;
  }
  return zones;
}

/**
 * La case d'une distance : le rang de la zone (0 pour la première), ou
 * `"hors"` au-delà de la dernière borne. Une borne appartient à sa zone : 5 km
 * pile est en zone 1.
 */
export function caseDeLaDistance(km: number, zones: readonly Zone[]): number | "hors" {
  const i = zones.findIndex((z) => km <= z.km);
  return i < 0 ? "hors" : i;
}

/**
 * La position d'un chantier, si elle vaut encore : les coordonnées ne disent
 * vrai que pour l'adresse qui les a produites (`adresseSituee`). Une adresse
 * corrigée depuis les rend fausses, et une zone devinée sur elles serait pire
 * que pas de zone.
 */
export function positionSiSituee(c: {
  latitude: string | number | null;
  longitude: string | number | null;
  adresse: string | null;
  adresseSituee: string | null;
}): Position | null {
  if (c.latitude === null || c.longitude === null || !c.adresse || c.adresseSituee !== c.adresse) return null;
  const latitude = Number(c.latitude);
  const longitude = Number(c.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}

/** Un chantier tel que le compte le lit : où il est, s'il est situé. */
export type ChantierDuJour = { nom: string; adresse: string | null; position: Position | null };

/** Ce qu'a fait un salarié un jour ouvré, du point de vue des zones. */
export type JourDuSalarie = {
  jour: JourIso;
  chantiers: readonly ChantierDuJour[];
  /** Absent ce jour d'une absence « déplacement » : compté hors zone. */
  enDeplacement?: boolean;
  /** Absent ce jour d'une absence « formation » : où, on ne le sait pas. */
  enFormation?: boolean;
};

export type JourPlace = {
  jour: JourIso;
  /** Le rang de la zone, `"hors"`, ou `null` quand on ne peut pas le dire. */
  case: number | "hors" | null;
  /** Ce qui l'a décidé, pour la liste des jours d'une zone. */
  chantier: ChantierDuJour | null;
  km: number | null;
  depot: boolean;
  /** Pourquoi il n'est dans aucune zone, en mots, quand c'est le cas. */
  raison: string | null;
};

/**
 * La case d'un jour.
 *
 *   sans chantier : le dépôt, donc la PREMIÈRE zone (sa règle du 5 novembre) ;
 *   un déplacement : hors zone, il ne rentre pas le soir ;
 *   une formation : on ne sait pas où, il la place lui-même ;
 *   un ou plusieurs chantiers : celui qui est le PLUS LOIN (sa réponse du
 *     6 novembre). Si un seul des chantiers du jour n'est pas situé, le plus
 *     loin pourrait être celui-là : le jour n'a pas de zone, plutôt qu'une
 *     zone devinée.
 */
export function placerLeJour(j: JourDuSalarie, depart: Position | null, zones: readonly Zone[]): JourPlace {
  const vide = { jour: j.jour, chantier: null, km: null, depot: false };
  if (j.enDeplacement) return { ...vide, case: "hors", raison: null };
  if (j.enFormation) return { ...vide, case: null, raison: "formation, le lieu n’est pas connu" };
  if (j.chantiers.length === 0) return { ...vide, case: zones.length ? 0 : "hors", depot: true, km: 0, raison: null };
  const nonSitue = j.chantiers.find((c) => c.position === null);
  if (nonSitue) return { ...vide, case: null, chantier: nonSitue, raison: "adresse non située" };
  if (!depart) return { ...vide, case: null, chantier: j.chantiers[0], raison: "le siège n’est pas situé" };
  let loin: { c: ChantierDuJour; km: number } | null = null;
  for (const c of j.chantiers) {
    const km = distanceOiseauKm(depart, c.position as Position);
    if (!loin || km > loin.km) loin = { c, km };
  }
  const l = loin as { c: ChantierDuJour; km: number };
  return { jour: j.jour, case: caseDeLaDistance(l.km, zones), chantier: l.c, km: Math.round(l.km), depot: false, raison: null };
}

// ─── CE QUE LE PLANNING DIT DE CHAQUE JOUR ─────────────────────────────────

/** Une coche de `equipes_du_chantier`, le salarié désigné par son rang. */
export type Coche = { chantierId: string; jour: JourIso | null; demi: string; rang: number };

/** Un chantier posé : où il est, et les demi-journées qu'il occupe. */
export type ChantierPose = ChantierDuJour & { id: string; creneaux: readonly { jour: JourIso; moment: Moment }[] };

/**
 * Les jours d'un salarié, du point de vue des zones, à partir du planning.
 *
 * **Il est sur un chantier une demi-journée** quand le chantier occupe cette
 * demi-journée ET qu'il y est coché : sans jour, la coche vaut chaque jour du
 * chantier ; datée, ce jour seulement (migration 0093). Une demi-journée où il
 * est absent ne le met sur aucun chantier.
 *
 * **Seuls les jours où il a travaillé** (`joursDeTravail`, rendus par
 * `compteDuMois`) se placent : un jour de congé n'a pas de zone. Un
 * déplacement noté le met hors zone, une formation de la journée sans zone.
 */
export function joursDuSalarie(
  rang: number,
  joursDeTravail: readonly JourIso[],
  chantiers: readonly ChantierPose[],
  coches: readonly Coche[],
  absences: readonly AbsenceEquipe[]
): JourDuSalarie[] {
  const siennes = coches.filter((c) => c.rang === rang);
  const parId = new Map(chantiers.map((c) => [c.id, c]));
  return joursDeTravail.map((jour) => {
    const moments = absences.map((a) => ({ a, m: momentDuJour(a, jour) })).filter((x) => x.m !== null);
    const enDeplacement = moments.some((x) => x.a.nature === "deplacement");
    const enFormation = moments.some((x) => x.a.nature === "formation" && x.m === "journee");
    const absentLe = (demi: Moment) =>
      moments.some((x) => !compteTravaille(x.a.nature ?? null) && (x.m === "journee" || x.m === demi));
    const vus = new Map<string, ChantierDuJour>();
    for (const c of siennes) {
      if (c.demi !== "matin" && c.demi !== "apres_midi") continue;
      if (c.jour !== null && c.jour !== jour) continue;
      if (absentLe(c.demi)) continue;
      const chantier = parId.get(c.chantierId);
      if (!chantier || !chantier.creneaux.some((x) => x.jour === jour && x.moment === c.demi)) continue;
      vus.set(chantier.id, { nom: chantier.nom, adresse: chantier.adresse, position: chantier.position });
    }
    return { jour, chantiers: [...vus.values()], enDeplacement, enFormation: enFormation && vus.size === 0 };
  });
}

/** Le compte d'un salarié par zone : un nombre par zone, puis hors zone. */
export type CompteParZone = { parZone: number[]; hors: number; sansZone: JourPlace[]; jours: JourPlace[] };

export function compteParZone(jours: readonly JourDuSalarie[], depart: Position | null, zones: readonly Zone[]): CompteParZone {
  const parZone = zones.map(() => 0);
  let hors = 0;
  const places = jours.map((j) => placerLeJour(j, depart, zones));
  for (const p of places) {
    if (p.case === "hors") hors++;
    else if (p.case !== null) parZone[p.case]++;
  }
  return { parZone, hors, sansZone: places.filter((p) => p.case === null), jours: places };
}

/** La clé d'une case dans les corrections : « z0 », « z1 »… ou « hors ». */
export type CleDeCase = string;

export function cleDeCase(c: number | "hors"): CleDeCase {
  return c === "hors" ? "hors" : `z${c}`;
}

/** Des corrections relues : une case connue, un nombre entier de 0 à 31. */
export function correctionsDeZonesLues(valeur: unknown, zones: readonly Zone[]): Record<CleDeCase, number> {
  const lues: Record<CleDeCase, number> = {};
  if (!valeur || typeof valeur !== "object") return lues;
  const connues = new Set([...zones.map((_, i) => `z${i}`), "hors"]);
  for (const [cle, n] of Object.entries(valeur as Record<string, unknown>)) {
    const v = Number(n);
    if (connues.has(cle) && Number.isInteger(v) && v >= 0 && v <= 31) lues[cle] = v;
  }
  return lues;
}

/**
 * Ce qui manque aux zones pour couvrir les jours travaillés (négatif : trop).
 * Une demi-journée de travail occupe un jour dans sa zone : on compare donc au
 * nombre de jours ARRONDI au-dessus.
 */
export function manqueAuxZones(joursTravailles: number, parCase: readonly number[]): number {
  return Math.ceil(joursTravailles) - parCase.reduce((t, n) => t + n, 0);
}

/** « Il manque une zone, ajoutez-la. » : ses mots du 5 novembre. */
export function phraseDuManque(manque: number): string | null {
  if (manque === 0) return null;
  if (manque > 0) return manque === 1 ? "Il manque une zone, ajoutez-la." : `Il manque ${manque} zones, ajoutez-les.`;
  return manque === -1 ? "Une zone de trop, retirez-la." : `${-manque} zones de trop, retirez-les.`;
}

// ─── LE DÉGRADÉ ─────────────────────────────────────────────────────────────

/**
 * Les teintes, en OKLCH : la planche, éprouvée au validateur des couleurs pour
 * les sept teintes, de deux à sept pas, dans les six chartes claires et les
 * deux sombres. Sur fond sombre la rampe s'inverse (la plus loin est la plus
 * claire) et sa saturation baisse vers le clair.
 */
const TEINTES: Record<TeinteZones, { h: number; c: number; nom: string }> = {
  turquoise: { h: 190, c: 0.09, nom: "Turquoise" },
  vert: { h: 145, c: 0.09, nom: "Vert" },
  bleu: { h: 255, c: 0.09, nom: "Bleu" },
  violet: { h: 305, c: 0.09, nom: "Violet" },
  rose: { h: 355, c: 0.09, nom: "Rose" },
  orange: { h: 55, c: 0.09, nom: "Orange" },
  gris: { h: 90, c: 0.012, nom: "Gris" },
};
const RAMPE = { clair: [0.71, 0.29], sombre: [0.5, 0.89] } as const;

export function nomDeLaTeinte(t: TeinteZones): string {
  return TEINTES[t].nom;
}

/** La couleur d'une case (rang k sur n, « hors zone » étant le dernier pas). */
export function couleurDeLaCase(k: number, n: number, t: TeinteZones): { clair: string; sombre: string; encreClaire: boolean; encreSombre: boolean; papier: string } {
  const { h, c } = TEINTES[t];
  const r = n > 1 ? k / (n - 1) : 0;
  const lc = RAMPE.clair[0] + (RAMPE.clair[1] - RAMPE.clair[0]) * r;
  const ls = RAMPE.sombre[0] + (RAMPE.sombre[1] - RAMPE.sombre[0]) * r;
  const cs = c * Math.min(1, Math.max(0.3, (0.97 - ls) / 0.2));
  return {
    clair: `oklch(${lc.toFixed(3)} ${c} ${h})`,
    sombre: `oklch(${ls.toFixed(3)} ${cs.toFixed(3)} ${h})`,
    // Sur la case, le chiffre en clair quand la case est foncée.
    encreClaire: lc < 0.58,
    encreSombre: ls < 0.6,
    papier: oklchEnRgb(lc, c, h),
  };
}

/**
 * La même couleur pour le PDF, qui ne connaît pas l'OKLCH : convertie en sRGB
 * (Björn Ottosson), bornée au gamut.
 */
export function oklchEnRgb(L: number, C: number, h: number): string {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const gamma = (x: number) => {
    const v = Math.max(0, Math.min(1, x));
    return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  };
  return `#${lin.map((x) => Math.round(gamma(x) * 255).toString(16).padStart(2, "0")).join("")}`;
}

// ─── CE QUI SE LIT D'UN JOUR ────────────────────────────────────────────────

/**
 * Le code postal et la ville d'une adresse, puis le reste : « 44000 Nantes »
 * et « 14 rue Crébillon ». Sans code postal, l'adresse entière, en ville.
 */
export function villeDeLAdresse(adresse: string | null): { ville: string; rue: string | null } {
  if (!adresse) return { ville: "Adresse non écrite", rue: null };
  const m = adresse.match(/^(.*?)[,\s]*\b(\d{5})\s+([^,]+?)\s*(?:,\s*France)?\s*$/i);
  if (!m) return { ville: adresse.trim(), rue: null };
  const rue = m[1].replace(/[,\s]+$/, "").trim();
  return { ville: `${m[2]} ${m[3]}`, rue: rue || null };
}

/** « Mercredi 4 novembre » : la date telle qu'il la cherche dans sa tête. */
export function jourEnClair(jour: JourIso): string {
  const t = new Date(`${jour}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * « Mercredi 4 novembre, Les Landes, adresse non située » : ce qui lui dit
 * quelle zone toucher, sous « Il manque une zone, ajoutez-la. ».
 */
export function phraseDuJourSansZone(p: JourPlace): string {
  const lieu = p.chantier ? (p.chantier.adresse ?? p.chantier.nom) : null;
  return [jourEnClair(p.jour), lieu, p.raison].filter(Boolean).join(", ");
}
