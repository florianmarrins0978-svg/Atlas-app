// Pose une couronne de tube sur fond blanc. Le tube est sombre ou bleu ; ses
// reflets, ses lettres et ses sangles se bouchent par fermeture (dilater puis
// éroder) ; le fond est ce qui reste, atteint depuis les bords et le trou du milieu.
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/Flori/Desktop/atlas-real-app/atlas-app-aquaplus/package.json');
const sharp = require('sharp');
const [, , entree, sortie, rayonArg] = process.argv;
const R = Number(rayonArg || 22);
const { data, info } = await sharp(entree).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const N = W * H;
let m = new Uint8Array(N);
for (let i = 0; i < N; i++) {
  const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  m[i] = lum < 85 || (b > r + 25 && b > 90) ? 1 : 0;
}
// max (ou min) glissant sur une fenêtre de 2R+1, d'abord en ligne puis en colonne
function passe(src, horizontal, max) {
  const dst = new Uint8Array(N);
  const L = horizontal ? W : H, M = horizontal ? H : W;
  for (let k = 0; k < M; k++) {
    let compte = 0;
    const at = (j) => (horizontal ? k * W + j : j * W + k);
    for (let j = -R; j <= R; j++) if (j >= 0 && j < L) compte += src[at(j)];
    for (let j = 0; j < L; j++) {
      const largeur = Math.min(L - 1, j + R) - Math.max(0, j - R) + 1;
      dst[at(j)] = max ? (compte > 0 ? 1 : 0) : (compte === largeur ? 1 : 0);
      const sort = j - R, entre = j + R + 1;
      if (sort >= 0) compte -= src[at(sort)];
      if (entre < L) compte += src[at(entre)];
    }
  }
  return dst;
}
m = passe(passe(m, true, true), false, true);
m = passe(passe(m, true, false), false, false);
// le fond : hors couronne, atteint depuis les bords et depuis le trou central
const fond = new Uint8Array(N);
const pile = [];
const graine = (i) => { if (!fond[i] && !m[i]) { fond[i] = 1; pile.push(i); } };
for (let x = 0; x < W; x++) { graine(x); graine((H - 1) * W + x); }
for (let y = 0; y < H; y++) { graine(y * W); graine(y * W + W - 1); }
graine(Math.round(H * 0.42) * W + Math.round(W * 0.5));
while (pile.length) {
  const i = pile.pop(), x = i % W;
  if (x > 0) graine(i - 1); if (x < W - 1) graine(i + 1);
  if (i >= W) graine(i - W); if (i < N - W) graine(i + W);
}
// le trou du milieu : ses reflets renvoient le béton, donc on n'y blanchit que le
// béton clair et chaud, et sans sortir du rectangle central.
const [hx0, hx1, hy0, hy1] = [W * 0.36, W * 0.64, H * 0.28, H * 0.5].map(Math.round);
const beton = (i) => { const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2]; return r - b >= 18 && 0.299 * r + 0.587 * g + 0.114 * b > 115; };
const gagne = (i) => { const x = i % W, y = (i / W) | 0; if (x >= hx0 && x < hx1 && y >= hy0 && y < hy1 && !fond[i] && beton(i)) { fond[i] = 1; pile.push(i); } };
for (let y = hy0; y < hy1; y++) for (let x = hx0; x < hx1; x++) { const i = y * W + x; if (fond[i]) pile.push(i); else gagne(i); }
while (pile.length) {
  const i = pile.pop(), x = i % W;
  if (x > 0) gagne(i - 1); if (x < W - 1) gagne(i + 1);
  if (i >= W) gagne(i - W); if (i < N - W) gagne(i + W);
}
let x0 = W, y0 = H, x1 = 0, y1 = 0;
const out = Buffer.alloc(N * 3);
for (let i = 0; i < N; i++) {
  if (fond[i]) { out[i * 3] = out[i * 3 + 1] = out[i * 3 + 2] = 255; continue; }
  out[i * 3] = data[i * 3]; out[i * 3 + 1] = data[i * 3 + 1]; out[i * 3 + 2] = data[i * 3 + 2];
  const x = i % W, y = (i / W) | 0;
  if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
}
const marge = 40;
const l = Math.max(0, x0 - marge), t = Math.max(0, y0 - marge);
await sharp(out, { raw: { width: W, height: H, channels: 3 } })
  .extract({ left: l, top: t, width: Math.min(W - l, x1 - x0 + 2 * marge), height: Math.min(H - t, y1 - y0 + 2 * marge) })
  .resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 88 }).toFile(sortie);
console.log('fond', fond.reduce((a, b) => a + b, 0), 'px sur', N, '; cadre', x0, y0, x1, y1);
