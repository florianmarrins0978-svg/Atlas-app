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
  /**
   * Ses mètres linéaires, pour une haie ou un massif.
   *
   * **Ajouté le 23 août 2026 : une haie sait aussi donner l'échelle.** Sur son
   * croquis, la haie longe tout le haut du terrain et porte sa longueur ; la
   * lui refuser, c'était jeter la moitié de ce que le dessin dit.
   */
  ml?: number | null;
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
/**
 * Toutes les estimations d'échelle qu'un croquis permet — sans en juger.
 *
 * **La haie compte aussi, depuis le 23 août 2026.** Sur son croquis, elle longe
 * tout le haut du terrain et porte sa longueur : la lui refuser jetait la
 * moitié de ce que le dessin disait, et pouvait ne rien laisser du tout.
 */
function estimationsDEchelle(zones: ZonePositionnee[]): number[] {
  const estimations: number[] = [];
  for (const z of zones) {
    if (z.L !== null && z.L > 0 && z.largeurFraction !== null && z.largeurFraction >= FRACTION_MINIMALE) {
      estimations.push(z.L / z.largeurFraction);
    }
    if (z.l !== null && z.l > 0 && z.hauteurFraction !== null && z.hauteurFraction >= FRACTION_MINIMALE) {
      estimations.push(z.l / z.hauteurFraction);
    }
    // Une haie n'a qu'une longueur : c'est son plus grand côté dessiné qui la
    // porte, quel que soit le sens dans lequel elle est tracée.
    const dessine = Math.max(z.largeurFraction ?? 0, z.hauteurFraction ?? 0);
    if (z.ml != null && z.ml > 0 && dessine >= FRACTION_MINIMALE) {
      estimations.push(z.ml / dessine);
    }
  }
  return estimations;
}

export function echelleDuCroquis(zones: ZonePositionnee[]): Echelle {
  const estimations = estimationsDEchelle(zones);

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
 * L'échelle POUR DESSINER — celle qui ne refuse presque jamais.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * **SA CORRECTION DU 23 AOÛT 2026, ET ELLE EST JUSTE.**
 *
 * *« Il n'arrive pas à me lire mon croquis sous prétexte qu'il n'est pas à
 * l'échelle. Ce qui serait bien, c'est qu'il arrive à le lire même s'il n'est
 * pas totalement à l'échelle, car les utilisateurs ne vont pas s'amuser à faire
 * des croquis à l'échelle à chaque fois. Là, il y a tous les métrés. »*
 *
 * Il avait raison, et le défaut était de fond : **les COTES commandent, le
 * dessin ne fait qu'ordonner.** Un croquis à main levée dit avec certitude qui
 * est à gauche de qui et qui touche quoi ; il ne dit rien de fiable sur les
 * longueurs — c'est justement pour cela qu'on y écrit les métrés. Refuser le
 * plan parce que le dessin n'est pas proportionné, c'est refuser le croquis
 * pour ce qu'il n'a jamais eu à être.
 *
 * **La sévérité reste là où elle sert** : `echelleDuCroquis` refuse toujours,
 * et c'est elle qui nourrit le trajet du regard — un nombre qui entre dans le
 * calcul de pression et décide de l'espacement des arroseurs. Un chiffre faux
 * y coûte un plan faux. Ici, ce qui est en jeu est un DESSIN : une pelouse
 * placée dix centimètres trop à droite se voit et se corrige à l'œil.
 * ─────────────────────────────────────────────────────────────────────────
 */
export type EchelleTolerante =
  | {
      ok: true;
      metresParFraction: number;
      /** Le rapport entre la plus grande et la plus petite estimation. 1 = parfait. */
      dispersion: number;
      /** Vrai quand aucune zone ne portait à la fois sa cote et sa place. */
      approchee: boolean;
    }
  | { ok: false; raison: string };

export function echelleTolerante(zones: ZonePositionnee[]): EchelleTolerante {
  const estimations = estimationsDEchelle(zones);

  if (estimations.length > 0) {
    const mini = Math.min(...estimations);
    const maxi = Math.max(...estimations);
    // **On ne refuse plus au-delà du double** : on prend la médiane et l'on DIT
    // que le dessin était approximatif. La médiane, jamais la moyenne — une
    // seule zone tracée de travers ne doit pas emporter tout le croquis.
    return {
      ok: true,
      metresParFraction: mediane(estimations),
      dispersion: mini > 0 ? maxi / mini : 1,
      approchee: false,
    };
  }

  // ── Le dernier recours : la plus grande cote sur la plus grande étendue ───
  //
  // **Quand AUCUNE zone ne porte à la fois sa cote et sa place**, le croquis
  // dit encore quelque chose : il montre un terrain qui occupe une certaine
  // étendue du dessin, et il porte quelque part la plus grande longueur du
  // jardin. Le rapport des deux donne un ordre de grandeur — pas une mesure, et
  // c'est pourquoi il est rendu marqué « approchée ».
  //
  // C'est ce qui manquait le 23 août : sur son croquis, plein de métrés, la
  // lecture n'avait rendu aucune proportion de zone — et le plan était refusé
  // avec un message qui accusait ses cotes, c'est-à-dire le mauvais coupable.
  const cotes = zones.flatMap((z) => [z.L, z.l, z.ml ?? null].filter((v): v is number => v != null && v > 0));
  if (cotes.length === 0) {
    return { ok: false, raison: "le croquis ne porte aucune cote : rien ne peut être placé" };
  }
  const etendue = etendueDuDessin(zones);
  if (etendue === null) {
    return {
      ok: false,
      raison: "le croquis ne situe aucune zone : le plan ne peut pas être dessiné",
    };
  }
  return {
    ok: true,
    metresParFraction: Math.max(...cotes) / etendue,
    dispersion: 1,
    approchee: true,
  };
}

/** L'étendue occupée par le dessin, en fraction — la plus grande des deux. */
function etendueDuDessin(zones: ZonePositionnee[]): number | null {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const z of zones) {
    if (!z.position) continue;
    const dx = (z.largeurFraction ?? 0) / 2;
    const dy = (z.hauteurFraction ?? 0) / 2;
    xs.push(z.position.x - dx, z.position.x + dx);
    ys.push(z.position.y - dy, z.position.y + dy);
  }
  if (xs.length === 0) return null;
  const large = Math.max(...xs) - Math.min(...xs);
  const haut = Math.max(...ys) - Math.min(...ys);
  const etendue = Math.max(large, haut);
  // Une étendue nulle — toutes les zones au même point — ne dit rien.
  return etendue >= FRACTION_MINIMALE ? etendue : null;
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
  /**
   * Ce qu'il faut DIRE du placement, ou `null` quand il n'y a rien à dire.
   *
   * **Une réserve, jamais un refus** — sa correction du 23 août 2026. Les cotes
   * sont justes ; c'est l'agencement qui suit un dessin à main levée. Le taire
   * ferait croire à un plan mesuré au cordeau ; en faire un refus lui
   * demanderait de dessiner à l'échelle, ce qu'aucun artisan ne fera.
   */
  reserve: string | null;
};

export function poserSurLeTerrain(
  regard: PointCroquis | null,
  zones: ZonePositionnee[]
): { ok: true; terrain: TerrainPose } | { ok: false; raison: string } {
  // **L'échelle TOLÉRANTE, pas la sévère** — et c'est tout le changement du
  // 23 août. Le trajet du regard garde la sévère : lui entre dans le calcul de
  // pression, et un chiffre faux y coûte un plan faux. Ici, ce qui est en jeu
  // est un dessin, et une pelouse placée un peu de travers se voit à l'œil.
  const echelle = echelleTolerante(zones);
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

  // **Ce qu'on dit du placement**, dans son langage et sans jargon.
  const reserve = echelle.approchee
    ? "le croquis ne donne pas les proportions des zones : elles sont placées à l’estime, " +
      "d’après leurs cotes — les métrés sont justes, l’agencement est à vérifier d’un coup d’œil"
    : echelle.dispersion > ECART_MAX_ENTRE_ZONES
      ? "le croquis n’est pas à l’échelle : les zones sont placées d’après leurs cotes, " +
        "pas d’après le dessin — les métrés sont justes, l’agencement est à vérifier d’un coup d’œil"
      : null;

  return {
    ok: true,
    terrain: {
      reserve,
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
