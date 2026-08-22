/**
 * Le temps de route entre deux chantiers, demandé au service de l'État.
 *
 * **Pourquoi celui-ci et pas un autre.** Le raisonnement est le même que pour
 * les adresses (`src/server/adresses/base-adresse-nationale.ts`) : un service
 * privé — Google, Mapbox — demanderait un compte, une clé, et deviendrait un
 * **sous-traitant ultérieur** de plus à nommer dans un contrat qui n'existe pas
 * encore (`docs/A-FAIRE.md` points 1 et 2). La Géoplateforme de l'IGN est un
 * service public français, sans compte ni clé.
 *
 * **Et ce n'est pas une supposition : ça a été mesuré.** Le 16 août 2026,
 * `.github/workflows/itineraire.yml` a joué `scripts/eprouver-itineraire-ign.ts`
 * sur une machine qui a le réseau — l'environnement de développement, lui, ne
 * peut joindre aucun service extérieur. Ce qu'il a rapporté, et qui a décidé du
 * reste :
 *
 *   · le service répond **200 sans clé ni compte** ;
 *   · l'écart entre le vol d'oiseau et la route va de **×1,33 à ×1,56** sur les
 *     monts du Lyonnais — c'est-à-dire qu'à vol d'oiseau on se trompe d'un tiers
 *     à la moitié, et que le classement lui-même peut en être inversé ;
 *   · dix appels d'affilée passent en **1858 ms**, tous en 200, 186 ms de
 *     moyenne ;
 *   · **aucun en-tête n'annonce de limite d'usage.** Dix appels ne prouvent pas
 *     qu'il en supporte mille : c'est pourquoi `appariement-demi-journees.ts`
 *     n'en fait partir que trois par proposition.
 *
 * **CE QUI PART D'ICI, ET RIEN D'AUTRE : deux paires de nombres.** Pas de nom
 * de client, pas d'adresse en clair, pas d'identifiant de chantier. Des
 * coordonnées ne se remontent pas à une personne sans le fichier qui va avec, et
 * ce fichier ne quitte jamais Atlas. C'est ce qui rend cette fonction acceptable
 * avant que le contrat de sous-traitance existe.
 */

const BASE_PAR_DEFAUT = "https://data.geopf.fr";

/**
 * Au-delà, on renonce.
 *
 * Six secondes : trente fois la réponse mesurée (186 ms), et bien en deçà de ce
 * qu'un écran peut faire attendre. **Le trajet n'est jamais indispensable** — le
 * vol d'oiseau a déjà classé les candidats. Mieux vaut afficher « à 8 km à vol
 * d'oiseau » tout de suite qu'une page blanche pendant vingt secondes.
 */
const DELAI_MS = 6_000;

export type Trajet = { km: number; minutes: number };

export type ResultatItineraire =
  | { ok: true; trajet: Trajet }
  | { ok: false; raison: "injoignable" | "refuse" | "illisible" | "sans-route" };

type Point = { latitude: number; longitude: number };

/**
 * Le trajet en voiture entre deux points, ou la raison de son absence.
 *
 * **Cette fonction ne lève jamais.** Un service extérieur qui tombe ne doit pas
 * emporter l'écran du planning avec lui : l'appelant retombe sur le vol
 * d'oiseau, qui est calculé chez nous et ne dépend de personne.
 *
 * @param base Adresse du service — surchargeable pour que les contrôles
 *   puissent la faire répondre, mal répondre, et ne pas répondre du tout. Sans
 *   cela, aucun de ces trois cas ne serait jamais éprouvé ici (`AGENTS.md`).
 */
export async function trajetVoiture(
  depart: Point,
  arrivee: Point,
  base: string = process.env.ITINERAIRE_BASE_URL || BASE_PAR_DEFAUT
): Promise<ResultatItineraire> {
  const url = new URL("/navigation/itineraire", base);
  url.searchParams.set("resource", "bdtopo-osrm");
  url.searchParams.set("profile", "car");
  url.searchParams.set("optimization", "fastest");
  // **Longitude d'abord.** C'est l'ordre du service, l'inverse de celui qu'on
  // dit à voix haute. Inversées, deux chantiers du Rhône se retrouvent au large
  // de la Somalie et le service répond « pas de route » sans qu'on comprenne
  // pourquoi.
  url.searchParams.set("start", `${depart.longitude},${depart.latitude}`);
  url.searchParams.set("end", `${arrivee.longitude},${arrivee.latitude}`);
  // Sans ces deux-là, le service rend des mètres et des secondes : les demander
  // explicitement évite une conversion silencieuse le jour où il change d'avis.
  url.searchParams.set("distanceUnit", "kilometer");
  url.searchParams.set("timeUnit", "minute");
  // La géométrie du tracé pèse des dizaines de kilo-octets et ne sert à rien :
  // on n'affiche pas de carte, seulement « à 12 km, 20 min de route ».
  url.searchParams.set("getSteps", "false");

  let reponse: Response;
  try {
    reponse = await fetch(url, {
      signal: AbortSignal.timeout(DELAI_MS),
      headers: { Accept: "application/json" },
    });
  } catch {
    return { ok: false, raison: "injoignable" };
  }

  if (!reponse.ok) return { ok: false, raison: "refuse" };

  let charge: unknown;
  try {
    charge = await reponse.json();
  } catch {
    return { ok: false, raison: "illisible" };
  }

  return lireTrajet(charge);
}

/**
 * Ce que le service a répondu, converti en deux nombres — ou rien.
 *
 * Séparée de l'appel **pour être éprouvable sans réseau**, et parce que c'est
 * ici que se cache le vrai risque : un service qui répond 200 avec un corps
 * qu'on ne reconnaît pas. Rendre `NaN` plutôt que « inconnu » ferait afficher
 * « à NaN min de route » — et le patron aurait raison de ne plus rien croire de
 * cet écran.
 */
export function lireTrajet(charge: unknown): ResultatItineraire {
  if (charge === null || typeof charge !== "object") return { ok: false, raison: "illisible" };
  const objet = charge as Record<string, unknown>;

  const nombre = (x: unknown): number | null => {
    const n = typeof x === "number" ? x : typeof x === "string" ? Number(x) : NaN;
    return Number.isFinite(n) ? n : null;
  };

  const km = nombre(objet.distance);
  const minutes = nombre(objet.duration);
  if (km === null || minutes === null) return { ok: false, raison: "illisible" };

  // Un trajet nul ou négatif n'existe pas. Le service le rend quand aucune route
  // ne relie les deux points — une île, un point tombé dans un lac — et une
  // proposition « à 0 min de route » serait plus trompeuse que pas de
  // proposition du tout.
  if (km < 0 || minutes <= 0) return { ok: false, raison: "sans-route" };

  return { ok: true, trajet: { km, minutes } };
}
