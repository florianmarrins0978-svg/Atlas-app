import { etatConstructionBanc } from "@/server/etat-banc";

// L'avancement de la construction, en JSON, pour le bandeau de l'écran.
//
// **Pourquoi une adresse de plus, à côté de `/api/health/banc`.** Celle-ci rend
// une page HTML, faite pour être LUE par le patron quand plus rien ne s'ouvre.
// Celle-là est interrogée toutes les cinq secondes par un bandeau : elle doit
// être minuscule et sans mise en forme.
//
// Sous `/api/health/` à dessein : le `matcher` du proxy laisse ce préfixe passer
// sans session. Le bandeau s'affiche aussi sur l'écran de connexion — c'est même
// là qu'il sert le plus, puisque c'est le premier écran, celui qui compile tout.
//
// **Elle n'expose aucune donnée d'entreprise** : deux compteurs et un chemin
// d'écran. Et elle ne répond rien du tout hors banc d'essai (`null`), ce qui
// éteint le bandeau partout ailleurs sans qu'aucun écran ait à le savoir.

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(etatConstructionBanc(), {
    headers: { "cache-control": "no-store" },
  });
}
