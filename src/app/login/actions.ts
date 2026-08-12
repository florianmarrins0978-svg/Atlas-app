"use server";

import { headers } from "next/headers";
import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { logger } from "@/server/logger";

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
 * L'adresse du visiteur, telle que la voit le serveur.
 *
 * Derrière le proxy de Codespaces comme derrière un hébergeur, l'adresse réelle
 * n'arrive que par `x-forwarded-for`. Absente, on retombe sur une clé commune :
 * le comptage redevient alors celui d'avant, jamais plus permissif.
 */
async function adresseVisiteur(): Promise<string> {
  const entetes = await headers();
  const transmise = entetes.get("x-forwarded-for")?.split(",")[0]?.trim();
  return transmise || entetes.get("x-real-ip") || "inconnue";
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
  const ip = await adresseVisiteur();
  const parVisiteur = await verifierLimite(`connexion:${email}:${ip}`, LIMITES.connexion);
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
  redirect("/");
}

export async function deconnexionAction() {
  await signOut({ redirectTo: "/login" });
}
