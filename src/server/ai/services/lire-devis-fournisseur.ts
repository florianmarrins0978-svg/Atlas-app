import { getFournisseurLLM } from "../providers/llm/fabrique";
import { lireReponseDevisFournisseur, type DevisLu } from "@/lib/devis-fournisseur-lu";
import type { RubriqueAchat } from "@/lib/prix-achat";

/**
 * Lire un devis reçu d'un fournisseur ou d'un partenaire, en photo ou en PDF —
 * sa demande du 19 octobre 2026. Une facture se lit de la même façon, totaux
 * compris (23 octobre 2026). Même patron que `lire-document-vehicule.ts`.
 *
 * Rend `null` quand elle ne peut rien dire (pas de fournisseur, réponse
 * illisible) : le devis reste gardé, et les prix se tapent à la main.
 *
 * **L'appel au fournisseur n'est pas éprouvé dans cet environnement** : il n'y
 * a aucune clé ici. La relecture du texte rendu l'est
 * (`test-devis-fournisseur-lu.ts`).
 */

const SYSTEME = `Tu lis un devis ou une facture qu'un fournisseur ou un sous-traitant a envoyé à un artisan paysagiste.
Tu réponds UNIQUEMENT par un objet JSON, sans phrase avant ni après, sans balises de code :
{"lignes": [{"designation": string, "reference": string|null, "quantite": string|null, "unite": string|null, "prix_unitaire_ht": string, "remise_pourcent": string|null}], "total_ht": string|null, "total_ttc": string|null}
Règles :
- Une entrée par ligne d'article ou de prestation du document, dans l'ordre.
- designation : le libellé tel qu'il est écrit, sans la référence.
- reference : le code article du fournisseur s'il est imprimé, sinon null.
- prix_unitaire_ht : le prix unitaire HORS TAXES imprimé, avec la virgule ou le point tel quel. Jamais un total de ligne, jamais un prix TTC.
- remise_pourcent : la remise imprimée sur la ligne, en pourcentage, sinon null.
- Tu ne DEVINES jamais : une valeur illisible ou absente vaut null. Tu ne CALCULES rien.
- Les lignes de total, de TVA, de frais de port et d'acompte ne sont pas des articles : tu ne les rends pas.
- total_ht et total_ttc : les totaux du document, recopiés tels qu'ils sont imprimés, sinon null.`;

const CONSIGNE = "Lis ce devis et rends l'objet JSON demandé.";

export async function lireDevisFournisseur(base64: string, mimeType: string, rubrique: RubriqueAchat): Promise<DevisLu | null> {
  const fournisseur = getFournisseurLLM();
  if (!fournisseur.lireImages) return null;
  const r = await fournisseur.lireImages(SYSTEME, CONSIGNE, [{ base64, mimeType }], { maxTokens: 4096 });
  if (!r.succes) return null;
  return lireReponseDevisFournisseur(r.texte, rubrique);
}
