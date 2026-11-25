import assert from "node:assert/strict";
import { avisSurLaPhoto, nettoyerTicket, redresser, trouverLeTicket, type ImageRvba, type Point } from "../src/lib/redresser-ticket";

// POUR MON COMPTABLE, LOT 5 — redresser la photo d'un ticket, refait sur sa
// planche du 24 novembre 2026 (`appli/soignee/ticket-lisible.html`) : un pouce
// sur un coin, la finesse de la photo gardée, une photo floue qui se reprend.
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

/** Un pouce sur un coin : une tache de peau qui mange le coin haut gauche. */
function avecUnPouce(img: ImageRvba, x: number, y: number, r: number): ImageRvba {
  const data = new Uint8ClampedArray(img.data);
  for (let yy = 0; yy < img.hauteur; yy++)
    for (let xx = 0; xx < img.largeur; xx++)
      if (Math.hypot(xx - x, yy - y) < r) {
        const k = (yy * img.largeur + xx) * 4;
        data[k] = 205;
        data[k + 1] = 150;
        data[k + 2] = 120;
      }
  return { ...img, data };
}

/** La photo bougée : un flou de boîte, rayon `r`. */
function flou(img: ImageRvba, r: number): ImageRvba {
  const { largeur: W, hauteur: H } = img;
  const data = new Uint8ClampedArray(img.data.length);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const somme = [0, 0, 0];
      let n = 0;
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const u = Math.min(W - 1, Math.max(0, x + dx));
          const v = Math.min(H - 1, Math.max(0, y + dy));
          for (let c = 0; c < 3; c++) somme[c] += img.data[(v * W + u) * 4 + c];
          n++;
        }
      for (let c = 0; c < 3; c++) data[(y * W + x) * 4 + c] = somme[c] / n;
      data[(y * W + x) * 4 + 3] = 255;
    }
  return { ...img, data };
}

const proche = (coins: Point[], attendus: Point[], tolerance: number) =>
  coins.forEach((p, k) => {
    const ecart = Math.hypot(p[0] - attendus[k][0], p[1] - attendus[k][1]);
    assert.ok(ecart < tolerance, `coin ${k} à ${ecart.toFixed(1)} px de sa place`);
  });

test("un ticket penché sur du bois : ses quatre coins sont trouvés, et le téléphone en est sûr", () => {
  const { img, attendus } = ticketPose(800, 1000, 300, 600, 8);
  const t = trouverLeTicket(img);
  assert.ok(t?.sur, "le ticket n'a pas été trouvé avec assurance");
  proche(t.coins, attendus, 12);
});

test("un pouce sur un coin : le coin caché se retrouve en prolongeant les bords", () => {
  const { img, attendus } = ticketPose(800, 1000, 300, 600, 8);
  const t = trouverLeTicket(avecUnPouce(img, attendus[0][0] + 18, attendus[0][1] + 18, 55));
  assert.ok(t?.sur, "le pouce a fait douter le téléphone");
  proche(t.coins, attendus, 16);
});

test("redressé, il garde ses proportions, son papier blanc et son encre", () => {
  const { img } = ticketPose(800, 1000, 300, 600, 8);
  const r = nettoyerTicket(img, 500);
  assert.ok(r);
  assert.equal(r.image.hauteur, 500, "le grand côté suit le plafond demandé");
  assert.ok(Math.abs(r.image.hauteur / r.image.largeur - 2) < 0.1, `rapport ${r.image.hauteur / r.image.largeur}`);
  let clairs = 0;
  let sombres = 0;
  for (let s = 0; s < r.image.largeur * r.image.hauteur; s++) {
    if (r.image.data[s * 4] > 200) clairs++;
    if (r.image.data[s * 4] < 80) sombres++;
  }
  const total = r.image.largeur * r.image.hauteur;
  assert.ok(clairs / total > 0.6, `papier trop sombre : ${((clairs / total) * 100).toFixed(0)} % clair`);
  assert.ok(sombres / total > 0.02, "l'encre a disparu");
});

test("le ticket garde la finesse de la photo : il n'est plus ramené à 1 000 pixels", () => {
  const { img } = ticketPose(1400, 2000, 600, 1400, 4);
  const r = nettoyerTicket(img);
  assert.ok(r);
  assert.ok(r.image.hauteur > 1300, `un long ticket ramené à ${r.image.hauteur} pixels de haut`);
  assert.ok(r.largeur > 550, "sa largeur dans la photo se mesure");
});

test("l'ombre sur la moitié du ticket s'efface", () => {
  const { img } = ticketPose(800, 1000, 300, 600, 0, true);
  const r = nettoyerTicket(img, 600);
  assert.ok(r);
  const { image } = r;
  // Une bande de papier sans encre, à gauche (dans l'ombre) et à droite.
  const moyenne = (f0: number, f1: number) => {
    let somme = 0;
    let n = 0;
    for (let v = 5; v < 25; v++)
      for (let u = Math.round(f0 * image.largeur); u < Math.round(f1 * image.largeur); u++) {
        somme += image.data[(v * image.largeur + u) * 4];
        n++;
      }
    return somme / n;
  };
  const gauche = moyenne(0.12, 0.3);
  const droite = moyenne(0.7, 0.88);
  assert.ok(gauche > 200 && droite > 200, `papier à ${gauche.toFixed(0)} dans l'ombre, ${droite.toFixed(0)} au soleil`);
});

test("une photo floue se dit avant d'être gardée, une photo nette ne dit rien", () => {
  const { img, attendus } = ticketPose(1000, 1400, 700, 1100, 0);
  const net = redresser(img, attendus as [Point, Point, Point, Point]);
  const bouge = redresser(flou(img, 6), attendus as [Point, Point, Point, Point]);
  assert.ok(net.nettete > bouge.nettete * 2, `nette ${net.nettete.toFixed(1)}, floue ${bouge.nettete.toFixed(1)}`);
  assert.equal(avisSurLaPhoto(net), null);
  assert.match(avisSurLaPhoto(bouge) ?? "", /^Photo floue/);
  assert.match(avisSurLaPhoto({ nettete: 20, largeur: 300 }) ?? "", /petit dans la photo/);
});

test("une photo où le ticket remplit tout ne se touche pas", () => {
  const img = image(600, 800, () => [240, 240, 236]);
  assert.notEqual(trouverLeTicket(img)?.sur, true);
  assert.equal(nettoyerTicket(img), null);
});

test("une miette de papier ne se prend pas pour le ticket", () => {
  const img = image(800, 1000, (x, y) => (x > 380 && x < 430 && y > 480 && y < 540 ? [245, 245, 240] : BOIS));
  assert.equal(trouverLeTicket(img), null);
});

test("une forme ronde n'a pas quatre coins : on ne la découpe pas", () => {
  const img = image(800, 1000, (x, y) => (Math.hypot(x - 400, y - 500) < 300 ? [245, 245, 240] : BOIS));
  assert.notEqual(trouverLeTicket(img)?.sur, true);
  assert.equal(nettoyerTicket(img), null);
});

test("une image trop petite ne se mesure pas", () => {
  assert.equal(trouverLeTicket(image(12, 12, () => BOIS)), null);
});

console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
if (failed > 0) process.exit(1);
