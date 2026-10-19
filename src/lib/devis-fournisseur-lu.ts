import Decimal from "decimal.js";
import { lirePrixHt, UNITES_ACHAT, type RubriqueAchat } from "./prix-achat";

/**
 * CE QUE L'IA A LU SUR UN DEVIS REÇU d'un fournisseur ou d'un partenaire, en
 * photo ou en PDF. Sa demande du 19 octobre 2026 : *« quand je reçois un devis
 * de mes fournisseurs, une petite base où enregistrer les devis »*, et le devis
 * lu passe ses prix dans « Mes prix » **après son accord**, comme
 * `ImportTarifs.tsx`.
 *
 * Le patron de `document-vehicule-lu.ts` : la réponse du modèle se relit ici,
 * en fonction pure éprouvée sans clé (`scripts/test-devis-fournisseur-lu.ts`) ;
 * l'appel au fournisseur vit dans `src/server/ai/services/lire-devis-fournisseur.ts`.
 *
 * **Rien ne se devine** : une ligne sans désignation ou sans prix unitaire lisible
 * n'est pas proposée, elle est comptée parmi les écartées et l'écran le dit.
 */

export type LigneDevisLue = {
  designation: string;
  reference: string | null;
  quantite: string | null;
  /** L'unité du devis quand elle est l'une des siennes, sinon la première de la rubrique. */
  unite: string;
  /** Le prix unitaire hors taxes, remise déduite quand le devis la porte sur la ligne. */
  prixHt: string;
};

export type DevisLu = { lignes: LigneDevisLue[]; ecartees: number };

const UNITES_LUES: Record<string, string> = {
  u: "pièce", un: "pièce", unite: "pièce", unité: "pièce", pce: "pièce", pc: "pièce", piece: "pièce", pièce: "pièce",
  sac: "sac", sacs: "sac", m: "m", ml: "m", mètre: "m", metre: "m", "m2": "m²", "m²": "m²", "m3": "m³", "m³": "m³",
  kg: "kg", palette: "palette", h: "heure", heure: "heure", heures: "heure", j: "journée", jour: "journée",
  journée: "journée", journee: "journée", forfait: "forfait", ens: "forfait",
};

/** Le texte du modèle, transformé en lignes, ou `null` s'il n'en rend aucune. */
export function lireReponseDevisFournisseur(texte: string, rubrique: RubriqueAchat): DevisLu | null {
  const debut = texte.indexOf("{");
  const fin = texte.lastIndexOf("}");
  if (debut === -1 || fin <= debut) return null;
  let brut: { lignes?: unknown };
  try {
    brut = JSON.parse(texte.slice(debut, fin + 1)) as { lignes?: unknown };
  } catch {
    // Une réponse qui n'est pas du JSON ne dit rien du devis : rien n'est
    // proposé, et l'écran dit que le devis n'a pas été lu.
    return null;
  }
  if (!Array.isArray(brut.lignes)) return null;
  const chaine = (v: unknown): string | null => {
    if (typeof v !== "string" && typeof v !== "number") return null;
    const p = String(v).replace(/\s+/g, " ").trim();
    return p === "" || p.toLowerCase() === "null" ? null : p.slice(0, 160);
  };
  const siennes = UNITES_ACHAT[rubrique];
  const lignes: LigneDevisLue[] = [];
  let ecartees = 0;
  for (const l of brut.lignes as Record<string, unknown>[]) {
    const designation = chaine(l?.designation);
    const prix = chaine(l?.prix_unitaire_ht);
    const prixHt = prix === null ? null : lirePrixHt(prix.replace(/€/g, ""));
    if (!designation || prixHt === null) {
      ecartees++;
      continue;
    }
    const remise = chaine(l?.remise_pourcent);
    const r = remise === null ? null : Number(remise.replace(",", ".").replace("%", ""));
    const net = r !== null && Number.isFinite(r) && r > 0 && r < 100 ? new Decimal(prixHt).times(1 - r / 100).toDecimalPlaces(2).toFixed(2) : prixHt;
    const uniteLue = chaine(l?.unite)?.toLowerCase().replace(/\.$/, "") ?? "";
    const unite = UNITES_LUES[uniteLue] && siennes.includes(UNITES_LUES[uniteLue]) ? UNITES_LUES[uniteLue] : siennes[0];
    lignes.push({ designation, reference: chaine(l?.reference), quantite: chaine(l?.quantite), unite, prixHt: net });
  }
  return { lignes, ecartees };
}

/** « Lu sur le devis « Haie Durand » du 12/10/2026 ». */
export function sourceDuDevisLu(nomDuDevis: string, recuLe: string): string {
  return `Lu sur le devis « ${nomDuDevis} » du ${recuLe.split("-").reverse().join("/")}`;
}
