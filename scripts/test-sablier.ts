/* =======================================================================
   Le sablier est UN dessin, et c'est un sablier.

   **Sa remarque du 6 novembre 2026**, devant la planche de la note sans
   réseau : *« le sablier, il est vraiment mal fait. Je veux bien que tu
   mettes un sablier, mais mets un vrai sablier. Là, on dirait pas du tout
   un sablier. »* Il avait raison : le tracé n'avait que la moitié haute de
   son côté droit, et se lisait comme un Z. Ce tracé cassé vivait en DEUX
   copies, celle du kit des planches (`appli/soignee/kit.js`,
   `horloge-sable`) et celle de l'appli (`src/components/atlas/IconeTrait.tsx`,
   `sablier`), montrée à ses clients sur « Ce lien n'est plus valable ».

   Ce contrôle tient deux choses :
     1. les deux copies portent le MÊME tracé : la planche est la maquette
        de l'écran, et deux tracés finissent toujours par diverger ;
     2. le tracé est SYMÉTRIQUE de part et d'autre de son axe : chaque point
        dessiné a son reflet dessiné. Le tracé du Z ratait la moitié basse
        de son côté droit : son reflet tombait dans le vide.

   Ni base, ni navigateur : le tracé se lit dans les deux fichiers, et ses
   courbes se calculent ici.
   ======================================================================= */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const RACINE = path.join(__dirname, "..");

type Point = { x: number; y: number };

/** Les `d="…"` d'un fragment de dessin, dans l'ordre. */
function tracesDe(fragment: string): string[] {
  return [...fragment.matchAll(/\bd="([^"]+)"/g)].map((m) => m[1]);
}

function traceDuKit(): string[] {
  const kit = readFileSync(path.join(RACINE, "appli/soignee/kit.js"), "utf8");
  const m = kit.match(/"horloge-sable":\s*'([^']*)'/);
  assert.ok(m, "Le kit ne porte plus d'icône « horloge-sable » : le contrôle ne mesure plus rien.");
  return tracesDe(m[1]);
}

function traceDeLAppli(): string[] {
  const appli = readFileSync(path.join(RACINE, "src/components/atlas/IconeTrait.tsx"), "utf8");
  const m = appli.match(/\n\s*sablier:\s*(.+),\n/);
  assert.ok(m, "IconeTrait.tsx ne porte plus de tracé « sablier » : le contrôle ne mesure plus rien.");
  return tracesDe(m[1]);
}

/**
 * Les points d'un tracé SVG, échantillonnés. Seules les commandes que les
 * icônes emploient sont lues (M, L, H, V, C, S, Z, absolues ou relatives) :
 * une autre fait échouer le contrôle plutôt que d'être ignorée en silence.
 */
export function pointsDuTrace(d: string, pas = 24): Point[] {
  const jetons = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];
  const points: Point[] = [];
  let i = 0;
  let commande = "";
  let x = 0, y = 0, debutX = 0, debutY = 0;
  // Écrit par `courbe`, lu par « S » : TypeScript ne suit pas une écriture
  // faite dans une fermeture, d'où le type posé sur la valeur.
  let dernierCtrl = null as Point | null;
  const nombre = () => Number(jetons[i++]);
  const ligne = (vx: number, vy: number) => {
    for (let k = 1; k <= pas; k++) points.push({ x: x + ((vx - x) * k) / pas, y: y + ((vy - y) * k) / pas });
    x = vx; y = vy;
  };
  const courbe = (c1: Point, c2: Point, fin: Point) => {
    for (let k = 1; k <= pas; k++) {
      const t = k / pas, u = 1 - t;
      points.push({
        x: u * u * u * x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * fin.x,
        y: u * u * u * y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * fin.y,
      });
    }
    dernierCtrl = c2;
    x = fin.x; y = fin.y;
  };
  while (i < jetons.length) {
    if (/[a-zA-Z]/.test(jetons[i])) commande = jetons[i++];
    const rel = commande === commande.toLowerCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    switch (commande.toUpperCase()) {
      case "M": {
        x = ox + nombre(); y = oy + nombre(); debutX = x; debutY = y;
        points.push({ x, y });
        commande = rel ? "l" : "L"; // les paires qui suivent un M sont des lignes
        dernierCtrl = null;
        break;
      }
      case "L": { const vx = ox + nombre(), vy = oy + nombre(); ligne(vx, vy); dernierCtrl = null; break; }
      case "H": { ligne(ox + nombre(), y); dernierCtrl = null; break; }
      case "V": { ligne(x, oy + nombre()); dernierCtrl = null; break; }
      case "C": {
        const c1 = { x: ox + nombre(), y: oy + nombre() };
        const c2 = { x: ox + nombre(), y: oy + nombre() };
        courbe(c1, c2, { x: ox + nombre(), y: oy + nombre() });
        break;
      }
      case "S": {
        const reflet: Point = dernierCtrl ? { x: 2 * x - dernierCtrl.x, y: 2 * y - dernierCtrl.y } : { x, y };
        const c2 = { x: ox + nombre(), y: oy + nombre() };
        courbe(reflet, c2, { x: ox + nombre(), y: oy + nombre() });
        break;
      }
      case "Z": { ligne(debutX, debutY); dernierCtrl = null; break; }
      default:
        throw new Error(`Commande de tracé non lue par ce contrôle : « ${commande} » dans « ${d} ».`);
    }
  }
  return points;
}

/** Le plus grand écart entre un point reflété (x ↦ 24 − x) et le dessin. */
export function ecartAuReflet(traces: string[]): { ecart: number; points: number } {
  const points = traces.flatMap((d) => pointsDuTrace(d));
  let pire = 0;
  for (const p of points) {
    let proche = Infinity;
    for (const q of points) proche = Math.min(proche, Math.hypot(24 - p.x - q.x, p.y - q.y));
    pire = Math.max(pire, proche);
  }
  return { ecart: pire, points: points.length };
}

// Le contrôle doit savoir échouer : le tracé du Z, celui qu'il a vu, rougit.
const TRACE_DU_Z = ["M7 3.5h10M7 20.5h10M8 3.5c0 5 8 5 8 8.5s-8 3.5-8 8.5M16 3.5c0 5-8 5-8 8.5"];
const SEUIL = 0.3;

const z = ecartAuReflet(TRACE_DU_Z);
assert.ok(z.ecart > 2, `Le tracé du Z devrait rater son reflet de plus de 2, il ne le rate que de ${z.ecart.toFixed(2)} : le contrôle ne voit plus le défaut.`);
console.log(`  ✓ le tracé du Z rate son reflet de ${z.ecart.toFixed(2)} : le contrôle sait échouer`);

const kit = traceDuKit();
const appli = traceDeLAppli();
assert.deepEqual(appli, kit, "Le sablier de l'appli (IconeTrait.tsx) et celui des planches (kit.js) ne portent plus le même tracé.");
console.log(`  ✓ l'appli et les planches portent le même tracé (${kit.length} chemins)`);

const mesure = ecartAuReflet(kit);
assert.ok(mesure.points > 100, `Seulement ${mesure.points} points lus : un dessin vide ne prouve rien.`);
assert.ok(
  mesure.ecart <= SEUIL,
  `Le sablier n'est pas symétrique : un point rate son reflet de ${mesure.ecart.toFixed(2)} (au plus ${SEUIL}).`,
);
console.log(`  ✓ le sablier est symétrique : ${mesure.points} points, écart au reflet ${mesure.ecart.toFixed(3)}`);

console.log("\n✅ Le sablier est un seul dessin, et c'est un sablier.");
