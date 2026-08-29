import { peutVoirLesMontants } from "@/lib/acces-roles";
import { getRole } from "./autorisation";
import type { Ctx } from "./repositories/context";

/**
 * LA GARDE DES SERVER ACTIONS — celles que `GardeAcces` ne peut pas voir.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **POURQUOI ELLE EXISTE, ET CE QUI ÉTAIT OUVERT SANS ELLE.**
 *
 * Constat de l'audit final, 29 août 2026, trouvé **deux fois
 * indépendamment** — ce qui est la meilleure raison de le croire.
 *
 * `GardeAcces` est un composant de `layout.tsx` : il ne s'exécute qu'au
 * **rendu** d'un écran. Une action serveur, elle, est exécutée **avant** tout
 * rendu. Et le middleware ne vérifie que la session, jamais le rôle
 * (`src/middleware.ts`) — il redirige qui n'est pas connecté, pas qui n'a pas
 * le droit.
 *
 * Entre les deux, il n'y avait rien. `GardeAcces.tsx` affirme pourtant :
 *
 *     « Les Server Actions, de même, gardent leur `exigerProprietaire` »
 *
 * C'est vrai des réglages, et **c'était faux d'une trentaine d'actions** qui
 * touchent aux montants : charger un devis complet et ses lignes, calculer une
 * proposition de prix, modifier ou supprimer une ligne de prix, envoyer un
 * devis à un client, émettre une facture, supprimer un client.
 *
 * **Ce qu'un salarié pouvait faire.** `/chantiers/…` ne lui est pas ouvert
 * (`acces-roles.ts`) : il ne peut pas *afficher* la page. Mais l'adresse de
 * l'action reste postable avec sa session valide, et les identifiants d'actions
 * se lisent dans les fragments servis sous `_next/static`, que le `matcher` du
 * middleware exclut. L'action s'exécutait donc — et ses effets, eux, ne se
 * défont pas d'une redirection au rendu.
 *
 * C'est exactement ce que `docs/QUESTIONS.md` §10 interdit, et que
 * `acces-roles.ts` cite en tête : *« Les montants ne doivent pas sortir du
 * serveur pour qui n'a pas le droit de les voir — ni dans la page, ni dans le
 * PDF, ni dans une réponse d'API. »* Les actions manquaient à la liste.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **POURQUOI ELLE NE S'APPUIE PAS SUR LE CHEMIN, contrairement à
 * `exigerOuverture`.**
 *
 * La garde des routes d'API lit `x-atlas-pathname`, l'en-tête que le middleware
 * pose sur chaque requête. Pour une action, cet en-tête porte **l'écran où se
 * trouve le navigateur**, pas la page qui possède l'action : un salarié posté
 * sur `/planning` — un chemin qui lui est ouvert — franchirait la garde tout en
 * appelant une action de `/chantiers/…`.
 *
 * On garde donc sur **ce que l'action fait**, jamais sur d'où elle semble
 * venir. C'est une donnée que le navigateur ne peut pas influencer.
 */

/** Levée quand une action est appelée par qui n'a pas le droit de la jouer. */
export class ActionRefuseeError extends Error {
  constructor(action: string) {
    // **Le message ne dit pas POURQUOI.** Il part vers un écran, et distinguer
    // « vous n'avez pas le droit » de « cela n'existe pas » apprend à qui
    // cherche qu'il a visé juste — la règle des routes de ce dépôt (404, jamais
    // 403). En production, Next.js remplace de toute façon le message d'une
    // exception par un identifiant opaque (`AGENTS.md`).
    super(`Action indisponible : ${action}.`);
    this.name = "ActionRefuseeError";
  }
}

/**
 * **Cette personne a-t-elle le droit de voir ou de toucher un montant ?**
 *
 * À appeler en PREMIÈRE LIGNE de toute action qui lit, écrit ou fait sortir un
 * prix, un total, une marge, une facture ou un paiement — juste après
 * `getCurrentCtx()`, et avant toute lecture.
 *
 * Le patron chiffre, le commercial vend, le salarié jamais : c'est toute la
 * raison d'être de la feuille de chantier sans prix. La règle est celle de
 * `peutVoirLesMontants`, et elle n'est pas recopiée ici — deux implémentations
 * de la même règle finissent toujours par diverger (`CLAUDE.md` §3).
 *
 * **Lève plutôt que de rendre une valeur de refus**, à l'inverse
 * d'`exigerOuverture` : une action rend des types différents à chaque fois, et
 * un refus qu'on peut oublier de tester serait pire qu'une exception. Ici le
 * doute se tranche du côté fermé — un rôle absent est un refus.
 */
export async function exigerMontants(ctx: Ctx, action: string): Promise<void> {
  const role = await getRole(ctx);
  if (!role || !peutVoirLesMontants(role)) {
    throw new ActionRefuseeError(action);
  }
}
