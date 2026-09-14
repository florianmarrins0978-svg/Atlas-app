import { logger } from "@/server/logger";
import type { Courriel, ResultatEnvoi } from "./index";

/**
 * Le service qui n'envoie rien.
 *
 * Il sert la batterie, la CI et un poste sans clé — et il ÉCRIT LE TEXTE
 * ENTIER dans le journal, en `warn` : un serveur qui « envoie » sans que rien
 * ne parte doit le dire à chaque fois, sinon la prochaine session cherchera
 * pourquoi l'e-mail n'arrive pas. `env.ts` le refuse en production.
 */
export async function envoyerEnDev(courriel: Courriel): Promise<ResultatEnvoi> {
  logger.warn("Courriel NON envoyé (COURRIEL_PROVIDER=dev)", {
    a: courriel.a,
    objet: courriel.objet,
    texte: courriel.texte,
  });
  return { ok: true };
}
