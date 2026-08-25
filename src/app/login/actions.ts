"use server";

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { logger } from "@/server/logger";
import { messageAttente as messageTemporisation, porteeTemporisation } from "@/lib/tentatives-connexion";
import { horsProductionReelle, sourceDuVisiteur } from "@/server/source-visiteur";
import { attenteAvantEssai, noterEchec, oublierEchecs } from "@/server/repositories/tentatives-connexion";
import { messageRefusCle } from "@/lib/cle-appareil";
import { optionsConnexion } from "@/server/cle-appareil";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/types";

/** Ce que le navigateur attend pour ouvrir la fenêtre du système. */
type OptionsPubliquesConnexion = PublicKeyCredentialRequestOptionsJSON;

const MESSAGE_GENERIQUE = "Email ou mot de passe incorrect.";

/**
 * Ce qu'on répond quand on n'a **pas pu** vérifier — ce qui n'est pas du tout la
 * même chose que « c'est faux ».
 *
 * **Le 12 août 2026 :** *« ça ne marche pas, je n'arrive pas à me connecter »*.
 * La base de données de son espace était arrêtée. La requête qui cherche son
 * compte échouait, Auth.js l'emballait dans une `AuthError` — et cet écran,
 * qui les traitait toutes pareil, lui répondait **« Email ou mot de passe
 * incorrect »**. Il pouvait retaper son mot de passe toute la nuit.
 *
 * C'est le défaut que l'en-tête de ce fichier interdit déjà, sous sa troisième
 * forme : *ne jamais répondre « mot de passe incorrect » à quelqu'un dont le mot
 * de passe est bon.* On l'avait réparé pour le blocage par tentatives ; la panne
 * d'un service, elle, retombait encore dans le même piège.
 *
 * Le message ne nomme pas la pièce en panne — il n'a pas à révéler l'intérieur —
 * mais il dit les deux choses qui comptent : **ce n'est pas vous**, et ça se
 * répare du côté du service. Le journal, lui, dit tout.
 */
const MESSAGE_SERVICE_INDISPONIBLE =
  "Impossible de vérifier vos identifiants : un service d'Atlas ne répond pas. " +
  "Ce n'est pas votre mot de passe. Réessayez dans un instant.";

/**
 * **Ne jamais répondre « mot de passe incorrect » à quelqu'un dont le mot de
 * passe est bon.**
 *
 * Le 6 août 2026, le patron donne l'adresse de l'application à ses parents pour
 * qu'ils l'essaient. Ils saisissent les bons identifiants et lisent « Email ou
 * mot de passe incorrect ». Ils recommencent, évidemment — ce que dit le
 * message —, et s'enfoncent : chaque tentative rallonge le blocage.
 *
 * Deux causes, et les deux sont réparées ici :
 *
 * 1. le compteur était tenu **par email**, alors que le banc d'essai partage un
 *    compte unique : les essais des uns bloquaient les autres. Il est désormais
 *    tenu par email **et adresse IP** — un visiteur ne peut plus verrouiller
 *    son voisin ;
 * 2. le message mentait. On préférait taire le blocage pour ne pas révéler
 *    qu'un email existe — protection dérisoire (celui qui martèle un compte le
 *    sait déjà) payée d'un prix total : l'utilisateur légitime n'a aucun moyen
 *    de comprendre, et conclut que l'application est cassée.
 */
function messageAttente(secondes: number): string {
  const minutes = Math.max(1, Math.ceil(secondes / 60));
  return `Trop de tentatives depuis cet appareil. Réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}.`;
}

// **D'où vient une requête** — la fonction, et le raisonnement qui la
// justifie, vivent dans `src/server/source-visiteur.ts`. Elle en a été sortie
// le 25 août 2026 : la réponse publique à un devis (constat F9) a besoin de la
// même, et deux implémentations d'une même règle finissent toujours par
// diverger (`CLAUDE.md` §3).

// `horsProductionReelle` y a suivi, pour la même raison.

export async function connexionAction(
  _etatPrecedent: { erreur?: string } | undefined,
  formData: FormData
): Promise<{ erreur?: string }> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  // Par visiteur d'abord — c'est ce seuil qui protège du martèlement, et lui
  // seul peut bloquer quelqu'un de bonne foi, d'où un message qui le dit.
  const horsProduction = horsProductionReelle();
  const source = await sourceDuVisiteur(horsProduction);
  const parVisiteur = await verifierLimite(`connexion:${email}:${source}`, LIMITES.connexion);
  if (!parVisiteur.autorise) {
    logger.warn("Limite de tentatives de connexion atteinte (visiteur)", { email });
    return { erreur: messageAttente(parVisiteur.retryAfterSecondes) };
  }

  // Puis par compte, très large : inoffensif à l'usage, il freine une attaque
  // répartie sur beaucoup d'adresses IP que le seuil précédent laisserait
  // passer. Message identique — un attaquant n'apprend rien de plus.
  //
  // La clé commence par `connexion:` à dessein : c'est le motif que le lanceur
  // des suites navigateur remet à zéro entre deux suites
  // (`scripts/run-e2e-tests.ts`). Nommée autrement, elle aurait accumulé les
  // connexions de trente-trois suites et fini par bloquer la batterie
  // elle-même — un contrôle qui casse ce qu'il vérifie.
  const parCompte = await verifierLimite(`connexion:compte:${email}`, LIMITES.connexionParCompte);
  if (!parCompte.autorise) {
    logger.warn("Limite de tentatives de connexion atteinte (compte)", { email });
    return { erreur: messageAttente(parCompte.retryAfterSecondes) };
  }

  /**
   * **La couche qui tient quand les deux précédentes ne tiennent plus.**
   *
   * Les deux seuils ci-dessus vivent dans Redis, et Redis tombe : le 12 août
   * 2026 il est tombé sur l'espace du patron, et depuis, un magasin qui ne
   * répond pas ne refuse plus rien (`server/rate-limit/index.ts` — la bascule
   * sur le compteur mémoire est de ce lot-ci, mais elle reste par instance).
   * Autrement dit, avant aujourd'hui, il suffisait d'attendre une panne pour
   * n'avoir plus aucune limite du tout.
   *
   * Celle-ci vit **en base**, avec les données. Elle est là tant qu'Atlas sert,
   * elle compte les échecs CONSÉCUTIFS de ce compte, elle s'oublie toute seule
   * au bout d'une heure sans nouvel échec, et une connexion réussie l'efface.
   * La règle des paliers est une fonction pure, éprouvée sans base :
   * `src/lib/tentatives-connexion.ts`.
   *
   * **Posée AVANT `signIn`**, donc avant toute comparaison de condensat : c'est
   * ce qui rend la temporisation réelle plutôt que cosmétique.
   */
  /**
   * **SUR QUOI on compte, et pourquoi ce n'est pas toujours le seul compte.**
   *
   * La règle vit dans `src/lib/tentatives-connexion.ts` et s'y explique : le
   * compte seul en production — c'est ce qui casse une attaque répartie sur
   * beaucoup d'adresses —, le compte ET la source ailleurs, pour que les
   * visiteurs d'un banc partageant un compte unique ne se verrouillent pas les
   * uns les autres. C'est l'invariant du 6 août 2026, et une suite le tient
   * (`test-connexion-limite-e2e.ts`).
   */
  const portee = porteeTemporisation({ email, source, horsProduction });

  const attente = await attenteAvantEssai(portee);
  if (attente !== null) {
    logger.warn("Connexion temporisée : trop d'échecs consécutifs sur ce compte", { email });
    return { erreur: messageTemporisation(attente) };
  }

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (err) {
    if (err instanceof AuthError) {
      // **Un seul type d'erreur veut dire « ces identifiants sont faux ».**
      // Tous les autres veulent dire « on n'a pas pu vérifier » — base de
      // données arrêtée, secret manquant, panne du fournisseur. Les confondre,
      // c'est accuser le patron de se tromper de mot de passe pendant qu'un
      // service est couché, et il n'a alors aucun moyen de le comprendre.
      if (err.type === "CredentialsSignin") {
        // **Un échec, et un seul type d'échec, fait avancer le compteur.** Une
        // base couchée ou un secret manquant ne sont pas des essais ratés :
        // les compter temporiserait l'artisan pour une panne qui n'est pas la
        // sienne — le piège que la branche du dessous existe pour éviter.
        await noterEchec(portee);
        return { erreur: MESSAGE_GENERIQUE };
      }
      // Bruyant à dessein : c'est la seule trace qui restera, et le message
      // rendu à l'écran ne dit volontairement pas ce qui est en panne.
      logger.error("Connexion impossible : la vérification des identifiants a échoué", {
        email,
        type: err.type,
        cause: err.cause instanceof Error ? err.cause.message : String(err.cause ?? ""),
      });
      return { erreur: MESSAGE_SERVICE_INDISPONIBLE };
    }
    throw err;
  }

  // **Le compteur repart de zéro — et il faut que ce soit ici.** Un artisan qui
  // se trompe quatre fois puis se rappelle son mot de passe ne doit pas rester
  // à un doigt de la temporisation pendant l'heure qui suit. Posé avant
  // `redirect()`, qui lève et ne rend jamais la main.
  await oublierEchecs(portee);
  redirect("/");
}

/**
 * « Ouvrir avec Face ID », premier temps : le défi qu'on envoie au téléphone.
 *
 * **Rendu en valeur, jamais levé.** Sur cette page, une exception d'action
 * serveur n'arrive pas jusqu'à l'artisan — Next.js la remplace en production
 * par un identifiant opaque (`HANDOVER.md`, piège 0 ter). Un refus se rend.
 */
export async function defiConnexionAction(): Promise<
  { ok: true; options: OptionsPubliquesConnexion } | { ok: false }
> {
  const source = await sourceDuVisiteur(horsProductionReelle());
  const limite = await verifierLimite(`cle-appareil:${source}`, LIMITES.cleAppareil);
  if (!limite.autorise) {
    logger.warn("Trop de demandes de défi Face ID depuis cette source");
    return { ok: false };
  }

  const r = await optionsConnexion();
  if (!r.ok) return { ok: false };
  return { ok: true, options: r.options };
}

/**
 * « Ouvrir avec Face ID », second temps : la signature, et la session.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE CHEMIN N'APPELLE JAMAIS `noterEchec`, et c'est délibéré.** Un visage mal
 * reconnu — poussière sur l'objectif, lumière rasante, casquette — n'est pas un
 * essai de mot de passe raté. Le compter temporiserait le compte de l'artisan
 * parce que son propre téléphone ne l'a pas reconnu : ce serait la panne du
 * 6 août 2026 refaite par l'autre bord, et il ne comprendrait pas davantage.
 *
 * Ce qui borne l'abus ici, c'est le seuil ci-dessus — un coût, pas un secret :
 * une signature ne se devine pas (`src/server/rate-limit/types.ts`).
 *
 * **Et il n'efface pas non plus le compteur du mot de passe.** Entrer par le
 * visage ne prouve rien sur les essais de mot de passe qui ont précédé : si
 * quelqu'un martèle le compte, la temporisation doit tenir.
 */
export async function connexionParCleAction(reponse: string): Promise<{ erreur?: string }> {
  const source = await sourceDuVisiteur(horsProductionReelle());
  const limite = await verifierLimite(`cle-appareil:${source}`, LIMITES.cleAppareil);
  if (!limite.autorise) return { erreur: messageRefusCle("panne") ?? MESSAGE_GENERIQUE };

  try {
    await signIn("cle-appareil", { reponse, redirect: false });
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.type === "CredentialsSignin") {
        // La cause exacte est déjà au journal, écrite par `ouvrirAvecCle` — la
        // refaire parler ici demanderait de rejouer la vérification, donc de
        // l'écrire deux fois (`CLAUDE.md` §3). Ce que lit l'artisan ne
        // l'accuse pas, et surtout n'accuse pas son mot de passe.
        return { erreur: messageRefusCle("panne") ?? undefined };
      }
      logger.error("Face ID impossible : la vérification a échoué", {
        type: err.type,
        cause: err.cause instanceof Error ? err.cause.message : String(err.cause ?? ""),
      });
      return { erreur: MESSAGE_SERVICE_INDISPONIBLE };
    }
    throw err;
  }

  redirect("/");
}

export async function deconnexionAction() {
  await signOut({ redirectTo: "/login" });
}
