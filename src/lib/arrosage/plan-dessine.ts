import { contourDesZones, cadre, type Rectangle } from "./terrain";
import { tracerReseaux, surLeBord, estDedans, distance, type Point, type Segment } from "./trace";

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
};

export type ReseauDessine = {
  numero: number;
  couleur: string;
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
  /** Les points où la ligne se sépare sans arroser : té égal 25×25×25. */
  jonctions: Point[];
  metresTuyau: number;
  tes: number;
  coudes: number;
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
  const parReseau = new Map<number, { lignes: Point[][]; tuyau: number }>();

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
    const arroseurs = dedans.flatMap((z) =>
      z.points
        .filter((pt) => pt.reseau !== undefined)
        .map((pt) => ({ point: { x: pt.x, y: pt.y }, reseau: pt.reseau as number }))
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
      const dejaLa = parReseau.get(n) ?? { lignes: [], tuyau: 0 };
      dejaLa.lignes.push(...chemins);
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
  const formeDe = new Map<
    string,
    { forme: "rond" | "carre"; portee: number; modele: string | null; buse: string | null }
  >();
  const parEndroit = new Map<string, Set<number>>();
  for (const z of zones) {
    for (const pt of z.points) {
      if (pt.reseau === undefined) continue;
      formeDe.set(`${cle(pt)}|${pt.reseau}`, {
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
    .map(([numero, { lignes, tuyau }]) => {
      // **Le degré du point décide de la pièce**, et rien d'autre : c'est la
      // seule lecture qui ne puisse pas diverger du dessin. Un point traversé
      // porte un té, un point terminal un coude — et un point à trois branches
      // qui n'arrose rien est un té égal.
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
      const materiels = new Map<string, { libelle: string; portee: number; nombre: number }>();
      const vus = new Set<string>();
      for (const ligne of lignes) {
        for (const p of ligne) {
          const k = cle(p);
          if (vus.has(k)) continue;
          vus.add(k);
          const degre = voisins.get(k)?.size ?? 0;
          const tete = formeDe.get(`${k}|${numero}`);
          if (tete) {
            tetes.push({ x: p.x, y: p.y, forme: tete.forme, plein: degre > 1, portee: tete.portee });
            // **On compte les têtes de chaque modèle**, au lieu de retenir le
            // premier : depuis le 23 août 2026, une vanne peut en porter deux.
            const libelle = [tete.modele, tete.buse].filter(Boolean).join(" ");
            const deja = materiels.get(libelle);
            if (deja) deja.nombre++;
            else materiels.set(libelle, { libelle, portee: tete.portee, nombre: 1 });
          }
          else if (degre > 2) jonctions.push(p);
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
        materiels: [...materiels.values()].filter((m) => m.libelle !== ""),
        lignes,
        tetes,
        jonctions,
        metresTuyau: Math.round(tuyau * 10) / 10,
        tes: tetes.filter((t) => t.plein).length,
        coudes: tetes.filter((t) => !t.plein).length,
      };
    });

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
      cotes: contours.flatMap(cotesDuContour),
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
