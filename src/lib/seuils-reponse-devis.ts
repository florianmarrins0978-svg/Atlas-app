import { SOURCE_NON_ETABLIE } from "./source-visiteur";

/**
 * Les seuils qui bornent la réponse d'un client à son devis : la règle, sortie
 * de l'action pour être éprouvée (audit du 25 octobre 2026, F9 était fragile).
 *
 * **Le seuil par SOURCE ne s'applique que si la source est établie.** Sans
 * `ATLAS_PROXY_SAUTS`, tous les visiteurs partagent une même source : un seuil
 * commun deviendrait une arme retournée, soixante appels d'où que ce soit et
 * plus aucun client d'aucun artisan ne pourrait signer. Le seuil par JETON ne
 * borne que le lien qu'on martèle : il s'applique toujours.
 */
export function seuilsDeLaReponseAuDevis(
  jeton: string,
  source: string
): Array<{ cle: string; quel: "jeton" | "source" }> {
  const seuils: Array<{ cle: string; quel: "jeton" | "source" }> = [{ cle: `reponse-devis:${jeton}`, quel: "jeton" }];
  if (source !== SOURCE_NON_ETABLIE) seuils.push({ cle: `reponse-devis:source:${source}`, quel: "source" });
  return seuils;
}
