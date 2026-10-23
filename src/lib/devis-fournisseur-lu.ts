import Decimal from "decimal.js";
import { lirePrixHt, UNITES_ACHAT, type RubriqueAchat } from "./prix-achat";
import { normaliserPourRecherche } from "./recherche-client";
import { typeDuDocument } from "./vehicules";
import type { LectureTableau } from "./import-tarifs";

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

export type DevisLu = {
  lignes: LigneDevisLue[];
  ecartees: number;
  /** Les totaux imprimés d'une facture, lus et jamais calculés ; `null` quand ils ne se lisent pas. */
  totalHt: string | null;
  totalTtc: string | null;
};

const UNITES_LUES: Record<string, string> = {
  u: "pièce", un: "pièce", unite: "pièce", unité: "pièce", pce: "pièce", pc: "pièce", piece: "pièce", pièce: "pièce",
  sac: "sac", sacs: "sac", m: "m", ml: "m", mètre: "m", metre: "m", "m2": "m²", "m²": "m²", "m3": "m³", "m³": "m³",
  kg: "kg", palette: "palette", h: "heure", heure: "heure", heures: "heure", j: "journée", jour: "journée",
  journée: "journée", journee: "journée", forfait: "forfait", ens: "forfait",
};

/** L'unité écrite sur le document quand elle est l'une des siennes, sinon la première de la rubrique. */
function uniteDeLaRubrique(brut: string | null, rubrique: RubriqueAchat): string {
  const siennes = UNITES_ACHAT[rubrique];
  const lue = UNITES_LUES[(brut ?? "").trim().toLowerCase().replace(/\.$/, "")];
  return lue && siennes.includes(lue) ? lue : siennes[0];
}

/** Le texte du modèle, transformé en lignes, ou `null` s'il n'en rend aucune. */
export function lireReponseDevisFournisseur(texte: string, rubrique: RubriqueAchat): DevisLu | null {
  const debut = texte.indexOf("{");
  const fin = texte.lastIndexOf("}");
  if (debut === -1 || fin <= debut) return null;
  let brut: { lignes?: unknown; total_ht?: unknown; total_ttc?: unknown };
  try {
    brut = JSON.parse(texte.slice(debut, fin + 1)) as typeof brut;
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
    lignes.push({ designation, reference: chaine(l?.reference), quantite: chaine(l?.quantite), unite: uniteDeLaRubrique(chaine(l?.unite), rubrique), prixHt: net });
  }
  const total = (v: unknown) => {
    const t = chaine(v);
    return t === null ? null : lirePrixHt(t.replace(/€/g, ""));
  };
  return { lignes, ecartees, totalHt: total(brut.total_ht), totalTtc: total(brut.total_ttc) };
}

/**
 * Un fichier Excel ou CSV reçu d'un fournisseur, déjà lu en tableau par la
 * règle des tarifs (`lireTableau`) : les colonnes s'y reconnaissent de la même
 * façon, et une ligne sans montant lisible est écartée et comptée. Un tableur
 * ne porte pas de total qu'on sache désigner : il n'en est pas inventé.
 */
export function lignesDuTableau(lecture: LectureTableau, rubrique: RubriqueAchat): DevisLu {
  const lignes: LigneDevisLue[] = [];
  let ecartees = lecture.ecartees.length;
  for (const l of lecture.retenues) {
    const designation = l.intitule.replace(/\s+/g, " ").trim().slice(0, 160);
    const prixHt = lirePrixHt(l.prix);
    if (!designation || prixHt === null) {
      ecartees++;
      continue;
    }
    lignes.push({ designation, reference: null, quantite: null, unite: uniteDeLaRubrique(l.unite, rubrique), prixHt });
  }
  return { lignes, ecartees, totalHt: null, totalTtc: null };
}

// ── Une facture confrontée à ses prix ──────────────────────────────────────

export type PrixConnu = { id: string; nom: string; reference: string | null; unite: string; prixHt: string };

export type Rapprochement =
  | { etat: "nouveau" }
  | { etat: "inchange" | "plus cher" | "moins cher"; ancien: PrixConnu };

/**
 * Ce que la ligne d'une facture ferait à « Mes prix ». **La référence d'abord**,
 * quand les deux la portent : c'est elle qui désigne la pièce chez le
 * fournisseur. Sinon le même nom, sans accents ni casse, **dans la même unité** :
 * un sac et une palette du même sable sont deux prix.
 *
 * Le même appel construit l'écran et décide au serveur : un prix remplacé est
 * celui qu'il a vu barré, et pas un autre.
 */
export function rapprocherDuPrix(
  ligne: { designation: string; reference: string | null; unite: string; prixHt: string },
  connus: readonly PrixConnu[]
): Rapprochement {
  const ref = (r: string | null) => (r ?? "").replace(/\s+/g, "").toLowerCase();
  const nom = normaliserPourRecherche(ligne.designation);
  const ancien =
    (ref(ligne.reference) && connus.find((p) => ref(p.reference) === ref(ligne.reference))) ||
    connus.find((p) => p.unite === ligne.unite && normaliserPourRecherche(p.nom) === nom);
  if (!ancien) return { etat: "nouveau" };
  const ecart = new Decimal(ligne.prixHt).comparedTo(ancien.prixHt);
  return { etat: ecart === 0 ? "inchange" : ecart > 0 ? "plus cher" : "moins cher", ancien };
}

/** « réf. SAB04, plus cher », « Nouvelle fourniture ». */
export function detailDeLaLigneLue(reference: string | null, r: Rapprochement, rubrique: RubriqueAchat): string {
  const etat =
    r.etat === "nouveau" ? (rubrique === "fournisseur" ? "nouvelle fourniture" : "nouvelle prestation") : r.etat === "inchange" ? "prix inchangé" : r.etat;
  if (reference) return `réf. ${reference}, ${etat}`;
  return etat.charAt(0).toUpperCase() + etat.slice(1);
}

/** « Lu sur le devis « Haie Durand » du 12/10/2026 ». */
export function sourceDuDevisLu(nomDuDevis: string, recuLe: string): string {
  return `Lu sur le devis « ${nomDuDevis} » du ${recuLe.split("-").reverse().join("/")}`;
}

/** « Lu sur la facture « Point P octobre » du 23/10/2026 ». */
export function sourceDeLaFactureLue(nomDeLaFacture: string, recuLe: string): string {
  return `Lu sur la facture « ${nomDeLaFacture} » du ${recuLe.split("-").reverse().join("/")}`;
}

/**
 * Le type servi d'un devis ou d'une facture reçus, d'après l'extension que le
 * serveur a posée. Une photo ou un PDF s'ouvrent dans la page ; un tableur se
 * télécharge, aucun navigateur de téléphone ne sachant l'afficher.
 */
export function typeDuFichierRecu(cle: string): { type: string; joint: boolean } | null {
  const document = typeDuDocument(cle);
  if (document) return { type: document, joint: false };
  const ext = cle.toLowerCase().split(".").pop();
  if (ext === "xlsx") return { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", joint: true };
  if (ext === "csv") return { type: "text/csv; charset=utf-8", joint: true };
  return null;
}
