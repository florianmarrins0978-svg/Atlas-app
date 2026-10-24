/**
 * Redresser la photo d'un ticket : le trouver sur le fond, le remettre droit
 * par ses quatre coins, effacer l'ombre. Lot 5 de « Pour mon comptable »
 * (24 octobre 2026), éprouvé d'abord sur ses deux vrais tickets
 * (Intermarché, Uber Eats), dont un froissé à moitié dans l'ombre.
 *
 * **Règle pure, sur des pixels** : aucune toile, aucun navigateur. L'écran la
 * nourrit (`src/components/atlas/nettoyer-photo.ts`) ; `test-redresser-ticket.ts`
 * l'éprouve sur des images fabriquées, sans rien monter.
 *
 * **Dans le doute, elle ne touche à rien** (`null`) : un ticket mal découpé
 * perdrait une ligne de la preuve. La photo part alors telle quelle, réduite.
 */

export type ImageRvba = { data: Uint8ClampedArray; largeur: number; hauteur: number };
export type Point = [number, number];
/** Haut gauche, haut droite, bas droite, bas gauche. */
export type Coins = [Point, Point, Point, Point];

/** Le pas de la grille où se cherche le papier : quatre pixels suffisent à le voir. */
const PAS = 4;

/**
 * Où est le ticket. Le papier est clair et peu saturé, même sous une lumière
 * chaude (saturation 0,26 mesurée sur sa photo) ; le bois et le tissu le sont
 * bien davantage.
 *
 * Rend `null` quand ce qu'elle trouve ne ressemble pas à un ticket posé sur un
 * fond : une tache trop petite (une miette, un reflet), une tache qui touche
 * les bords de la photo (le ticket la remplit déjà, ou c'est le fond qui est
 * clair), une forme qui n'a pas quatre coins.
 */
export function trouverLeTicket(img: ImageRvba): Coins | null {
  const { data, largeur: W, hauteur: H } = img;
  const gw = Math.floor(W / PAS);
  const gh = Math.floor(H / PAS);
  if (gw < 8 || gh < 8) return null;

  const papier = new Uint8Array(gw * gh);
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      const k = (j * PAS * W + i * PAS) * 4;
      const r = data[k];
      const g = data[k + 1];
      const b = data[k + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      papier[j * gw + i] = max > 85 && (max - min) / max < 0.38 ? 1 : 0;
    }
  }

  // La plus grande tache : c'est le ticket, pas une miette.
  const etiquette = new Int32Array(gw * gh);
  let meilleure = 0;
  let meilleureTaille = 0;
  let n = 0;
  for (let s = 0; s < gw * gh; s++) {
    if (!papier[s] || etiquette[s]) continue;
    n++;
    let taille = 0;
    const pile = [s];
    etiquette[s] = n;
    while (pile.length) {
      const p = pile.pop() as number;
      taille++;
      const i = p % gw;
      const j = (p / gw) | 0;
      const voisins = [i > 0 ? p - 1 : -1, i < gw - 1 ? p + 1 : -1, j > 0 ? p - gw : -1, j < gh - 1 ? p + gw : -1];
      for (const q of voisins) {
        if (q >= 0 && papier[q] && !etiquette[q]) {
          etiquette[q] = n;
          pile.push(q);
        }
      }
    }
    if (taille > meilleureTaille) {
      meilleureTaille = taille;
      meilleure = n;
    }
  }
  if (meilleureTaille < gw * gh * 0.08) return null;

  // Les quatre coins : les points extrêmes en diagonale. Et combien de bords
  // de la photo la tache touche.
  let hg: [number, number, number] = [0, 0, Infinity];
  let hd: [number, number, number] = [0, 0, -Infinity];
  let bd: [number, number, number] = [0, 0, -Infinity];
  let bg: [number, number, number] = [0, 0, Infinity];
  const bords = { haut: false, bas: false, gauche: false, droite: false };
  for (let s = 0; s < gw * gh; s++) {
    if (etiquette[s] !== meilleure) continue;
    const gi = s % gw;
    const gj = (s / gw) | 0;
    if (gj === 0) bords.haut = true;
    if (gj === gh - 1) bords.bas = true;
    if (gi === 0) bords.gauche = true;
    if (gi === gw - 1) bords.droite = true;
    const x = gi * PAS;
    const y = gj * PAS;
    if (x + y < hg[2]) hg = [x, y, x + y];
    if (x + y > bd[2]) bd = [x, y, x + y];
    if (x - y > hd[2]) hd = [x, y, x - y];
    if (x - y < bg[2]) bg = [x, y, x - y];
  }
  // Un ticket posé sur un fond touche au plus deux bords (il dépasse parfois
  // en haut ou en bas) ; au-delà, c'est le fond qui est clair.
  if (Object.values(bords).filter(Boolean).length > 2) return null;

  const coins: Coins = [
    [hg[0], hg[1]],
    [hd[0], hd[1]],
    [bd[0], bd[1]],
    [bg[0], bg[1]],
  ];
  // La forme a-t-elle quatre coins ? L'aire du quadrilatère doit couvrir la
  // tache : une tache ronde, ou en L, n'en couvre qu'une partie.
  const aire = Math.abs(
    coins.reduce((acc, p, k) => {
      const q = coins[(k + 1) % 4];
      return acc + p[0] * q[1] - q[0] * p[1];
    }, 0) / 2
  );
  const aireTache = meilleureTaille * PAS * PAS;
  if (aire < aireTache * 0.85 || aire > aireTache * 1.3) return null;

  // Un liseré vers l'intérieur : le bord du papier n'est jamais net.
  const cx = coins.reduce((a, p) => a + p[0], 0) / 4;
  const cy = coins.reduce((a, p) => a + p[1], 0) / 4;
  for (const p of coins) {
    const dx = cx - p[0];
    const dy = cy - p[1];
    const d = Math.hypot(dx, dy) || 1;
    p[0] += (dx / d) * 10;
    p[1] += (dy / d) * 10;
  }
  return coins;
}

/** L'homographie qui envoie les points `d` sur les points `s` (huit inconnues, pivot de Gauss). */
export function homographie(d: Point[], s: Point[]): number[] {
  const A: number[][] = [];
  const B: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = d[i];
    const [X, Y] = s[i];
    A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]);
    B.push(X);
    A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]);
    B.push(Y);
  }
  for (let i = 0; i < 8; i++) {
    let p = i;
    for (let r = i + 1; r < 8; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]];
    [B[i], B[p]] = [B[p], B[i]];
    for (let r = 0; r < 8; r++) {
      if (r === i) continue;
      const f = A[r][i] / A[i][i];
      for (let c = i; c < 8; c++) A[r][c] -= f * A[i][c];
      B[r] -= f * B[i];
    }
  }
  return B.map((b, i) => b / A[i][i]);
}

/**
 * Le ticket remis droit, en niveaux de gris, l'ombre effacée : chaque point est
 * divisé par l'éclairage autour de lui (un maximum lissé), puis l'encre est
 * appuyée. Rend une image RVBA de `largeurSortie` pixels de large.
 */
export function redresser(img: ImageRvba, coins: Coins, largeurSortie: number): ImageRvba {
  const { data: px, largeur: W, hauteur: H } = img;
  const dist = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const largeur = (dist(coins[0], coins[1]) + dist(coins[3], coins[2])) / 2;
  const hauteur = (dist(coins[0], coins[3]) + dist(coins[1], coins[2])) / 2;
  const OW = largeurSortie;
  const OH = Math.max(1, Math.round((OW * hauteur) / largeur));
  const h = homographie(
    [
      [0, 0],
      [OW, 0],
      [OW, OH],
      [0, OH],
    ],
    coins
  );

  const gris = new Float32Array(OW * OH);
  for (let v = 0; v < OH; v++) {
    for (let u = 0; u < OW; u++) {
      const z = h[6] * u + h[7] * v + 1;
      const sx = (h[0] * u + h[1] * v + h[2]) / z;
      const sy = (h[3] * u + h[4] * v + h[5]) / z;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0;
      let acc = 0;
      for (const [ox, oy, w] of [
        [0, 0, (1 - fx) * (1 - fy)],
        [1, 0, fx * (1 - fy)],
        [0, 1, (1 - fx) * fy],
        [1, 1, fx * fy],
      ]) {
        const k = (Math.min(H - 1, Math.max(0, y0 + oy)) * W + Math.min(W - 1, Math.max(0, x0 + ox))) * 4;
        acc += w * (0.3 * px[k] + 0.59 * px[k + 1] + 0.11 * px[k + 2]);
      }
      gris[v * OW + u] = acc;
    }
  }

  // L'éclairage local : une moyenne sur une fenêtre, par image intégrale.
  const R = Math.max(2, Math.round(OW / 14));
  const I = new Float64Array((OW + 1) * (OH + 1));
  for (let v = 0; v < OH; v++) {
    let ligne = 0;
    for (let u = 0; u < OW; u++) {
      ligne += gris[v * OW + u];
      I[(v + 1) * (OW + 1) + u + 1] = I[v * (OW + 1) + u + 1] + ligne;
    }
  }
  const sortie = new Uint8ClampedArray(OW * OH * 4);
  for (let v = 0; v < OH; v++) {
    for (let u = 0; u < OW; u++) {
      const a = Math.max(0, u - R);
      const b = Math.max(0, v - R);
      const c = Math.min(OW, u + R + 1);
      const d = Math.min(OH, v + R + 1);
      const fond = (I[d * (OW + 1) + c] - I[b * (OW + 1) + c] - I[d * (OW + 1) + a] + I[b * (OW + 1) + a]) / ((c - a) * (d - b));
      let r = gris[v * OW + u] / Math.max(30, fond * 1.08);
      r = Math.min(1, Math.max(0, (r - 0.38) / 0.55));
      const val = Math.round(255 * Math.pow(r, 1.25));
      const s = (v * OW + u) * 4;
      sortie[s] = sortie[s + 1] = sortie[s + 2] = val;
      sortie[s + 3] = 255;
    }
  }
  return { data: sortie, largeur: OW, hauteur: OH };
}

/** Trouver puis redresser ; `null` quand le ticket ne se trouve pas avec assurance. */
export function nettoyerTicket(img: ImageRvba, largeurSortie = 1000): ImageRvba | null {
  const coins = trouverLeTicket(img);
  return coins ? redresser(img, coins, largeurSortie) : null;
}
