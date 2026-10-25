import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { accueilDuRole, cheminAutorise } from "@/lib/acces-roles";
import { estCheminPublic } from "@/lib/chemins-publics";
import { accesDeLaPersonne } from "@/server/autorisation";
import { getCurrentCtx } from "@/server/session-ctx";

/**
 * LE REFUS DES RÔLES, POSÉ PAR CHAQUE ÉCRAN.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Ce qu'il répare depuis le 25 août 2026.** Un compte non propriétaire
 * atteignait tous les écrans : retirer un bouton n'a jamais fermé une adresse
 * (`docs/QUESTIONS.md` §10).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **POURQUOI DANS CHAQUE ÉCRAN, ET PLUS DANS LE GABARIT RACINE (audit du
 * 25 octobre 2026, E8).** La garde vivait dans `src/app/layout.tsx`, pour ne
 * pas s'oublier au premier écran neuf. Mais un gabarit partagé NE SE REJOUE PAS
 * à la navigation interne, et il n'empêche pas l'écran d'arriver dans la
 * réponse (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`,
 * « Layouts and auth checks ») : un commercial passé par `/chantiers` lisait
 * Ma TVA. Un chargement complet était refusé ; un clic, non.
 *
 * L'oubli que le gabarit évitait est tenu autrement : `test-pages-gardees.ts`
 * refuse tout écran qui n'appelle pas cette garde en premier.
 *
 * `x-atlas-pathname` est posé par le middleware à CHAQUE requête, navigations
 * internes comprises : c'est ce qui rend la garde juste sur l'écran demandé, et
 * non sur celui d'où l'on vient. Ce qui s'atteint sans compte s'atteint sans
 * rôle (`chemins-publics.ts`, une seule liste).
 *
 * Les routes d'API ont leur propre garde (`exigerOuverture`,
 * `test-acces-routes-gardees.ts`), les actions serveur aussi (`exigerMontants`
 * et les autres, `test-actions-gardees-db.ts`).
 */
export async function garderLaPage(): Promise<void> {

  const chemin = (await headers()).get("x-atlas-pathname");
  // Sans chemin, on ne sait pas de quoi on parle : la garde se tait plutôt que
  // de refuser au hasard. Ce cas n'arrive que hors requête HTTP réelle.
  if (!chemin) return;
  // Ce qui s'atteint sans compte s'atteint sans rôle. Les mêler ferait naître la
  // seconde liste que ce dépôt a déjà payée deux fois (`chemins-publics.ts`).
  if (estCheminPublic(chemin)) return;

  let acces;
  try {
    const ctx = await getCurrentCtx();
    acces = await accesDeLaPersonne(ctx);
  } catch (err) {
    /**
     * **UNE REDIRECTION N'EST PAS UNE PANNE, et l'avaler en serait une.**
     *
     * `getCurrentCtx` appelle `redirect("/api/session-perimee")` quand le compte
     * a disparu ou que le jeton précède une coupure — et `redirect()` lève **par
     * conception**. Un `catch` nu la prendrait pour une base muette, la
     * mangerait, et le cookie mort resterait dans le navigateur : c'est le piège
     * du 10 août 2026, une soirée perdue sur un cookie que rien n'effaçait. On
     * la laisse donc repartir.
     */
    if (typeof (err as { digest?: unknown })?.digest === "string") throw err;

    // Le reste — pas de session, pas d'adhésion — n'est pas à cette garde de
    // trancher. Le middleware renvoie déjà à la connexion, et `getCurrentCtx`
    // sait distinguer un compte disparu d'une anomalie de données. Refuser ici
    // recouvrirait ses deux réponses par une troisième, moins juste.
    return;
  }

  // Une adhésion retirée entre deux requêtes : plus de rôle, donc plus d'écran.
  // On ne redirige pas — il n'y a nulle part où l'envoyer —, `getCurrentCtx`
  // aura déjà tranché au tour suivant.
  if (!acces) return;

  if (!cheminAutorise(acces.role, chemin)) {
    redirect(accueilDuRole(acces.role));
  }
}
