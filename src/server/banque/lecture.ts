import { jourIso } from "@/lib/jour";
import { logger } from "../logger";
import type { Ctx } from "../repositories/context";
import { ajouterVirements, liaisonDeLEntreprise, marquerBanqueLue } from "../repositories/banque";
import { virementsRecus, type Refus } from "./enable-banking";

/**
 * Une lecture de la banque au plus toutes les demi-heures.
 *
 * **Ce n'est pas une politesse** : les banques limitent les lectures faites
 * sans que le titulaire soit devant (quatre par jour et par compte, règle
 * européenne). L'accueil se relit toutes les trente secondes
 * (`VeilleDesNouvelles`) ; sans ce plafond, il épuiserait la journée en deux
 * minutes et la banque refuserait jusqu'au lendemain.
 */
export const LIRE_AU_PLUS_TOUS_LES_MS = 30 * 60 * 1000;

/** Trente jours à la première lecture ; ensuite, depuis la dernière, moins trois jours de marge. */
const PREMIERE_FENETRE_JOURS = 30;
const MARGE_JOURS = 3;

export type ResultatLecture = { ok: true; nouveaux: number; lue: boolean } | Refus;

/**
 * Lit les virements reçus depuis la dernière fois, et les range.
 *
 * **Il n'y a pas de tâche de fond dans son espace** : la banque se lit quand
 * quelqu'un ouvre Atlas (l'accueil, Ma TVA, Ma banque), et la carte apparaît à
 * la relecture suivante de l'accueil. La marge de trois jours rattrape un
 * virement que la banque inscrit avec retard ; la clé du virement empêche
 * qu'il soit compté deux fois.
 *
 * **La lecture est marquée faite même quand la banque refuse** : sans quoi
 * chaque relecture de l'accueil retenterait, et l'on brûlerait les lectures
 * permises sur une panne. Le refus part au journal, et Ma banque le dit.
 */
export async function lireLaBanque(
  ctx: Ctx,
  options: { maintenant: Date; forcer?: boolean }
): Promise<ResultatLecture> {
  const liaison = await liaisonDeLEntreprise(ctx);
  if (!liaison) return { ok: true, nouveaux: 0, lue: false };
  const { maintenant } = options;
  if (!options.forcer && liaison.luLe && maintenant.getTime() - liaison.luLe.getTime() < LIRE_AU_PLUS_TOUS_LES_MS) {
    return { ok: true, nouveaux: 0, lue: false };
  }
  if (liaison.accordJusquAu.getTime() <= maintenant.getTime()) {
    return { ok: false, raison: "L'accord donné à votre banque est terminé. Reliez-la à nouveau." };
  }

  const jours = (n: number) => n * 24 * 3600 * 1000;
  const plusTot = maintenant.getTime() - jours(PREMIERE_FENETRE_JOURS);
  const depuis = liaison.luLe ? Math.max(plusTot, liaison.luLe.getTime() - jours(MARGE_JOURS)) : plusTot;

  await marquerBanqueLue(ctx, maintenant);
  const r = await virementsRecus(liaison, jourIso(new Date(depuis)));
  if (!r.ok) {
    logger.warn("La banque n'a pas pu être lue", { raison: r.raison });
    return r;
  }
  const nouveaux = await ajouterVirements(ctx, r.virements);
  return { ok: true, nouveaux, lue: true };
}
