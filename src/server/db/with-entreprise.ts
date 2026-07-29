import { and, eq, sql } from "drizzle-orm";
import { db, type DbOrTx } from "./client";
import { membresEntreprise } from "./schema";

// Cœur de la sécurité multi-entreprise (voir docs/ARCHITECTURE_DONNEES.md §7 et
// docs/ARCHITECTURE_DONNEES_v2.1_corrections.md, corrections 2, 3, 8).
//
// - Le contexte RLS est fixé via set_config(..., true) : portée strictement
//   limitée à la transaction courante (jamais à la connexion, qui est mutualisée).
// - L'adhésion de l'utilisateur à l'entreprise est revalidée à CHAQUE appel,
//   même si l'entrepriseId provient d'un JWT signé côté serveur — une adhésion
//   a pu être révoquée depuis l'émission du jeton.
// - Aucune fonction de repository ne doit appeler `db` directement : tout passe
//   par withEntreprise().

export class AccesRefuseError extends Error {
  constructor(utilisateurId: string, entrepriseId: string) {
    super(`Utilisateur ${utilisateurId} n'est pas membre de l'entreprise ${entrepriseId}.`);
    this.name = "AccesRefuseError";
  }
}

export async function withEntreprise<T>(
  utilisateurId: string,
  entrepriseId: string,
  fn: (tx: DbOrTx) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    // Contexte RLS — SET LOCAL n'accepte pas de paramètre lié côté protocole
    // Postgres ; set_config(), lui, est un appel de fonction normal, paramétrable.
    await tx.execute(sql`SELECT set_config('app.entreprise_id', ${entrepriseId}, true)`);

    const adhesion = await tx
      .select({ id: membresEntreprise.id })
      .from(membresEntreprise)
      .where(
        and(eq(membresEntreprise.utilisateurId, utilisateurId), eq(membresEntreprise.entrepriseId, entrepriseId))
      )
      .limit(1);

    if (adhesion.length === 0) {
      throw new AccesRefuseError(utilisateurId, entrepriseId);
    }

    return fn(tx);
  });
}
