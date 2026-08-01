import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { documentsAAccepter } from "@/server/repositories/documents-legaux";
import { logger } from "@/server/logger";

// Garde d'accès : tant qu'un document dont l'acceptation est requise n'a pas
// été accepté, l'application n'est pas utilisable (voir docs/RGPD.md §8).
//
// Sans cette garde, l'acceptation serait facultative — et une acceptation
// facultative ne vaut rien : elle ne prouve pas que l'artisan a pris
// connaissance du contrat, seulement qu'il aurait pu.
//
// Placée dans le layout racine plutôt que dans un middleware : la vérification
// interroge la base, ce que le middleware (exécuté en amont, sur un runtime
// restreint) ne doit pas faire.

// Chemins où la garde ne s'applique pas, sous peine de boucle de redirection
// ou de blocage de la connexion elle-même.
const CHEMINS_EXEMPTS = ["/login", "/documents-legaux", "/api"];

export default async function GardeDocumentsLegaux() {
  const entetes = await headers();
  const chemin = entetes.get("x-atlas-pathname");

  // En-tête absent : rendu hors requête HTTP normale (génération statique,
  // outillage). On ne bloque pas — la garde n'a rien à protéger dans ce cas.
  if (!chemin) return null;
  if (CHEMINS_EXEMPTS.some((p) => chemin === p || chemin.startsWith(`${p}/`))) return null;

  const session = await auth();
  const utilisateurId = session?.user?.id;
  // Pas de session : le middleware a déjà redirigé vers /login. Rien à faire.
  if (!utilisateurId) return null;

  let enAttente;
  try {
    enAttente = await documentsAAccepter(utilisateurId);
  } catch (err) {
    // Fail-closed serait ici pire que fail-open : une base indisponible
    // renverrait tous les artisans vers un écran d'acceptation qui ne
    // fonctionnerait pas davantage. On journalise et on laisse passer — la
    // page demandée échouera d'elle-même si elle a besoin de la base.
    logger.error("Vérification des documents légaux impossible", {
      utilisateurId,
      erreur: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  if (enAttente.length > 0) redirect("/documents-legaux");
  return null;
}
