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
 *   2. **On minimise la TRANCHÉE, pas le tuyau.** Deux tuyaux qui suivent le
 *      même chemin n'occupent qu'une saignée : le mètre de tuyau se pose, le
 *      mètre de tranchée se creuse et se remblaie. Un réseau a donc raison de
 *      rallonger son tuyau pour rester dans une tranchée déjà ouverte.
 *   3. **On ne coupe pas le jardin.** *« Beaucoup de choses enterrées — j'aurais
 *      fait le tour. »* Longer un bord coûte parfois plus de tuyau et toujours
 *      moins d'ennuis : au milieu passent gaines, drains et racines. On ne rentre
 *      que pour desservir un arroseur qui s'y trouve.
 *   4. **Au plus court**, une fois les trois précédentes tenues.
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
 * C'est ce qui traduit la règle 3 en arithmétique : le tour n'est pris que s'il
 * n'est pas démesurément plus long. `PENALITE = 2` veut dire qu'on accepte de
 * doubler la distance pour rester au bord — au-delà, la traversée redevient
 * raisonnable, et c'est le cas d'un arroseur au milieu d'une grande pelouse.
 *
 * **Et la tranchée est l'UNION des tracés**, jamais leur somme : c'est là que
 * la règle 2 se joue. Un réseau qui rejoint un arroseur lointain le fait par
 * les segments déjà pris par un autre, tant que le détour reste borné.
 */

/** Un point du plan, en mètres, origine au coin haut-gauche du terrain. */
export type Point = { x: number; y: number };

/** Un arroseur posé : où il est, et sur quelle voie il se trouve. */
export type ArroseurPose = { point: Point; reseau: number };

export type Segment = { de: Point; a: Point };

export type Trace = {
  /** Les chemins de chaque réseau, depuis la nourrice. */
  lignes: Record<number, Point[][]>;
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
 * une pénalité de 2. Mais le tour y est GRATUIT — ses segments servent déjà à
 * d'autres arroseurs, et la tranchée ne les compte qu'une fois. C'est
 * l'union qui tranche, pas la pénalité : celle-ci ne sert qu'à départager deux
 * chemins de coût égal en tranchée.
 */
const PENALITE_TRAVERSEE = 2;

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
 * ouverte : un segment déjà creusé lui est facturé **zéro**. C'est ainsi que la
 * règle de la tranchée se traduit — le second réseau prend le chemin du premier
 * même s'il rallonge son tuyau.
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
  ajouter(nourrice);
  arroseurs.forEach((a) => ajouter(a.point));
  contour.forEach(ajouter);
  // Les projections : un arroseur au milieu d'une pelouse doit pouvoir se
  // raccorder au bord par le plus court, et ce pied de perpendiculaire n'est
  // ni un arroseur ni un sommet.
  for (const a of arroseurs) {
    for (const b of [...arroseurs.map((x) => x.point), nourrice, ...contour]) {
      ajouter({ x: a.point.x, y: b.y });
      ajouter({ x: b.x, y: a.point.y });
    }
  }

  const dedans = (p: Point) => surLeBord(p, contour) || estDedans(p, contour);
  const utiles = noeuds.filter(dedans);

  type Arete = { vers: number; poids: number };
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
      aretes[i].push({ vers: j, poids });
      aretes[j].push({ vers: i, poids });
    }
  }

  const indice = new Map(utiles.map((p, i) => [cle(p), i]));

  // ── Le tracé, réseau par réseau ───────────────────────────────────────────
  const dejaCreuse = new Set<string>();
  const tranchee: Segment[] = [];
  const lignes: Record<number, Point[][]> = {};
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
    const aJoindre = arroseurs.filter((a) => a.reseau === r).map((a) => a.point);
    const atteints = new Set<number>([indice.get(cle(nourrice))!]);
    const chemins: Point[][] = [];
    let tuyau = 0;

    while (aJoindre.length > 0) {
      // Dijkstra depuis TOUT ce que le réseau atteint déjà, vers le plus proche
      // des arroseurs restants. Un segment déjà creusé ne coûte rien.
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
          const gratuit = dejaCreuse.has(cleSegment(utiles[u], utiles[e.vers]));
          const d = dist[u] + (gratuit ? 0 : e.poids);
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
  return { lignes, tranchee, metresTranchee: Math.round(metres * 10) / 10, metresTuyau };
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
