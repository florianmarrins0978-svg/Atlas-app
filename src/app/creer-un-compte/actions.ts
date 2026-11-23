"use server";

import { signIn } from "@/auth";
import { creerSonCompte, type SaisieCompte } from "@/server/repositories/creation-compte";
import { ouvrirLaVerification } from "@/server/repositories/verification-email";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { horsProductionReelle, sourceDuVisiteur } from "@/server/source-visiteur";
import { logger } from "@/server/logger";
import { sirenDeLEssai } from "@/lib/siren";
import { demanderAuRegistre, type VerdictDuRegistre } from "@/server/registre-entreprises";
import { etatDeLEssaiDuSiren, type EtatDuSiren } from "@/server/repositories/essais-par-siren";

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
 * la session ouverte, mais la porte reste fermée (`garderLAdresseVerifiee`)
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

  // Le registre se demande ICI, jamais à l'écran : ce que l'écran dirait de sa
  // réponse ne vaut rien côté serveur. Injoignable, rien n'est confirmé, et le
  // compte se crée quand même.
  const siretConfirme = sirenDeLEssai(saisie.siret) !== null && (await demanderAuRegistre(saisie.siret ?? "")).etat === "trouve";
  const resultat = await creerSonCompte(saisie, { siretConfirme });
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

/**
 * La question du SIRET, au premier « Continuer » : ce SIREN a-t-il déjà eu
 * son essai, et que dit le registre des entreprises de ce numéro ? Ses
 * planches du 23 novembre (`appli/soignee/essai-par-entreprise.html`).
 *
 * **Elle ne bloque jamais** : un SIRET qu'on ne lit pas, un limiteur atteint
 * ou une base qui ne répond pas rendent `libre` et `injoignable`, et
 * l'inscription continue. Les règles elles-mêmes se jouent à la création du
 * compte, qui ne dépend pas de cette réponse : le message prévient, il ne
 * décide pas.
 */
export type QuestionDuSiret = { essai: EtatDuSiren; registre: VerdictDuRegistre };
const RIEN_A_DIRE: QuestionDuSiret = { essai: "libre", registre: { etat: "injoignable" } };

export async function etatDuSiretAction(siret: string): Promise<QuestionDuSiret> {
  const siren = sirenDeLEssai(siret);
  if (siren === null) return RIEN_A_DIRE;
  // Tout le reste sous le même filet : une exception levée ici remonterait à
  // l'écran d'inscription entier, et le ferait tomber pour un message.
  try {
    const source = await sourceDuVisiteur(horsProductionReelle());
    const limite = await verifierLimite(`question-siren:${source}`, LIMITES.questionSiren);
    if (!limite.autorise) return RIEN_A_DIRE;
    const [essai, registre] = await Promise.all([etatDeLEssaiDuSiren(siren), demanderAuRegistre(siret)]);
    return { essai, registre };
  } catch (erreur) {
    logger.error("La question du SIREN n'a pas pu être posée", {
      erreur: erreur instanceof Error ? erreur.message : String(erreur),
    });
    return RIEN_A_DIRE;
  }
}
