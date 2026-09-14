import { getEnv } from "@/server/env";
import { envoyerParBrevo } from "./brevo";
import { envoyerEnDev } from "./dev";

/**
 * L'ENVOI D'E-MAILS PAR L'APPLICATION — la première fois qu'elle en envoie.
 *
 * Jusqu'au 14 septembre 2026, Atlas n'envoyait rien : le devis et la facture
 * partent par l'application Mail de son téléphone (`docs/QUESTIONS.md` §2),
 * et c'était un choix. Ce module existe pour une seule raison, qui ne se
 * délègue pas au téléphone : **prouver qu'une adresse existe** au moment où
 * quelqu'un crée un compte. Il a créé le sien avec une adresse inventée, et
 * il est entré.
 *
 * Un seul point d'entrée, un service derrière (`env.courrielProvider`) : Brevo
 * avec sa clé, ou `dev`, qui n'envoie rien et journalise. L'appelant ne sait
 * pas lequel — c'est ce qui permet à la batterie de jouer le parcours entier
 * sans qu'un e-mail d'essai parte chez qui que ce soit.
 */

export type Courriel = {
  a: string;
  objet: string;
  /** Texte brut. Un code à recopier n'a pas besoin de HTML, et le texte passe partout. */
  texte: string;
};

export type ResultatEnvoi = { ok: true } | { ok: false; raison: string };

export async function envoyerCourriel(courriel: Courriel): Promise<ResultatEnvoi> {
  const env = getEnv();
  if (env.courrielProvider === "brevo") {
    return envoyerParBrevo(courriel, {
      cle: env.brevoApiKey!,
      expediteur: env.courrielExpediteur!,
    });
  }
  return envoyerEnDev(courriel);
}
