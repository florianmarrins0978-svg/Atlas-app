/**
 * OÙ SONT LES CHOSES SUR LE CROQUIS — et à quelle distance de la nourrice.
 *
 * **Sa demande du 22 août 2026 :** *« oui fais-le lire les proportions »*.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI CE FICHIER EXISTE
 *
 * Le calcul savait, depuis le 22 août au soir, ce qui se perd entre le regard
 * et le dernier arroseur d'une ligne (`ARCHITECTURE.md` §147). Une seule chose
 * lui échappait encore : **le trajet du regard jusqu'à la PREMIÈRE tête.**
 *
 * Je lui avais dit qu'aucune saisie ne le donnait. Il a répondu : *« j'ai pas
 * besoin de lui dire, il a tous les métrés du terrain, il a juste à
 * calculer »*. Il avait raison sur le fond et je me trompais sur le fait : le
 * croquis PORTE l'information — la nourrice y est dessinée, les zones aussi, et
 * les cotes donnent l'échelle. C'est la LECTURE qui ne la relevait pas.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'ÉCHELLE SE DÉDUIT DES COTES, ELLE NE SE DEMANDE PAS
 *
 * Le modèle rend des positions en **fraction du croquis** (0 à 1), parce que
 * c'est tout ce qu'une image permet de dire sûrement : il voit qu'une pelouse
 * occupe le tiers gauche, pas qu'elle est à douze mètres du regard.
 *
 * Les mètres, eux, viennent des cotes DÉJÀ lues. Une pelouse de 16 m qui occupe
 * 0,40 du croquis en largeur donne 40 m par unité de fraction. Chaque zone cotée
 * fournit ainsi une estimation de l'échelle, et l'on retient la **médiane** —
 * une valeur aberrante (un modèle qui se trompe sur une zone) ne l'emporte pas.
 *
 * **ET L'ON REFUSE DE CONCLURE QUAND ELLES SE CONTREDISENT.** Si les zones ne
 * s'accordent pas — plus du double d'écart entre la plus petite et la plus
 * grande —, c'est que le croquis n'est pas à l'échelle ou que la lecture est
 * fausse. On rend `null` et une réserve, jamais une distance moyenne qui
 * n'existe nulle part (`CLAUDE.md` §4 ter : ce qui ne se calcule pas se dit).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUE CETTE DISTANCE COÛTE SI ELLE EST FAUSSE
 *
 * Elle ne sert qu'à une chose : la perte de charge du trajet regard → première
 * tête. Sur du Ø25 à 1,5 m³/h, dix mètres coûtent 0,09 bar. Une erreur de 20 %
 * sur la distance vaut donc 0,02 bar — sans effet sur le choix des buses. C'est
 * ce qui permet d'accepter une lecture approximative ICI, alors qu'une cote de
 * zone fausse de 20 % ferait commander le mauvais nombre d'arroseurs.
 *
 * **Elle est malgré tout signalée comme estimée**, et le restera : le patron
 * doit pouvoir la corriger d'un coup d'œil s'il la trouve absurde.
 */

/** Un point du croquis, en fraction de sa largeur et de sa hauteur (0 à 1). */
export type PointCroquis = { x: number; y: number };

/** Ce qu'une zone occupe sur le croquis, en fraction — et ce qu'elle mesure. */
export type ZonePositionnee = {
  /** Le centre de la zone sur le croquis. */
  position: PointCroquis | null;
  /** Sa largeur et sa hauteur sur le croquis, en fraction. */
  largeurFraction: number | null;
  hauteurFraction: number | null;
  /** Ses cotes réelles, en mètres — celles déjà lues par `lire-croquis`. */
  L: number | null;
  l: number | null;
};

/**
 * Combien de mètres vaut une unité de fraction du croquis.
 *
 * `null` quand les zones se contredisent ou qu'aucune ne permet de conclure —
 * et la raison est rendue avec, pour qu'elle arrive à l'écran.
 */
export type Echelle =
  | { ok: true; metresParFraction: number; surCombienDeZones: number }
  | { ok: false; raison: string };

/**
 * L'écart toléré entre deux zones avant de refuser de conclure.
 *
 * **Deux, et pas plus.** Un croquis à main levée n'est jamais exact : une zone
 * dessinée un peu large donne une échelle un peu petite, et c'est normal.
 * Au-delà du double, ce n'est plus de l'imprécision — c'est que le dessin n'est
 * pas à l'échelle du tout, ou que la lecture a confondu deux zones. Dans les
 * deux cas, une distance calculée là-dessus serait inventée.
 */
export const ECART_MAX_ENTRE_ZONES = 2;

/** Combien de fraction, au minimum, pour qu'une zone dise quelque chose. */
const FRACTION_MINIMALE = 0.02;

function mediane(valeurs: number[]): number {
  const triees = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(triees.length / 2);
  return triees.length % 2 === 1
    ? triees[milieu]
    : (triees[milieu - 1] + triees[milieu]) / 2;
}

/**
 * L'échelle du croquis, déduite des zones cotées.
 *
 * **Chaque zone en donne jusqu'à deux estimations** — une par sa largeur, une
 * par sa hauteur. Les deux entrent dans le lot : une zone allongée dessinée de
 * travers se corrige ainsi par son autre côté.
 */
export function echelleDuCroquis(zones: ZonePositionnee[]): Echelle {
  const estimations: number[] = [];

  for (const z of zones) {
    if (z.L !== null && z.L > 0 && z.largeurFraction !== null && z.largeurFraction >= FRACTION_MINIMALE) {
      estimations.push(z.L / z.largeurFraction);
    }
    if (z.l !== null && z.l > 0 && z.hauteurFraction !== null && z.hauteurFraction >= FRACTION_MINIMALE) {
      estimations.push(z.l / z.hauteurFraction);
    }
  }

  if (estimations.length === 0) {
    return {
      ok: false,
      raison:
        "aucune zone du croquis ne porte à la fois ses cotes et sa place : l'échelle ne se déduit pas",
    };
  }

  const mini = Math.min(...estimations);
  const maxi = Math.max(...estimations);
  if (maxi > mini * ECART_MAX_ENTRE_ZONES) {
    return {
      ok: false,
      raison:
        `le croquis n'est pas à l'échelle : selon les zones, un même trait vaut de ` +
        `${Math.round(mini)} à ${Math.round(maxi)} m — les distances ne s'en déduisent pas`,
    };
  }

  return { ok: true, metresParFraction: mediane(estimations), surCombienDeZones: estimations.length };
}

/**
 * La distance du regard à une zone, en mètres.
 *
 * **En Manhattan, pas à vol d'oiseau** : un tuyau suit les axes, et c'est la
 * règle du dépôt sur les tranchées. Une diagonale sous-estimerait le tuyau
 * qu'il faut acheter et la perte qu'il subit — dans le mauvais sens des deux.
 *
 * **Elle vise le BORD de la zone, pas son centre.** La première tête d'une ligne
 * est sur le pourtour ; compter jusqu'au milieu ajouterait la moitié de la
 * pelouse à un trajet que la ligne parcourt déjà, et cette longueur-là est
 * comptée ailleurs (`perteDuReseau`). La compter deux fois gonflerait la perte
 * et ferait resserrer la pose sans raison.
 */
export function distanceRegardVersZone(
  regard: PointCroquis,
  zone: ZonePositionnee,
  metresParFraction: number
): number | null {
  if (!zone.position || !(metresParFraction > 0)) return null;

  const demiLargeur = (zone.largeurFraction ?? 0) / 2;
  const demiHauteur = (zone.hauteurFraction ?? 0) / 2;

  // L'écart au bord : zéro quand le regard est déjà au-dessus de la zone.
  const dx = Math.max(0, Math.abs(regard.x - zone.position.x) - demiLargeur);
  const dy = Math.max(0, Math.abs(regard.y - zone.position.y) - demiHauteur);

  return (dx + dy) * metresParFraction;
}

/**
 * Le plus long trajet regard → zone de tout le jardin.
 *
 * **Le plus long, parce que c'est lui qui décide.** Toutes les zones sont
 * dimensionnées sur la même pression (`ARCHITECTURE.md` §147 : une seule buse
 * par famille, sinon le plan ne se pose pas), et cette pression doit être celle
 * du point le plus mal servi. Prendre la moyenne donnerait un plan qui tient en
 * moyenne — c'est-à-dire un plan qui ne tient pas au bout du jardin.
 */
export function trajetLePlusLong(
  regard: PointCroquis | null,
  zones: ZonePositionnee[]
): { ok: true; metres: number; estimee: true } | { ok: false; raison: string } {
  if (!regard) {
    return {
      ok: false,
      raison: "le croquis ne montre pas où la nourrice est posée",
    };
  }

  const echelle = echelleDuCroquis(zones);
  if (!echelle.ok) return { ok: false, raison: echelle.raison };

  let plusLong = 0;
  let mesurees = 0;
  for (const z of zones) {
    const d = distanceRegardVersZone(regard, z, echelle.metresParFraction);
    if (d === null) continue;
    mesurees++;
    if (d > plusLong) plusLong = d;
  }

  if (mesurees === 0) {
    return { ok: false, raison: "aucune zone du croquis n'a de place lisible" };
  }

  // **Un trajet aberrant ne se rend pas.** Au-delà de 200 m, ce n'est plus un
  // jardin de particulier : c'est une échelle lue de travers, et la perte de
  // charge qu'on en tirerait condamnerait le plan pour rien.
  if (plusLong > 200) {
    return {
      ok: false,
      raison: `le trajet lu jusqu'au jardin (${Math.round(plusLong)} m) n'est pas vraisemblable`,
    };
  }

  return { ok: true, metres: Math.round(plusLong * 10) / 10, estimee: true };
}

/**
 * LE CROQUIS POSÉ SUR LE TERRAIN — des fractions du dessin à des mètres.
 *
 * **Ajouté le 23 août 2026, au moment de brancher le plan dessiné.** Le tracé
 * (`trace.ts`) et le contour (`terrain.ts`) travaillent en MÈTRES, avec une
 * origine au coin haut-gauche du terrain ; la lecture, elle, ne rend que des
 * fractions du dessin — c'est tout ce qu'une image permet de dire sûrement.
 * Il fallait donc un passage, et **un seul** : deux façons de convertir un
 * croquis en terrain finiraient par placer la même pelouse à deux endroits
 * (`CLAUDE.md` §3).
 *
 * **L'échelle vient d'ici, jamais du dessin de la nourrice.** Elle se déduit
 * des cotes déjà lues, par la médiane des estimations de toutes les zones — et
 * `echelleDuCroquis` refuse de conclure quand elles se contredisent. La
 * nourrice n'y participe pas : elle n'a pas de cote, seulement une place.
 *
 * **L'origine est ramenée à zéro**, sur le coin haut-gauche de ce que le
 * croquis montre. Un terrain qui commencerait à x = 40 m parce que le dessin
 * est décentré ne serait pas faux, mais il cadrerait mal et se lirait mal.
 */
export type TerrainPose = {
  /** Les zones, en mètres : coin haut-gauche et cotes. */
  zones: { x: number; y: number; L: number; l: number }[];
  /** Le regard, en mètres, sur le même repère. `null` s'il n'est pas dessiné. */
  nourrice: PointCroquis | null;
};

export function poserSurLeTerrain(
  regard: PointCroquis | null,
  zones: ZonePositionnee[]
): { ok: true; terrain: TerrainPose } | { ok: false; raison: string } {
  const echelle = echelleDuCroquis(zones);
  if (!echelle.ok) return { ok: false, raison: echelle.raison };
  const m = echelle.metresParFraction;

  const posees: ({ x: number; y: number; L: number; l: number } | null)[] = zones.map((z) => {
    if (!z.position || z.L === null || z.l === null || z.L <= 0 || z.l <= 0) return null;
    // **Le coin, pas le centre** : la lecture rend un centre, le dessin veut un
    // coin. Et les CÔTÉS viennent des cotes lues, jamais de la largeur
    // dessinée — un rectangle tracé de travers ne doit pas changer le métré.
    return {
      x: z.position.x * m - z.L / 2,
      y: z.position.y * m - z.l / 2,
      L: z.L,
      l: z.l,
    };
  });

  const vues = posees.filter((z): z is NonNullable<typeof z> => z !== null);
  if (vues.length === 0) {
    return { ok: false, raison: "aucune zone du croquis n'a à la fois sa place et ses cotes" };
  }

  const nourrice = regard ? { x: regard.x * m, y: regard.y * m } : null;
  const xs = [...vues.map((z) => z.x), ...(nourrice ? [nourrice.x] : [])];
  const ys = [...vues.map((z) => z.y), ...(nourrice ? [nourrice.y] : [])];
  const ox = Math.min(...xs);
  const oy = Math.min(...ys);
  const arrondir = (v: number) => Math.round(v * 100) / 100;

  return {
    ok: true,
    terrain: {
      // **`null` reste `null`**, et il compte : une zone sans place laisse un
      // trou dans la liste, à la même position que dans `zones`. C'est ce qui
      // permet à l'appelant de savoir LAQUELLE n'a pas pu être posée, au lieu
      // de décaler toutes les suivantes en silence.
      zones: posees.map((z) =>
        z === null
          ? { x: 0, y: 0, L: 0, l: 0 }
          : { x: arrondir(z.x - ox), y: arrondir(z.y - oy), L: z.L, l: z.l }
      ),
      nourrice: nourrice ? { x: arrondir(nourrice.x - ox), y: arrondir(nourrice.y - oy) } : null,
    },
  };
}
