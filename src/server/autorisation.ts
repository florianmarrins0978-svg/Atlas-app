import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { withEntreprise } from "./db/with-entreprise";
import { membresEntreprise } from "./db/schema";
import type { Ctx } from "./repositories/context";
import { cheminAutorise, type PorteePlanning, type Role } from "@/lib/acces-roles";

export class AccesRoleRefuseError extends Error {
  constructor(action: string) {
    super(`Action réservée au propriétaire de l'entreprise : ${action}.`);
    this.name = "AccesRoleRefuseError";
  }
}

/**
 * Ce qu'un compte peut, dans CETTE entreprise.
 *
 * Le rôle, ce qu'il voit du planning, et la file du planning qu'il tient. Les
 * trois se lisent d'un coup parce qu'ils viennent de la même ligne : les
 * chercher séparément, c'est trois allers-retours pour une seule vérité.
 */
export type AccesPersonne = {
  role: Role;
  porteePlanning: PorteePlanning;
  /** La file du planning rattachée. NULL est l'état normal (`schema.ts`). */
  equipeId: string | null;
};

/**
 * Relit les droits actuels depuis la base à CHAQUE requête.
 *
 * **Jamais retenu d'une requête à l'autre, jamais lu d'une donnée transmise par
 * le navigateur.** Un rôle a pu être retiré depuis que le jeton a été signé —
 * c'est même le geste qu'on attend d'un patron dont un salarié est parti le
 * matin même. Et le rôle est scopé par entreprise : un même compte peut être
 * patron d'une société et salarié d'une autre.
 *
 * Passe par `withEntreprise()` : sans le contexte RLS, cette lecture ne rendrait
 * rien — silencieusement (`CLAUDE.md` §3).
 *
 * **`cache()` de React : une seule lecture par REQUÊTE, jamais entre deux.** Un
 * même écran la pose trois fois — la garde d'accès, la barre du bas, la page
 * elle-même —, et sans cela chacune ouvrirait sa transaction. La mémoire de
 * `cache()` meurt avec la requête : le rôle reste donc relu à chaque requête,
 * ce qui est exactement la promesse ci-dessus. **Ne pas remplacer par une
 * mémoire qui survivrait** — un accès retiré ce matin doit fermer la porte à la
 * requête suivante, pas au prochain redémarrage.
 */
const lireAcces = cache(async function lireAcces(
  utilisateurId: string,
  entrepriseId: string
): Promise<AccesPersonne | null> {
  return withEntreprise(utilisateurId, entrepriseId, async (tx) => {
    const [membre] = await tx
      .select({
        role: membresEntreprise.role,
        porteePlanning: membresEntreprise.porteePlanning,
        equipeId: membresEntreprise.equipeId,
      })
      .from(membresEntreprise)
      .where(
        and(
          eq(membresEntreprise.utilisateurId, utilisateurId),
          eq(membresEntreprise.entrepriseId, entrepriseId)
        )
      )
      .limit(1);
    return membre ?? null;
  });
});

export async function accesDeLaPersonne(ctx: Ctx): Promise<AccesPersonne | null> {
  // **Deux chaînes, jamais l'objet.** `cache()` de React compare ses arguments
  // par IDENTITÉ : `getCurrentCtx` rend un objet neuf à chaque appel, si bien
  // qu'un `cache()` posé sur `ctx` n'aurait JAMAIS servi — une optimisation qui
  // n'optimise rien, et que rien n'aurait signalé.
  return lireAcces(ctx.utilisateurId, ctx.entrepriseId);
}

export async function getRole(ctx: Ctx): Promise<Role | null> {
  return (await accesDeLaPersonne(ctx))?.role ?? null;
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
 * **Ce compte a-t-il le droit d'ouvrir cette adresse ?** — la question que
 * `GardeAcces` pose à chaque écran, et que les routes d'API posent aussi.
 *
 * Un rôle absent (adhésion retirée entre deux requêtes) répond NON. Ne rien
 * décider dans ce cas serait ouvrir l'application à un compte qu'on vient
 * précisément de fermer.
 */
export async function peutOuvrir(ctx: Ctx, chemin: string): Promise<boolean> {
  const acces = await accesDeLaPersonne(ctx);
  if (!acces) return false;
  return cheminAutorise(acces.role, chemin);
}

/**
 * Le rôle de la session courante — ou `null` si la question n'a pas de sens ici
 * (visiteur sans compte, page publique, script hors requête).
 *
 * **Ne lève jamais.** Il sert à DESSINER : la barre du bas, le sommaire. Une
 * exception y ferait tomber l'écran entier pour un onglet. Ce qui REFUSE, c'est
 * `GardeAcces` et `exigerOuverture` — et eux ne se contentent pas d'un `null`.
 *
 * **Sauf une redirection**, qui n'est pas une panne : `getCurrentCtx` renvoie à
 * `/api/session-perimee` quand le compte a disparu, et `redirect()` lève par
 * conception. L'avaler laisserait le cookie mort dans le navigateur — le piège
 * du 10 août 2026.
 */
export async function roleDeLaSession(): Promise<Role | null> {
  try {
    const { getCurrentCtx } = await import("./session-ctx");
    return await getRole(await getCurrentCtx());
  } catch (err) {
    if (typeof (err as { digest?: unknown })?.digest === "string") throw err;
    return null;
  }
}
