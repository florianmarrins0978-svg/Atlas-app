import assert from "node:assert/strict";
import { nettoyerTicket, trouverLeTicket, type ImageRvba, type Point } from "../src/lib/redresser-ticket";

// POUR MON COMPTABLE, LOT 5 — redresser la photo d'un ticket.
//
// Des images FABRIQUÉES, pas ses photos : elles disent exactement où sont les
// coins, et l'on sait donc si la règle les trouve. **Les cas qui comptent le
// plus sont ceux où elle doit S'ABSTENIR** : un ticket mal découpé perdrait
// une ligne de la preuve.

let passed = 0;
let failed = 0;
function test(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

const BOIS: [number, number, number] = [120, 72, 34];

function image(W: number, H: number, pixel: (x: number, y: number) => [number, number, number]): ImageRvba {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const [r, g, b] = pixel(x, y);
      const k = (y * W + x) * 4;
      data[k] = r;
      data[k + 1] = g;
      data[k + 2] = b;
      data[k + 3] = 255;
    }
  return { data, largeur: W, hauteur: H };
}

/** Un ticket de `l` × `h`, centré en (cx, cy), tourné de `angle` degrés, avec des lignes d'encre. */
function ticketPose(W: number, H: number, l: number, h: number, angle: number, ombre = false) {
  const cx = W / 2;
  const cy = H / 2;
  const a = (angle * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const img = image(W, H, (x, y) => {
    // Le point dans le repère du ticket.
    const dx = x - cx;
    const dy = y - cy;
    const u = dx * cos + dy * sin + l / 2;
    const v = -dx * sin + dy * cos + h / 2;
    if (u < 0 || v < 0 || u >= l || v >= h) return BOIS;
    const encre = Math.floor(v / 40) % 2 === 1 && v % 40 < 8 && u > 30 && u < l - 30;
    const clarte = ombre && u < l / 2 ? 0.6 : 1;
    const c = Math.round((encre ? 40 : 245) * clarte);
    return [c, c, Math.round(c * 0.97)];
  });
  const coin = (u: number, v: number): Point => {
    const x = u - l / 2;
    const y = v - h / 2;
    return [cx + x * cos - y * sin, cy + x * sin + y * cos];
  };
  return { img, attendus: [coin(0, 0), coin(l, 0), coin(l, h), coin(0, h)] };
}

test("un ticket penché sur du bois : ses quatre coins sont trouvés", () => {
  const { img, attendus } = ticketPose(800, 1000, 300, 600, 8);
  const coins = trouverLeTicket(img);
  assert.ok(coins, "le ticket n'a pas été trouvé");
  coins.forEach((p, k) => {
    const ecart = Math.hypot(p[0] - attendus[k][0], p[1] - attendus[k][1]);
    // Le liseré rentre de dix pixels, et la grille en voit quatre.
    assert.ok(ecart < 25, `coin ${k} à ${ecart.toFixed(1)} px de sa place`);
  });
});

test("redressé, il garde ses proportions, son papier blanc et son encre", () => {
  const { img } = ticketPose(800, 1000, 300, 600, 8);
  const r = nettoyerTicket(img, 500);
  assert.ok(r);
  assert.equal(r.largeur, 500);
  assert.ok(Math.abs(r.hauteur / r.largeur - 2) < 0.15, `rapport ${r.hauteur / r.largeur}`);
  let clairs = 0;
  let sombres = 0;
  for (let s = 0; s < r.largeur * r.hauteur; s++) {
    if (r.data[s * 4] > 200) clairs++;
    if (r.data[s * 4] < 80) sombres++;
  }
  const total = r.largeur * r.hauteur;
  assert.ok(clairs / total > 0.6, `papier trop sombre : ${((clairs / total) * 100).toFixed(0)} % clair`);
  assert.ok(sombres / total > 0.02, "l'encre a disparu");
});

test("l'ombre sur la moitié du ticket s'efface", () => {
  const { img } = ticketPose(800, 1000, 300, 600, 0, true);
  const r = nettoyerTicket(img, 400);
  assert.ok(r);
  // Une bande de papier sans encre, à gauche (dans l'ombre) et à droite.
  const moyenne = (u0: number, u1: number) => {
    let somme = 0;
    let n = 0;
    for (let v = 5; v < 25; v++)
      for (let u = u0; u < u1; u++) {
        somme += r.data[(v * r.largeur + u) * 4];
        n++;
      }
    return somme / n;
  };
  const gauche = moyenne(40, 120);
  const droite = moyenne(280, 360);
  assert.ok(gauche > 200 && droite > 200, `papier à ${gauche.toFixed(0)} dans l'ombre, ${droite.toFixed(0)} au soleil`);
});

test("une photo où le ticket remplit tout ne se touche pas", () => {
  assert.equal(trouverLeTicket(image(600, 800, () => [240, 240, 236])), null);
});

test("une miette de papier ne se prend pas pour le ticket", () => {
  const img = image(800, 1000, (x, y) => (x > 380 && x < 430 && y > 480 && y < 540 ? [245, 245, 240] : BOIS));
  assert.equal(trouverLeTicket(img), null);
});

test("une forme ronde n'a pas quatre coins : on ne la découpe pas", () => {
  const img = image(800, 1000, (x, y) => (Math.hypot(x - 400, y - 500) < 300 ? [245, 245, 240] : BOIS));
  assert.equal(trouverLeTicket(img), null);
});

test("une image trop petite ne se mesure pas", () => {
  assert.equal(trouverLeTicket(image(20, 20, () => BOIS)), null);
});

console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
if (failed > 0) process.exit(1);
