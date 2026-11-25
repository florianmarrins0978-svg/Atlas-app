/**
 * Redresser la photo d'un ticket : le trouver sur le fond, le remettre droit
 * par ses quatre coins, le nettoyer comme un scan. Lot 5 de « Pour mon
 * comptable » (24 octobre 2026), refait sur sa planche du 24 novembre 2026
 * (`appli/soignee/ticket-lisible.html`), éprouvée sur sa vraie photo d'un
 * ticket Leclerc tenu sur le genou, une lampe au dessus.
 *
 * **Ce que la planche a changé, et pourquoi.** La première règle cherchait un
 * papier « clair et peu saturé » à seuil fixe, sur une grille de quatre
 * pixels, et rendait le ticket à 1 000 pixels de large. Sur le genou, le reflet
 * de la lampe se collait au papier, le pouce mangeait un coin, et un long
 * ticket ramené à 1 000 pixels perdait la moitié de sa netteté. Désormais :
 *
 *   · le papier se lit par sa BLANCHEUR (`min − 0,6 × écart`), séparée du fond
 *     par deux seuils d'Otsu : le premier sépare le clair du sombre, le second,
 *     pris dans le clair, sépare le papier d'un reflet ; la tache la plus
 *     PLEINE (une fois ses trous bouchés) l'emporte ;
 *   · chaque bord est porté par le plus long segment de l'enveloppe, puis par
 *     le morceau le plus parallèle au bord d'en face : un pouce sur un coin y
 *     fait un pan coupé, et le coin caché se retrouve en prolongeant les bords ;
 *   · le ticket garde la finesse de la photo, jusqu'à 2 400 pixels ;
 *   · sa NETTETÉ se mesure, pour dire avant de le garder qu'une photo floue se
 *     reprend : une photo floue ne devient pas nette sans inventer, et une
 *     pièce inventée est une fausse pièce.
 *
 * **Règle pure, sur des pixels** : aucune toile, aucun navigateur, aucun appel
 * d'IA. L'écran la nourrit (`src/components/atlas/nettoyer-photo.ts`) ;
 * `test-redresser-ticket.ts` l'éprouve sur des images fabriquées.
 *
 * **Dans le doute, elle ne touche à rien** (`sur` faux) : un ticket mal
 * découpé perdrait une ligne de la preuve. La photo part alors seule.
 */

export type ImageRvba = { data: Uint8ClampedArray; largeur: number; hauteur: number };
export type Point = [number, number];
/** Haut gauche, haut droite, bas droite, bas gauche, en pixels de l'image donnée. */
export type Coins = [Point, Point, Point, Point];
/** Le ticket trouvé, et si le téléphone est sûr de lui. */
export type TicketTrouve = { coins: Coins; sur: boolean };

/** Le grand côté de l'image où se cherche le papier : 640 pixels suffisent à le voir. */
const DETECTION = 640;
/** Le plus grand côté du ticket gardé : la finesse d'une photo de téléphone, bornée pour la mémoire. */
export const COTE_GARDE = 2400;
/** Sous ce chiffre, la photo est floue (mesuré sur ses photos, nette vers 10, floue vers 2). */
export const SEUIL_NETTETE = 6;
/** Moins de 650 pixels de large dans la photo : le ticket était trop loin pour se lire. */
export const LARGEUR_MIN = 650;

/** Le papier d'un ticket est CLAIR et PEU COLORÉ ; un jean, une main, une table en bois ne le sont pas. */
function blancheur(r: number, g: number, b: number): number {
  const mi = Math.min(r, g, b);
  const ma = Math.max(r, g, b);
  return mi - 0.6 * (ma - mi);
}

function seuilOtsu(valeurs: ArrayLike<number>): number {
  const h = new Array<number>(256).fill(0);
  const n = valeurs.length;
  for (let i = 0; i < n; i++) h[Math.max(0, Math.min(255, valeurs[i]! | 0))]!++;
  let somme = 0;
  for (let t = 0; t < 256; t++) somme += t * h[t]!;
  let sB = 0;
  let wB = 0;
  let meilleur = 0;
  let seuil = 128;
  for (let t = 0; t < 256; t++) {
    wB += h[t]!;
    if (!wB) continue;
    const wF = n - wB;
    if (!wF) break;
    sB += t * h[t]!;
    const mB = sB / wB;
    const mF = (somme - sB) / wF;
    const v = wB * wF * (mB - mF) * (mB - mF);
    if (v > meilleur) {
      meilleur = v;
      seuil = t;
    }
  }
  return seuil;
}

/** L'image réduite par moyenne de blocs, pour chercher le papier sans tout parcourir. */
export function reduire(img: ImageRvba, coteMax: number): ImageRvba {
  const e = Math.min(1, coteMax / Math.max(img.largeur, img.hauteur));
  if (e === 1) return img;
  const w = Math.max(1, Math.round(img.largeur * e));
  const h = Math.max(1, Math.round(img.hauteur * e));
  const data = new Uint8ClampedArray(w * h * 4);
  const f = 1 / e;
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * f);
    const y1 = Math.min(img.hauteur, Math.max(y0 + 1, Math.floor((y + 1) * f)));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * f);
      const x1 = Math.min(img.largeur, Math.max(x0 + 1, Math.floor((x + 1) * f)));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const k = (yy * img.largeur + xx) * 4;
          r += img.data[k]!;
          g += img.data[k + 1]!;
          b += img.data[k + 2]!;
          n++;
        }
      }
      const s = (y * w + x) * 4;
      data[s] = r / n;
      data[s + 1] = g / n;
      data[s + 2] = b / n;
      data[s + 3] = 255;
    }
  }
  return { data, largeur: w, hauteur: h };
}

/** La plus grande tache, en quatre voisins, sans récursion. */
function plusGrandeTache(masque: Uint8Array, w: number, h: number): { etiquette: Int32Array; num: number; taille: number } {
  const etiquette = new Int32Array(w * h);
  const pile = new Int32Array(w * h);
  let meilleure = 0;
  let taille = 0;
  let num = 0;
  for (let d = 0; d < w * h; d++) {
    if (!masque[d] || etiquette[d]) continue;
    num++;
    let haut = 0;
    let n = 0;
    pile[haut++] = d;
    etiquette[d] = num;
    while (haut) {
      const p = pile[--haut]!;
      n++;
      const x = p % w;
      const y = (p / w) | 0;
      if (x > 0 && masque[p - 1] && !etiquette[p - 1]) {
        etiquette[p - 1] = num;
        pile[haut++] = p - 1;
      }
      if (x < w - 1 && masque[p + 1] && !etiquette[p + 1]) {
        etiquette[p + 1] = num;
        pile[haut++] = p + 1;
      }
      if (y > 0 && masque[p - w] && !etiquette[p - w]) {
        etiquette[p - w] = num;
        pile[haut++] = p - w;
      }
      if (y < h - 1 && masque[p + w] && !etiquette[p + w]) {
        etiquette[p + w] = num;
        pile[haut++] = p + w;
      }
    }
    if (n > taille) {
      taille = n;
      meilleure = num;
    }
  }
  return { etiquette, num: meilleure, taille };
}

/** L'enveloppe convexe (chaîne monotone d'Andrew). */
function enveloppe(points: Point[]): Point[] {
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const bas: Point[] = [];
  const haut: Point[] = [];
  for (const p of points) {
    while (bas.length >= 2 && cross(bas[bas.length - 2]!, bas[bas.length - 1]!, p) <= 0) bas.pop();
    bas.push(p);
  }
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i]!;
    while (haut.length >= 2 && cross(haut[haut.length - 2]!, haut[haut.length - 1]!, p) <= 0) haut.pop();
    haut.push(p);
  }
  haut.pop();
  bas.pop();
  return bas.concat(haut);
}

function intersection(a1: Point, a2: Point, b1: Point, b2: Point): Point | null {
  const d = (a1[0] - a2[0]) * (b1[1] - b2[1]) - (a1[1] - a2[1]) * (b1[0] - b2[0]);
  if (Math.abs(d) < 1e-6) return null;
  const t = ((a1[0] - b1[0]) * (b1[1] - b2[1]) - (a1[1] - b1[1]) * (b1[0] - b2[0])) / d;
  return [a1[0] + t * (a2[0] - a1[0]), a1[1] + t * (a2[1] - a1[1])];
}

/** Les trous d'une tache (le texte du ticket) se bouchent : tout ce qui est sombre sans toucher le bord est enfermé dans le papier. */
function boucherLesTrous(masque: Uint8Array, w: number, h: number) {
  const dehors = new Uint8Array(w * h);
  const pile = new Int32Array(w * h);
  let haut = 0;
  const poser = (p: number) => {
    if (!masque[p] && !dehors[p]) {
      dehors[p] = 1;
      pile[haut++] = p;
    }
  };
  for (let x = 0; x < w; x++) {
    poser(x);
    poser((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    poser(y * w);
    poser(y * w + w - 1);
  }
  while (haut) {
    const p = pile[--haut]!;
    const px = p % w;
    const py = (p / w) | 0;
    if (px > 0) poser(p - 1);
    if (px < w - 1) poser(p + 1);
    if (py > 0) poser(p - w);
    if (py < h - 1) poser(p + w);
  }
  for (let k = 0; k < w * h; k++) if (!dehors[k]) masque[k] = 1;
}

const aireDe = (q: readonly Point[]) => Math.abs(q.reduce((s, p, n) => s + p[0] * q[(n + 1) % q.length]![1] - q[(n + 1) % q.length]![0] * p[1], 0)) / 2;

type Essai = { coins: Coins; plenitude: number; sur: boolean };

/**
 * Une tache, son enveloppe, ses quatre bords, et sa plénitude : un ticket est
 * plein une fois ses trous bouchés ; un reflet sur un parquet est fait de
 * traits qui laissent passer le fond, et ne l'est pas.
 */
function ticketAuSeuil(score: Float32Array, w: number, h: number, seuil: number): Essai | null {
  const masque = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) masque[i] = score[i]! > seuil ? 1 : 0;
  boucherLesTrous(masque, w, h);
  const t = plusGrandeTache(masque, w, h);
  // Une miette, un reflet : trop petit pour être le ticket.
  if (t.taille < w * h * 0.04) return null;
  const bord: Point[] = [];
  let touche = { haut: false, bas: false, gauche: false, droite: false };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      if (t.etiquette[k] !== t.num) continue;
      if (y === 0) touche = { ...touche, haut: true };
      if (y === h - 1) touche = { ...touche, bas: true };
      if (x === 0) touche = { ...touche, gauche: true };
      if (x === w - 1) touche = { ...touche, droite: true };
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || t.etiquette[k - 1] !== t.num || t.etiquette[k + 1] !== t.num || t.etiquette[k - w] !== t.num || t.etiquette[k + w] !== t.num) bord.push([x, y]);
    }
  }
  const env = enveloppe(bord);
  if (env.length < 4) return null;
  const aireEnv = aireDe(env);

  // Les quatre extrêmes en diagonale découpent l'enveloppe en quatre bords.
  const extreme = (f: (p: Point) => number) => env.reduce((m, p, j) => (f(p) > f(env[m]!) ? j : m), 0);
  const coins = [extreme((p) => -p[0] - p[1]), extreme((p) => p[0] - p[1]), extreme((p) => p[0] + p[1]), extreme((p) => -p[0] + p[1])];
  // Chaque bord est porté par le plus long segment de l'enveloppe entre deux
  // extrêmes : un pouce sur un coin y fait un pan coupé, plus court que le bord.
  const bords: [Point, Point][] = [];
  const chaines: { morceaux: { seg: [Point, Point]; l: number }[]; long: number }[] = [];
  for (let b = 0; b < 4; b++) {
    const de = coins[b]!;
    const a = coins[(b + 1) % 4]!;
    let long = -1;
    let seg: [Point, Point] | null = null;
    let j = de;
    const chaine: { seg: [Point, Point]; l: number }[] = [];
    while (j !== a) {
      const s2 = (j + 1) % env.length;
      const l = Math.hypot(env[s2]![0] - env[j]![0], env[s2]![1] - env[j]![1]);
      chaine.push({ seg: [env[j]!, env[s2]!], l });
      if (l > long) {
        long = l;
        seg = [env[j]!, env[s2]!];
      }
      j = s2;
      if (j === de) break;
    }
    if (!seg) return null;
    bords.push(seg);
    chaines.push({ morceaux: chaine, long });
  }
  // Un ticket est un rectangle : chaque bord est parallèle à celui d'en face.
  // Le pan coupé d'un pouce peut être plus long que le bout de bord resté
  // visible ; on préfère alors le morceau, assez long, le plus parallèle au
  // bord opposé. Deux passes, pour que deux côtés abîmés se corrigent.
  const angle = (sg: [Point, Point]) => Math.atan2(sg[1][1] - sg[0][1], sg[1][0] - sg[0][0]);
  const ecart = (a1: number, a2: number) => {
    const d = Math.abs(a1 - a2) % Math.PI;
    return Math.min(d, Math.PI - d);
  };
  for (let passe = 0; passe < 2; passe++) {
    for (let b = 0; b < 4; b++) {
      const face = angle(bords[(b + 2) % 4]!);
      let mieux = bords[b]!;
      let score = ecart(angle(bords[b]!), face);
      for (const m of chaines[b]!.morceaux) {
        if (m.l < 0.25 * chaines[b]!.long) continue;
        const e2 = ecart(angle(m.seg), face);
        if (e2 + 0.02 < score) {
          score = e2;
          mieux = m.seg;
        }
      }
      bords[b] = mieux;
    }
  }
  // Les bords prolongés retrouvent un coin caché ; mais si le pouce a mangé un
  // bord presque entier, c'est le pan coupé qui passe pour lui, et le coin part
  // dans le vide. Un cadre qui déborde trop du papier ne se croit pas : on
  // revient aux coins visibles, et l'on doute.
  const prolonge: Point[] = [];
  const direct: Point[] = [];
  let horsImage = false;
  for (let b = 0; b < 4; b++) {
    const p = intersection(bords[(b + 3) % 4]![0], bords[(b + 3) % 4]![1], bords[b]![0], bords[b]![1]) ?? env[coins[b]!]!;
    if (p[0] < -0.03 * w || p[0] > 1.03 * w || p[1] < -0.03 * h || p[1] > 1.03 * h) horsImage = true;
    prolonge.push(p);
    direct.push(env[coins[b]!]!);
  }
  const fiable = !horsImage && aireDe(prolonge) <= 1.25 * aireEnv;
  const choisi = (fiable ? prolonge : direct).map((p): Point => [Math.max(0, Math.min(w, p[0])), Math.max(0, Math.min(h, p[1]))]) as Coins;
  const plenitude = t.taille / Math.max(1, aireEnv);
  const aire = aireDe(choisi);
  // **Un ticket posé sur un fond touche au plus deux bords de la photo** (il
  // dépasse parfois en haut ou en bas) ; au delà, c'est le fond qui est clair,
  // ou le ticket remplit déjà la photo. Et le cadre couvre la tache : une
  // forme ronde ou en L n'a pas quatre coins.
  const bordsTouches = Object.values(touche).filter(Boolean).length;
  const sur = fiable && aire > 0.04 * w * h && plenitude > 0.9 && bordsTouches <= 2 && aire >= 0.85 * t.taille && aire <= 1.3 * t.taille;
  return { coins: choisi, plenitude, sur };
}

/**
 * Où est le ticket, en pixels de l'image donnée : ses quatre coins, et si le
 * téléphone est sûr de lui. `null` quand rien ne ressemble à un ticket.
 */
export function trouverLeTicket(img: ImageRvba): TicketTrouve | null {
  const petit = reduire(img, DETECTION);
  const { largeur: w, hauteur: h, data: px } = petit;
  if (w < 16 || h < 16) return null;
  const score = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) score[i] = blancheur(px[i * 4]!, px[i * 4 + 1]!, px[i * 4 + 2]!);
  const t1 = seuilOtsu(score);
  const clairs: number[] = [];
  for (let i = 0; i < w * h; i++) if (score[i]! > t1) clairs.push(score[i]!);
  const essais = [ticketAuSeuil(score, w, h, t1)];
  if (clairs.length > 100) essais.push(ticketAuSeuil(score, w, h, seuilOtsu(clairs)));
  // La tache la plus pleine l'emporte : le papier, pas le reflet de la lampe.
  const meilleur = essais.reduce<Essai | null>((m, e) => (e && (!m || e.plenitude > m.plenitude) ? e : m), null);
  if (!meilleur) return null;
  const ex = img.largeur / w;
  const ey = img.hauteur / h;
  return { coins: meilleur.coins.map((p): Point => [p[0] * ex, p[1] * ey]) as Coins, sur: meilleur.sur };
}

/** L'homographie qui envoie les points `d` sur les points `s` (huit inconnues, pivot de Gauss). */
export function homographie(d: Point[], s: Point[]): number[] {
  const A: number[][] = [];
  const B: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = d[i]!;
    const [X, Y] = s[i]!;
    A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]);
    B.push(X);
    A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]);
    B.push(Y);
  }
  for (let i = 0; i < 8; i++) {
    let p = i;
    for (let r = i + 1; r < 8; r++) if (Math.abs(A[r]![i]!) > Math.abs(A[p]![i]!)) p = r;
    [A[i], A[p]] = [A[p]!, A[i]!];
    [B[i], B[p]] = [B[p]!, B[i]!];
    for (let r = 0; r < 8; r++) {
      if (r === i) continue;
      const f = A[r]![i]! / A[i]![i]!;
      for (let c = i; c < 8; c++) A[r]![c]! -= f * A[i]![c]!;
      B[r]! -= f * B[i]!;
    }
  }
  return B.map((b, i) => b / A[i]![i]!);
}

/**
 * LA NETTETÉ, mesurée à la taille des lettres : le ticket ramené à 420 pixels
 * de large (une quarantaine de caractères par ligne, dix pixels chacun), la
 * force moyenne des contours, divisée par le contraste du papier. Une photo
 * floue n'a plus de contours francs, quelle que soit sa taille.
 */
export function nettete(gris: Float32Array, W: number, H: number): number {
  const f = Math.max(1, W / 420);
  const w = Math.max(8, Math.floor(W / f));
  const h = Math.max(8, Math.floor(H / f));
  const r = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      let n = 0;
      for (let yy = Math.floor(y * f); yy < Math.min(H, Math.floor((y + 1) * f)); yy++) {
        for (let xx = Math.floor(x * f); xx < Math.min(W, Math.floor((x + 1) * f)); xx++) {
          s += gris[yy * W + xx]!;
          n++;
        }
      }
      r[y * w + x] = n ? s / n : 0;
    }
  }
  let somme = 0;
  let k = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      somme += Math.abs(4 * r[i]! - r[i - 1]! - r[i + 1]! - r[i - w]! - r[i + w]!);
      k++;
    }
  }
  const tri = Float32Array.from(r).sort();
  const contraste = tri[Math.floor(tri.length * 0.95)]! - tri[Math.floor(tri.length * 0.05)]!;
  return k ? (somme / k / Math.max(10, contraste)) * 100 : 0;
}

/**
 * Comme un scan : un léger renforcement des contours (il ne crée rien, il rend
 * franc ce que la photo porte déjà), puis le fond (un grand flou) divise
 * l'image, ce qui efface les ombres ; le papier passe au blanc, l'encre au noir.
 */
function commeUnScan(gris: Float32Array, W: number, H: number): Uint8ClampedArray {
  const net = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let m = 0;
      let c = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const u = x + dx;
          const v = y + dy;
          if (u >= 0 && u < W && v >= 0 && v < H) {
            m += gris[v * W + u]!;
            c++;
          }
        }
      }
      net[y * W + x] = gris[y * W + x]! + 0.8 * (gris[y * W + x]! - m / c);
    }
  }
  const I = new Float64Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) {
    let ligne = 0;
    for (let x = 0; x < W; x++) {
      ligne += net[y * W + x]!;
      I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1]! + ligne;
    }
  }
  const R = Math.max(8, Math.round(Math.min(W, H) / 14));
  const v = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const x1 = Math.max(0, x - R);
      const x2 = Math.min(W, x + R + 1);
      const y1 = Math.max(0, y - R);
      const y2 = Math.min(H, y + R + 1);
      const fond = (I[y2 * (W + 1) + x2]! - I[y1 * (W + 1) + x2]! - I[y2 * (W + 1) + x1]! + I[y1 * (W + 1) + x1]!) / ((x2 - x1) * (y2 - y1));
      v[y * W + x] = Math.min(1.2, net[y * W + x]! / Math.max(1, fond));
    }
  }
  const tri = Float32Array.from(v).sort();
  const bas = tri[Math.floor(tri.length * 0.01)]!;
  const haut = tri[Math.floor(tri.length * 0.5)]!;
  const sortie = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const t = Math.max(0, Math.min(1, (v[i]! - bas) / Math.max(0.02, haut - bas)));
    const g = 255 * Math.pow(t, 1.3);
    sortie[i * 4] = sortie[i * 4 + 1] = sortie[i * 4 + 2] = g;
    sortie[i * 4 + 3] = 255;
  }
  return sortie;
}

/** Le ticket remis droit et nettoyé, sa netteté, et sa largeur dans la photo. */
export type TicketRedresse = { image: ImageRvba; nettete: number; largeur: number };

/**
 * Le ticket remis droit par ses quatre coins, à la finesse de la photo
 * (`COTE_GARDE` au plus), puis nettoyé comme un scan. La netteté se mesure
 * AVANT le nettoyage : c'est la photo qu'elle juge, pas son traitement.
 */
export function redresser(img: ImageRvba, coins: Coins, coteMax = COTE_GARDE): TicketRedresse {
  const { data: px, largeur: W0, hauteur: H0 } = img;
  const dist = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const largeur = Math.max(dist(coins[0], coins[1]), dist(coins[3], coins[2]));
  const hauteur = Math.max(dist(coins[0], coins[3]), dist(coins[1], coins[2]));
  const e = Math.min(1, coteMax / Math.max(largeur, hauteur));
  const W = Math.max(40, Math.round(largeur * e));
  const H = Math.max(40, Math.round(hauteur * e));
  const h = homographie(
    [
      [0, 0],
      [W, 0],
      [W, H],
      [0, H],
    ],
    coins
  );
  const gris = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const z = h[6]! * x + h[7]! * y + 1;
      const u = (h[0]! * x + h[1]! * y + h[2]!) / z;
      const v = (h[3]! * x + h[4]! * y + h[5]!) / z;
      const x0 = Math.max(0, Math.min(W0 - 2, Math.floor(u)));
      const y0 = Math.max(0, Math.min(H0 - 2, Math.floor(v)));
      const fx = Math.min(1, Math.max(0, u - x0));
      const fy = Math.min(1, Math.max(0, v - y0));
      const lum = (k: number) => 0.299 * px[k]! + 0.587 * px[k + 1]! + 0.114 * px[k + 2]!;
      const a = lum((y0 * W0 + x0) * 4);
      const b = lum((y0 * W0 + x0 + 1) * 4);
      const c = lum(((y0 + 1) * W0 + x0) * 4);
      const d = lum(((y0 + 1) * W0 + x0 + 1) * 4);
      gris[y * W + x] = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
    }
  }
  return { image: { data: commeUnScan(gris, W, H), largeur: W, hauteur: H }, nettete: nettete(gris, W, H), largeur: Math.round(largeur) };
}

/**
 * Ce que la photo ne pourra jamais donner, dit avant de la garder. Le geste
 * juste est de la reprendre, ticket en main.
 */
export function avisSurLaPhoto(m: { nettete: number; largeur: number }): string | null {
  if (m.nettete < SEUIL_NETTETE) return "Photo floue : le texte ne se lira pas mieux. Reprenez-la sans bouger, avec plus de lumière.";
  if (m.largeur < LARGEUR_MIN) return "Le ticket est petit dans la photo : approchez le téléphone, ou prenez un long ticket en deux fois.";
  return null;
}

/** Trouver puis redresser ; `null` quand le ticket ne se trouve pas avec assurance. */
export function nettoyerTicket(img: ImageRvba, coteMax = COTE_GARDE): TicketRedresse | null {
  const trouve = trouverLeTicket(img);
  return trouve?.sur ? redresser(img, trouve.coins, coteMax) : null;
}
