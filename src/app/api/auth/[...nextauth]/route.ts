import { handlers } from "@/auth";

/**
 * LA SECONDE PORTE DE LA CONNEXION, ET POURQUOI ELLE EST MURÉE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **CE QUI ÉTAIT OUVERT, ET CE QUE ÇA COÛTAIT** — constat de l'audit final,
 * 29 août 2026.
 *
 * Ce fichier montait les gestionnaires d'Auth.js en entier :
 *
 *     export const { GET, POST } = handlers;
 *
 * Or `/api/auth` est un chemin public (`src/lib/chemins-publics.ts`), et
 * `POST /api/auth/callback/credentials` appelle `authorize()` **directement**.
 * Toutes les défenses contre le bourrage d'identifiants — les deux seuils Redis
 * et, surtout, la temporisation en base qui compte les échecs consécutifs —
 * vivent dans l'action serveur `connexionAction` (`src/app/login/actions.ts`).
 * Aucune ne se trouvait sur ce chemin-ci.
 *
 * Autrement dit : le formulaire était gardé, et la porte d'à côté ne l'était
 * pas. `GET /api/auth/csrf` rend un jeton et pose son cookie ; le reste est une
 * boucle de POST, sans compteur qui avance, sans temporisation qui se pose, et
 * sans que `noterEchec` soit jamais appelé. Le succès se distingue de l'échec au
 * `Set-Cookie`. C'est exactement l'attaque que le lot C1 et la migration 0062
 * prétendaient avoir fermée.
 *
 * **Et aucune suite ne pouvait le voir** : `test-connexion-limite-e2e.ts` pilote
 * le formulaire, donc l'action serveur ; `test-bourrage-connexion-db.ts` appelle
 * `noterEchec()` en direct. Les deux passaient au vert sur une application
 * ouverte à quatre vents.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **POURQUOI FERMER PLUTÔT QUE GARDER LES DEUX PORTES.**
 *
 * La tentation était de recopier les seuils dans `authorize()`. C'est
 * précisément ce que `CLAUDE.md` §3 interdit : deux implémentations de la même
 * règle finissent toujours par diverger, et l'on ne saurait plus laquelle fait
 * foi. Une seule entrée, un seul jeu de gardes.
 *
 * **Et rien ne casse, parce que rien ne s'en sert.** `signIn()` importé de
 * `@/auth` est le helper SERVEUR : il appelle `Auth(request, config)` en
 * processus (`node_modules/next-auth/lib/actions.js`), il n'émet aucune requête
 * HTTP vers cette route. Aucun `signIn()` de navigateur n'existe dans ce dépôt,
 * et il n'y a ni `SessionProvider` ni `useSession`.
 *
 * **Ce qui reste ouvert, délibérément :** tout le reste d'Auth.js, `GET`
 * compris. `GET /api/auth/session` est même employé par
 * `test-coupure-sessions-e2e.ts` pour rejouer l'attaque qu'il éprouve — le
 * fermer ferait rougir une suite qui défend autre chose.
 */

export const { GET } = handlers;

/** Les fournisseurs `Credentials` déclarés dans `src/auth.ts`. */
const RAPPELS_MURES = ["/callback/credentials", "/callback/cle-appareil"];

export async function POST(requete: Parameters<typeof handlers.POST>[0]): Promise<Response> {
  const chemin = new URL(requete.url).pathname;
  if (RAPPELS_MURES.some((r) => chemin.endsWith(r))) {
    // **404, et non 403.** Un refus explicite confirmerait à qui cherche que la
    // route existe et qu'elle mène quelque part. Ici elle n'a aucun usage
    // légitime : autant qu'elle n'existe pas.
    return new Response(null, { status: 404 });
  }
  return handlers.POST(requete);
}
