import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { users } from "./db/schema";
import type { Ctx } from "./repositories/context";

/**
 * Qui est l'éditeur de l'application — c'est-à-dire le patron, et lui seul.
 *
 * **Ce que ça sert, dans ses mots** (7 août 2026) : *« est-ce que les
 * utilisateurs auront accès à cette page ? Moi c'est ça que je ne veux pas. Je
 * veux qu'il y ait mon application avec mon compte à moi, et ensuite un profil
 * entreprise — c'est ce profil-là qu'on va vendre. »*
 *
 * **Provisoire, et il faut le dire.** La vraie réponse est un système de rôles
 * à trois niveaux (éditeur / patron d'entreprise / salarié), consigné dans
 * `docs/QUESTIONS.md` §10 et remis à un lot suivant à sa demande : *« attends,
 * fais déjà tout le reste, on en reparle après. »*
 *
 * En attendant, une variable d'environnement nomme l'adresse e-mail de
 * l'éditeur. Ce n'est pas un rôle, c'est une serrure — mais elle tient : elle
 * est lue **côté serveur**, comparée à l'utilisateur réellement connecté, et
 * aucune page ni action ne s'ouvre sans elle.
 *
 * **Sans la variable, personne n'est éditeur.** Jamais l'inverse : une
 * installation qui ne dit rien ne doit pas ouvrir la page à tout le monde. Le
 * défaut de configuration doit refuser, pas accorder.
 */
export async function estEditeur(ctx: Ctx): Promise<boolean> {
  const attendu = (process.env.ATLAS_EDITEUR_EMAIL ?? "").trim().toLowerCase();
  if (!attendu) return false;

  // L'adresse est relue en base à chaque appel, jamais reprise d'une donnée
  // transmise par le navigateur — même règle que `getRole` pour les rôles
  // d'entreprise (`src/server/autorisation.ts`).
  const [utilisateur] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, ctx.utilisateurId))
    .limit(1);

  return (utilisateur?.email ?? "").trim().toLowerCase() === attendu;
}

export class AccesEditeurRefuseError extends Error {
  constructor(action: string) {
    super(`Action réservée à l'éditeur de l'application : ${action}.`);
    this.name = "AccesEditeurRefuseError";
  }
}

/** À appeler en tout début des actions réservées à l'éditeur. */
export async function exigerEditeur(ctx: Ctx, action: string): Promise<void> {
  if (!(await estEditeur(ctx))) {
    throw new AccesEditeurRefuseError(action);
  }
}
