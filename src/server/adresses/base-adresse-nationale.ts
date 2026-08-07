import { lireSuggestions, meriteUneRecherche, MAX_SUGGESTIONS, type SuggestionAdresse } from "@/lib/suggestions-adresse";

/**
 * L'annuaire des adresses françaises, interrogé par Atlas — jamais par le
 * téléphone du patron.
 *
 * **Pourquoi ce détour par notre propre serveur.** Le patron voulait la
 * commodité qu'il connaît ailleurs : « on commence à taper l'adresse et il nous
 * propose tout un tas de listes ». Le faire depuis le navigateur aurait été plus
 * court d'un fichier — et faux pour deux raisons :
 *
 *   1. la politique de sécurité de l'application interdit au navigateur de
 *      joindre un hôte extérieur (`next.config.ts`, `connect-src 'self'`). Ce
 *      n'est pas une gêne à contourner : c'est ce qui garantit qu'aucun écran ne
 *      peut envoyer quoi que ce soit ailleurs sans qu'on l'ait décidé ;
 *   2. l'adresse d'un client est une donnée de client. Elle passe par un seul
 *      endroit, qu'on peut lire, limiter et couper — pas par autant de
 *      navigateurs qu'il y a d'utilisateurs.
 *
 * **Pourquoi la base de l'État plutôt que celle de Google.** Google demanderait
 * un compte de facturation, une clé, et deviendrait un **sous-traitant** de plus
 * à nommer dans les documents du patron — c'est précisément le contrat qui le
 * bloque aujourd'hui (`docs/A-FAIRE.md` point 2). La Base Adresse Nationale est
 * un service public français, sans compte ni clé, et ce qu'on lui envoie se
 * limite à une rue : jamais le nom du client, jamais le chantier.
 */
export type ResultatRechercheAdresse =
  | { ok: true; suggestions: SuggestionAdresse[] }
  | { ok: false; raison: "trop-court" | "injoignable" | "refuse" };

/** Au-delà, l'aide devient une gêne : on rend la main et le champ reste libre. */
const DELAI_MS = 4_000;

const BASE_PAR_DEFAUT = "https://api-adresse.data.gouv.fr";

/**
 * @param base Adresse du service — surchargeable pour que les contrôles
 *   puissent la faire répondre, mal répondre, et ne pas répondre du tout. Sans
 *   cela, aucun de ces trois cas ne serait jamais éprouvé ici (`AGENTS.md`).
 */
export async function chercherAdresses(
  saisie: string,
  base: string = process.env.ADRESSE_BASE_URL || BASE_PAR_DEFAUT
): Promise<ResultatRechercheAdresse> {
  if (!meriteUneRecherche(saisie)) return { ok: false, raison: "trop-court" };

  const url = new URL("/search/", base);
  url.searchParams.set("q", saisie.trim());
  url.searchParams.set("limit", String(MAX_SUGGESTIONS));
  // `autocomplete=1` est le mode fait pour la frappe en cours : il complète le
  // dernier mot au lieu d'exiger qu'il soit terminé.
  url.searchParams.set("autocomplete", "1");

  try {
    const reponse = await fetch(url, {
      signal: AbortSignal.timeout(DELAI_MS),
      headers: { Accept: "application/json" },
    });
    if (!reponse.ok) return { ok: false, raison: "refuse" };
    return { ok: true, suggestions: lireSuggestions(await reponse.json()) };
  } catch {
    // Réseau coupé, délai dépassé, réponse illisible : dans tous les cas le
    // champ redevient un champ ordinaire. L'aide s'efface, la saisie continue.
    return { ok: false, raison: "injoignable" };
  }
}
