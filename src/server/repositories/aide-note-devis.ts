import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/client";
import { users } from "../db/schema";

/**
 * LA FENÊTRE « TA NOTE : TON CLIENT LA LIRA ICI », UNE SEULE FOIS PAR COMPTE —
 * sa décision du 4 novembre 2026 (migration 0163) : *« seulement pour le
 * premier devis de chaque utilisateur ; ensuite la fenêtre ne revient plus
 * jamais »*.
 *
 * **Pas de `withEntreprise`, pour la raison de `charte-personne.ts`** : `users`
 * est la table d'authentification, sans `entreprise_id` ni politique RLS. Ce
 * qui protège, c'est que l'identifiant vient de la SESSION (`ctx.utilisateurId`),
 * jamais de l'écran.
 */
export async function aideNoteDevisAMontrer(utilisateurId: string): Promise<boolean> {
  const [ligne] = await db
    .select({ vueLe: users.aideNoteDevisVueLe })
    .from(users)
    .where(eq(users.id, utilisateurId))
    .limit(1);
  // Un compte introuvable ne la voit pas : une aide n'a rien à montrer à
  // personne, et la montrer « par défaut » la ferait revenir à chaque fois.
  return ligne !== undefined && ligne.vueLe === null;
}

/**
 * Marquée au moment où elle se MONTRE, pas quand elle part : il peut quitter
 * l'écran pendant les huit secondes, elle compte quand même pour vue.
 *
 * **La première date reste** (`IS NULL`) : deux onglets ouverts ne la
 * réécrivent pas, et la date dit vraiment quand il l'a vue la première fois.
 */
export async function marquerAideNoteDevisVue(utilisateurId: string, quand: Date = new Date()): Promise<void> {
  await db
    .update(users)
    .set({ aideNoteDevisVueLe: quand })
    .where(and(eq(users.id, utilisateurId), isNull(users.aideNoteDevisVueLe)));
}
