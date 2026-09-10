"use server";

/**
 * S'ABONNER, ET GÉRER SON ABONNEMENT — les deux seuls gestes de cet écran.
 *
 * **Ni l'une ni l'autre n'encaisse quoi que ce soit.** Elles ouvrent une page
 * hébergée par le prestataire, et c'est tout : aucun numéro de carte ne
 * traverse Atlas, jamais. C'est ce qui fait qu'un défaut d'ici ne peut pas
 * coûter un moyen de paiement.
 *
 * **Réservées au patron.** Ce qui engage l'entreprise pour un an ne s'ouvre
 * pas à un commercial (`docs/QUESTIONS.md` §10).
 */

import { getCurrentCtx } from "@/server/session-ctx";
import { exigerProprietaire } from "@/server/autorisation";
import { getEntreprise } from "@/server/repositories/entreprises";
import { abonnementDeLEntreprise, enregistrerLAbonnement } from "@/server/repositories/abonnements";
import { ouvrirLePaiement, ouvrirLeGuichet, changerLaFormule } from "@/server/paiement/stripe";
import { revalidatePath } from "next/cache";
import { adresseDeRetour, retourConfigure } from "@/server/paiement/retour";
import { estFormule, estPeriodicite } from "@/lib/abonnements";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { logger } from "@/server/logger";

/**
 * **`url` est facultative, et c'est ce qui distingue les deux gestes.**
 * S'abonner envoie chez le prestataire ; changer de formule se fait sans
 * quitter Atlas — l'écran se recharge alors, il ne redirige pas.
 */
export type ReponsePaiement = { ok: true; url?: string } | { ok: false; message: string };

/**
 * Les phrases lues par le patron. **Aucune ne dit « erreur 500 » ni ne nomme
 * Stripe** : ce qui compte pour lui, c'est s'il doit réessayer ou appeler.
 */
function phrase(erreur: "non_configure" | "prestataire_injoignable" | "prestataire_refuse"): string {
  switch (erreur) {
    case "non_configure":
      return "Le paiement n’est pas encore branché.";
    case "prestataire_injoignable":
      return "La page de paiement ne répond pas. Réessayez dans un instant.";
    case "prestataire_refuse":
      return "Le paiement n’a pas pu s’ouvrir. Réessayez dans un instant.";
  }
}

/**
 * OUVRIR LA PAGE DE PAIEMENT pour une formule et une périodicité.
 *
 * **La formule est REVALIDÉE ici**, même si l'écran ne propose que trois
 * boutons : une action serveur est appelable directement, et un code inventé
 * arriverait tel quel jusqu'au montant envoyé au prestataire.
 */
export async function sabonnerAction(formuleVoulue: string, periodiciteVoulue: string): Promise<ReponsePaiement> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "ouvrir la page de paiement");

  if (!estFormule(formuleVoulue) || !estPeriodicite(periodiciteVoulue)) {
    return { ok: false, message: "Cette formule n’existe pas." };
  }

  // **Vérifié AVANT d'appeler le prestataire, et non par une exception.** Sans
  // adresse de retour, `adresseDeRetour` lève — et le message d'une exception
  // levée dans une action serveur n'arrive jamais jusqu'au patron (`AGENTS.md`,
  // piège 0 ter) : il verrait une page cassée au lieu d'une phrase.
  if (!retourConfigure()) return { ok: false, message: phrase("non_configure") };

  // **Une cadence, parce que chaque appui crée un objet chez le prestataire.**
  // Sans elle, un double appui nerveux — celui d'un artisan sur un réseau lent
  // — fabrique autant de sessions de paiement qu'il y a d'appuis, et elles
  // encombrent son tableau de bord le jour où il cherche la bonne.
  const limite = await verifierLimite(`ouvrirLePaiement:${ctx.entrepriseId}`, LIMITES.ouvrirLePaiement);
  if (!limite.autorise) {
    return { ok: false, message: "Vous venez d’ouvrir le paiement. Patientez un instant." };
  }

  const entreprise = await getEntreprise(ctx);

  const r = await ouvrirLePaiement({
    entrepriseId: ctx.entrepriseId,
    email: entreprise?.email ?? null,
    formule: formuleVoulue,
    periodicite: periodiciteVoulue,
    // `{CHECKOUT_SESSION_ID}` est remplacé par le prestataire au moment de la
    // redirection : c'est par là que l'écran de retour sait quoi relire.
    retourSucces: adresseDeRetour("/reglages/abonnement?paiement={CHECKOUT_SESSION_ID}"),
    retourAbandon: adresseDeRetour("/reglages/abonnement?paiement=abandon"),
  });

  if (!r.ok) return { ok: false, message: phrase(r.erreur) };
  return { ok: true, url: r.url };
}

/**
 * OUVRIR LE GUICHET — changer de carte, retélécharger ses factures, résilier.
 *
 * Il est hébergé par le prestataire, et c'est délibéré : cet écran-là porte
 * des obligations d'information qui bougent avec la loi.
 *
 * **Le changement de formule, lui, ne passe PAS par là** : le guichet ne sait
 * proposer que des formules déclarées à la main chez le prestataire, ce qui
 * serait une seconde grille tarifaire (voir `prixDeLaFormule`). Il se fait
 * dans Atlas — `changerDeFormuleAction`, plus bas.
 */
export async function ouvrirLeGuichetAction(): Promise<ReponsePaiement> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "ouvrir le guichet d’abonnement");

  if (!retourConfigure()) return { ok: false, message: phrase("non_configure") };

  const abonnement = await abonnementDeLEntreprise(ctx);
  if (!abonnement?.clientPrestataire) {
    // Ce n'est pas une panne : il n'a simplement jamais payé. Le dire
    // autrement l'enverrait chercher un défaut qui n'existe pas.
    logger.info("Guichet demandé sans abonnement", { entrepriseId: ctx.entrepriseId });
    return { ok: false, message: "Vous n’avez pas encore d’abonnement." };
  }

  const r = await ouvrirLeGuichet({
    clientPrestataire: abonnement.clientPrestataire,
    retour: adresseDeRetour("/reglages/abonnement"),
  });

  if (!r.ok) return { ok: false, message: phrase(r.erreur) };
  return { ok: true, url: r.url };
}

/**
 * CHANGER DE FORMULE — au prorata, sans repasser par la carte.
 *
 * **Pourquoi ce n'est PAS `sabonnerAction`.** Ouvrir une page de paiement pour
 * qui est déjà abonné créerait un SECOND abonnement vivant à côté du premier :
 * il serait prélevé deux fois, tous les mois, et rien à l'écran ne le dirait.
 * C'est le défaut le plus cher que cet écran puisse produire.
 *
 * **L'état est réécrit tout de suite**, sans attendre le crochet : le patron
 * revient sur son écran dans la seconde, et y lire encore l'ancienne formule
 * lui ferait rappuyer.
 */
export async function changerDeFormuleAction(
  formuleVoulue: string,
  periodiciteVoulue: string
): Promise<ReponsePaiement> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "changer de formule");

  if (!estFormule(formuleVoulue) || !estPeriodicite(periodiciteVoulue)) {
    return { ok: false, message: "Cette formule n’existe pas." };
  }

  const limite = await verifierLimite(`ouvrirLePaiement:${ctx.entrepriseId}`, LIMITES.ouvrirLePaiement);
  if (!limite.autorise) {
    return { ok: false, message: "Vous venez de changer de formule. Patientez un instant." };
  }

  const abonnement = await abonnementDeLEntreprise(ctx);
  if (!abonnement?.abonnementPrestataire) {
    return { ok: false, message: "Vous n’avez pas encore d’abonnement." };
  }

  const r = await changerLaFormule({
    abonnementPrestataire: abonnement.abonnementPrestataire,
    formule: formuleVoulue,
    periodicite: periodiciteVoulue,
  });
  if (!r.ok) return { ok: false, message: phrase(r.erreur) };

  await enregistrerLAbonnement(ctx, r.etat);
  revalidatePath("/reglages/abonnement");
  return { ok: true };
}
