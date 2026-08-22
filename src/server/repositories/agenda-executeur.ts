import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { withEntreprise } from "../db/with-entreprise";
import type { Ctx } from "./context";

/**
 * Comment ouvrir la base pour une entreprise donnée.
 *
 * **Deux chemins mènent à l'agenda, et ils n'ont pas la même porte d'entrée.**
 * L'écran du patron a une session : `withEntreprise` pose son contexte. La page
 * publique du client n'en a pas — elle dérive l'entreprise **du jeton** et pose
 * le contexte à la main, exactement comme `lireParJeton`.
 *
 * Cette petite abstraction existe pour que la logique qui suit — jeton expiré,
 * renouvellement, écriture de l'erreur — soit écrite **une seule fois**. Deux
 * copies finiraient par diverger, et l'une des deux oublierait un jour de
 * consulter l'agenda : le client se verrait alors proposer un jour où le patron
 * est pris, c'est-à-dire précisément le défaut que ce lot répare.
 *
 * **Sorti dans son propre fichier le 12 août 2026**, quand l'agenda iCloud est
 * venu s'ajouter à celui de Google : les deux raccordements en ont besoin, et
 * le laisser chez l'un des deux aurait fait dépendre Apple de Google — ou
 * produit une seconde copie, ce que ce module existe justement pour éviter.
 */
export type Executeur = <T>(
  fn: (tx: Parameters<Parameters<typeof withEntreprise>[2]>[0]) => Promise<T>
) => Promise<T>;

export function executeurDeSession(ctx: Ctx): Executeur {
  return (fn) => withEntreprise(ctx.utilisateurId, ctx.entrepriseId, fn);
}

/**
 * L'exécuteur de la page publique : le contexte vient du jeton, jamais d'une
 * donnée envoyée par le client.
 */
export function executeurParEntreprise(entrepriseId: string): Executeur {
  return (fn) =>
    db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.entreprise_id', ${entrepriseId}, true)`);
      return fn(tx);
    });
}

/**
 * Le message d'une panne, tronqué, tel que le service l'a écrit.
 *
 * Reproduire le message du serveur plutôt que l'idée qu'on s'en fait est une
 * règle du dépôt payée d'une demi-journée (`AGENTS.md`) : trois correctifs
 * d'affilée sont passés au vert en réparant une panne imaginée.
 */
export function messageDePanne(e: unknown): string {
  const texte = e instanceof Error ? e.message : String(e);
  return texte.slice(0, 500);
}
