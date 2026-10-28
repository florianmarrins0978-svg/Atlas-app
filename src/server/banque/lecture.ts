import { fenetreDeVirements, virementsDesMouvements } from "@/lib/releve-bancaire";
import { dossierEnCours } from "../repositories/dossiers-comptables";
import { appliquerCheckUp } from "../repositories/pour-mon-comptable";
import { logger } from "../logger";
import type { Ctx } from "../repositories/context";
import { ajouterMouvements, ajouterVirements, liaisonDeLEntreprise, marquerBanqueLue, noterProfondeurLue } from "../repositories/banque";
import { mouvementsBancaires, type Refus } from "./enable-banking";

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

export type ResultatLecture = { ok: true; nouveaux: number; lue: boolean } | Refus;

/**
 * Lit le relevé au plus profond que la banque accepte, et le range : chaque
 * ligne pour le dossier du comptable, et les virements reçus pour les questions
 * de l'accueil. Chaque lecture relit tout l'historique accepté ; la clé empêche
 * de compter deux fois.
 *
 * **Il n'y a pas de tâche de fond dans son espace** : la banque se lit quand
 * quelqu'un ouvre Atlas (l'accueil, Ma TVA, Ma banque), et la carte apparaît à
 * la relecture suivante de l'accueil. Une ligne que la banque inscrit avec
 * retard est rattrapée par la lecture suivante, puisque celle-ci relit tout.
 *
 * **La lecture est marquée faite même quand la banque refuse** : sans quoi
 * chaque relecture de l'accueil retenterait, et l'on brûlerait les lectures
 * permises sur une panne. Le refus part au journal, et Ma banque le dit.
 *
 * **La profondeur atteinte est gardée en base** (`noterProfondeurLue`) : Ma
 * banque explique pourquoi on voit moins, même quand la lecture suivante est
 * retenue par le délai.
 *
 * `nouveaux` compte les virements reçus nouveaux, comme avant : c'est ce que
 * l'accueil et Ma banque annoncent.
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

  await marquerBanqueLue(ctx, maintenant);
  const r = await mouvementsBancaires(liaison, maintenant);
  if (!r.ok) {
    logger.warn("La banque n'a pas pu être lue", { raison: r.raison });
    return r;
  }
  await noterProfondeurLue(ctx, r.joursLus, r.refusDesPlusProfonds);
  await ajouterMouvements(ctx, r.mouvements);
  // Les lignes nouvelles retrouvent leur ticket dès qu'elles arrivent : c'est
  // ici, à l'arrivée de la donnée, que le Check up silencieux a sa place.
  const dossier = await dossierEnCours(ctx, maintenant);
  await appliquerCheckUp(ctx, dossier.du, dossier.au);
  const nouveaux = await ajouterVirements(
    ctx,
    virementsDesMouvements(r.mouvements).filter((v) => v.date >= fenetreDeVirements(maintenant))
  );
  return { ok: true, nouveaux, lue: true };
}
