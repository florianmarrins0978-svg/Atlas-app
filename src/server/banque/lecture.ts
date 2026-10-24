import { fenetresDeLecture, virementsDesMouvements } from "@/lib/releve-bancaire";
import { dossierEnCours } from "../repositories/dossiers-comptables";
import { appliquerCheckUp } from "../repositories/pour-mon-comptable";
import { logger } from "../logger";
import type { Ctx } from "../repositories/context";
import { ajouterMouvements, ajouterVirements, liaisonDeLEntreprise, marquerBanqueLue } from "../repositories/banque";
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
 * Lit le relevé depuis la dernière fois, et le range : chaque ligne pour le
 * dossier du comptable, et les virements reçus pour les questions de l'accueil.
 *
 * **Il n'y a pas de tâche de fond dans son espace** : la banque se lit quand
 * quelqu'un ouvre Atlas (l'accueil, Ma TVA, Ma banque), et la carte apparaît à
 * la relecture suivante de l'accueil. La marge de trois jours rattrape une
 * ligne que la banque inscrit avec retard ; la clé empêche qu'elle soit
 * comptée deux fois.
 *
 * **La lecture est marquée faite même quand la banque refuse** : sans quoi
 * chaque relecture de l'accueil retenterait, et l'on brûlerait les lectures
 * permises sur une panne. Le refus part au journal, et Ma banque le dit.
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

  const { releve, virements } = fenetresDeLecture(maintenant, liaison.luLe);

  await marquerBanqueLue(ctx, maintenant);
  const r = await mouvementsBancaires(liaison, releve);
  if (!r.ok) {
    logger.warn("La banque n'a pas pu être lue", { raison: r.raison });
    return r;
  }
  await ajouterMouvements(ctx, r.mouvements);
  // Les lignes nouvelles retrouvent leur ticket dès qu'elles arrivent : c'est
  // ici, à l'arrivée de la donnée, que le Check up silencieux a sa place.
  const dossier = await dossierEnCours(ctx, maintenant);
  await appliquerCheckUp(ctx, dossier.du, dossier.au);
  const nouveaux = await ajouterVirements(
    ctx,
    virementsDesMouvements(r.mouvements).filter((v) => v.date >= virements)
  );
  return { ok: true, nouveaux, lue: true };
}

