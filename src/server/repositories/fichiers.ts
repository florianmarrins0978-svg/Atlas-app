import { eq, lt } from "drizzle-orm";
import { db } from "../db/client";
import { fichiersAPurger } from "../db/schema";
import { supprimerObjet } from "../storage";

// Purge différée (délai de grâce) et idempotente. Supprime réellement l'objet
// du stockage local (voir server/storage/local-storage.ts) ; à la connexion
// d'un bucket réel, seule cette fonction sera à adapter.
export async function purgerFichiersEnAttente(delaiHeures = 24): Promise<number> {
  const seuil = new Date(Date.now() - delaiHeures * 3600 * 1000);
  const aPurger = await db.select().from(fichiersAPurger).where(lt(fichiersAPurger.misEnFileLe, seuil));

  for (const f of aPurger) {
    await supprimerObjet(f.storageKey); // idempotent : une clé déjà absente n'est jamais une erreur
    await db.delete(fichiersAPurger).where(eq(fichiersAPurger.id, f.id));
  }

  return aPurger.length;
}
