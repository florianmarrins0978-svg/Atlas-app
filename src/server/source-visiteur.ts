import { headers } from "next/headers";
import { getEnv } from "@/server/env";
import { sourceDepuisEntetes } from "@/lib/source-visiteur";

/**
 * D'où vient CETTE requête — la lecture, côté serveur, de la règle pure.
 *
 * **Pourquoi ce fichier existe.** Ces deux fonctions vivaient à l'intérieur de
 * `src/app/login/actions.ts`, non exportées. La réponse publique à un devis
 * (constat F9) a besoin exactement des mêmes : recopier huit lignes aurait
 * fabriqué une seconde façon de décider qui est « le même visiteur », et deux
 * implémentations d'une même règle finissent toujours par diverger
 * (`CLAUDE.md` §3). La règle elle-même n'a pas bougé d'un caractère : elle est
 * toujours dans `src/lib/source-visiteur.ts`, où elle s'éprouve sans requête.
 *
 * Le raisonnement complet — pourquoi `x-forwarded-for` ne se lit jamais à
 * gauche, et ce qu'il reste à poser en production (`ATLAS_PROXY_SAUTS`) — est
 * en tête de ce module pur. Il n'est pas recopié ici : un commentaire dupliqué
 * périme aussi sûrement qu'un code dupliqué.
 */
/**
 * De qui vient cette tentative — **et seulement quand on peut le savoir.**
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Le défaut réparé le 23 août 2026 (audit, constat C1).** La version
 * précédente lisait ceci :
 *
 *     const transmise = entetes.get("x-forwarded-for")?.split(",")[0]?.trim();
 *
 * `x-forwarded-for` est un en-tête **que celui qui frappe écrit lui-même**. En
 * prendre la première valeur, c'est offrir un compteur neuf à chaque essai : il
 * suffisait d'incrémenter un chiffre pour ne jamais atteindre aucun seuil. La
 * protection « cinq essais par quart d'heure » n'existait donc pas dès qu'on
 * pensait à la contourner.
 *
 * **Ce qu'on fait à la place, et pourquoi c'est la seule chose honnête.**
 * Une adresse transmise ne vaut que par le mandataire qui l'a écrite. Sans
 * savoir combien de mandataires de confiance nous précèdent, aucune position
 * dans la liste n'est fiable — et deviner reviendrait à faire confiance à
 * l'attaquant. On distingue donc trois cas :
 *
 *   1. `ATLAS_PROXY_SAUTS` est posé — on sait combien de mandataires ajoutent
 *      leur ligne, donc laquelle a été écrite par le nôtre. Elle fait foi ;
 *   2. l'en-tête existe mais rien ne dit qui l'a écrit — **on n'en tire aucune
 *      valeur** : toutes ces tentatives partagent un seul et même seau. C'est
 *      exactement le comportement d'avant lorsqu'aucun en-tête n'arrivait, donc
 *      jamais plus permissif qu'aujourd'hui ;
 *   3. aucun en-tête — connexion directe, un seul seau également.
 *
 * **Ce qui reste à configurer en production, et il faut le dire :** poser
 * `ATLAS_PROXY_SAUTS` au nombre de mandataires de confiance placés devant
 * Atlas (1 pour un hébergeur ordinaire), ET s'assurer que ce mandataire
 * **écrase** `x-forwarded-for` au lieu d'y ajouter la valeur du client. Sans
 * les deux, ce seuil-ci reste commun à tout le monde — ce qui protège encore,
 * mais moins finement. Le compteur par compte, lui, ne dépend de rien de tout
 * cela (voir plus bas).
 */
export async function sourceDuVisiteur(horsProduction: boolean): Promise<string> {
  const entetes = await headers();
  return sourceDepuisEntetes({
    xff: entetes.get("x-forwarded-for"),
    sauts: getEnv().proxySauts,
    horsProduction,
  });
}

/**
 * Sommes-nous ailleurs qu'en production réelle ?
 *
 * Une seule notion, plusieurs usages, et il ne faut pas qu'ils divergent : elle
 * décide si l'on distingue encore les visiteurs par leur adresse. `bancDEssai`
 * en fait partie parce qu'un banc, servi en version bâtie, répond
 * « production » à son `NODE_ENV` sans en être une.
 */
export function horsProductionReelle(): boolean {
  const env = getEnv();
  return env.nodeEnv !== "production" || env.bancDEssai;
}
