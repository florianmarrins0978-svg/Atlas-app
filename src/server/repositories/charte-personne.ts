import { eq } from "drizzle-orm";
import { auth } from "../../auth";
import { db } from "../db/client";
import { users } from "../db/schema";
import { normaliserCharte, type NomCharte } from "../../lib/chartes";

/**
 * La charte de couleurs de la personne connectée.
 *
 * **Pas de `withEntreprise`, pour la même raison que `compte.ts`** : `users`
 * est la table d'authentification, elle ne porte pas d'`entreprise_id` et
 * aucune politique RLS ne s'y applique. Ce qui protège, c'est que la requête
 * est bornée par l'identifiant de la SESSION — jamais par un identifiant venu
 * de l'écran.
 *
 * **Appelée par le gabarit, donc à CHAQUE page.** D'où une seule colonne
 * sélectionnée, et un repli silencieux : une couleur est un agrément, elle ne
 * doit jamais empêcher un écran de s'afficher.
 */
export async function lireCharte(): Promise<NomCharte | null> {
  const session = await auth();
  const utilisateurId = session?.user?.id;
  if (!utilisateurId) return null;
  return charteDeLaPersonne(utilisateurId);
}

/**
 * La charte d'une personne déjà identifiée par le serveur (`ctx.utilisateurId`,
 * tiré de sa session par `getCurrentCtx`, jamais de l'écran).
 *
 * **Pourquoi elle existe à part** : `contextePlanning` reçoit la personne en
 * paramètre et sert aussi hors d'une requête (les suites, un cron). Y relire la
 * session par `auth()` le faisait tomber sur « `headers` was called outside a
 * request scope » (`test-planning-portee-db`, 29 septembre 2026) : une
 * fonction qui connaît déjà la personne ne va pas la redemander au navigateur.
 */
export async function charteDeLaPersonne(utilisateurId: string): Promise<NomCharte | null> {
  const [ligne] = await db
    .select({ charte: users.charte })
    .from(users)
    .where(eq(users.id, utilisateurId))
    .limit(1);
  return normaliserCharte(ligne?.charte);
}

/** Écrit le choix. Un nom inconnu efface le réglage plutôt que de s'inscrire. */
export async function ecrireCharte(utilisateurId: string, nom: string | null): Promise<NomCharte | null> {
  const propre = normaliserCharte(nom);
  await db.update(users).set({ charte: propre, updatedAt: new Date() }).where(eq(users.id, utilisateurId));
  return propre;
}
