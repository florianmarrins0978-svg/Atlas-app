"use server";

import { signIn } from "@/auth";
import { creerSonCompte, type SaisieCompte } from "@/server/repositories/creation-compte";
import { ouvrirLaVerification } from "@/server/repositories/verification-email";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { horsProductionReelle, sourceDuVisiteur } from "@/server/source-visiteur";
import { logger } from "@/server/logger";

/**
 * L'action de la porte : créer le compte, puis ouvrir la session.
 *
 * **ELLE OUVRE LA SESSION ELLE-MÊME, et c'est ce qui évite le pire écran du
 * parcours** : celui où l'on vient de répondre à seize questions et où l'on
 * retombe sur « Adresse » et « Mot de passe », à retaper ce qu'on vient
 * d'écrire. `signIn` est appelé avec le mot de passe en clair qu'on a encore —
 * il ne sort pas d'ici.
 *
 * **LE LIMITEUR EST LÀ POUR UNE AUTRE RAISON QUE LA CONNEXION.** Sur `/login`
 * il protège un compte des essais répétés ; ici il protège la BASE : sans lui,
 * cette adresse crée une entreprise par appel, aussi vite qu'on les envoie.
 *
 * **ET ELLE OUVRE LA VÉRIFICATION DE L'ADRESSE — 14 septembre 2026.** Il a
 * créé son compte avec une adresse inventée, et il est entré : *« il faut
 * mettre une sécurité avec un numéro envoyé par email »*. Le compte est créé,
 * la session ouverte, mais la porte reste fermée (`GardeVerificationEmail`)
 * tant que le code reçu n'a pas été entré. `codeEnvoyeA` dit à l'écran où
 * regarder ; `avertissement` dit si l'envoi lui-même a échoué — le compte
 * existe quand même, et « Renvoyer » reste possible.
 */

export type EtatCreation =
  | { refus: string }
  | { refus?: undefined; codeEnvoyeA: string; avertissement?: string }
  | undefined;

export async function creerLeCompteAction(saisie: SaisieCompte): Promise<EtatCreation> {
  const source = await sourceDuVisiteur(horsProductionReelle());
  const limite = await verifierLimite(`creation-compte:${source}`, LIMITES.connexion);
  if (!limite.autorise) {
    return { refus: "Trop d’essais depuis cet appareil. Réessayez dans quelques minutes." };
  }

  const resultat = await creerSonCompte(saisie);
  if (!resultat.ok) return { refus: resultat.refus };

  // La ligne d'attente est écrite AVANT d'ouvrir la session : une session
  // ouverte sur un compte sans ligne serait un compte entré sans code.
  const adresse = saisie.email.trim();
  const envoi = await ouvrirLaVerification(resultat.utilisateurId, adresse);

  try {
    await signIn("credentials", {
      email: saisie.email,
      password: saisie.motDePasse,
      redirect: false,
    });
  } catch (erreur) {
    // **Le compte EXISTE : on ne le refait pas, et on ne ment pas non plus.**
    // Si l'ouverture de session échoue, tout le reste est enregistré — il ne
    // manque qu'une session. L'écran l'envoie donc se connecter, ce qui marche,
    // plutôt que de lui laisser croire que rien n'a été créé.
    logger.error("Session non ouverte après la création du compte", {
      erreur: erreur instanceof Error ? erreur.message : String(erreur),
    });
    return { refus: "Votre compte est créé. Connectez-vous pour entrer." };
  }

  return { codeEnvoyeA: adresse, avertissement: envoi.ok ? undefined : envoi.refus };
}
