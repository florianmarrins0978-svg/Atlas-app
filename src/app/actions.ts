"use server";

import { revalidatePath } from "next/cache";
import { exigerEcran } from "@/server/garde-action";
import { getCurrentCtx } from "@/server/session-ctx";
import { logger } from "@/server/logger";
import { marquerReponseVue } from "@/server/repositories/envois-devis";
import { getOuCreerDevisBrouillon } from "@/server/repositories/devis";
import { repousserRappelFacture, marquerRappelVu } from "@/server/repositories/rappels";
import { estGenreAcquittable } from "@/lib/rappels";
import { jourIso } from "@/lib/jour";

/**
 * Le patron a pris connaissance d'une réponse du client.
 *
 * Marquer « vu » est un geste, pas un effet de bord de l'affichage : une
 * notification qui disparaît au premier coup d'œil est une notification qu'on
 * peut manquer en faisant défiler l'écran.
 */
export async function marquerReponseVueAction(envoiId: string) {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/", "marquer une réponse comme vue");
  await marquerReponseVue(ctx, envoiId);
  revalidatePath("/");
}

/**
 * « Corriger le devis » : ouvrir le document, prêt à être modifié.
 *
 * **Sa demande du 13 août 2026 :** *« lorsque je clique sur corriger le devis,
 * je dois arriver directement sur la page du devis pour pouvoir le corriger.
 * Et aujourd'hui, ce n'est pas le cas. »*
 *
 * Un devis parti est immuable — le déclencheur
 * `empecher_modification_devis_envoye` s'en assure en base. L'ouvrir tel quel
 * lui donnerait un document qui refuse la première frappe. Il faut donc le
 * REPRENDRE, ce qui ouvre une version de plus sous le même numéro commercial.
 *
 * **Ce geste est le sien** : il vient d'appuyer sur un bouton qui annonce
 * « Corriger le devis ». C'est la limite exacte de la règle « rien ne part sans
 * un geste du patron » (`CLAUDE.md` §4) — ici, le geste a eu lieu.
 *
 * Rendue en VALEUR, jamais en exception. Une exception levée par une action
 * serveur n'arrive jamais jusqu'à lui : Next la remplace en production par un
 * identifiant opaque, et son banc sert une version bâtie (`HANDOVER.md`,
 * piège 0 ter). Il verrait « une erreur est survenue », et personne ne saurait
 * laquelle.
 */
export async function corrigerDevisAction(
  chantierId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const ctx = await getCurrentCtx();
    await exigerEcran(ctx, "/", "rouvrir un devis en correction");
    await getOuCreerDevisBrouillon(ctx, chantierId);
    revalidatePath(`/chantiers/${chantierId}/devis-complet`);
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    // Journalisé avant de rendre la main : sans cela, le défaut serait muet, et
    // la première livraison devrait être de le rendre bavard (`AGENTS.md`).
    logger.error("Reprise du devis impossible depuis la carte de réponse", {
      chantierId,
      cause: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      message:
        "Le devis n'a pas pu être rouvert pour correction. Passez par l'écran Devis du chantier, " +
        "puis « Corriger et renvoyer ».",
    };
  }
}

/**
 * « Plus tard » — repousser le rappel d'une facture impayée.
 *
 * *Sa demande du 16 août 2026 :* ***« je veux un rappel toutes les semaines ou
 * tous les quinze jours, mais pas qu'il y ait la notification tous les
 * jours »***. Ce geste est le seul moteur du rythme : tant qu'il n'y touche
 * pas, la carte reste.
 *
 * **Le jour est calculé AU SERVEUR.** Le téléphone peut être à l'heure
 * d'ailleurs, et « toutes les semaines » se compte en jours civils : une
 * journée d'écart ferait revenir la carte un jour trop tôt.
 *
 * **Le refus est une valeur, jamais une exception** : le message d'une erreur
 * levée par une action serveur n'arrive jamais jusqu'au patron
 * (`HANDOVER.md`, piège 0 ter).
 */
export async function repousserRappelFactureAction(
  factureId: string
): Promise<{ ok: true } | { ok: false; raison: string }> {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/", "repousser un rappel de facture");
  try {
    const fait = await repousserRappelFacture(ctx, factureId, jourIso(new Date()));
    return fait
      ? { ok: true }
      : { ok: false, raison: "Cette facture n'existe plus. Rechargez l'écran." };
  } catch (erreur) {
    console.error("[accueil] rappel de facture non repoussé", erreur);
    return { ok: false, raison: "Impossible de repousser ce rappel pour l'instant. Réessayez." };
  }
}

/**
 * « J'ai vu » sur un rappel — sa demande du 30 août 2026, capture à l'appui.
 *
 * *« Pour chaque notification je dois pouvoir cliquer sur vu pour les faire
 * disparaître ; pourquoi certaines n'ont pas cette fonction ? Mets la fonction
 * pour toutes. »*
 *
 * **Le genre est vérifié ICI, contre une liste fermée.** Une adresse d'action
 * se tape : un genre inventé ferait une ligne d'acquittement qui ne
 * correspondrait à aucun rappel, et personne ne saurait la rallumer.
 *
 * **Le refus est une valeur, jamais une exception** (`HANDOVER.md`, piège 0 ter).
 */
export async function marquerRappelVuAction(
  genre: string,
  chantierId: string
): Promise<{ ok: true } | { ok: false; raison: string }> {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/", "marquer un rappel comme vu");
  if (!estGenreAcquittable(genre)) {
    return { ok: false, raison: "Ce rappel ne peut pas être acquitté. Rechargez l'écran." };
  }
  try {
    const fait = await marquerRappelVu(ctx, genre, chantierId);
    // **Comme pour une réponse acquittée** : sans cela, un retour en arrière
    // pourrait réafficher la carte depuis le cache du routeur, et il croirait
    // son geste perdu.
    if (fait) revalidatePath("/");
    return fait
      ? { ok: true }
      : { ok: false, raison: "Ce chantier n'existe plus. Rechargez l'écran." };
  } catch (erreur) {
    // Journalisé avant de rendre la main : un défaut muet se devine, et deviner
    // à sa place, c'est réparer une panne imaginée (`AGENTS.md`).
    console.error("[accueil] rappel non marqué vu", erreur);
    return { ok: false, raison: "Impossible de ranger ce rappel pour l'instant. Réessayez." };
  }
}
