// LA CARTE DU POINT GPS — la règle, sans réseau ni écran.
//
// **Sa question du 14 octobre 2026** : *« pourquoi t'as pas fait la vraie carte
// GPS ? »*, puis *« ça marche, code ça »* sur `appli/fiche-securite-carte-gps.html`.
//
// La carte est faite de tuiles carrées de 256 pixels, celles de la Géoplateforme
// de l'IGN (le service public que l'appli emploie déjà pour le temps de route).
// Les mêmes fonctions disent à l'écran ET au PDF quelles tuiles poser et où :
// deux calculs finiraient par mettre le point à deux endroits différents.

export const TAILLE_D_UNE_TUILE = 256;
export const ZOOM_MIN = 12;
export const ZOOM_MAX = 19;
/** Assez près pour reconnaître la maison, assez loin pour voir la rue. */
export const ZOOM_PAR_DEFAUT = 17;

export const FONDS_DE_CARTE = {
  plan: { couche: "GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2", format: "image/png" },
  photo: { couche: "ORTHOIMAGERY.ORTHOPHOTOS", format: "image/jpeg" },
} as const;
export type FondDeCarte = keyof typeof FONDS_DE_CARTE;

export type Point = { lat: number; lon: number };

// Au-delà, la projection des tuiles n'est plus définie.
const LATITUDE_MAX = 85;

/**
 * Le champ GPS est un texte libre (« 48.99387, 1.71077 ») : le patron peut le
 * taper à la main quand le téléphone refuse sa position. On ne lit que ce qui
 * est sans ambiguïté ; le reste n'a pas de carte, plutôt qu'une carte fausse.
 */
export function lireLeGps(texte: string): Point | null {
  const m = texte.trim().match(/^(-?\d{1,2}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1].replace(",", "."));
  const lon = Number(m[2].replace(",", "."));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > LATITUDE_MAX || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

/** Cinq décimales : un mètre près, ce que le téléphone donne de mieux. */
export function ecrireLeGps(p: Point): string {
  return `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`;
}

/** La position du point en tuiles, à ce zoom (projection de Mercator, celle des tuiles « PM »). */
export function versTuile(p: Point, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom;
  const r = (p.lat * Math.PI) / 180;
  return { x: ((p.lon + 180) / 360) * n, y: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n };
}

export function versPoint(x: number, y: number, zoom: number): Point {
  const n = 2 ** zoom;
  return { lon: (x / n) * 360 - 180, lat: (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI };
}

/** Le point sous un appui, à (dx, dy) pixels du centre de la carte. */
export function pointSousLAppui(centre: Point, zoom: number, dx: number, dy: number): Point {
  const c = versTuile(centre, zoom);
  return versPoint(c.x + dx / TAILLE_D_UNE_TUILE, c.y + dy / TAILLE_D_UNE_TUILE, zoom);
}

export type TuilePosee = { x: number; y: number; gauche: number; haut: number };

/** Les tuiles qui couvrent une vue de cette taille, centrée sur le point, et où les poser. */
export function tuilesAutour(centre: Point, zoom: number, largeur: number, hauteur: number): TuilePosee[] {
  const c = versTuile(centre, zoom);
  const demiX = largeur / 2 / TAILLE_D_UNE_TUILE, demiY = hauteur / 2 / TAILLE_D_UNE_TUILE;
  const n = 2 ** zoom;
  const tuiles: TuilePosee[] = [];
  for (let x = Math.floor(c.x - demiX); x <= Math.floor(c.x + demiX); x++) {
    for (let y = Math.floor(c.y - demiY); y <= Math.floor(c.y + demiY); y++) {
      if (y < 0 || y >= n) continue;
      tuiles.push({
        x: ((x % n) + n) % n,
        y,
        gauche: Math.round((x - c.x) * TAILLE_D_UNE_TUILE + largeur / 2),
        haut: Math.round((y - c.y) * TAILLE_D_UNE_TUILE + hauteur / 2),
      });
    }
  }
  return tuiles;
}

/** Une tuile demandée à Atlas : bornée, pour que la route ne devienne pas un relais ouvert vers l'IGN. */
export function tuileDemandee(fond: string | null, z: string | null, x: string | null, y: string | null): { fond: FondDeCarte; z: number; x: number; y: number } | null {
  if (fond !== "plan" && fond !== "photo") return null;
  const nz = Number(z), nx = Number(x), ny = Number(y);
  if (![nz, nx, ny].every(Number.isInteger) || nz < ZOOM_MIN || nz > ZOOM_MAX) return null;
  const n = 2 ** nz;
  if (nx < 0 || ny < 0 || nx >= n || ny >= n) return null;
  return { fond, z: nz, x: nx, y: ny };
}

export function adresseDeLaTuile(fond: FondDeCarte, z: number, x: number, y: number): string {
  return `/api/carte/tuile?fond=${fond}&z=${z}&x=${x}&y=${y}`;
}
