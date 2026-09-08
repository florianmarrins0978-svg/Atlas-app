"use server";

import { signIn } from "@/auth";
import { creerSonCompte, type SaisieCompte } from "@/server/repositories/creation-compte";
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
 */

export type EtatCreation = { refus?: string } | undefined;

export async function creerLeCompteAction(saisie: SaisieCompte): Promise<EtatCreation> {
  const source = await sourceDuVisiteur(horsProductionReelle());
  const limite = await verifierLimite(`creation-compte:${source}`, LIMITES.connexion);
  if (!limite.autorise) {
    return { refus: "Trop d’essais depuis cet appareil. Réessayez dans quelques minutes." };
  }

  const resultat = await creerSonCompte(saisie);
  if (!resultat.ok) return { refus: resultat.refus };

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

  return undefined;
}
