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
  /**
   * La tête est réglée à la vis sous la portée de sa buse — sa règle du
   * 16 octobre 2026 (jusqu'à 40 %, turbines seulement). La légende l'écrit
   * « bridée à 6 m », sa réponse « la B » devant la planche du même jour :
   * sans le mot, le poseur règle la buse à fond.
   */
  bridee: boolean;
  points: { x: number; y: number; reseau: number | undefined }[];
  /**
   * Le réseau de chaque sortie du goutte-à-goutte de cette zone (`sortiesGoutte`
   * dans le calcul). Une sortie n'arrose rien : c'est là que le Ø25 s'arrête
   * sur un coude taraudé, où se visse le té Palaplast. Absent : aucune.
   */
  sorties?: (number | undefined)[];
  /** Les mètres de tube de goutte-à-goutte que la zone demande ; zéro pour des têtes. */
  metresDeTube?: number;
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
  materiels: { libelle: string; portee: number; bridee: boolean; nombre: number }[];
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
  /**
   * Les pièces des sorties du goutte-à-goutte, À PART des raccords d'arroseurs :
   * un coude taraudé par sortie, et les tés égaux qui les séparent. Rangées
   * ailleurs, elles casseraient `tés + coudes = arroseurs`, sa règle réseau par
   * réseau, qui ne parle que des têtes.
   */
  coudesDesSorties: number;
  egauxDesSorties: number;
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
   * Où écrire le mot « nourrice » : au plus près du regard, là où RIEN n'est
   * dessiné (`placeDuMotNourrice`). Une ancre `start` ou `end` ne se lit plus
   * que dans un plan enregistré avant le 22 novembre 2026, qui ne se recalcule
   * jamais.
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
 * Ce que le plan trace, en mètres : `PlanDessine.tsx` le dessine avec ces
 * mesures, et le mot « nourrice » et les losanges s'en écartent avec les mêmes.
 * Deux copies auraient fini par diverger, et le mot serait retombé sur un trait.
 */
export const EPAISSEURS = {
  contour: 0.26,
  ligne: 0.26,
  /** L'antenne Ø16 : plus fine que la ligne Ø25, comme sur le chantier. */
  antenne: 0.13,
  tranchee: 0.95,
  liaison: 0.2,
};
/** Le rectangle du regard, autour du point qu'IL a posé ; au robinet, la croix tient dedans. */
export const REGARD = { demiLargeur: 0.75, demiHauteur: 1.4, trait: 0.22 };
/** Le demi-côté du losange d'un té égal (avant sa rotation d'un huitième de tour) et son trait. */
export const LOSANGE = { demi: 0.38, trait: 0.26 };

/**
 * La place qu'occupe le texte d'une cote, en mètres : il est écrit à 0,95 m de
 * haut (`PlanDessine.tsx`), et un caractère prend un peu plus d'un demi-corps.
 */
const HAUTEUR_COTE = 0.95;
function boiteDuTexte(c: Cote): Point[] {
  const w = c.texte.length * HAUTEUR_COTE * 0.6;
  const x0 = c.ancre === "start" ? c.x : c.ancre === "end" ? c.x - w : c.x - w / 2;
  return [{ x: x0, y: c.y - HAUTEUR_COTE }, { x: x0 + w, y: c.y }];
}

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
  const parReseau = new Map<number, { lignes: Point[][]; antennes: Segment[]; tuyau: number; entrees: Set<string> }>();

  // ── Les sorties du goutte-à-goutte, posées comme des pieds sans tête ──────
  //
  // **Sa capture du 21 octobre 2026** : deux massifs sur une vanne, et aucun
  // Ø25 dessiné vers l'un ou l'autre ; le tuyau, la tranchée et les raccords
  // de ces sorties manquaient. Une sortie entre donc au tracé comme le pied
  // d'un arroseur, sans antenne : la ligne vient jusqu'à elle, et le degré du
  // point dit la pièce, comme pour les têtes.
  const sorties = zones.flatMap((z) => {
    const reseauxDesSorties = (z.sorties ?? []).filter((r): r is number => r !== undefined);
    return pointsDeSortie(z, nourrice, reseauxDesSorties.length).map((point, k) => ({ zone: z, point, reseau: reseauxDesSorties[k] }));
  });
  const sortiesAuPied = new Map<string, number>();
  for (const so of sorties) {
    const k = `${cle(so.point)}|${so.reseau}`;
    sortiesAuPied.set(k, (sortiesAuPied.get(k) ?? 0) + 1);
  }
  const sortiesTracees = new Set<(typeof sorties)[number]>();

  // ── Chaque morceau de terrain se trace pour lui-même ──────────────────────
  //
  // **Une pelouse devant et une derrière, c'est le cas le plus courant** — et
  // les recoller en un seul terrain ferait passer le tuyau sous la maison. Le
  // morceau qui porte la nourrice se trace depuis elle ; les autres depuis leur
  // point le plus proche du regard, et la liaison entre les deux se DIT au lieu
  // d'être mesurée sur un chemin que le croquis ne montre pas.
  for (const contour of contours) {
    const ici = (pt: Point) => surLeBord(pt, contour) || estDedans(pt, contour);
    const sortiesIci = sorties.filter((so) => ici(so.point));
    const dedans = zones.filter((z) => z.points.some(ici) || sortiesIci.some((so) => so.zone === z));
    const arroseurs: ArroseurPose[] = [
      ...dedans.flatMap((z) =>
        z.points
          .filter((pt) => pt.reseau !== undefined)
          .map((pt) => ({
            point: { x: pt.x, y: pt.y },
            pied: piedDeLaTete(z, { x: pt.x, y: pt.y }),
            reseau: pt.reseau as number,
          }))
      ),
      ...sortiesIci.map((so) => ({ point: so.point, pied: so.point, reseau: so.reseau })),
    ];
    sortiesIci.forEach((so) => sortiesTracees.add(so));
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
      const dejaLa = parReseau.get(n) ?? { lignes: [], antennes: [], tuyau: 0, entrees: new Set<string>() };
      dejaLa.entrees.add(cle(entree));
      dejaLa.lignes.push(...chemins);
      dejaLa.antennes.push(...(t.antennes[n] ?? []).map((a) => ({ de: a.de, a: a.a })));
      dejaLa.tuyau += t.metresTuyau[n] ?? 0;
      parReseau.set(n, dejaLa);
    }
  }

  // **Une sortie hors du terrain dessiné** (une haie, qui n'a pas de largeur au
  // croquis) : le Ø25 y va par un passage que le croquis ne montre pas. Il se
  // dessine en pointillés et se dit, comme un morceau de terrain à part ; sa
  // sortie compte son coude, et un té égal à la vanne quand celle-ci alimente
  // déjà autre chose.
  const horsTerrain = new Map<number, number>();
  for (const so of sorties) {
    if (sortiesTracees.has(so)) continue;
    liaisons.push({ de: nourrice, a: so.point });
    reserves.push(`le passage de la nourrice à « ${so.zone.nom} » n’est pas sur le croquis : sa longueur doit être mesurée`);
    horsTerrain.set(so.reseau, (horsTerrain.get(so.reseau) ?? 0) + 1);
    if (!parReseau.has(so.reseau)) parReseau.set(so.reseau, { lignes: [], antennes: [], tuyau: 0, entrees: new Set<string>() });
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
  type TeteLue = { x: number; y: number; forme: "rond" | "carre"; portee: number; bridee: boolean; modele: string | null; buse: string | null };
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
        bridee: z.bridee,
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
    .map(([numero, { lignes, antennes, tuyau, entrees }]) => {
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
      let coudesDesSorties = 0;
      const materiels = new Map<string, { libelle: string; portee: number; bridee: boolean; nombre: number }>();
      const vus = new Set<string>();
      for (const ligne of lignes) {
        for (const p of ligne) {
          const k = cle(p);
          if (vus.has(k)) continue;
          vus.add(k);
          // **L'eau ARRIVE au point d'entrée par une branche que le dessin du
          // réseau ne porte pas** (elle vient de la nourrice, ou du robinet) : elle
          // compte comme les autres. Une ligne qui entre et part dans deux sens
          // demande donc un té égal (sa règle du 18 octobre 2026, « si on descend
          // du robinet et qu'on a un réseau qui va à droite, à gauche, il nous faut
          // un té égal »). Sans elle, ce té manquait à tous les plans.
          // Une sortie du goutte-à-goutte est une branche qui s'arrête là, sur
          // son coude taraudé : elle compte dans le degré, et son coude se compte.
          const auPied = sortiesAuPied.get(`${k}|${numero}`) ?? 0;
          coudesDesSorties += auPied;
          const degre = (voisins.get(k)?.size ?? 0) + (entrees.has(k) ? 1 : 0) + auPied;
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
            else materiels.set(libelle, { libelle, portee: tete.portee, bridee: tete.bridee, nombre: 1 });
          });
          if (degre > 2) {
            tesEgaux += degre - 2;
            // Le losange se pose SUR le pied quand rien n'y arrose, et JUSTE À
            // CÔTÉ quand une tête l'occupe — décalé vers la branche qui part.
            // **Un losange par té égal**, côte à côte (sa règle du 11 septembre 2026) :
            // un point qui en demande deux en montre deux, sinon la liste en compte
            // un que le plan ne montre pas. Le premier se pose sur le pied s'il est
            // libre ; les suivants s'écartent chacun vers une autre branche.
            const branches = [...(voisins.get(k) ?? [])].reverse();
            for (let j = 0; j < degre - 2; j++) {
              const libre = portees.length === 0 && j === 0;
              // Sans branche dessinée (des sorties posées à l'entrée même), le losange reste sur le pied.
              jonctions.push(libre || branches.length === 0 ? p : versLaBranche(p, branches[(portees.length === 0 ? j - 1 : j) % branches.length]));
            }
          }
        }
      }

      // Un réseau sans tête est un goutte-à-goutte : ses tés égaux séparent ses
      // sorties. Il en faut un de plus à la vanne pour chaque tuyau qui part en
      // plus du premier, vers un autre morceau de terrain ou hors du croquis :
      // une sortie de moins que de sorties, comme le calcul le compte.
      const dehors = horsTerrain.get(numero) ?? 0;
      coudesDesSorties += dehors;
      let egauxDesSorties = 0;
      if (tetes.length === 0) {
        egauxDesSorties = tesEgaux + Math.max(0, entrees.size + dehors - 1);
        tesEgaux = 0;
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
        coudesDesSorties,
        egauxDesSorties,
      };
    });

  ecarterLesSymboles(reseaux);

  // **Le cadre contient aussi les cotes écrites dehors.** Calculé sur le seul
  // terrain, il coupait le texte d'un côté posé au bord : « 2,4 r » au lieu de
  // « 2,4 m », sa question du 18 octobre 2026. Les cotes se calculent donc
  // AVANT le cadre, et leur texte y entre. Le mot « nourrice » aussi, qui se
  // pose là où rien n'est dessiné, parfois hors du terrain ; et les losanges
  // sortis du regard s'écartent des cotes avant qu'il se pose.
  const cotes = cotesLisibles(contours);
  degagerLesLosanges(reseaux, nourrice, cotes);
  const etiquetteNourrice = placeDuMotNourrice(nourrice, { contours, trous, tranchee, liaisons, reseaux, cotes });
  const c = cadre([...contours.flat(), nourrice]);
  const t = cadre([...contours.flat(), nourrice, ...cotes.flatMap(boiteDuTexte), ...boiteDuTexte({ ...etiquetteNourrice, texte: MOT_NOURRICE })]);
  const gauche = Math.min(c.x - MARGE, t.x - 0.4);
  const haut = Math.min(c.y - MARGE, t.y - 0.4);
  const droite = Math.max(c.x + c.L + MARGE, t.x + t.L + 0.4);
  const bas = Math.max(c.y + c.l + MARGE, t.y + t.l + 0.4);
  const metres = tranchee.reduce((t, s) => t + distance(s.de, s.a), 0);

  return {
    ok: true,
    reserves,
    dessin: {
      viewBox: `${gauche} ${haut} ${droite - gauche} ${bas - haut}`,
      contours,
      trous,
      cotes,
      tranchee,
      metresTranchee: Math.round(metres * 10) / 10,
      nourrice,
      etiquetteNourrice,
      liaisons,
      reseaux,
    },
  };
}

const cle = (p: { x: number; y: number }) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`;

/**
 * Où le Ø25 rejoint une zone de goutte-à-goutte : son point le plus proche de
 * la nourrice, et, quand elle en demande plusieurs (une par tranche de 100 m de
 * tube, une par vanne), réparties sur le même côté. Une zone sans largeur au
 * croquis (une haie) n'a que sa place : la sortie s'y pose.
 */
function pointsDeSortie(z: ZoneDessinee, nourrice: Point, n: number): Point[] {
  if (n === 0) return [];
  const arrondir = (v: number) => Math.round(v * 1000) / 1000;
  if (!(z.L > 0 && z.l > 0)) return Array.from({ length: n }, () => ({ x: z.x, y: z.y }));
  const borne = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
  const premier = { x: arrondir(borne(nourrice.x, z.x, z.x + z.L)), y: arrondir(borne(nourrice.y, z.y, z.y + z.l)) };
  if (n === 1) return [premier];
  const surUnBordHorizontal = premier.y === arrondir(z.y) || premier.y === arrondir(z.y + z.l);
  return Array.from({ length: n }, (_, k) =>
    surUnBordHorizontal
      ? { x: arrondir(z.x + (z.L * (k + 0.5)) / n), y: premier.y }
      : { x: premier.x, y: arrondir(z.y + (z.l * (k + 0.5)) / n) }
  );
}
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
function versLaBranche(p: Point, voisin: string): Point {
  const [x, y] = voisin.split(",").map(Number);
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

// ── Ce qui se pose AUTOUR du regard : le mot « nourrice » et les losanges ─────
//
// Sa lecture du PDF, le 21 novembre 2026 : le mot était barré par la tranchée,
// le tuyau ou les pointillés qui partent de la nourrice, et sur le réseau 2 le
// losange du té égal était à moitié sous le regard. Le mot se posait vers le
// centre du terrain sans regarder ce qui y était dessiné ; le losange, sur la
// ligne même qui sort du regard. Les deux se posent maintenant là où rien
// n'est dessiné, au plus près.

const MOT_NOURRICE = "nourrice";
/** L'air laissé entre ce qui se pose et ce qui est déjà dessiné, en mètres. */
const JEU = 0.15;
/** Le rond d'une turbine (0,5 m et son trait) ou le carré d'une tuyère (0,88 m de côté), dans un cercle. */
const EMPRISE_TETE = 0.72;
const EMPRISE_LOSANGE = LOSANGE.demi * Math.SQRT2 + LOSANGE.trait / 2;

type Boite = { x0: number; y0: number; x1: number; y1: number };

function boiteDeLaCote(c: Cote): Boite {
  const [a, b] = boiteDuTexte(c);
  return { x0: a.x, y0: a.y, x1: b.x, y1: b.y };
}

function boiteDuRegard(n: Point, marge = 0): Boite {
  const dx = REGARD.demiLargeur + REGARD.trait / 2 + marge;
  const dy = REGARD.demiHauteur + REGARD.trait / 2 + marge;
  return { x0: n.x - dx, y0: n.y - dy, x1: n.x + dx, y1: n.y + dy };
}
const elargir = (b: Boite, m: number): Boite => ({ x0: b.x0 - m, y0: b.y0 - m, x1: b.x1 + m, y1: b.y1 + m });
const ecartPointBoite = (p: Point, b: Boite) => Math.hypot(Math.max(b.x0 - p.x, 0, p.x - b.x1), Math.max(b.y0 - p.y, 0, p.y - b.y1));
const ecartBoites = (a: Boite, b: Boite) => Math.hypot(Math.max(a.x0 - b.x1, 0, b.x0 - a.x1), Math.max(a.y0 - b.y1, 0, b.y0 - a.y1));

/** Le segment traverse-t-il la boîte ? Liang et Barsky : on rogne le segment aux quatre bords. */
function coupe(s: Segment, b: Boite): boolean {
  const dx = s.a.x - s.de.x, dy = s.a.y - s.de.y;
  let t0 = 0, t1 = 1;
  for (const [p, q] of [[-dx, s.de.x - b.x0], [dx, b.x1 - s.de.x], [-dy, s.de.y - b.y0], [dy, b.y1 - s.de.y]]) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return true;
}

/**
 * Les losanges qui tomberaient sous le regard en sortent, au plus près —
 * sa règle du 11 septembre 2026 : *« même si c'est au même endroit, tu ne dois
 * pas superposer les ronds, carrés ou losanges : mets-les côte à côte »*. La
 * ligne se sépare souvent juste à la sortie du regard, voire au point même où
 * il l'a posé : son losange était caché, en tout ou en moitié. Le point vrai ne
 * change pas, seul le dessin s'écarte, sans tomber sur une tête ni sur un
 * autre losange.
 */
function degagerLesLosanges(reseaux: ReseauDessine[], nourrice: Point, cotes: Cote[]): void {
  const regard = boiteDuRegard(nourrice, EMPRISE_LOSANGE + JEU);
  const tetes = reseaux.flatMap((r) => r.tetes.map((t) => ({ x: t.x + t.decalage.x, y: t.y + t.decalage.y })));
  const textes = cotes.map(boiteDeLaCote);
  const poses = reseaux.flatMap((r) => r.jonctions.filter((p) => ecartPointBoite(p, regard) > 0));
  for (const r of reseaux) {
    r.jonctions = r.jonctions.map((p) => {
      if (ecartPointBoite(p, regard) > 0) return p;
      const libre = autour(p, 4, 0.1).find(
        (q) =>
          ecartPointBoite(q, regard) > 0 &&
          textes.every((b) => ecartPointBoite(q, b) >= EMPRISE_LOSANGE + JEU) &&
          tetes.every((t) => distance(q, t) >= EMPRISE_TETE + EMPRISE_LOSANGE) &&
          poses.every((o) => distance(q, o) >= 2 * EMPRISE_LOSANGE + JEU)
      );
      const q = libre ?? p;
      poses.push(q);
      return q;
    });
  }
}

/** Les points d'une grille de `pas` autour de `p`, du plus proche au plus loin, dans un ordre fixe. */
function autour(p: Point, rayon: number, pas: number): Point[] {
  const n = Math.round(rayon / pas);
  const points: (Point & { d: number })[] = [];
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) points.push({ x: p.x + i * pas, y: p.y + j * pas, d: Math.round(Math.hypot(i, j) * 1e6) });
  }
  return points.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
}

/**
 * Où écrire le mot « nourrice » : la place libre la plus proche du regard.
 *
 * Libre veut dire qu'aucun trait ne le barre (tranchée, tuyaux, antennes,
 * pointillés, bords des zones, chacun avec son épaisseur), qu'il ne couvre ni
 * une tête, ni un losange, ni le regard, ni une cote. À distance égale, dessous
 * d'abord, puis le plus droit possible sous le regard : c'est là que l'œil le
 * cherche. Le regard se pose souvent dans un passage de deux mètres entre deux
 * pelouses, plus étroit que le mot : la place est alors à côté, jamais dessus.
 *
 * Sans place libre à six mètres, le moins encombré l'emporte : on le dit ici
 * plutôt que de le croire impossible.
 */
function placeDuMotNourrice(
  nourrice: Point,
  d: { contours: Point[][]; trous: Point[][]; tranchee: Segment[]; liaisons: Segment[]; reseaux: ReseauDessine[]; cotes: Cote[] }
): Point & { ancre: "middle" } {
  const aretes = (c: Point[]) => c.map((p, i) => ({ de: p, a: c[(i + 1) % c.length] }));
  const traits = [
    ...d.tranchee.map((s) => ({ s, demi: EPAISSEURS.tranchee / 2 })),
    ...d.liaisons.map((s) => ({ s, demi: EPAISSEURS.liaison / 2 })),
    ...[...d.contours, ...d.trous].flatMap(aretes).map((s) => ({ s, demi: EPAISSEURS.contour / 2 })),
    ...d.reseaux.flatMap((r) => [
      ...r.traits.map((s) => ({ s, demi: EPAISSEURS.ligne / 2 })),
      ...r.antennes.map((s) => ({ s, demi: EPAISSEURS.antenne / 2 })),
    ]),
  ];
  const ronds = d.reseaux.flatMap((r) => [
    ...r.tetes.map((t) => ({ p: { x: t.x + t.decalage.x, y: t.y + t.decalage.y }, r: EMPRISE_TETE })),
    ...r.jonctions.map((p) => ({ p, r: EMPRISE_LOSANGE })),
  ]);
  const regard = boiteDuRegard(nourrice);
  const boites: Boite[] = [regard, ...d.cotes.map(boiteDeLaCote)];
  const genes = (b: Boite) =>
    traits.filter((t) => coupe(t.s, elargir(b, t.demi + JEU))).length +
    ronds.filter((o) => ecartPointBoite(o.p, b) < o.r + JEU).length +
    boites.filter((x) => ecartBoites(x, b) < JEU).length;

  const largeur = MOT_NOURRICE.length * HAUTEUR_COTE * 0.6;
  const candidats = autour(nourrice, 6, 0.25).map((p) => {
    const b = { x0: p.x - largeur / 2, y0: p.y - HAUTEUR_COTE, x1: p.x + largeur / 2, y1: p.y };
    return { p, b, loin: Math.round(ecartBoites(b, regard) * 1e6), dessus: p.y > nourrice.y ? 0 : 1, travers: Math.round(Math.abs(p.x - nourrice.x) * 1e6) };
  });
  candidats.sort((a, b) => a.loin - b.loin || a.dessus - b.dessus || a.travers - b.travers);
  const libre = candidats.find((c) => genes(c.b) === 0);
  const retenu = libre ?? candidats.map((c) => ({ c, n: genes(c.b) })).filter((x) => ecartBoites(x.c.b, regard) >= JEU).sort((a, b) => a.n - b.n)[0]?.c ?? candidats[0];
  return { x: retenu.p.x, y: retenu.p.y, ancre: "middle" };
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
