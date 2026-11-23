import { lireLeRegistre, type ReponseDuRegistre } from "@/lib/registre-entreprises";
import { logger } from "./logger";

/**
 * DEMANDER AU REGISTRE DES ENTREPRISES ce qu'il sait d'un SIRET (23 novembre
 * 2026, `src/lib/registre-entreprises.ts` pour ce qu'on en lit).
 *
 * **Un service public, sans compte ni clé**, comme la Base Adresse Nationale
 * (`adresses/base-adresse-nationale.ts`) : seul le SIRET part, et il est public.
 *
 * **L'adresse est surchargeable** (`REGISTRE_ENTREPRISES_BASE`, ou l'argument) :
 * les contrôles font répondre un faux serveur, mal répondre, ou se taire.
 *
 * **Injoignable n'est jamais inconnu.** Le registre qui ne répond pas ne dit
 * rien du numéro : l'inscription continue, et la confirmation se redemande au
 * prochain envoi (`reconfirmerLeSiret`).
 */
const BASE_PAR_DEFAUT = "https://recherche-entreprises.api.gouv.fr";
const DELAI_MS = 4_000;

export type VerdictDuRegistre = ReponseDuRegistre | { etat: "injoignable" };

export async function demanderAuRegistre(
  siret: string,
  base: string = process.env.REGISTRE_ENTREPRISES_BASE || BASE_PAR_DEFAUT
): Promise<VerdictDuRegistre> {
  const url = new URL("/search", base);
  url.searchParams.set("q", siret.replace(/\D/g, ""));
  url.searchParams.set("page", "1");
  url.searchParams.set("per_page", "1");
  try {
    const reponse = await fetch(url, { signal: AbortSignal.timeout(DELAI_MS), headers: { Accept: "application/json" } });
    if (!reponse.ok) {
      logger.warn("Registre des entreprises : demande refusée", { statut: reponse.status });
      return { etat: "injoignable" };
    }
    const lu = lireLeRegistre(await reponse.json(), siret);
    if (lu.etat === "illisible") logger.error("Registre des entreprises : réponse illisible, sa forme a peut-être changé");
    return lu;
  } catch (erreur) {
    logger.warn("Registre des entreprises injoignable", { erreur: String(erreur) });
    return { etat: "injoignable" };
  }
}
