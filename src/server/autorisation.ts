import { and, eq, sql } from "drizzle-orm";
import { auth } from "../auth";
import { db } from "./db/client";
import { withEntreprise } from "./db/with-entreprise";
import { membresEntreprise } from "./db/schema";
import type { Ctx } from "./repositories/context";

export class AccesRoleRefuseError extends Error {
  constructor(action: string) {
    super(`Action réservée au propriétaire de l'entreprise : ${action}.`);
    this.name = "AccesRoleRefuseError";
  }
}

// Relit le rôle actuel depuis la base à chaque appel (jamais mis en cache,
// jamais fait confiance depuis une donnée transmise par le client) — le rôle
// est scopé par entreprise : un même utilisateur peut être propriétaire d'une
// société et simple membre d'une autre. Passe par withEntreprise() pour fixer
// correctement le contexte RLS (app.entreprise_id) avant la lecture.
export async function getRole(ctx: Ctx): Promise<"proprietaire" | "membre" | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [membre] = await tx
      .select({ role: membresEntreprise.role })
      .from(membresEntreprise)
      .where(and(eq(membresEntreprise.utilisateurId, ctx.utilisateurId), eq(membresEntreprise.entrepriseId, ctx.entrepriseId)))
      .limit(1);
    return membre?.role ?? null;
  });
}

export async function estProprietaire(ctx: Ctx): Promise<boolean> {
  return (await getRole(ctx)) === "proprietaire";
}

// À appeler en tout début des Server Actions réservées au propriétaire
// (gestion des tarifs, suppression de données financières/catalogue,
// gestion des membres et paramètres de l'entreprise). Lève une erreur
// explicite plutôt que de laisser l'action se dérouler silencieusement.
export async function exigerProprietaire(ctx: Ctx, action: string): Promise<void> {
  if (!(await estProprietaire(ctx))) {
    throw new AccesRoleRefuseError(action);
  }
}

/**
 * La personne connectée est-elle propriétaire — question posée par le GABARIT.
 *
 * **Pourquoi elle n'appelle pas `getCurrentCtx`**, alors que ce serait plus
 * court. Deux raisons, et la première est un défaut évité de justesse :
 *
 * 1. `getCurrentCtx` peut appeler `redirect()` — session périmée, compte
 *    disparu —, ce qui lève une exception que Next.js reconnaît. Enveloppée
 *    dans le `try/catch` que le gabarit doit poser (un visiteur sans session ne
 *    doit pas faire tomber la page), cette redirection serait **avalée** : le
 *    cookie mort resterait dans le navigateur, et l'on retomberait dans le
 *    piège du 10 août 2026, une soirée perdue sur un cookie que rien n'effaçait.
 * 2. Le gabarit s'exécute à CHAQUE page. `getCurrentCtx` y ajouterait sa
 *    transaction et sa lecture de coupure des jetons, pour un bouton d'agrément.
 *
 * C'est le même parti que `lireCharte` (`charte-personne.ts`), et pour les mêmes
 * raisons : ce qui se lit au gabarit se lit court, et se tait en cas de doute.
 *
 * **Elle désigne la MÊME entreprise que les actions** — la première adhésion par
 * date de création, comme `resoudreEntrepriseId`. Deux règles divergentes
 * offriraient un bouton que l'action refuserait ensuite.
 *
 * **Ce n'est pas une barrière**, seulement de quoi ne pas offrir une porte
 * fermée : les actions relisent le rôle de leur côté.
 */
export async function personneConnecteeEstProprietaire(): Promise<boolean> {
  const session = await auth();
  const utilisateurId = session?.user?.id;
  if (!utilisateurId) return false;

  return db.transaction(async (tx) => {
    // La politique de bootstrap (migration 0012) autorise une personne à lire
    // SA propre adhésion dès lors que `app.utilisateur_id` est posé — c'est le
    // seul moyen de connaître son entreprise avant de connaître son entreprise.
    await tx.execute(sql`SELECT set_config('app.utilisateur_id', ${utilisateurId}, true)`);
    const [membre] = await tx
      .select({ role: membresEntreprise.role })
      .from(membresEntreprise)
      .where(eq(membresEntreprise.utilisateurId, utilisateurId))
      .orderBy(membresEntreprise.createdAt)
      .limit(1);
    return membre?.role === "proprietaire";
  });
}
