/**
 * DE LA NOURRICE AUX ARROSEURS — le tracé des lignes, et la tranchée.
 *
 * **Ce que ce fichier calcule, et que rien ne calculait.** Le découpage en
 * voies existe (`decouper()`), la pose des arroseurs existe (`poser()`) — mais
 * *par où passe le tuyau* n'était nulle part. Le plan des maquettes le dessinait
 * à la main, un rectangle par zone, ce qui suffit pour un carré et ne dit rien
 * d'un jardin en L.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LES RÈGLES DU PATRON, TOUTES DANS UNE SEULE FONCTION — `CLAUDE.md` §4 bis.
 *
 *   1. **Tout part de la nourrice.** *« Règle indiscutable. »* Chaque réseau a
 *      au moins une ligne qui démarre au regard ; ses antennes se greffent sur
 *      un point qu'il dessert déjà.
 *   2. **On ne coupe pas le jardin.** *« Beaucoup de choses enterrées — j'aurais
 *      fait le tour. »* Longer un bord coûte parfois plus de tuyau et toujours
 *      moins d'ennuis : au milieu passent gaines, drains et racines. On ne rentre
 *      que pour desservir un arroseur qui s'y trouve.
 *   3. **Le moins de mètres de PE.** Sa correction du 23 novembre 2026 : *« il
 *      faut pouvoir dépenser le moins de mètres linéaires possible de PE »*.
 *      Jusque-là, un segment déjà creusé par un autre réseau ne coûtait rien, et
 *      le second réseau rallongeait son tuyau pour suivre la tranchée du premier :
 *      sur son 12 × 12 et 8 × 8, le réseau vert faisait 42 m de PE, et son tracé
 *      à lui en fait 18 (*« en réutilisant la tranchée, il y a 2 fois plus de
 *      mètres linéaires de PE »*), pour la même tranchée de 72 m.
 *   4. **À PE égal, la tranchée déjà ouverte** : c'est ce qui reste de sa règle
 *      du 21 août (*« quand les deux solutions se valent, la tranchée
 *      l'emporte »*), et rien de plus (`DEPARTAGE`).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * COMMENT, ET POURQUOI PAS AUTREMENT.
 *
 * L'arbre le plus court reliant des points est un arbre de Steiner — un
 * problème qu'on ne résout pas exactement pour un jardin quelconque. On prend
 * donc l'arbre couvrant minimal (Prim), avec **deux poids et non un seul** :
 *
 *   · un segment qui LONGE un bord est facturé sa longueur ;
 *   · un segment qui COUPE l'intérieur est facturé sa longueur × `PENALITE`.
 *
 * C'est ce qui traduit la règle 2 en arithmétique : le tour n'est pris que s'il
 * n'est pas démesurément plus long. `PENALITE = 2` veut dire qu'on accepte de
 * doubler la distance pour rester au bord — au-delà, la traversée redevient
 * raisonnable, et c'est le cas d'un arroseur au milieu d'une grande pelouse.
 *
 * **Et la tranchée est l'UNION des tracés**, jamais leur somme. Un segment
 * qu'un autre réseau a déjà creusé coûte son PE, sans la pénalité de la
 * traversée (rien de neuf ne s'y creuse), et à peine moins qu'un segment neuf :
 * il ne l'emporte qu'à PE égal.
 */

/** Un point du plan, en mètres, origine au coin haut-gauche du terrain. */
export type Point = { x: number; y: number };

/**
 * Un arroseur posé : où il est, sur quelle voie, et OÙ LA LIGNE DOIT PASSER.
 *
 * **Le Ø25 ne va pas à la tête, il passe à côté — sa règle du 11 septembre
 * 2026** (`CLAUDE.md` §4 bis) : *« un seul passage au mieux pour le 25, et
 * ensuite ce sont des antennes en diamètre 16 rigide qui vont de part et
 * d'autre »*. `pied` est le point de la ligne d'où part l'antenne ; quand la
 * ligne passe au pied de l'arroseur, c'est le même point.
 */
export type ArroseurPose = { point: Point; pied: Point; reseau: number };
export type Antenne = { de: Point; a: Point; reseau: number };

/**
 * La longueur maximale d'une antenne Ø16 rigide, en mètres — SA règle.
 *
 * *« Si le couloir fait 3 m, une seule tranchée au milieu et 1,50 m de 16
 * rigide de chaque côté, ça passe. S'il fait 5 m, ça fait des antennes de
 * 2,50 m, et le max c'est 2 m. »* Au-delà, ce n'est plus une antenne : la
 * ligne doit repasser plus près (`piedDeLaTete`, dans `plan-dessine.ts`).
 */
export const ANTENNE_MAX = 2;

export type Segment = { de: Point; a: Point };

export type Trace = {
  /** Les chemins de chaque réseau, depuis la nourrice — la ligne Ø25. */
  lignes: Record<number, Point[][]>;
  /** Du pied sur la ligne à la tête, en Ø16 rigide — quand les deux diffèrent. */
  antennes: Record<number, Antenne[]>;
  /** Ce qu'une équipe creuse — l'union, sans double compte. */
  tranchee: Segment[];
  /** Le linéaire de tranchée, en mètres. */
  metresTranchee: number;
  /** Le linéaire de tuyau, par réseau. */
  metresTuyau: Record<number, number>;
};

/**
 * Ce qu'on accepte de rallonger pour longer un bord plutôt que de couper.
 *
 * **Deux, et le chiffre a une raison.** Sur son extension de 8 × 4, couper fait
 * 4 m et le tour en fait 12 : rapport 3, donc la traversée l'emporterait avec
 * une pénalité de 2. Mais le tour y est déjà le chemin du réseau lui-même : ses
 * segments servent à ses autres arroseurs, et une antenne qui part d'un point
 * que le réseau atteint ne coûte que ce qu'elle ajoute.
 */
const PENALITE_TRAVERSEE = 2;

/**
 * La remise d'un segment déjà creusé par un autre réseau : un millième de son
 * PE. **Elle départage, elle ne décide pas** (sa règle du 23 novembre 2026, le
 * moins de PE d'abord) : la tranchée ouverte ne l'emporte qu'à PE égal, ou à
 * quelques centimètres sur un chemin de plusieurs dizaines de mètres.
 */
const DEPARTAGE = 0.001;

export const distance = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const cle = (p: Point) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`;

/** Le point est-il sur le périmètre, à l'épaisseur d'un trait près ? */
export function surLeBord(p: Point, contour: Point[], tolerance = 0.01): boolean {
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i];
    const b = contour[(i + 1) % contour.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const L = dx * dx + dy * dy;
    const t = L === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L));
    if (Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)) <= tolerance) return true;
  }
  return false;
}

/**
 * Tracer toutes les lignes, et en déduire la tranchée.
 *
 * **UN GRAPHE, ET NON DES LIGNES BRISÉES.** Une première version reliait chaque
 * arroseur au point atteint le plus proche par un simple coude : elle rendait
 * 76 ml de tranchée là où le tracé fait à la main en demandait 64. Elle ne
 * savait pas CONTOURNER — pour aller de la nourrice au coin opposé, elle
 * traversait, faute de pouvoir passer par les sommets du terrain.
 *
 * On construit donc un graphe : les arroseurs, la nourrice, **et les sommets du
 * contour**, reliés dès qu'ils sont alignés. Chercher le raccordement le moins
 * coûteux devient alors un plus-court-chemin, et le tour redevient possible.
 *
 * Les réseaux sont tracés l'un après l'autre, et chacun voit la tranchée déjà
 * ouverte : un segment déjà creusé lui coûte son PE, moins `DEPARTAGE`. **Il
 * ne lui coûtait rien jusqu'au 23 novembre 2026**, et le second réseau prenait
 * le chemin du premier même en doublant son tuyau : c'est ce qu'il a corrigé.
 */
export function tracerReseaux(
  nourrice: Point,
  arroseurs: ArroseurPose[],
  contour: Point[]
): Trace {
  // ── Le graphe : où l'on peut passer ───────────────────────────────────────
  const noeuds: Point[] = [];
  const ajouter = (p: Point) => {
    if (!noeuds.some((q) => cle(q) === cle(p))) noeuds.push(p);
  };
  // **La ligne rejoint les PIEDS, pas les têtes.** Dans un couloir, les pieds
  // sont tous sur l'axe du milieu : la ligne n'a plus aucune raison de longer
  // les deux bords, et c'est là que la seconde tranchée disparaît.
  ajouter(nourrice);
  arroseurs.forEach((a) => ajouter(a.pied));
  contour.forEach(ajouter);
  // Les projections : un pied au milieu d'une pelouse doit pouvoir se
  // raccorder au bord par le plus court, et ce pied de perpendiculaire n'est
  // ni un arroseur ni un sommet.
  for (const a of arroseurs) {
    for (const b of [...arroseurs.map((x) => x.pied), nourrice, ...contour]) {
      ajouter({ x: a.pied.x, y: b.y });
      ajouter({ x: b.x, y: a.pied.y });
    }
  }

  const dedans = (p: Point) => surLeBord(p, contour) || estDedans(p, contour);
  const utiles = noeuds.filter(dedans);

  // `poids` : ce que coûte un segment neuf (son PE, doublé s'il traverse) ;
  // `tuyau` : son PE seul, ce que coûte le même segment déjà creusé.
  type Arete = { vers: number; poids: number; tuyau: number };
  const aretes: Arete[][] = utiles.map(() => []);
  const cleSegment = (a: Point, b: Point) => [cle(a), cle(b)].sort().join("|");

  for (let i = 0; i < utiles.length; i++) {
    for (let j = i + 1; j < utiles.length; j++) {
      const a = utiles[i];
      const b = utiles[j];
      if (a.x !== b.x && a.y !== b.y) continue;   // seulement des segments droits
      // Le segment doit rester dans le terrain : un tuyau ne sort pas du jardin.
      const milieu = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (!dedans(milieu)) continue;
      // Aucun autre nœud ne doit se trouver au milieu : on garde les segments
      // élémentaires, sans quoi un long segment masquerait ses propres portions
      // et la tranchée serait comptée deux fois.
      const coupeUnAutre = utiles.some(
        (q, k) =>
          k !== i && k !== j && ((q.x === a.x && q.x === b.x && entre(q.y, a.y, b.y)) || (q.y === a.y && q.y === b.y && entre(q.x, a.x, b.x)))
      );
      if (coupeUnAutre) continue;
      const l = distance(a, b);
      const poids = surLeBord(milieu, contour) ? l : l * PENALITE_TRAVERSEE;
      aretes[i].push({ vers: j, poids, tuyau: l });
      aretes[j].push({ vers: i, poids, tuyau: l });
    }
  }

  const indice = new Map(utiles.map((p, i) => [cle(p), i]));

  // ── Le tracé, réseau par réseau ───────────────────────────────────────────
  const dejaCreuse = new Set<string>();
  const tranchee: Segment[] = [];
  const lignes: Record<number, Point[][]> = {};
  const antennes: Record<number, Antenne[]> = {};
  const metresTuyau: Record<number, number> = {};

  const creuser = (path: Point[]) => {
    for (let i = 0; i < path.length - 1; i++) {
      const k = cleSegment(path[i], path[i + 1]);
      if (dejaCreuse.has(k)) continue;
      dejaCreuse.add(k);
      tranchee.push({ de: path[i], a: path[i + 1] });
    }
  };

  const reseaux = [...new Set(arroseurs.map((a) => a.reseau))].sort((a, b) => a - b);
  for (const r of reseaux) {
    // Deux têtes peuvent partager un pied : la ligne n'y passe qu'une fois.
    const aJoindre: Point[] = [];
    for (const a of arroseurs.filter((x) => x.reseau === r)) {
      if (!aJoindre.some((p) => cle(p) === cle(a.pied))) aJoindre.push(a.pied);
    }
    antennes[r] = arroseurs
      .filter((a) => a.reseau === r && cle(a.pied) !== cle(a.point))
      .map((a) => ({ de: a.pied, a: a.point, reseau: r }));
    const atteints = new Set<number>([indice.get(cle(nourrice))!]);
    const chemins: Point[][] = [];
    let tuyau = 0;

    while (aJoindre.length > 0) {
      // Dijkstra depuis TOUT ce que le réseau atteint déjà, vers le plus proche
      // des arroseurs restants. Un segment déjà creusé coûte son PE, à peine moins.
      const dist = new Array(utiles.length).fill(Infinity);
      const parent = new Array(utiles.length).fill(-1);
      const vu = new Array(utiles.length).fill(false);
      atteints.forEach((i) => (dist[i] = 0));

      for (;;) {
        let u = -1;
        for (let i = 0; i < utiles.length; i++) if (!vu[i] && dist[i] < (u < 0 ? Infinity : dist[u])) u = i;
        if (u < 0) break;
        vu[u] = true;
        for (const e of aretes[u]) {
          const creuse = dejaCreuse.has(cleSegment(utiles[u], utiles[e.vers]));
          const d = dist[u] + (creuse ? e.tuyau * (1 - DEPARTAGE) : e.poids);
          if (d < dist[e.vers]) {
            dist[e.vers] = d;
            parent[e.vers] = u;
          }
        }
      }

      let choisi = 0;
      let meilleur = Infinity;
      aJoindre.forEach((p, k) => {
        const i = indice.get(cle(p))!;
        if (dist[i] < meilleur) {
          meilleur = dist[i];
          choisi = k;
        }
      });

      const cible = indice.get(cle(aJoindre[choisi]))!;
      const path: Point[] = [];
      for (let i = cible; i >= 0; i = parent[i]) path.unshift(utiles[i]);

      creuser(path);
      chemins.push(path);
      for (let k = 0; k < path.length - 1; k++) tuyau += distance(path[k], path[k + 1]);
      path.forEach((p) => atteints.add(indice.get(cle(p))!));
      aJoindre.splice(choisi, 1);
    }

    lignes[r] = chemins;
    metresTuyau[r] = Math.round(tuyau * 10) / 10;
  }

  const metres = tranchee.reduce((t, s) => t + distance(s.de, s.a), 0);
  return { lignes, antennes, tranchee, metresTranchee: Math.round(metres * 10) / 10, metresTuyau };
}

const entre = (v: number, a: number, b: number) => v > Math.min(a, b) + 1e-9 && v < Math.max(a, b) - 1e-9;

/** Le point est-il à l'intérieur du terrain ? (rayon horizontal) */
export function estDedans(p: Point, contour: Point[]): boolean {
  let ok = false;
  for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
    const a = contour[i];
    const b = contour[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) ok = !ok;
  }
  return ok;
}
