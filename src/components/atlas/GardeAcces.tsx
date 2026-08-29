import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { accueilDuRole, cheminAutorise } from "@/lib/acces-roles";
import { estCheminPublic } from "@/lib/chemins-publics";
import { accesDeLaPersonne } from "@/server/autorisation";
import { getCurrentCtx } from "@/server/session-ctx";

/**
 * LE REFUS, ET IL EST AU SERVEUR.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Ce qu'il répare.** Jusqu'au 25 août 2026, un compte non propriétaire
 * atteignait tous les écrans sauf les rares qui avaient reçu une garde écrite à
 * la main. Retirer un bouton n'a jamais rien fermé : l'adresse reste tapable, et
 * la page, elle, a déjà reçu les données. `docs/QUESTIONS.md` §10 le dit
 * d'avance — *« un salarié qui découvre votre marge parce qu'il a su regarder,
 * c'est pire que pas de restriction du tout, puisque vous vous croyiez
 * protégé »*.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **POURQUOI DANS LA MISE EN PAGE RACINE, ET PAS DANS CHAQUE ÉCRAN.**
 *
 * Une garde posée écran par écran s'oublie au premier écran neuf — et l'oubli
 * ne se voit pas : la page marche, elle marche même trop bien. Ici, tout écran
 * qui porte la navigation passe par cette garde, y compris celui qui sera écrit
 * demain par une autre session. C'est le même raisonnement que
 * `GardeDocumentsLegaux`, juste à côté, et il a déjà fait ses preuves.
 *
 * **Rendue AVANT le contenu**, comme elle : la redirection part donc avant
 * qu'aucune donnée n'ait été peinte.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **CE QU'ELLE NE COUVRE PAS, ET QUI EST TRAITÉ AILLEURS.**
 *
 * Une route d'API ne traverse aucune mise en page : `/api/devis/<id>/pdf` ne
 * verrait jamais cette garde. Les routes qui servent une donnée d'entreprise
 * appellent donc `exigerOuverture()` elles-mêmes (`src/server/garde-route.ts`),
 * et un contrôle refuse qu'une route neuve l'oublie
 * (`scripts/test-acces-routes-gardees.ts`).
 *
 * **LES SERVER ACTIONS SE GARDENT AUSSI — et ce paragraphe a longtemps affirmé
 * le contraire de la vérité.** Il disait : *« Les Server Actions, de même,
 * gardent leur `exigerProprietaire` »*. C'était vrai des réglages, et faux de
 * trente-quatre actions qui ouvrent un devis, calculent une marge, envoient un
 * devis chez un client, émettent une facture ou suppriment un client.
 *
 * L'audit final du 29 août 2026 l'a trouvé, et **c'est cette phrase qui avait
 * empêché de le voir** : elle rassurait quiconque venait vérifier. Une garde de
 * mise en page ne s'exécute qu'au RENDU ; une action serveur s'exécute AVANT, et
 * ses effets ne se défont pas d'une redirection. Le middleware, lui, ne regarde
 * que la session.
 *
 * Elles portent désormais `exigerMontants` (`src/server/garde-action.ts`), qui
 * garde sur **ce que l'action fait** et non sur le chemin d'où elle semble
 * venir — un salarié posté sur `/planning`, chemin qui lui est ouvert, peut
 * appeler une action de `/chantiers/…`. Un contrôle refuse qu'une action neuve
 * l'oublie (`scripts/test-actions-gardees-db.ts`).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **POURQUOI UNE REDIRECTION, ET PAS UN ÉCRAN « INTERDIT ».**
 *
 * Un salarié qui suit un lien d'un temps où il était commercial n'a rien fait de
 * mal : le renvoyer à son planning est la réponse utile. Et la cible est
 * toujours une adresse que son rôle atteint (`accueilDuRole`) — un refus qui
 * renverrait vers un autre refus tournerait en boucle, et l'écran resterait
 * blanc.
 */
export default async function GardeAcces() {
  const chemin = (await headers()).get("x-atlas-pathname");
  // Sans chemin, on ne sait pas de quoi on parle : la garde se tait plutôt que
  // de refuser au hasard. Ce cas n'arrive que hors requête HTTP réelle.
  if (!chemin) return null;
  // Ce qui s'atteint sans compte s'atteint sans rôle. Les mêler ferait naître la
  // seconde liste que ce dépôt a déjà payée deux fois (`chemins-publics.ts`).
  if (estCheminPublic(chemin)) return null;

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
    return null;
  }

  // Une adhésion retirée entre deux requêtes : plus de rôle, donc plus d'écran.
  // On ne redirige pas — il n'y a nulle part où l'envoyer —, `getCurrentCtx`
  // aura déjà tranché au tour suivant.
  if (!acces) return null;

  if (!cheminAutorise(acces.role, chemin)) {
    redirect(accueilDuRole(acces.role));
  }

  return null;
}
