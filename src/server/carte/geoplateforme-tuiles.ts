import { FONDS_DE_CARTE, ZOOM_PAR_DEFAUT, lireLeGps, tuilesAutour, type FondDeCarte } from "@/lib/carte-du-point";

/**
 * Une tuile de carte, demandée à la Géoplateforme de l'IGN par Atlas — jamais
 * par le téléphone.
 *
 * **Pourquoi ce détour.** La politique de sécurité des pages n'admet que nos
 * propres images (`next.config.ts`, `img-src 'self'`), et le PDF de la fiche
 * doit pouvoir poser la même carte : les deux passent donc par ici. Même choix
 * que le temps de route (`src/server/itineraire/geoplateforme.ts`) : un service
 * public, sans compte ni clé, et rien d'autre ne part qu'un numéro de tuile.
 */
const BASE_PAR_DEFAUT = "https://data.geopf.fr";

/** Une carte qui tarde ne doit pas retenir l'écran ni le PDF. */
const DELAI_MS = 6_000;

export async function lireUneTuile(
  fond: FondDeCarte,
  z: number,
  x: number,
  y: number,
  base: string = process.env.CARTE_BASE_URL || BASE_PAR_DEFAUT
): Promise<{ octets: Uint8Array; mime: string } | null> {
  const { couche, format } = FONDS_DE_CARTE[fond];
  const url = new URL("/wmts", base);
  url.search = new URLSearchParams({
    SERVICE: "WMTS",
    REQUEST: "GetTile",
    VERSION: "1.0.0",
    STYLE: "normal",
    TILEMATRIXSET: "PM",
    LAYER: couche,
    FORMAT: format,
    TILEMATRIX: String(z),
    TILECOL: String(x),
    TILEROW: String(y),
  }).toString();
  try {
    const reponse = await fetch(url, { signal: AbortSignal.timeout(DELAI_MS) });
    const mime = reponse.headers.get("content-type")?.split(";")[0].trim() ?? "";
    if (!reponse.ok || (mime !== "image/png" && mime !== "image/jpeg")) {
      console.error("[carte] tuile refusée", { fond, z, x, y, statut: reponse.status, mime });
      return null;
    }
    return { octets: new Uint8Array(await reponse.arrayBuffer()), mime };
  } catch (erreur) {
    console.error("[carte] tuile injoignable", { fond, z, x, y, erreur: String(erreur) });
    return null;
  }
}

/** La carte imprimée : des tuiles posées en pixels sur une vue de cette taille, le point en son centre. */
export type CarteImprimee = { largeur: number; hauteur: number; tuiles: { gauche: number; haut: number; octets: Uint8Array; mime: string }[] };

const VUE_IMPRIMEE = { largeur: 640, hauteur: 250 };

/**
 * La carte du point pour le PDF, au plan IGN : c'est elle que lisent les
 * secours. `null` sans point lisible ; une tuile manquante laisse un trou, et
 * aucune tuile du tout rend `null` : le PDF le dit plutôt qu'un cadre vide.
 */
export async function carteDuPointImprimee(gps: string): Promise<CarteImprimee | null> {
  const point = lireLeGps(gps);
  if (!point) return null;
  const posees = tuilesAutour(point, ZOOM_PAR_DEFAUT, VUE_IMPRIMEE.largeur, VUE_IMPRIMEE.hauteur);
  const lues = await Promise.all(posees.map(async (p) => ({ p, tuile: await lireUneTuile("plan", ZOOM_PAR_DEFAUT, p.x, p.y) })));
  const tuiles = lues.flatMap(({ p, tuile }) => (tuile ? [{ gauche: p.gauche, haut: p.haut, ...tuile }] : []));
  return tuiles.length ? { ...VUE_IMPRIMEE, tuiles } : null;
}
