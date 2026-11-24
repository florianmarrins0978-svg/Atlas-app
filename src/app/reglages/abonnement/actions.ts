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
import {
  abonnementDeLEntreprise,
  compterLEquipe,
  enregistrerLAbonnement,
  noterLeChangementPrevu,
  retenirLaSessionDeCarte,
} from "@/server/repositories/abonnements";
import { doitPoserSaCarte, joursDEssaiAuPaiement } from "@/lib/essai-avec-carte";
import {
  lireLaSessionDePaiement,
  ouvrirLePaiement,
  ouvrirLeGuichet,
  monterToutDeSuite,
  prevoirALEcheance,
  garderLaFormule,
  demanderLaResiliation,
  retirerLaResiliation,
} from "@/server/paiement/stripe";
import { revalidatePath } from "next/cache";
import { adresseDeRetour, retourConfigure } from "@/server/paiement/retour";
import {
  equipeTientDansLaFormule,
  estFormule,
  estModule,
  estPeriodicite,
  formule,
  jourEnLettres,
  nomDeLAbonnement,
  type ModuleCode,
} from "@/lib/abonnements";
import { changementAVenir, changementDeFormule, memesModules } from "@/lib/changement-de-formule";
import { estRaisonDepart, texteDeDepart } from "@/lib/resiliation";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { logger } from "@/server/logger";

/**
 * **`url` est facultative, et c'est ce qui distingue les deux gestes.**
 * S'abonner envoie chez le prestataire ; changer de formule se fait sans
 * quitter Atlas — l'écran se recharge alors, il ne redirige pas.
 */
export type ReponsePaiement =
  | { ok: true; url?: string }
  | {
      ok: false;
      message: string;
      /** Le débit immédiat n'est pas passé : la feuille propose de changer de carte. */
      paiementRefuse?: boolean;
    };

/**
 * Les phrases lues par le patron. **Aucune ne dit « erreur 500 » ni ne nomme
 * Stripe** : ce qui compte pour lui, c'est s'il doit réessayer ou appeler.
 */
function phrase(
  erreur: "non_configure" | "prestataire_injoignable" | "prestataire_refuse" | "carte_refusee" | "confirmation_bancaire"
): string {
  switch (erreur) {
    case "non_configure":
      return "Le paiement n’est pas encore branché.";
    case "prestataire_injoignable":
      return "La page de paiement ne répond pas. Réessayez dans un instant.";
    case "prestataire_refuse":
      return "Le paiement n’a pas pu s’ouvrir. Réessayez dans un instant.";
    case "carte_refusee":
      return "Carte refusée. Rien n’est débité.";
    case "confirmation_bancaire":
      return "Votre banque demande une confirmation. Rien n’est débité.";
  }
}

/**
 * LES MODULES VOULUS, REVALIDÉS : une action serveur s'appelle sans écran, et un
 * code inventé arriverait tel quel jusqu'au montant. `null` s'il en nomme un
 * qu'Atlas ne connaît pas ; on refuse plutôt que de l'oublier en silence.
 */
function modulesVoulus(brut: unknown): ModuleCode[] | null {
  if (!Array.isArray(brut)) return null;
  if (!brut.every((m) => typeof m === "string" && estModule(m))) return null;
  return [...new Set(brut as ModuleCode[])];
}

/**
 * L'ÉQUIPE TIENT-ELLE DANS LA FORMULE ? L'article 14.6 des conditions générales,
 * et sa réponse du 18 novembre 2026 (« refusé avant ») : choisir Artisan avec
 * des salariés déjà invités se refuse, et la phrase dit qui retirer.
 */
async function refusDeLEquipe(ctx: Awaited<ReturnType<typeof getCurrentCtx>>, formuleVoulue: string): Promise<string | null> {
  return equipeTientDansLaFormule(formuleVoulue, await compterLEquipe(ctx));
}

/**
 * OUVRIR LA PAGE DE PAIEMENT pour une formule et une périodicité.
 *
 * **La formule est REVALIDÉE ici**, même si l'écran ne propose que trois
 * boutons : une action serveur est appelable directement, et un code inventé
 * arriverait tel quel jusqu'au montant envoyé au prestataire.
 */
export async function sabonnerAction(
  formuleVoulue: string,
  periodiciteVoulue: string,
  modulesBruts: unknown,
  depuis?: unknown
): Promise<ReponsePaiement> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "ouvrir la page de paiement");

  const modules = modulesVoulus(modulesBruts);
  if (!estFormule(formuleVoulue) || !estPeriodicite(periodiciteVoulue) || !modules) {
    return { ok: false, message: "Cette formule n’existe pas." };
  }
  // Avant la page de paiement : refuser après qu'il a payé serait pire.
  const equipe = await refusDeLEquipe(ctx, formuleVoulue);
  if (equipe) return { ok: false, message: equipe };

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

  const [entreprise, abonnement] = await Promise.all([getEntreprise(ctx), abonnementDeLEntreprise(ctx)]);

  // **LA CARTE DE L'ESSAI** (le modèle A, migration 0199) : tant qu'elle reste
  // à poser, s'abonner, c'est la poser, avec ses jours d'essai et rien de
  // débité avant. Ce que « Votre essai » annonce sort de la même règle
  // (`joursDEssaiAuPaiement`). Une session déjà ouverte se relit d'abord : il a
  // pu payer puis fermer l'onglet, et une seconde ouvrirait un second
  // abonnement.
  const carte = doitPoserSaCarte(abonnement);
  if (carte && abonnement?.sessionDeCarte && (await carteDejaPosee(ctx, abonnement.sessionDeCarte))) {
    return { ok: true };
  }
  const retour = depuis === "essai" && carte ? "/essai" : "/reglages/abonnement";

  const r = await ouvrirLePaiement({
    entrepriseId: ctx.entrepriseId,
    email: entreprise?.email ?? null,
    formule: formuleVoulue,
    periodicite: periodiciteVoulue,
    modules,
    // `{CHECKOUT_SESSION_ID}` est remplacé par le prestataire au moment de la
    // redirection : c'est par là que l'écran de retour sait quoi relire.
    retourSucces: adresseDeRetour(`${retour}?paiement={CHECKOUT_SESSION_ID}`),
    retourAbandon: adresseDeRetour(`${retour}?paiement=abandon`),
    ...(carte && abonnement ? { joursDEssai: joursDEssaiAuPaiement(abonnement) } : {}),
  });

  if (!r.ok) return { ok: false, message: phrase(r.erreur) };
  if (carte && r.session) await retenirLaSessionDeCarte(ctx, r.session);
  return { ok: true, url: r.url };
}

/**
 * La session retenue a-t-elle posé la carte ? Si oui, l'abonnement s'enregistre
 * comme au retour du paiement, par la même fonction, et rien ne se rouvre.
 * L'entreprise de la session est comparée à la sienne : la règle du retour
 * (`page.tsx`).
 */
async function carteDejaPosee(ctx: Awaited<ReturnType<typeof getCurrentCtx>>, session: string): Promise<boolean> {
  const lu = await lireLaSessionDePaiement(session);
  if (!lu.ok || lu.entrepriseId !== ctx.entrepriseId) return false;
  await enregistrerLAbonnement(ctx, lu.etat);
  return true;
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
 * CHANGER DE FORMULE — ce que la feuille vient d'annoncer, et rien d'autre
 * (ses décisions du 23 novembre 2026, `src/lib/changement-de-formule.ts`).
 *
 * **La même règle que la feuille** : `changementDeFormule` décide ici ce qui
 * part tout de suite et ce qui attend l'échéance, comme elle l'a décidé à
 * l'écran. Une action qui recalculerait à sa façon pourrait débiter un autre
 * montant que celui qu'il vient de lire.
 *
 * **Pourquoi ce n'est PAS `sabonnerAction`.** Ouvrir une page de paiement pour
 * qui est déjà abonné créerait un SECOND abonnement vivant à côté du premier :
 * il serait prélevé deux fois, tous les mois, et rien à l'écran ne le dirait.
 *
 * **L'état est réécrit tout de suite**, sans attendre le crochet : le patron
 * revient sur son écran dans la seconde, et y lire encore l'ancienne formule
 * lui ferait rappuyer.
 */
export async function changerDeFormuleAction(
  formuleVoulue: string,
  periodiciteVoulue: string,
  modulesBruts: unknown
): Promise<ReponsePaiement> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "changer de formule");

  const modules = modulesVoulus(modulesBruts);
  if (!estFormule(formuleVoulue) || !estPeriodicite(periodiciteVoulue) || !modules) {
    return { ok: false, message: "Cette formule n’existe pas." };
  }
  // **Pas de refus de l'équipe ici** : sa décision du 23 novembre 2026 remplace
  // celle du 18 pour qui est déjà abonné. Une formule trop petite pour son
  // équipe ne peut être qu'une descente, qui attend l'échéance : la feuille
  // dit quels accès partiront, et le crochet les retire ce jour-là
  // (`lesComptesQuiPartent`). Le refus reste pour s'abonner (`sabonnerAction`).

  const limite = await verifierLimite(`ouvrirLePaiement:${ctx.entrepriseId}`, LIMITES.ouvrirLePaiement);
  if (!limite.autorise) {
    return { ok: false, message: "Vous venez de changer de formule. Patientez un instant." };
  }

  const abonnement = await abonnementDeLEntreprise(ctx);
  if (!abonnement?.abonnementPrestataire || abonnement.statut !== "actif") {
    return { ok: false, message: "Vous n’avez pas d’abonnement en cours." };
  }

  const nomActuel = nomDeLAbonnement(abonnement.formule, abonnement.modules);
  const voulu = { formule: formuleVoulue, periodicite: periodiciteVoulue, modules };
  const prevu = changementAVenir(abonnement);
  const changement = changementDeFormule(
    { formule: abonnement.formule, periodicite: abonnement.periodicite, modules: abonnement.modules },
    voulu
  );
  if (changement.genre === "aucun") return { ok: false, message: "C’est déjà votre formule." };

  if (changement.genre === "tout-de-suite") {
    // **Une descente prévue se retire d'abord**, d'un geste à lui (« Garder ») :
    // monter par-dessus la ferait disparaître sans qu'il l'ait vu, et un débit
    // refusé la laisserait perdue.
    if (prevu && abonnement.periodeFin) {
      const nomPrevu = nomDeLAbonnement(prevu.formule, prevu.modules);
      return {
        ok: false,
        message: `${nomPrevu} est prévu le ${jourEnLettres(abonnement.periodeFin)}. Touchez d’abord « Garder ${formule(abonnement.formule)?.nom ?? abonnement.formule} ».`,
      };
    }
    const r = await monterToutDeSuite({
      abonnementPrestataire: abonnement.abonnementPrestataire,
      formule: formuleVoulue,
      periodicite: periodiciteVoulue,
      modules,
      facon: changement.facon,
    });
    if (!r.ok) {
      // Sa phrase de la planche : la formule ne change pas, et une ligne le dit.
      const reste = `Vous restez sur ${nomActuel}, rien n’est débité.`;
      if (r.erreur === "carte_refusee") return { ok: false, paiementRefuse: true, message: `Carte refusée. ${reste}` };
      if (r.erreur === "confirmation_bancaire") {
        return { ok: false, paiementRefuse: true, message: `Votre banque demande une confirmation. ${reste}` };
      }
      return { ok: false, message: phrase(r.erreur) };
    }
    await enregistrerLAbonnement(ctx, r.etat);
    revalidatePath("/reglages/abonnement");
    return { ok: true };
  }

  // À l'échéance : déjà prévue telle quelle, rien à refaire.
  if (
    prevu &&
    prevu.formule === voulu.formule &&
    prevu.periodicite === voulu.periodicite &&
    memesModules(prevu.modules, voulu.modules)
  ) {
    return { ok: true };
  }

  const r = await prevoirALEcheance({
    abonnementPrestataire: abonnement.abonnementPrestataire,
    formule: formuleVoulue,
    periodicite: periodiciteVoulue,
    modules,
  });
  if (!r.ok) return { ok: false, message: phrase(r.erreur) };

  await enregistrerLAbonnement(ctx, r.etat);
  await noterLeChangementPrevu(ctx, voulu);
  revalidatePath("/reglages/abonnement");
  return { ok: true };
}

/**
 * « GARDER ENTREPRISE » — la descente prévue est retirée (planche du
 * 23 novembre 2026). Sans ce geste, changer d'avis voudrait dire attendre
 * l'échéance, puis repayer le prix entier pour remonter.
 */
export async function garderLaFormuleAction(): Promise<ReponsePaiement> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "garder sa formule");

  const limite = await verifierLimite(`ouvrirLePaiement:${ctx.entrepriseId}`, LIMITES.ouvrirLePaiement);
  if (!limite.autorise) return { ok: false, message: "Patientez un instant, puis réessayez." };

  const abonnement = await abonnementDeLEntreprise(ctx);
  if (!abonnement?.abonnementPrestataire || !changementAVenir(abonnement)) {
    return { ok: false, message: "Aucun changement n’est prévu." };
  }

  const r = await garderLaFormule({ abonnementPrestataire: abonnement.abonnementPrestataire });
  if (!r.ok) return { ok: false, message: phrase(r.erreur) };

  await enregistrerLAbonnement(ctx, r.etat);
  await noterLeChangementPrevu(ctx, null);
  revalidatePath("/reglages/abonnement");
  return { ok: true };
}

/**
 * RÉSILIER, depuis « Avant de partir » — à l'échéance, avec sa raison et son
 * texte s'il en a donné (planche du 18 octobre 2026, `docs/A-FAIRE.md` §17).
 *
 * **Facile, et c'est voulu** : il a vu la formule moins chère et la question,
 * il a dit non ; un second barrage le ferait passer par sa banque. Rien n'est
 * coupé aujourd'hui : il garde tout jusqu'à la date payée.
 *
 * La raison et le texte sont REVALIDÉS ici : l'action est appelable
 * directement, et un texte sans borne partirait tel quel chez le prestataire.
 */
export async function resilierAction(raison: string | null, texte: string | null): Promise<ReponsePaiement> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "résilier l’abonnement");

  const limite = await verifierLimite(`ouvrirLePaiement:${ctx.entrepriseId}`, LIMITES.ouvrirLePaiement);
  if (!limite.autorise) return { ok: false, message: "Patientez un instant, puis réessayez." };

  const abonnement = await abonnementDeLEntreprise(ctx);
  if (!abonnement?.abonnementPrestataire || abonnement.statut !== "actif") {
    return { ok: false, message: "Vous n’avez pas d’abonnement en cours." };
  }

  const r = await demanderLaResiliation({
    abonnementPrestataire: abonnement.abonnementPrestataire,
    raison: estRaisonDepart(raison) ? raison : null,
    texte: texteDeDepart(texte),
  });
  if (!r.ok) return { ok: false, message: phrase(r.erreur) };

  logger.info("Résiliation demandée", { entrepriseId: ctx.entrepriseId, raison: estRaisonDepart(raison) ? raison : null });
  await enregistrerLAbonnement(ctx, r.etat);
  revalidatePath("/reglages/abonnement");
  return { ok: true };
}

/** « Ne pas arrêter » : il change d'avis avant l'échéance, l'abonnement continue. */
export async function nePasArreterAction(): Promise<ReponsePaiement> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "reprendre l’abonnement");

  const abonnement = await abonnementDeLEntreprise(ctx);
  if (!abonnement?.abonnementPrestataire || !abonnement.annulationDemandee) {
    return { ok: false, message: "Aucune résiliation en cours." };
  }

  const r = await retirerLaResiliation({ abonnementPrestataire: abonnement.abonnementPrestataire });
  if (!r.ok) return { ok: false, message: phrase(r.erreur) };

  await enregistrerLAbonnement(ctx, r.etat);
  revalidatePath("/reglages/abonnement");
  return { ok: true };
}

