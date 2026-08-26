import { and, eq, sql } from "drizzle-orm";
import { accueilDuRole, estRole } from "@/lib/acces-roles";
import { db } from "./db/client";
import { clesAppareil, membresEntreprise, users } from "./db/schema";

/**
 * OÙ L'ON ENTRE, UNE FOIS CONNECTÉ — et ce n'est pas le même écran pour tous.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **CE QUE CE FICHIER RÉPARE, ET IL NE SE VOYAIT QU'À L'ŒIL.**
 *
 * Jusqu'au 25 août 2026, la connexion renvoyait tout le monde sur `/`. Pour un
 * salarié, cet écran n'existe pas : la garde de rôle le renvoyait aussitôt vers
 * son planning — un SECOND renvoi, enchaîné à l'intérieur de la réponse d'une
 * action serveur. Next.js rend alors sa page « 404 » à l'adresse d'arrivée :
 * l'URL affichait bien `/planning`, et le salarié voyait un écran **BLANC**.
 *
 * Un rechargement réparait — ce que personne n'a de raison de tenter à sa
 * première connexion, et surtout pas un salarié à qui son patron vient de dire
 * « c'est bon, tu peux te connecter ».
 *
 * **Aucun contrôle ne le voyait**, et c'est cela qui compte : la suite
 * navigateur attendait l'adresse `/planning`, qui était juste. C'est en
 * REGARDANT la page — 9 540 octets contre 61 208, zéro onglet — que le défaut
 * est sorti. Le quatrième de ce dépôt trouvé sur une image et par aucun
 * contrôle vert (`CLAUDE.md` §5).
 *
 * **La correction ne rattrape pas le second renvoi : elle fait qu'il n'y en a
 * plus.** On envoie chacun là où son rôle a le droit d'être. Mesuré après
 * coup : 59 424 octets et deux onglets, au lieu d'un écran blanc.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **POURQUOI LE RÔLE NE SE LIT PAS PAR LA SESSION, ICI.**
 *
 * C'est le piège de ce fichier, et la première correction est tombée dedans :
 * `signIn(..., {redirect:false})` pose le cookie sur la réponse qui PART.
 * `auth()`, lui, lit les cookies de la requête ARRIVÉE — celle d'avant la
 * connexion. Appelé dans la foulée, il ne voit donc aucune session, rend `null`,
 * et l'on retombe sur `/` : le correctif compile, se déploie, et ne change
 * strictement rien. Il a fallu le mesurer pour s'en apercevoir.
 *
 * On repart donc de ce qu'on a en main — l'adresse saisie, ou la clé
 * d'appareil —, jamais de la session.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **CE QUE CES FONCTIONS NE SONT PAS : une autorisation.**
 *
 * Elles choisissent une DESTINATION, elles n'ouvrent rien. Ce qui refuse reste
 * `GardeAcces` et `exigerOuverture`, sur la requête suivante. Une valeur
 * inattendue ne peut donc rien donner de plus qu'un écran que le rôle aurait de
 * toute façon eu le droit d'ouvrir — d'où le repli sur `/`, qui est gardé comme
 * les autres.
 */

/** Le rôle d'un compte, lu sans passer par la session. `null` si rien n'est sûr. */
async function accueilPourUtilisateur(utilisateurId: string | undefined): Promise<string> {
  if (!utilisateurId) return "/";

  return db.transaction(async (tx) => {
    // La politique d'isolation de `membres_entreprise` exige un contexte. Ici
    // c'est celui du BOOTSTRAP — `app.utilisateur_id`, jamais `app.entreprise_id`,
    // qu'on ne connaît pas encore — exactement comme `getCurrentCtx`
    // (migration 0012). Sans lui, la lecture ne rendrait rien, silencieusement.
    await tx.execute(sql`SELECT set_config('app.utilisateur_id', ${utilisateurId}, true)`);

    const [membre] = await tx
      .select({ role: membresEntreprise.role })
      .from(membresEntreprise)
      .where(eq(membresEntreprise.utilisateurId, utilisateurId))
      // La même adhésion que celle que `getCurrentCtx` retiendra : la plus
      // ancienne. En prendre une autre enverrait vers l'accueil d'une entreprise
      // dans laquelle la session ne sera pas.
      .orderBy(membresEntreprise.createdAt)
      .limit(1);

    return membre && estRole(membre.role) ? accueilDuRole(membre.role) : "/";
  });
}

/** Après une connexion par mot de passe : l'adresse saisie suffit à savoir. */
export async function accueilPourEmail(email: string): Promise<string> {
  const propre = email.trim().toLowerCase();
  if (!propre) return "/";
  const [compte] = await db.select({ id: users.id }).from(users).where(eq(users.email, propre)).limit(1);
  return accueilPourUtilisateur(compte?.id);
}

/**
 * Après une connexion par « Ouvrir avec Face ID ».
 *
 * **La clé n'est PAS revérifiée ici, et elle n'a pas à l'être** : `signIn` vient
 * de le faire, signature comprise (`ouvrirAvecCle`). Ce qu'on cherche est le
 * propriétaire de la clé, pour savoir où l'envoyer. Un identifiant inventé ne
 * trouve aucune ligne et retombe sur `/`.
 */
export async function accueilPourCleAppareil(identifiantCle: string): Promise<string> {
  if (!identifiantCle) return "/";
  const [cle] = await db
    .select({ utilisateurId: clesAppareil.utilisateurId })
    .from(clesAppareil)
    .where(and(eq(clesAppareil.identifiantCle, identifiantCle)))
    .limit(1);
  return accueilPourUtilisateur(cle?.utilisateurId);
}
