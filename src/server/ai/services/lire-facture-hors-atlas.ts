import { getFournisseurLLM } from "../providers/llm/fabrique";
import { lireReponseFactureHorsAtlas, type FactureHorsAtlasLue } from "@/lib/facture-hors-atlas-lue";

/**
 * Lire le total d'une facture que l'artisan a faite HORS d'Atlas, en photo ou
 * en PDF, pour la comparer au virement reçu qui la paie (25 octobre 2026). Le
 * même patron que `lire-devis-fournisseur.ts`, qui lit les factures REÇUES :
 * celle-ci est émise par lui, et seul son total compte.
 *
 * Rend `null` quand elle ne peut rien dire (pas de fournisseur, réponse
 * illisible) : la facture reste jointe, et le total se tape à la main.
 *
 * **L'appel au fournisseur n'est pas éprouvé dans cet environnement** : il n'y
 * a aucune clé ici. La relecture du texte rendu l'est
 * (`test-facture-hors-atlas-lue.ts`).
 */

const SYSTEME = `Tu lis une facture qu'un artisan paysagiste a faite à son client.
Tu réponds UNIQUEMENT par un objet JSON, sans phrase avant ni après, sans balises de code :
{"total_ttc": string|null, "numero": string|null}
Règles :
- total_ttc : le montant TOTAL TOUTES TAXES de la facture, recopié tel qu'il est imprimé. Pas un sous-total, pas un acompte déjà versé, pas le reste à payer.
- numero : le numéro de la facture tel qu'il est imprimé, sinon null.
- Tu ne DEVINES jamais : une valeur illisible ou absente vaut null. Tu ne CALCULES rien.`;

const CONSIGNE = "Lis cette facture et rends l'objet JSON demandé.";

export async function lireFactureHorsAtlas(base64: string, mimeType: string): Promise<FactureHorsAtlasLue | null> {
  const fournisseur = getFournisseurLLM();
  if (!fournisseur.lireImages) return null;
  const r = await fournisseur.lireImages(SYSTEME, CONSIGNE, [{ base64, mimeType }], { maxTokens: 512 });
  if (!r.succes) return null;
  return lireReponseFactureHorsAtlas(r.texte);
}
