import { communeDeNaissance, communesDeLaReponse, type CommuneTrouvee } from "@/lib/urssaf/branchement";

/**
 * LA COMMUNE DE NAISSANCE d'un client, cherchée dans le découpage
 * administratif de l'État (geo.api.gouv.fr), pour l'inscrire à l'avance
 * immédiate (lot 3) : l'Urssaf veut son code, il tape son nom.
 *
 * **Un service public, sans compte ni clé**, comme la Base Adresse Nationale
 * (`base-adresse-nationale.ts`), et pour les mêmes raisons : seuls un nom de
 * commune et un numéro de département partent, jamais le nom du client.
 *
 * **L'adresse est surchargeable** (`GEO_API_BASE`, ou l'argument) : les
 * contrôles font répondre un faux serveur, mal répondre, ou se taire.
 *
 * **Ce qu'elle ne sait pas** : les communes fusionnées ou disparues depuis la
 * naissance ne sont plus au découpage d'aujourd'hui. Elle rend alors `null`,
 * la feuille le dit, et rien ne se devine.
 */
const BASE_PAR_DEFAUT = "https://geo.api.gouv.fr";
const DELAI_MS = 4_000;

export type ResultatCommune = { ok: true; commune: CommuneTrouvee | null } | { ok: false; raison: "injoignable" };

export async function chercherCommuneDeNaissance(
  nom: string,
  departement: string,
  base: string = process.env.GEO_API_BASE || BASE_PAR_DEFAUT
): Promise<ResultatCommune> {
  const url = new URL("/communes", base);
  url.searchParams.set("nom", nom.trim());
  // Le département sans son zéro de tête : « 044 » s'écrit « 44 » à l'État.
  url.searchParams.set("codeDepartement", departement.replace(/^0(?=\d{2}$|2[AB]$)/, ""));
  url.searchParams.set("fields", "nom,code,codeDepartement");
  url.searchParams.set("limit", "20");
  try {
    const reponse = await fetch(url, { signal: AbortSignal.timeout(DELAI_MS), headers: { Accept: "application/json" } });
    if (!reponse.ok) {
      console.error("[communes] recherche refusée", { statut: reponse.status });
      return { ok: false, raison: "injoignable" };
    }
    return { ok: true, commune: communeDeNaissance(communesDeLaReponse(await reponse.json()), nom, departement) };
  } catch (erreur) {
    console.error("[communes] recherche injoignable", { erreur: String(erreur) });
    return { ok: false, raison: "injoignable" };
  }
}
