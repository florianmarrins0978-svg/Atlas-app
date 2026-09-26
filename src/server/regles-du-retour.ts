import { getEntreprise } from "@/server/repositories/entreprises";
import { abonnementDeLEntreprise } from "@/server/repositories/abonnements";
import { fonctionOuverte } from "@/lib/abonnements";
import type { ReglesDuRetour } from "@/lib/retour-intervention";
import type { Ctx } from "@/server/repositories/context";

/**
 * CE QUE LE PATRON EXIGE EN FIN DE CHANTIER, lu à UN endroit pour tous ceux
 * qui en dépendent : la feuille du chantier, la ligne « Retour à envoyer » du
 * planning et la carte « Retour pas reçu » de l'accueil (26 septembre 2026).
 * Trois lectures séparées finiraient par ne plus s'accorder sur la formule.
 *
 * Les retours sont un plus d'« Entreprise » (sa décision du 10 septembre 2026).
 * Un « Artisan » qui avait coché « retour demandé » avant de choisir sa formule
 * ne doit pas continuer à le faire réclamer à ses gars : ce qu'il ne peut plus
 * lire, on ne le leur demande pas. La règle vit dans `fonctionOuverte` ; ici on
 * la lit, on ne la réécrit pas.
 */
export async function reglesDuRetour(ctx: Ctx): Promise<ReglesDuRetour> {
  const [entreprise, abonnement] = await Promise.all([getEntreprise(ctx), abonnementDeLEntreprise(ctx)]);
  const ouvert = fonctionOuverte(abonnement?.formule, "retours");
  return {
    demande: ouvert && (entreprise?.retourDemande ?? false),
    photoExigee: ouvert && (entreprise?.retourPhotoExigee ?? false),
  };
}
