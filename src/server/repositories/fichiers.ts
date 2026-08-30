import { eq, lt } from "drizzle-orm";
import { db } from "../db/client";
import { fichiersAPurger } from "../db/schema";
import { supprimerObjet } from "../storage";
import { RETENTION } from "../retention";

// Purge différée (délai de grâce) et idempotente. Supprime réellement l'objet
// du stockage local (voir server/storage/local-storage.ts) ; à la connexion
// d'un bucket réel, seule cette fonction sera à adapter.
//
// **Le délai vient de `RETENTION`, et il ne s'écrit plus ici** — lot de
// clôture, 29 août 2026. Ce fichier recopiait `24` en dur et n'importait même
// pas `retention.ts` : deux sources pour un seul chiffre, si bien que régler la
// constante ne changeait rien et que personne ne l'aurait vu. C'est la règle
// dupliquée que `CLAUDE.md` §3 interdit, sur une durée de conservation.
export async function purgerFichiersEnAttente(
  delaiHeures = RETENTION.fichiersOrphelinsHeures
): Promise<number> {
  const seuil = new Date(Date.now() - delaiHeures * 3600 * 1000);
  const aPurger = await db.select().from(fichiersAPurger).where(lt(fichiersAPurger.misEnFileLe, seuil));

  for (const f of aPurger) {
    await supprimerObjet(f.storageKey); // idempotent : une clé déjà absente n'est jamais une erreur
    await db.delete(fichiersAPurger).where(eq(fichiersAPurger.id, f.id));
  }

  return aPurger.length;
}
