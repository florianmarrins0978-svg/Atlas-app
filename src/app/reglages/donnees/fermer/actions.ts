"use server";

/**
 * FERMER SON COMPTE, ET LE ROUVRIR — les deux gestes de l'écran
 * `reglages/donnees/fermer` (question 33 de `docs/QUESTIONS.md`).
 *
 * **Réservés au patron, et sous preuve récente** : fermer coupe l'accès de
 * toute l'équipe et lance, trente jours plus tard, l'effacement du reste. Une
 * session volée ne doit pas pouvoir le faire d'un appui.
 *
 * **Son choix A** : un abonné garde tout jusqu'à la fin de ce qui est payé.
 * Fermer, c'est donc d'abord demander la résiliation à l'échéance, le geste
 * qui existe déjà (`resilierAction`) ; la date d'effet du compte est cette
 * échéance-là, et pas une seconde calculée à côté.
 *
 * Les refus se rendent en valeur : le message d'une exception levée ici
 * n'arriverait jamais jusqu'à lui (`AGENTS.md`).
 */

import { revalidatePath } from "next/cache";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerProprietaire } from "@/server/autorisation";
import { exigerPreuveRecente, PreuveRecenteExigeeError } from "@/server/preuve-recente";
import { GESTES_SENSIBLES } from "@/lib/preuve-recente";
import { abonnementDeLEntreprise, enregistrerLAbonnement } from "@/server/repositories/abonnements";
import { lireLaFermeture, programmerLaFermeture, retirerLaFermeture } from "@/server/repositories/fermeture-compte";
import { demanderLaResiliation, retirerLaResiliation } from "@/server/paiement/stripe";
import { commentRouvrir, dateDeFermeture } from "@/lib/fermeture-compte";
import { logger } from "@/server/logger";

export type ReponseFermeture = { ok: true } | { ok: false; message: string; preuveExigee?: true };

const INJOIGNABLE = "Le paiement ne répond pas. Réessayez dans un instant.";

export async function fermerLeCompteAction(): Promise<ReponseFermeture> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "fermer le compte");
  try {
    await exigerPreuveRecente(ctx, GESTES_SENSIBLES.fermerLeCompte);
  } catch (e) {
    if (e instanceof PreuveRecenteExigeeError) return { ok: false, message: e.message, preuveExigee: true };
    throw e;
  }

  const maintenant = new Date();
  const { etat } = await lireLaFermeture(ctx, maintenant);
  // Déjà demandée : un second appui ne repousse ni n'avance rien.
  if (etat.statut !== "ouvert") return { ok: true };

  const abonnement = await abonnementDeLEntreprise(ctx);
  const effectiveLe = dateDeFermeture(abonnement, maintenant);

  // **Stripe d'abord, la base ensuite.** Un compte marqué fermé alors que le
  // prélèvement continue serait le pire des deux échecs : il paierait pour un
  // compte qu'il croit fermé. Dans cet ordre, un refus de Stripe laisse tout
  // tel quel, et il réessaie.
  const prelevementEnCours =
    abonnement?.abonnementPrestataire &&
    (abonnement.statut === "actif" || abonnement.statut === "impaye") &&
    !abonnement.annulationDemandee;
  if (prelevementEnCours && abonnement.abonnementPrestataire) {
    const r = await demanderLaResiliation({ abonnementPrestataire: abonnement.abonnementPrestataire, raison: null, texte: null });
    if (!r.ok) {
      logger.warn("Fermeture du compte : la résiliation n'a pas pu être demandée", { entrepriseId: ctx.entrepriseId, erreur: r.erreur });
      return { ok: false, message: INJOIGNABLE };
    }
    await enregistrerLAbonnement(ctx, r.etat);
  }

  await programmerLaFermeture(ctx, effectiveLe, maintenant);
  logger.info("Fermeture du compte demandée", { entrepriseId: ctx.entrepriseId, effectiveLe: effectiveLe.toISOString() });
  revalidatePath("/reglages/donnees/fermer");
  revalidatePath("/");
  return { ok: true };
}

/**
 * « Ne pas fermer » avant l'échéance, ou « Rouvrir mon compte » après, pour
 * un compte qui n'a jamais eu d'abonnement. Un compte passé par l'abonnement,
 * lui, rouvre en se réabonnant : l'écran l'envoie sur Abonnement, et c'est
 * l'abonnement repris qui retire la fermeture (`abonnementRouvreLeCompte`).
 */
export async function rouvrirLeCompteAction(): Promise<ReponseFermeture> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "rouvrir le compte");

  const { etat, aUneLigneDAbonnement } = await lireLaFermeture(ctx);
  const comment = commentRouvrir(etat, aUneLigneDAbonnement);
  if (comment === null) return { ok: true };
  if (comment === "se-reabonner") return { ok: false, message: "Choisissez une formule dans Abonnement pour rouvrir votre compte." };

  if (comment === "annuler") {
    const abonnement = await abonnementDeLEntreprise(ctx);
    if (abonnement?.abonnementPrestataire && abonnement.annulationDemandee) {
      const r = await retirerLaResiliation({ abonnementPrestataire: abonnement.abonnementPrestataire });
      if (!r.ok) return { ok: false, message: INJOIGNABLE };
      await enregistrerLAbonnement(ctx, r.etat);
    }
  }

  await retirerLaFermeture(ctx);
  logger.info("Fermeture du compte retirée", { entrepriseId: ctx.entrepriseId, comment });
  revalidatePath("/reglages/donnees/fermer");
  revalidatePath("/");
  return { ok: true };
}
