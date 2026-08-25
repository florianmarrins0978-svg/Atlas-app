"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { motDePasseEstCeluiDe } from "@/server/secret-authentification";
import { poserPreuve, preuveRecenteExiste } from "@/server/preuve-recente";
import { verifierLimite, LIMITES } from "@/server/rate-limit";

/**
 * SE PROUVER À NOUVEAU — la seule façon d'obtenir une preuve récente.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUI FAIT AUTORITÉ, ET CE QUI N'EN A AUCUNE.**
 *
 * | Une vérification du mot de passe **en base** (M9) | fait autorité |
 * | Une signature WebAuthn vérifiée par le serveur | fait autorité |
 * | Tout ce que le navigateur envoie d'autre | **aucune autorité** |
 *
 * Il n'existe **aucun** chemin par lequel un écran puisse déclarer une preuve.
 * Cette action est le seul endroit qui en pose une, et elle ne le fait qu'après
 * avoir confronté un mot de passe à la base — laquelle ne rend jamais le
 * condensat, depuis M9.
 *
 * **La cadence est bornée, comme la connexion.** Sans cela, cette action serait
 * un banc d'essai à mots de passe pour qui détient déjà une session — plus
 * commode que la page de connexion, qui est protégée.
 */
export type ResultatPreuve = { ok: true } | { ok: false; raison: string };

export async function prouverParMotDePasseAction(motDePasse: string): Promise<ResultatPreuve> {
  const ctx = await getCurrentCtx();

  if (!ctx.sessionId) {
    /**
     * Un jeton signé avant le 25 août 2026 ne porte pas d'identité de session :
     * il n'y a rien à quoi accrocher une preuve. Le message dit le geste qui
     * règle cela, plutôt qu'un refus dont il ne saurait quoi faire.
     */
    return {
      ok: false,
      raison: "Votre session date d'avant cette mise à jour. Déconnectez-vous puis reconnectez-vous.",
    };
  }

  const cadence = await verifierLimite(`preuve:${ctx.utilisateurId}`, LIMITES.preuveRecente);
  if (!cadence.autorise) {
    return { ok: false, raison: "Trop d'essais. Réessayez dans un instant." };
  }

  if (!(await motDePasseEstCeluiDe(ctx.utilisateurId, motDePasse))) {
    return { ok: false, raison: "Ce n'est pas votre mot de passe." };
  }

  await poserPreuve(ctx.utilisateurId, ctx.sessionId, "mot-de-passe");
  return { ok: true };
}

/**
 * Cette session a-t-elle déjà une preuve valable ?
 *
 * Sert à l'écran, pour ne PAS redemander un mot de passe qui vient d'être donné.
 * **Ce n'est pas une garde** : la garde est côté serveur, dans chaque geste
 * sensible. Mentir ici ne donnerait aucun droit.
 */
export async function preuveDejaRecenteAction(): Promise<boolean> {
  const ctx = await getCurrentCtx();
  return preuveRecenteExiste(ctx);
}
