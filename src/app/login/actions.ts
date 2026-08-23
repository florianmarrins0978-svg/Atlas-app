"use server";

import { headers } from "next/headers";
import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { logger } from "@/server/logger";
import { getEnv } from "@/server/env";
import { messageAttente as messageTemporisation } from "@/lib/tentatives-connexion";
import { sourceDepuisEntetes } from "@/lib/source-visiteur";
import { attenteAvantEssai, noterEchec, oublierEchecs } from "@/server/repositories/tentatives-connexion";

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
async function sourceDuVisiteur(): Promise<string> {
  const entetes = await headers();
  // La règle vit dans `src/lib/source-visiteur.ts` — fonction pure, éprouvée
  // sans requête HTTP. Ici, on ne fait que lui donner ce que le serveur voit.
  return sourceDepuisEntetes({
    xff: entetes.get("x-forwarded-for"),
    sauts: getEnv().proxySauts,
    // **Sur un banc, on distingue encore les visiteurs par leur adresse.**
    // Sans cela, tout le monde retomberait dans le même seau — cinq essais à se
    // partager sur un compte de démonstration unique, c'est-à-dire la panne du
    // 6 août 2026, recréée par le remède. Voir `src/lib/source-visiteur.ts`.
    horsProduction: getEnv().nodeEnv !== "production" || getEnv().bancDEssai,
  });
}

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
  const source = await sourceDuVisiteur();
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
  const attente = await attenteAvantEssai(email);
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
        await noterEchec(email);
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
  await oublierEchecs(email);
  redirect("/");
}

export async function deconnexionAction() {
  await signOut({ redirectTo: "/login" });
}
