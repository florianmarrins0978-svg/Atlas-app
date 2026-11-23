import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/client";
import { users } from "../db/schema";

/**
 * LA CARTE « LA VISITE GUIDÉE » DE L'ACCUEIL, UNE SEULE FOIS PAR COMPTE — sa
 * décision du 23 novembre 2026 (migration 0194) : *« une seule fois au premier
 * accueil ; et qu'il puisse, s'il ne veut pas la faire, enlever le bouton »*.
 *
 * **Pas de `withEntreprise`, pour la raison de `aide-note-devis.ts`** : `users`
 * est la table d'authentification, sans `entreprise_id` ni politique RLS. Ce
 * qui protège, c'est que l'identifiant vient de la SESSION, jamais de l'écran.
 */
export async function carteVisiteAMontrer(utilisateurId: string): Promise<boolean> {
  const [ligne] = await db
    .select({ vueLe: users.visiteGuideeVueLe })
    .from(users)
    .where(eq(users.id, utilisateurId))
    .limit(1);
  // Un compte introuvable ne la voit pas : la montrer « par défaut » la ferait
  // revenir à chaque fois.
  return ligne !== undefined && ligne.vueLe === null;
}

/**
 * Marquée quand il la SUIT (« Faire la visite ») ou la REFUSE (« Non merci ») :
 * les deux veulent dire « ne plus la proposer ». Montrée sans geste, elle reste,
 * puisqu'il ne l'a peut-être pas vue.
 *
 * **La première date reste** (`IS NULL`) : deux onglets ne la réécrivent pas.
 */
export async function marquerCarteVisiteVue(utilisateurId: string, quand: Date = new Date()): Promise<void> {
  await db
    .update(users)
    .set({ visiteGuideeVueLe: quand })
    .where(and(eq(users.id, utilisateurId), isNull(users.visiteGuideeVueLe)));
}
