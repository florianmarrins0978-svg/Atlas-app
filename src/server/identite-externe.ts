import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { users } from "./db/schema";

/**
 * LE COMPTE ATLAS DERRIÈRE UNE ADRESSE PROUVÉE PAR GOOGLE OU APPLE.
 *
 * **L'adresse doit DÉJÀ avoir été prouvée** — c'est le travail de
 * `emailProuve` (`src/lib/fournisseurs-connexion.ts`), et il ne se refait pas
 * ici : deux rédactions de la même vérification divergeraient, et la
 * divergence s'appellerait « entré sans adresse vérifiée » (`CLAUDE.md` §3).
 * Cette fonction ne fait qu'une chose : chercher.
 *
 * **Aucune création.** Une adresse inconnue rend `null`, et l'aiguillage se
 * décide chez l'appelant (`src/auth.ts`). Créer un compte ici donnerait un
 * Atlas sans entreprise ni TVA.
 *
 * **Hors `withEntreprise`, et c'est le même cas que la connexion par mot de
 * passe** : à cet instant, aucune entreprise n'est connue — c'est justement ce
 * qu'on cherche à établir. `users` n'est pas soumise à la politique
 * d'isolation par entreprise ; toute lecture qui l'est passe par
 * `withEntreprise`, une fois l'identité posée.
 */
export async function identifiantPourEmailProuve(email: string): Promise<string | null> {
  const propre = email.trim().toLowerCase();
  if (!propre) return null;

  const [compte] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, propre))
    .limit(1);

  return compte?.id ?? null;
}
