import assert from "node:assert";
import { CHARTES } from "../src/lib/chartes";

/**
 * LES HUIT CATÉGORIES DU DOSSIER SE DISTINGUENT, SUR CHAQUE CHARTE.
 *
 * Sa remarque du 27 octobre 2026 : *« le train, le virement et les repas, les
 * couleurs sont trop proches. Il faut que chaque couleur soit bien distincte
 * des autres. Qu'on ne les confonde pas. »*
 *
 * Les couleurs ne sont pas posées telles quelles : chaque charte les remonte ou
 * les assombrit pour qu'elles se lisent (`couleursDuComptable`). Une teinte
 * choisie sur la charte claire peut donc rejoindre sa voisine sur Nuit ou
 * Sylve (un brun éclairci devient l'orange d'à côté, écart de 3). On mesure
 * donc la couleur FINALE de chaque charte, l'écart CIEDE2000 de chaque paire.
 *
 * Seuil 17 : l'ancienne palette tombait à 12,4 sur Nuit et 13,4 sur Sylve, et
 * le test rougit sur elle ; celle du 27 octobre reste au-dessus de 18 partout.
 */
const SEUIL = 17;
const CLES = ["catCarburant", "catRepas", "catMateriel", "catHotel", "catTransport", "catAutre", "catVirement", "catRecu"] as const;

function lab(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** CIEDE2000, la formule de référence (Sharma, Wu, Dalal 2005). */
function ecart(a: string, b: string): number {
  const [L1, a1, b1] = lab(a);
  const [L2, a2, b2] = lab(b);
  const Cm = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1 = Math.hypot(a1p, b1);
  const C2 = Math.hypot(a2p, b2);
  const h1 = ((Math.atan2(b1, a1p) * 180) / Math.PI + 360) % 360;
  const h2 = ((Math.atan2(b2, a2p) * 180) / Math.PI + 360) % 360;
  let dh = h2 - h1;
  if (C1 * C2 === 0) dh = 0;
  else if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const dL = L2 - L1;
  const dC = C2 - C1;
  const dH = 2 * Math.sqrt(C1 * C2) * Math.sin((dh * Math.PI) / 360);
  const Lm = (L1 + L2) / 2;
  const Cp = (C1 + C2) / 2;
  let hm = h1 + h2;
  if (C1 * C2 !== 0) hm = Math.abs(h1 - h2) <= 180 ? (h1 + h2) / 2 : h1 + h2 < 360 ? (h1 + h2 + 360) / 2 : (h1 + h2 - 360) / 2;
  const rad = (d: number) => (d * Math.PI) / 180;
  const T = 1 - 0.17 * Math.cos(rad(hm - 30)) + 0.24 * Math.cos(rad(2 * hm)) + 0.32 * Math.cos(rad(3 * hm + 6)) - 0.2 * Math.cos(rad(4 * hm - 63));
  const SL = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2);
  const SC = 1 + 0.045 * Cp;
  const SH = 1 + 0.015 * Cp * T;
  const RC = 2 * Math.sqrt(Cp ** 7 / (Cp ** 7 + 25 ** 7));
  const RT = -Math.sin(rad(60 * Math.exp(-(((hm - 275) / 25) ** 2)))) * RC;
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}

let echecs = 0;
function cas(nom: string, f: () => void) {
  try { f(); console.log(`  ✓ ${nom}`); } catch (e) { echecs++; console.error(`  ✗ ${nom}\n    ${(e as Error).message}`); }
}

cas("l'écart sait mesurer : deux couleurs égales ne s'écartent pas, noir et blanc s'écartent à fond", () => {
  assert.equal(ecart("#12a150", "#12a150"), 0);
  assert.ok(ecart("#000000", "#ffffff") > 90);
});

for (const charte of CHARTES) {
  cas(`${charte.nom} : chacune des huit catégories se distingue des sept autres (au moins ${SEUIL})`, () => {
    const j = charte.jetons as unknown as Record<string, string>;
    const pires: string[] = [];
    for (let i = 0; i < CLES.length; i++) {
      for (let k = i + 1; k < CLES.length; k++) {
        const e = ecart(j[CLES[i]], j[CLES[k]]);
        if (e < SEUIL) pires.push(`${CLES[i].slice(3)} et ${CLES[k].slice(3)} : ${e.toFixed(1)} (${j[CLES[i]]} / ${j[CLES[k]]})`);
      }
    }
    assert.deepEqual(pires, [], `couleurs trop proches sur ${charte.nom} : ${pires.join(" ; ")}`);
  });
}

console.log(`\n${echecs === 0 ? "✅" : "❌"} Catégories distinctes, ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
