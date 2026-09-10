import { getEnv } from "../env";

/**
 * OÙ LE PATRON REVIENT APRÈS AVOIR PAYÉ.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **L'ADRESSE NE SE DÉDUIT PAS DE LA REQUÊTE, ET C'EST LE POINT.**
 *
 * La tentation est d'employer l'en-tête `Host` : elle marche toujours, en
 * développement comme en production, sans rien à configurer. Mais cet en-tête
 * est écrit par celui qui frappe — c'est exactement la faute que ce dépôt a
 * fermée sur `x-forwarded-for` (`env.ts`, `ATLAS_PROXY_SAUTS`). Ici, la
 * conséquence serait qu'un tiers renvoie le patron, au sortir du paiement,
 * vers une page de son choix : une page qui a toutes les apparences d'Atlas,
 * juste après qu'il a tapé un numéro de carte.
 *
 * L'adresse vient donc d'`ATLAS_URL_PUBLIQUE`, posée à la main une fois — et
 * quand elle manque, **le paiement ne s'ouvre pas**. Refuser franchement vaut
 * mieux qu'ouvrir un paiement dont le retour va n'importe où.
 */
export class UrlPubliqueManquanteError extends Error {
  constructor() {
    super(
      "ATLAS_URL_PUBLIQUE n'est pas posée : impossible de dire au prestataire de paiement " +
        "où renvoyer le patron. Elle ne se déduit pas de la requête — voir src/server/paiement/retour.ts."
    );
    this.name = "UrlPubliqueManquanteError";
  }
}

/**
 * @param chemin toujours absolu depuis la racine, « /reglages/abonnement ».
 */
export function adresseDeRetour(chemin: string): string {
  const racine = getEnv().urlPublique;
  if (!racine) throw new UrlPubliqueManquanteError();
  return `${racine}${chemin.startsWith("/") ? chemin : `/${chemin}`}`;
}

/** Le retour est-il configurable ? L'écran le demande avant d'offrir un bouton. */
export function retourConfigure(): boolean {
  return Boolean(getEnv().urlPublique);
}
