import { contourDesZones, cadre, type Rectangle } from "./terrain";
import {
  tracerReseaux,
  surLeBord,
  estDedans,
  distance,
  ANTENNE_MAX,
  type ArroseurPose,
  type Point,
  type Segment,
} from "./trace";

/**
 * LE PLAN, ASSEMBLÉ — du croquis lu au dessin qu'il regarde.
 *
 * **Ce fichier ne décide de rien de neuf.** Il met bout à bout trois règles
 * déjà écrites et déjà éprouvées : la forme du terrain (`terrain.ts`), le
 * chemin du tuyau (`trace.ts`), et la pose des arroseurs avec leurs vannes
 * (`calcul.js`, depuis le 17 août). Ce qui manquait, c'était le raccord entre
 * les trois — et c'est précisément ce que les maquettes faisaient à la main.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DEUX RÈGLES DU PATRON VIVENT ICI, ET NULLE PART AILLEURS.
 *
 * **1. Sans croquis complet, aucun plan** (`CLAUDE.md` §4 bis). Les métrés, le
 * piquage, et surtout **l'endroit définitif de la nourrice**. Il en manque un :
 * on ne grise pas le plan, on le RETIRE. *« Il n'est pas valable avec cette
 * nouvelle règle. »* Un plan approximatif se photographie et se commande.
 *
 * **2. La nourrice se place par lui, jamais par l'outil.** *« C'est
 * l'utilisateur qui placera la nourrice où il veut. »* Ce fichier ne sait pas
 * la deviner et ne doit pas apprendre : proposer un emplacement, c'est décider
 * du tracé de toute la tranchée à sa place.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUE LA FORME ET LE REMPLISSAGE DISENT — sa planche du 17 août.
 *
 * Un rond est une turbine, un carré une tuyère. **Plein**, la ligne continue à
 * travers : c'est un té taraudé. **Creux**, la ligne s'arrête là : c'est un
 * coude taraudé. Un losange n'arrose rien — la ligne s'y sépare en deux, c'est
 * un té égal.
 *
 * Ces trois pièces ne se comptent donc PAS à part : elles se lisent sur le
 * dessin, et `tés + coudes = arroseurs` par construction, réseau par réseau.
 * C'est le contrôle que le patron a réclamé après une liste où deux erreurs se
 * compensaient au total (« il faut que tu l'appliques pour chaque réseau »).
 *
 * **Et la liste des pièces se LIT ICI depuis le 11 septembre 2026**
 * (`pieces.ts`) : le calcul les comptait sur un modèle de rangées parallèles
 * que le tracé ne suit pas, et les deux divergeaient — 8 tés + 4 coudes + 2 tés
 * égaux dans la liste, 7 + 5 + 0 sur le dessin de ses deux pelouses. C'est le
 * défaut qu'il avait relevé le 21 août (« quatre arroseurs qui ne sont pas
 * alimentés »), revenu par une autre porte.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LE Ø25 PASSE, L'ANTENNE Ø16 VA CHERCHER LA TÊTE — sa règle du 11 septembre.
 *
 * *« Un seul passage au mieux pour le 25, et ensuite des antennes en 16 rigide
 * de part et d'autre — et le max c'est 2 m. »* Une zone dont le petit côté ne
 * dépasse pas deux antennes (4 m) reçoit sa ligne SUR L'AXE DU MILIEU, et chaque
 * tête pend au bout d'une antenne d'un demi-côté. Au-delà, la ligne passe au
 * pied de chaque tête, comme avant : c'est le seul moyen de tenir les 2 m.
 */

/** Une zone telle que le calcul la rend, avec ses têtes déjà placées. */
export type ZoneDessinee = {
  id: number;
  nom: string;
  type: string;
  x: number;
  y: number;
  L: number;
  l: number;
  cle: string;
  modele: string | null;
  buse: string | null;
  portee: number;
  points: { x: number; y: number; reseau: number | undefined }[];
};

export type Tete = {
  x: number;
  y: number;
  /** Rond pour une turbine, carré pour une tuyère — sa planche du 17 août. */
  forme: "rond" | "carre";
  /** Plein : la ligne continue (té taraudé). Creux : elle s'arrête (coude taraudé). */
  plein: boolean;
  portee: number;
  /**
   * Où DESSINER le symbole quand un autre occupe le même point — sa règle du
   * 11 septembre 2026 : *« même si c'est au même endroit, tu ne dois pas
   * superposer les ronds, carrés ou losanges : mets-les côte à côte, qu'on les
   * voie bien ; l'utilisateur comprendra que c'est au même endroit »*. Le
   * point vrai reste `x, y` — c'est lui qui arrose ; ceci n'est qu'un écart
   * de dessin, nul quand la tête est seule.
   */
  decalage: { x: number; y: number };
};

export type ReseauDessine = {
  numero: number;
  couleur: string;
  /** Du pied sur la ligne Ø25 à la tête, en Ø16 rigide — 2 m au plus. */
  antennes: Segment[];
  metresAntennes: number;
  /**
   * QUELS arroseurs, avec QUELLES buses — sa demande du 21 août 2026 :
   * *« lorsque l'utilisateur regarde son plan, il sache tout de suite où les
   * réseaux passent et quels sont les arroseurs que tu vas utiliser à quel
   * endroit »*. Un plan qui montre des ronds sans les nommer oblige à
   * redescendre dans la liste de pièces pour savoir ce qu'on pose.
   *
   * **UNE LISTE, ET NON UN SEUL MODÈLE — corrigé le 23 août 2026.** Tant que la
   * pluviométrie faisait partie de la clé de secteur, toutes les têtes d'une
   * vanne portaient forcément le même modèle, et lire la première suffisait.
   * Le patron l'a retirée le 23 (*« ne prends pas en compte la
   * pluviométrie »*) : une vanne peut désormais porter deux buses, et n'en
   * nommer qu'une ferait commander de travers.
   */
  materiels: { libelle: string; portee: number; nombre: number }[];
  lignes: Point[][];
  /**
   * Les mêmes lignes, DÉCALÉES pour être vues.
   *
   * **Vu à la capture du 23 août, jamais par un test.** Deux réseaux qui
   * partagent une tranchée — ce que la règle du patron encourage — dessinent
   * exactement le même trait : le second recouvre le premier, et le plan
   * montrait un réseau bleu réduit à un point. Chaque réseau est donc écarté de
   * quelques centimètres de l'axe de la tranchée, comme deux tuyaux le sont
   * réellement au fond de la saignée.
   */
  traits: Segment[];
  tetes: Tete[];
  /**
   * Où se dessine un losange : la ligne se sépare là. Sans arroseur, c'est un
   * té égal seul ; À CÔTÉ d'un arroseur, c'est le té égal qui s'ajoute à son té
   * taraudé — *« il faut un té égal à côté du premier arroseur pour faire la
   * jonction »*, sa lecture du plan du 11 septembre 2026.
   */
  jonctions: Point[];
  metresTuyau: number;
  tes: number;
  coudes: number;
  /** Les tés égaux 25×25×25 : un par branche au-delà de deux, en chaque point. */
  tesEgaux: number;
};

export type Cote = { x: number; y: number; texte: string; ancre: "start" | "middle" | "end" };

export type Dessin = {
  /** Le cadre du SVG, en mètres — tout le dessin est mesurable à la règle. */
  viewBox: string;
  contours: Point[][];
  trous: Point[][];
  cotes: Cote[];
  tranchee: Segment[];
  metresTranchee: number;
  nourrice: Point;
  /**
   * Où écrire le mot « nourrice » — DANS le terrain, jamais dehors.
   *
   * **Vu à la capture, pas au test** (`CLAUDE.md` §5). Le regard se pose
   * presque toujours en bord de pelouse ; son libellé écrit vers l'extérieur
   * tombait donc exactement sur la cote du côté — « 12 m » et « nourrice »
   * l'un sur l'autre. Les cotes vivent dehors, ce mot vit dedans : c'est ce qui
   * garantit qu'ils ne se rencontrent pas, quel que soit l'endroit choisi.
   */
  etiquetteNourrice: Point & { ancre: "start" | "middle" | "end" };
  /** Le trait pointillé quand le regard est hors de la pelouse, ou sur un autre morceau. */
  liaisons: Segment[];
  reseaux: ReseauDessine[];
};

export type ResultatDessin =
  | { ok: true; dessin: Dessin; reserves: string[] }
  | { ok: false; raison: string };

/** Une marge autour du terrain : les cotes et la nourrice vivent dehors. */
const MARGE = 3.2;

/**
 * Dessiner le plan — ou dire pourquoi on ne le dessine pas.
 *
 * `nourrice` est l'endroit que LE PATRON a posé sur son croquis. `null` quand
 * le croquis ne le montre pas : c'est un refus, pas un défaut à compenser.
 */
export function dessinerPlan(
  zones: ZoneDessinee[],
  nourrice: Point | null,
  couleurs: string[]
): ResultatDessin {
  if (nourrice === null) {
    return {
      ok: false,
      raison:
        "Le croquis ne montre pas l’endroit définitif de la nourrice : sans lui, " +
        "le tracé des réseaux ne peut pas être calculé. Ajoutez-le et reprenez la photo.",
    };
  }

  const rectangles: Rectangle[] = zones
    .filter((z) => z.L > 0 && z.l > 0)
    .map((z) => ({ x: z.x, y: z.y, L: z.L, l: z.l }));
  if (rectangles.length === 0) {
    return { ok: false, raison: "Aucune zone du croquis n’a de longueur et de largeur lisibles." };
  }

  // **Les zones toutes à l'origine sont un croquis sans plan**, pas un jardin.
  // Le calcul rend `x = 0, y = 0` quand le croquis ne dit pas où se trouve la
  // zone : deux pelouses se superposeraient alors, et le plan serait faux sans
  // que rien ne le montre. On le refuse — le silence coûte plus cher.
  if (rectangles.length > 1 && rectangles.every((r) => r.x === 0 && r.y === 0)) {
    return {
      ok: false,
      raison:
        "Le croquis ne dit pas où chaque partie du jardin se trouve par rapport aux autres : " +
        "le plan ne peut pas être dessiné. Cotez les distances entre les zones.",
    };
  }

  const { contours, trous } = contourDesZones(rectangles);
  if (contours.length === 0) {
    return { ok: false, raison: "La forme du terrain n’a pas pu être reconstituée." };
  }

  const reserves: string[] = [];
  const liaisons: Segment[] = [];
  const tranchee: Segment[] = [];
  const parReseau = new Map<number, { lignes: Point[][]; antennes: Segment[]; tuyau: number }>();

  // ── Chaque morceau de terrain se trace pour lui-même ──────────────────────
  //
  // **Une pelouse devant et une derrière, c'est le cas le plus courant** — et
  // les recoller en un seul terrain ferait passer le tuyau sous la maison. Le
  // morceau qui porte la nourrice se trace depuis elle ; les autres depuis leur
  // point le plus proche du regard, et la liaison entre les deux se DIT au lieu
  // d'être mesurée sur un chemin que le croquis ne montre pas.
  for (const contour of contours) {
    const dedans = zones.filter((z) =>
      z.points.some((pt) => surLeBord(pt, contour) || estDedans(pt, contour))
    );
    const arroseurs: ArroseurPose[] = dedans.flatMap((z) =>
      z.points
        .filter((pt) => pt.reseau !== undefined)
        .map((pt) => ({
          point: { x: pt.x, y: pt.y },
          pied: piedDeLaTete(z, { x: pt.x, y: pt.y }),
          reseau: pt.reseau as number,
        }))
    );
    if (arroseurs.length === 0) continue;

    const porte = surLeBord(nourrice, contour) || estDedans(nourrice, contour);
    const entree = porte ? nourrice : pointLePlusProche(nourrice, contour);
    if (!porte) {
      liaisons.push({ de: nourrice, a: entree });
      reserves.push(
        `« ${dedans.map((z) => z.nom).join(" + ")} » n’est pas d’un seul tenant avec la nourrice : ` +
          "le cheminement entre les deux passe hors de la pelouse et reste à mesurer sur place"
      );
    }

    const t = tracerReseaux(entree, arroseurs, contour);
    tranchee.push(...t.tranchee);
    for (const [numero, chemins] of Object.entries(t.lignes)) {
      const n = Number(numero);
      const dejaLa = parReseau.get(n) ?? { lignes: [], antennes: [], tuyau: 0 };
      dejaLa.lignes.push(...chemins);
      dejaLa.antennes.push(...(t.antennes[n] ?? []).map((a) => ({ de: a.de, a: a.a })));
      dejaLa.tuyau += t.metresTuyau[n] ?? 0;
      parReseau.set(n, dejaLa);
    }
  }

  if (parReseau.size === 0) {
    return { ok: false, raison: "Aucun arroseur n’a pu être placé sur ce croquis." };
  }

  // ── La forme et le remplissage de chaque tête ─────────────────────────────
  //
  // **La clé porte le réseau, et pas seulement l'endroit.** Deux zones qui se
  // touchent partagent leur arête : la turbine du coin de l'une et la tuyère du
  // coin de l'autre tombent alors aux MÊMES coordonnées. Une clé sur le seul
  // point faisait que la seconde effaçait la première, et le plan dessinait un
  // carré là où une turbine est posée.
  type TeteLue = { x: number; y: number; forme: "rond" | "carre"; portee: number; modele: string | null; buse: string | null };
  /** Les têtes de chaque réseau, rangées par le PIED qui les alimente. */
  const tetesAuPied = new Map<string, TeteLue[]>();
  const parEndroit = new Map<string, Set<number>>();
  for (const z of zones) {
    for (const pt of z.points) {
      if (pt.reseau === undefined) continue;
      const k = `${cle(piedDeLaTete(z, pt))}|${pt.reseau}`;
      if (!tetesAuPied.has(k)) tetesAuPied.set(k, []);
      tetesAuPied.get(k)!.push({
        x: pt.x,
        y: pt.y,
        forme: z.cle === "tuyere" ? "carre" : "rond",
        portee: z.portee,
        modele: z.modele,
        buse: z.buse,
      });
      if (!parEndroit.has(cle(pt))) parEndroit.set(cle(pt), new Set());
      parEndroit.get(cle(pt))!.add(pt.reseau);
    }
  }

  // **Deux têtes au même endroit se DISENT.** Le cas est réel — deux pelouses
  // qui se touchent posent chacune son arroseur sur l'arête commune —, et il
  // n'est pas soluble ici : elles sont sur des vannes différentes, donc l'une
  // ne peut pas remplacer l'autre. C'est un coup de bêche à décaler sur place,
  // pas un chiffre à corriger dans un tableur.
  for (const [endroit, reseaux] of parEndroit) {
    if (reseaux.size < 2) continue;
    const [x, y] = endroit.split(",");
    reserves.push(
      `deux arroseurs de réseaux différents tombent au même endroit (${Number(x)
        .toFixed(1)
        .replace(".", ",")} ; ${Number(y).toFixed(1).replace(".", ",")} m) : ` +
        "à décaler de part et d’autre de la limite, sur place"
    );
  }

  // **Qui partage quel segment**, et dans quel ordre : c'est ce qui décide du
  // décalage de chaque trait. Un segment emprunté par trois réseaux les répartit
  // symétriquement de part et d'autre de l'axe.
  const partage = new Map<string, number[]>();
  for (const [numero, { lignes }] of parReseau) {
    for (const ligne of lignes) {
      for (let i = 0; i < ligne.length - 1; i++) {
        const k = cleSegment(ligne[i], ligne[i + 1]);
        const dessus = partage.get(k) ?? [];
        if (!dessus.includes(numero)) dessus.push(numero);
        partage.set(k, dessus);
      }
    }
  }

  const reseaux: ReseauDessine[] = [...parReseau.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([numero, { lignes, antennes, tuyau }]) => {
      // **Le degré du PIED décide de la pièce**, et rien d'autre : c'est la
      // seule lecture qui ne puisse pas diverger du dessin. Un pied traversé
      // porte un té taraudé, un pied terminal un coude — et chaque branche
      // au-delà de deux, arroseur ou pas, est un té égal de plus.
      const voisins = new Map<string, Set<string>>();
      const relier = (a: Point, b: Point) => {
        if (!voisins.has(cle(a))) voisins.set(cle(a), new Set());
        voisins.get(cle(a))!.add(cle(b));
      };
      for (const ligne of lignes) {
        for (let i = 0; i < ligne.length - 1; i++) {
          relier(ligne[i], ligne[i + 1]);
          relier(ligne[i + 1], ligne[i]);
        }
      }

      const tetes: Tete[] = [];
      const jonctions: Point[] = [];
      let tes = 0;
      let coudes = 0;
      let tesEgaux = 0;
      const materiels = new Map<string, { libelle: string; portee: number; nombre: number }>();
      const vus = new Set<string>();
      for (const ligne of lignes) {
        for (const p of ligne) {
          const k = cle(p);
          if (vus.has(k)) continue;
          vus.add(k);
          const degre = voisins.get(k)?.size ?? 0;
          const portees = tetesAuPied.get(`${k}|${numero}`) ?? [];
          // Deux têtes sur un même pied se montent en série : un seul coude
          // possible, au bout — les autres sont des tés.
          portees.forEach((tete, rang) => {
            const plein = degre > 1 || rang < portees.length - 1;
            tetes.push({ x: tete.x, y: tete.y, forme: tete.forme, plein, portee: tete.portee, decalage: { x: 0, y: 0 } });
            if (plein) tes++;
            else coudes++;
            // **On compte les têtes de chaque modèle**, au lieu de retenir le
            // premier : depuis le 23 août 2026, une vanne peut en porter deux.
            const libelle = [tete.modele, tete.buse].filter(Boolean).join(" ");
            const deja = materiels.get(libelle);
            if (deja) deja.nombre++;
            else materiels.set(libelle, { libelle, portee: tete.portee, nombre: 1 });
          });
          if (degre > 2) {
            tesEgaux += degre - 2;
            // Le losange se pose SUR le pied quand rien n'y arrose, et JUSTE À
            // CÔTÉ quand une tête l'occupe — décalé vers la branche qui part.
            jonctions.push(portees.length === 0 ? p : aCote(p, voisins.get(k)!));
          }
        }
      }

      const traits: Segment[] = [];
      for (const ligne of lignes) {
        for (let i = 0; i < ligne.length - 1; i++) {
          traits.push(decaler(ligne[i], ligne[i + 1], partage.get(cleSegment(ligne[i], ligne[i + 1])) ?? [numero], numero));
        }
      }

      return {
        numero,
        couleur: couleurs[numero] ?? "#7C8271",
        traits,
        antennes,
        metresAntennes: Math.round(antennes.reduce((t, a) => t + distance(a.de, a.a), 0) * 10) / 10,
        materiels: [...materiels.values()].filter((m) => m.libelle !== ""),
        lignes,
        tetes,
        jonctions,
        metresTuyau: Math.round(tuyau * 10) / 10,
        tes,
        coudes,
        tesEgaux,
      };
    });

  ecarterLesSymboles(reseaux);

  const tousLesPoints = [...contours.flat(), nourrice];
  const c = cadre(tousLesPoints);
  const metres = tranchee.reduce((t, s) => t + distance(s.de, s.a), 0);

  return {
    ok: true,
    reserves,
    dessin: {
      viewBox: `${c.x - MARGE} ${c.y - MARGE} ${c.L + 2 * MARGE} ${c.l + 2 * MARGE}`,
      contours,
      trous,
      cotes: cotesLisibles(contours),
      tranchee,
      metresTranchee: Math.round(metres * 10) / 10,
      nourrice,
      etiquetteNourrice: versLInterieur(nourrice, contours),
      liaisons,
      reseaux,
    },
  };
}

const cle = (p: { x: number; y: number }) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
const cleSegment = (a: Point, b: Point) => [cle(a), cle(b)].sort().join("|");

/**
 * Où la ligne Ø25 doit passer pour cette tête — sa règle du 11 septembre 2026.
 *
 * Quand le petit côté de la zone tient dans deux antennes, la ligne suit l'axe
 * du milieu, parallèle au grand côté, et la tête pend au bout d'une antenne
 * perpendiculaire — un demi-côté, jamais plus de `ANTENNE_MAX`. Sinon la ligne
 * vient au pied de la tête : c'est la seule façon de tenir les 2 m.
 */
export function piedDeLaTete(z: { x: number; y: number; L: number; l: number }, pt: Point): Point {
  const petit = Math.min(z.L, z.l);
  if (!(petit > 0) || petit > 2 * ANTENNE_MAX) return { x: pt.x, y: pt.y };
  const arrondir = (v: number) => Math.round(v * 1000) / 1000;
  return z.L >= z.l
    ? { x: pt.x, y: arrondir(z.y + z.l / 2) }
    : { x: arrondir(z.x + z.L / 2), y: pt.y };
}

/** Un point à 0,8 m du pied, vers la dernière branche qui en part. */
/** Un point à 1,1 m du pied, vers la dernière branche qui en part : le losange ne touche pas la tête. */
function aCote(p: Point, voisins: Set<string>): Point {
  const [x, y] = [...voisins][voisins.size - 1].split(",").map(Number);
  const l = Math.hypot(x - p.x, y - p.y);
  if (l < 1e-9) return p;
  return { x: p.x + ((x - p.x) / l) * 1.1, y: p.y + ((y - p.y) / l) * 1.1 };
}

/** Deux symboles qui tiennent l'un de l'autre à moins de cette distance se lisent comme un seul. */
const ECART_SYMBOLES = 1.15;

/**
 * Les têtes qui tombent au même point se dessinent CÔTE À CÔTE — sa règle du
 * 11 septembre 2026.
 *
 * Deux pelouses qui se touchent posent chacune sa tête sur l'arête commune ; le
 * dessin en montrait une, la seconde exactement dessous. La réserve le disait,
 * le plan le cachait. Les têtes d'un même point s'écartent maintenant le long
 * de l'arête qu'elles partagent — perpendiculairement à la direction du pied,
 * ou en x quand rien ne l'indique —, chacune de son côté de l'axe.
 */
function ecarterLesSymboles(reseaux: ReseauDessine[]): void {
  const parPoint = new Map<string, Tete[]>();
  for (const r of reseaux) for (const t of r.tetes) {
    const k = cle(t);
    if (!parPoint.has(k)) parPoint.set(k, []);
    parPoint.get(k)!.push(t);
  }
  for (const tetes of parPoint.values()) {
    if (tetes.length < 2) continue;
    tetes.forEach((t, i) => {
      t.decalage = { x: (i - (tetes.length - 1) / 2) * ECART_SYMBOLES, y: 0 };
    });
  }
}

/** L'écart entre deux tuyaux d'une même tranchée, en mètres — de quoi les distinguer. */
const ECART_TRAIT = 0.34;

/**
 * Un segment écarté de l'axe de la tranchée, selon qui d'autre l'emprunte.
 *
 * **Les extrémités débordent de l'écart**, et c'est ce qui referme les angles :
 * deux segments décalés qui tournent à 90° ne se rejoignent plus, et laisseraient
 * une encoche à chaque coin. Les prolonger de la valeur du décalage les fait se
 * croiser exactement au coin.
 */
function decaler(a: Point, b: Point, dessus: number[], numero: number): Segment {
  const rang = Math.max(0, dessus.indexOf(numero));
  const ecart = (rang - (dessus.length - 1) / 2) * ECART_TRAIT;
  const l = Math.hypot(b.x - a.x, b.y - a.y);
  if (l < 1e-9 || ecart === 0) return { de: a, a: b };
  const ux = (b.x - a.x) / l;
  const uy = (b.y - a.y) / l;
  const px = -uy * ecart;
  const py = ux * ecart;
  const debord = Math.abs(ecart);
  return {
    de: { x: a.x + px - ux * debord, y: a.y + py - uy * debord },
    a: { x: b.x + px + ux * debord, y: b.y + py + uy * debord },
  };
}

/**
 * Les cotes, écrites DEHORS — sur chaque côté du terrain, sa longueur.
 *
 * **Elles se mesurent sur le contour, elles ne se recopient pas de la saisie.**
 * Un croquis qui annonce 12 m et un contour qui en fait 11 se démentiraient
 * l'un l'autre sur le même dessin : c'est le trait qui fait foi, puisque c'est
 * lui qu'il photographiera pour commander.
 */
function cotesDuContour(contour: Point[]): Cote[] {
  const out: Cote[] = [];
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i];
    const b = contour[(i + 1) % contour.length];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    if (l < 0.5) continue;
    // L'intérieur est à gauche du sens de parcours (`terrain.ts` les oriente
    // tous dans le même sens) : la cote va donc du côté opposé.
    const dx = (b.x - a.x) / l;
    const dy = (b.y - a.y) / l;
    const versLExterieur = { x: dy, y: -dx };
    out.push({
      x: (a.x + b.x) / 2 + versLExterieur.x * 1.35,
      y: (a.y + b.y) / 2 + versLExterieur.y * 1.35 + 0.3,
      texte: `${l.toFixed(l % 1 === 0 ? 0 : 1).replace(".", ",")} m`,
      ancre: versLExterieur.x > 0.5 ? "start" : versLExterieur.x < -0.5 ? "end" : "middle",
    });
  }
  return out;
}

/**
 * Les cotes de tous les contours, moins celles qui tomberaient sur un autre.
 *
 * **Vu à la capture du 11 septembre 2026, sur trois zones** : deux pelouses
 * séparées d'un passage de 2 m y écrivaient chacune leur cote DANS le passage,
 * l'une sur l'autre et sur le mot « nourrice ». Une cote dont le libellé tombe
 * à moins d'un mètre et demi d'un autre contour ne s'écrit pas — quand le même
 * contour porte déjà la même longueur ailleurs (le côté d'en face d'un
 * rectangle). Sinon elle reste : mieux vaut une cote serrée qu'une cote absente.
 */
function cotesLisibles(contours: Point[][]): Cote[] {
  const parContour = contours.map(cotesDuContour);
  return parContour.flatMap((cotes, i) =>
    cotes.filter((c) => {
      const genee = contours.some((autre, j) => j !== i && distanceAuContour(c, autre) < 1.5);
      const deja = cotes.filter((d) => d !== c && d.texte === c.texte).length > 0;
      return !(genee && deja);
    })
  );
}

function distanceAuContour(p: Point, contour: Point[]): number {
  let mini = Infinity;
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i];
    const b = contour[(i + 1) % contour.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const L = dx * dx + dy * dy;
    const t = L === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L));
    mini = Math.min(mini, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)));
  }
  return mini;
}

/**
 * Un point décalé de la nourrice vers le cœur du terrain.
 *
 * Le centre de gravité des sommets suffit — on ne cherche pas le barycentre
 * exact d'un polygone, seulement une direction qui pointe vers la pelouse
 * plutôt que vers le vide.
 */
function versLInterieur(p: Point, contours: Point[][]): Point & { ancre: "start" | "middle" | "end" } {
  const sommets = contours.flat();
  const centre = { x: p.x, y: p.y + 2.4, ancre: "middle" as const };
  if (sommets.length === 0) return centre;
  const cx = sommets.reduce((t, q) => t + q.x, 0) / sommets.length;
  const cy = sommets.reduce((t, q) => t + q.y, 0) / sommets.length;
  const d = Math.hypot(cx - p.x, cy - p.y);
  if (d < 0.001) return centre;
  const ux = (cx - p.x) / d;
  const uy = (cy - p.y) / d;
  // **Le mot part du point, il ne l'enjambe pas.** Centré, il chevauchait le
  // regard lui-même — le dessin du regard fait 1,5 m de large, le mot en fait
  // quatre. Ancré du côté où il s'éloigne, il ne peut plus le recouvrir.
  const ancre = ux > 0.3 ? ("start" as const) : ux < -0.3 ? ("end" as const) : ("middle" as const);
  return { x: p.x + ux * 1.5, y: p.y + uy * 1.5 + (Math.abs(uy) > 0.7 ? uy * 0.9 : 0.35), ancre };
}

/** Le point du bord le plus proche d'un regard posé hors de la pelouse. */
function pointLePlusProche(p: Point, contour: Point[]): Point {
  let meilleur = contour[0];
  let mini = Infinity;
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i];
    const b = contour[(i + 1) % contour.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const L = dx * dx + dy * dy;
    const t = L === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L));
    const q = { x: a.x + t * dx, y: a.y + t * dy };
    const d = Math.hypot(p.x - q.x, p.y - q.y);
    if (d < mini) {
      mini = d;
      meilleur = q;
    }
  }
  return meilleur;
}
