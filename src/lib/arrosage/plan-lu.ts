/**
 * LE PLAN LU, À VÉRIFIER AVANT DE LE FAIRE.
 *
 * *Sa planche du 21 octobre 2026* (`appli/arrosage-plan-lu-a-verifier.html`),
 * dite « code ça » le 22 : la photo du croquis ne donne plus le plan d'un
 * coup. Ce que l'IA a lu s'ouvre dans « Dessiner le plan », à l'échelle ; il
 * corrige une cote, glisse une zone, pose la nourrice, puis « Faire le plan ».
 * Le plan part alors par le chemin du dessin, le seul qui sache ce qu'il a vu.
 *
 * **Rien ne s'invente** (`.claude/rules/arrosage.md`, règle 1) : une cote que le
 * croquis ne porte pas reste MANQUANTE, et le plan ne se fait pas sans elle.
 * La zone se dessine quand même, à la taille où elle est dessinée sur la
 * photo, pour qu'il la voie et la complète. Une cote déduite se montre comme
 * déduite, avec ce dont elle vient.
 *
 * **Pure** : le serveur la calcule sur la lecture, l'écran la reçoit.
 */
import type { CroquisLu, ZoneLue } from "@/server/ai/services/lire-croquis";
import { echelleTolerante, poserSurLeTerrain, type ZonePositionnee } from "@/lib/arrosage/geometrie-croquis";
import { NOMS_DES_ZONES, type DessinDuPlan, type ZoneDessinee } from "@/lib/arrosage/dessin-du-plan";

/** Ce qui reste à vérifier sur une zone lue : les cotes absentes, les déduites. */
export type AVerifier = {
  manque: ("L" | "l")[];
  deduites: { champ: "L" | "l"; depuis: string }[];
};

export type ZoneLueDessinee = ZoneDessinee & { aVerifier?: AVerifier };

export type PlanLu = {
  dessin: Omit<DessinDuPlan, "zones"> & { zones: ZoneLueDessinee[] };
  /**
   * Ce que la lecture n'a pas su faire et que le dessin ne montre pas déjà, dit
   * sous le dessin : une zone écrite et pas lue, un type écarté, une place
   * qui manque. Une cote absente ou déduite, la nourrice, le piquage se voient
   * sur le dessin lui-même : les redire ferait deux phrases pour une chose.
   */
  reserves: string[];
  /** Ce que le croquis dit du point d'eau : il règle « Le piquage se fait… ». */
  pointDEau: CroquisLu["pointDEau"];
};

/** Une zone sans cote lisible sur la photo ni place : la taille où on la pose
 *  pour qu'il la voie. Ce n'est pas une cote : elle reste marquée manquante. */
const TAILLE_A_L_ESTIME = 2;
/** Entre deux zones posées l'une sous l'autre faute de place lue. */
const ECART_DE_PILE = 0.5;

const arrondi = (v: number) => Math.round(v * 100) / 100;

/** La phrase de l'écran pour une cote qui manque : la même partout. */
export function phraseDuManque(z: { type: ZoneLue["type"]; nom: string | null }, champ: "L" | "l"): string {
  return `Pas de plan : la ${champ === "L" ? "longueur" : "largeur"} de « ${z.nom || NOMS_DES_ZONES[z.type]} » n’est pas sur le croquis.`;
}

export function planLuDuCroquis(lu: CroquisLu): PlanLu {
  // Une haie se lit en mètres linéaires : sur le dessin, c'est sa longueur ; sa
  // largeur, la photo ne la donne pas, et ses lignes en dépendent.
  const cotes = lu.zones.map((z) => (z.type === "haie" ? { L: z.ml, l: null } : { L: z.L, l: z.l }));
  const places: ZonePositionnee[] = lu.zones.map((z, i) => ({
    position: z.x !== null && z.y !== null ? { x: z.x, y: z.y } : null,
    largeurFraction: z.largeurFraction,
    hauteurFraction: z.hauteurFraction,
    L: cotes[i].L,
    l: cotes[i].l,
    ml: z.ml,
  }));
  const echelle = echelleTolerante(places);
  const m = echelle.ok ? echelle.metresParFraction : null;
  // La cote absente prend la taille DESSINÉE, à l'échelle des cotes écrites.
  const estime = (fraction: number | null) =>
    m !== null && fraction !== null && fraction > 0 ? Math.max(0.3, arrondi(fraction * m)) : TAILLE_A_L_ESTIME;
  const tailles = lu.zones.map((z, i) => ({
    L: cotes[i].L ?? estime(z.largeurFraction),
    l: cotes[i].l ?? estime(z.hauteurFraction),
  }));

  // Les places, par la règle qui pose déjà le plan de la photo : une seule.
  const pose = m !== null ? poserSurLeTerrain(lu.nourrice, places.map((p, i) => ({ ...p, ...tailles[i] })), lu.piquage) : null;
  const posees = pose?.ok ? pose.terrain : null;

  const placee = lu.zones.map((_, i) => posees !== null && places[i].position !== null);
  const zones: ZoneLueDessinee[] = lu.zones.map((z, i) => {
    const t = tailles[i];
    const place = placee[i] ? posees!.zones[i] : { x: 0, y: 0 };
    const zone: ZoneLueDessinee = { type: z.type, nom: z.nom, L: t.L, l: t.l, x: place.x, y: place.y };
    const manque = (["L", "l"] as const).filter((c) => cotes[i][c] === null);
    const deduites = (z.deduites ?? []).map((d) => ({ champ: d.champ === "l" ? ("l" as const) : ("L" as const), depuis: d.depuis }));
    if (manque.length || deduites.length) zone.aVerifier = { manque, deduites };
    return zone;
  });
  // Une zone sans place lue se pose sous les autres : il la glisse où elle va.
  const posePlacee = zones.filter((_, i) => placee[i]);
  let pile = posePlacee.length ? Math.max(...posePlacee.map((z) => z.y + z.l)) + ECART_DE_PILE : 0;
  zones.forEach((z, i) => {
    if (placee[i]) return;
    z.y = arrondi(pile);
    pile += z.l + ECART_DE_PILE;
  });

  const nourrice = posees?.nourrice ?? null;
  const piquage = posees?.piquage ?? null;
  const bords = [
    ...zones.map((z) => ({ x: z.x + z.L, y: z.y + z.l })),
    ...(nourrice ? [nourrice] : []),
    ...(piquage ? [piquage] : []),
  ];
  // Le terrain enveloppe ce qui est posé, au demi-mètre : il le corrige s'il
  // connaît ses vraies cotes.
  const auDemi = (v: number) => Math.max(1, Math.ceil(v * 2 - 1e-9) / 2);
  const terrain = { L: auDemi(Math.max(...bords.map((b) => b.x))), l: auDemi(Math.max(...bords.map((b) => b.y))) };

  const sansPlace = placee.filter((p) => !p).length;
  const placement = !echelle.ok || !pose?.ok
    ? "Le croquis ne donne pas les places : les zones sont posées l’une sous l’autre, glissez-les à leur place."
    : sansPlace > 0
      ? "Une zone n’a pas de place sur le croquis : elle est posée en bas, glissez-la à sa place."
      : posees?.reserve
        ? "Le croquis n’est pas à l’échelle : vérifiez où sont les zones."
        : null;

  const dejaVues = /^(la cote de |les cotes de |le croquis ne montre pas où |le croquis ne dit pas d’où vient l’eau)/;
  const reserves = [
    ...(placement ? [placement] : []),
    ...lu.reserves.filter((r) => !dejaVues.test(r)).map((r) => `${r.charAt(0).toUpperCase()}${r.slice(1)}.`),
  ];
  return { dessin: { terrain, zones, maisons: [], dalles: [], nourrice, piquage }, reserves, pointDEau: lu.pointDEau };
}
