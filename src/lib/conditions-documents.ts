import { TEXTE_ORIGINE_CONDITIONS_GENERALES } from "./conditions-generales";
import { enEuros } from "./euros";

/**
 * Les conditions qui s'impriment sur un devis, réglées au lieu d'être en dur.
 *
 * *Dessiné le 13 août 2026 (`maquettes/atlas-reglages-documents.html`), codé le
 * 14. Rubrique « Devis & factures ».*
 *
 * **Ce qu'elles remplacent.** « Validité : 30 jours » était écrit en dur dans
 * `devis-pdf.ts` — une constante, la même pour tous les artisans, qu'aucun
 * écran ne montrait. Un couvreur qui tient ses prix quinze jours envoyait donc
 * un devis qui l'engageait trente.
 *
 * ─── LA RÈGLE DES INTERRUPTEURS, ET ELLE VIENT DE LUI ───────────────────────
 *
 * Le patron, le 13 août 2026 : *« [des interrupteurs] seulement à celles où la
 * désactivation n'entraîne pas de problème juridique ou moral ou de
 * dysfonctionnement à l'appli »*.
 *
 * D'où le partage, qui n'est pas négociable :
 *
 *   · **CE QUI SE COUPE** — ce qui s'imprime EN PLUS : l'acompte, le rappel des
 *     pénalités sur le devis, les moyens de paiement, le texte de bas de page.
 *     Un devis sans acompte reste un devis valable ;
 *   · **CE QUI NE SE COUPE PAS** — les mentions légales de la FACTURE
 *     (pénalités au taux légal, indemnité de 40 €, franchise de l'art. 293 B).
 *     Elles restent écrites en dur dans `facture-pdf.ts`, et c'est bien : un
 *     interrupteur dessus serait un bouton « rendre ma facture irrégulière ».
 *
 * **Une valeur ABSENTE veut dire « éteint ».** Pas de colonne « actif » à côté
 * de chaque nombre : deux champs pour une seule idée finissent par se
 * contredire — un acompte à 30 % et un interrupteur éteint, et personne ne sait
 * ce qui s'imprime.
 */

/** Ce que la base porte. `null` partout = les valeurs d'origine d'Atlas. */
export type ConditionsLues = {
  validiteJours?: number | null;
  acomptePourcent?: string | number | null;
  delaiPaiementJours?: number | null;
  moyensPaiement?: string | null;
  rappelerPenalites?: boolean | null;
  textePied?: string | null;
  /**
   * Les conditions générales de vente et de règlement (migration 0090).
   * **Ici l'encodage est INVERSÉ par rapport au texte de pied**, et c'est sa
   * demande : la case arrive REMPLIE. `null` / absent = le texte d'origine
   * d'Atlas ; `""` = il a tout effacé, rien ne s'imprime ; du texte = le sien.
   */
  conditionsGenerales?: string | null;
};

/**
 * Trente jours de validité : ce qui était écrit en dur, et qui reste le défaut.
 *
 * **Un défaut qui ne change rien au comportement d'avant** — le même choix
 * qu'au régime de TVA le 13 août. Une migration qui modifierait ce qui
 * s'imprime, sans qu'il l'ait demandé, ferait partir des devis différents de
 * ceux de la veille.
 */
export const VALIDITE_PAR_DEFAUT_JOURS = 30;

/** Bornes de bon sens. Elles servent à l'écran ET au serveur : une seule règle. */
export const BORNES = {
  validiteJours: { min: 1, max: 365 },
  acomptePourcent: { min: 1, max: 100 },
  delaiPaiementJours: { min: 0, max: 120 },
} as const;

export type Conditions = {
  /** `null` : aucune durée n'est imprimée sur le devis. */
  validiteJours: number | null;
  /** `null` : aucun acompte n'est demandé. */
  acomptePourcent: number | null;
  /** `null` : aucun délai n'est imprimé — `0` veut dire « comptant ». */
  delaiPaiementJours: number | null;
  /** `null` ou vide : rien n'est listé sous les coordonnées bancaires. */
  moyensPaiement: string | null;
  /** Le rappel des pénalités sur le DEVIS. Sur la facture, elles sont scellées. */
  rappelerPenalites: boolean;
  /** Ajouté tel quel en bas de chaque document. */
  textePied: string | null;
  /** Imprimées après le bon pour accord. Vide : rien, pas même le titre. */
  conditionsGenerales: string;
};

function nombre(valeur: unknown, bornes: { min: number; max: number }): number | null {
  if (valeur === null || valeur === undefined || valeur === "") return null;
  const n = typeof valeur === "number" ? valeur : Number(String(valeur).replace(",", "."));
  if (!Number.isFinite(n)) return null;
  // **On borne au lieu de refuser.** Une saisie hors bornes vient d'un doigt qui
  // a glissé, pas d'une intention ; refuser laisserait le champ vide, donc le
  // réglage éteint — l'inverse de ce qu'il voulait.
  return Math.min(bornes.max, Math.max(bornes.min, Math.round(n * 100) / 100));
}

/**
 * Un champ libre commandé par un interrupteur : trois états, jamais deux.
 *
 * ─── LE DÉFAUT DU 25 AOÛT 2026, ET IL SE VOIT À L'ŒIL ───────────────────────
 *
 * *Le patron :* ***« le texte en bas de vos documents ne passe pas en ON, il
 * saute automatiquement »***.
 *
 * L'interrupteur s'allumait en envoyant une chaîne VIDE — il n'y a rien
 * d'écrit —, cette fonction la ramenait à `null`, l'écran relisait ce que la
 * base porte, et `null` veut dire ÉTEINT. Il ne pouvait donc jamais l'allumer :
 * le geste s'annulait lui-même, en une fraction de seconde.
 *
 * **Deux états ne suffisent pas à en décrire trois :**
 *
 * | En base | Ce que ça veut dire |
 * |---|---|
 * | `null` / absent | l'interrupteur est **éteint** — rien ne s'imprime |
 * | `""` | **allumé**, mais rien n'est encore écrit |
 * | du texte | allumé, et voilà ce qui s'imprime |
 *
 * **Ce qui NE change pas, et c'est ce que défendait la suite d'avant :** un
 * champ vide n'imprime rien. Cela se décide à l'IMPRESSION
 * (`lignesConditionsDevis`), là où c'est vrai — et non en éteignant un
 * interrupteur que le patron vient d'allumer.
 */
function texte(valeur: unknown): string | null {
  return typeof valeur === "string" ? valeur.trim() : null;
}

/** Ce que la base rend, mis en forme — avec le défaut d'Atlas là où rien n'a été dit. */
export function lireConditions(brut: ConditionsLues | null | undefined): Conditions {
  return {
    // **`undefined` et `null` ne veulent PAS dire la même chose.** Jamais réglé
    // (colonne absente de la lecture) → le défaut d'Atlas. Réglé puis éteint
    // (`null` en base) → rien ne s'imprime. Les confondre remettrait « 30 jours »
    // sur le devis d'un artisan qui l'a délibérément retiré.
    validiteJours:
      brut?.validiteJours === undefined
        ? VALIDITE_PAR_DEFAUT_JOURS
        : nombre(brut.validiteJours, BORNES.validiteJours),
    acomptePourcent: nombre(brut?.acomptePourcent, BORNES.acomptePourcent),
    delaiPaiementJours:
      brut?.delaiPaiementJours === null || brut?.delaiPaiementJours === undefined
        ? null
        : nombre(brut.delaiPaiementJours, BORNES.delaiPaiementJours) ?? 0,
    moyensPaiement: texte(brut?.moyensPaiement),
    rappelerPenalites: brut?.rappelerPenalites === true,
    textePied: texte(brut?.textePied),
    // Absent → rien. Le texte d'origine ne se pose QUE dans
    // `conditionsDepuisEntreprise` : ici passe aussi l'instantané d'un devis, et
    // un devis d'avant la migration 0090 sortirait sinon avec des CGV au dos
    // qu'il n'a jamais portées (`test-conditions-sur-le-devis`, 13 sept. 2026).
    conditionsGenerales: texte(brut?.conditionsGenerales) ?? "",
  };
}

/**
 * Ce qui part en base après une saisie. Même fonction que pour l'affichage.
 *
 * **UNE CLEF ABSENTE NE S'ÉCRIT PAS — 14 septembre 2026.** Elle valait
 * « éteint » : un geste qui ne portait qu'un réglage effaçait tous les autres.
 * Deux appelants s'en étaient protégés en relisant la base pour tout renvoyer
 * (le geste `regler_documents` de l'assistant, la photo d'un devis) — et le
 * second avait oublié la clef née le 13 (migration 0090) : ses conditions
 * générales repartaient à `""`, c'est-à-dire « il a tout effacé », et plus rien
 * ne s'imprimait après le bon pour accord. Un troisième appelant aurait refait
 * la même faute. La règle vit donc ici : ce qui n'est pas dit ne bouge pas.
 * `null` reste « éteint », `""` reste « allumé, rien écrit ».
 */
export function normaliserConditions(saisie: ConditionsLues): {
  validiteJours?: number | null;
  acomptePourcent?: string | null;
  delaiPaiementJours?: number | null;
  moyensPaiement?: string | null;
  rappelerPenalites?: boolean;
  textePied?: string | null;
  conditionsGenerales?: string;
} {
  const c = lireConditions({ ...saisie, validiteJours: saisie.validiteJours ?? null });
  const dite = (clef: keyof ConditionsLues) => saisie[clef] !== undefined;
  return {
    ...(dite("validiteJours") ? { validiteJours: c.validiteJours } : {}),
    ...(dite("acomptePourcent")
      ? { acomptePourcent: c.acomptePourcent === null ? null : String(c.acomptePourcent) }
      : {}),
    ...(dite("delaiPaiementJours") ? { delaiPaiementJours: c.delaiPaiementJours } : {}),
    ...(dite("moyensPaiement") ? { moyensPaiement: c.moyensPaiement } : {}),
    ...(dite("rappelerPenalites") ? { rappelerPenalites: c.rappelerPenalites } : {}),
    ...(dite("textePied") ? { textePied: c.textePied } : {}),
    ...(dite("conditionsGenerales") ? { conditionsGenerales: c.conditionsGenerales } : {}),
  };
}

/** « 30 jours », « 1 jour » — ou rien du tout. */
export function libelleValidite(c: Conditions): string | null {
  if (c.validiteJours === null) return null;
  return `${c.validiteJours} jour${c.validiteJours > 1 ? "s" : ""}`;
}

/**
 * Les lignes de conditions à imprimer sur le DEVIS, dans l'ordre.
 *
 * **Une seule fonction pour l'écran et pour le PDF.** L'aperçu des réglages
 * montre exactement ces phrases : deux rédactions finiraient par diverger, et
 * c'est le client qui lirait la mauvaise (`CLAUDE.md` §3).
 */
export function lignesConditionsDevis(
  c: Conditions,
  totalTtc?: number,
  /**
   * Les phrases des acomptes POSÉS sur le devis (`src/lib/acomptes-devis.ts`),
   * quand il y en a : elles remplacent la phrase du réglage, sinon l'acompte
   * s'imprimerait deux fois. Vide ou absente, la phrase du réglage reste —
   * *« il reste visible dans les notes et conditions quoi qu'il arrive »*
   * (12 septembre 2026), même quand la ligne des totaux a été retirée.
   */
  phrasesAcomptes?: readonly string[]
): string[] {
  const lignes: string[] = [];

  if (phrasesAcomptes && phrasesAcomptes.length > 0) {
    lignes.push(...phrasesAcomptes);
  } else if (c.acomptePourcent !== null) {
    // **La B de sa planche, choisie le 14 septembre 2026** — la même rédaction
    // que `phrasesAcomptes`, pour le réglage seul : le mode, puis les montants
    // QUAND le total est connu. Sur l'aperçu des réglages il ne l'est pas — et
    // un chiffre inventé à cet endroit finirait imprimé.
    lignes.push(`Mode de règlement : ${c.acomptePourcent} % à la commande, solde à réception de la facture.`);
    if (totalTtc !== undefined && Number.isFinite(totalTtc)) {
      const acompte = Math.round(totalTtc * c.acomptePourcent) / 100;
      lignes.push(`Montant à régler à la commande : ${enEuros(acompte)}`);
      lignes.push(`Solde restant à régler : ${enEuros(Math.round((totalTtc - acompte) * 100) / 100)}`);
    }
  }

  if (c.delaiPaiementJours !== null) {
    lignes.push(
      c.delaiPaiementJours === 0
        ? "Paiement comptant à la fin des travaux."
        : `Paiement à ${c.delaiPaiementJours} jours à compter de la facture.`
    );
  }

  // **`!== null` ne suffit plus** : une chaîne vide veut dire « allumé, rien
  // écrit » depuis le 25 août 2026, et elle imprimerait « Moyens de paiement
  // acceptés : . » sur le devis d'un client.
  if (c.moyensPaiement) lignes.push(`Moyens de paiement acceptés : ${c.moyensPaiement}.`);

  if (c.rappelerPenalites) {
    // Le TEXTE de la facture, rappelé mot pour mot : deux formulations
    // différentes pour la même pénalité se lisent comme deux pénalités.
    lignes.push(
      "En cas de retard de paiement : pénalités au taux de trois fois le taux d'intérêt légal, " +
        "et indemnité forfaitaire de 40 € pour frais de recouvrement."
    );
  }

  // Même règle : allumé sans rien écrire n'ajoute pas une ligne vide au bas du
  // devis.
  if (c.textePied) lignes.push(c.textePied);

  return lignes;
}

/**
 * Traduit une ligne de `entreprises` en conditions.
 *
 * **Cette fonction existe parce que les noms diffèrent**, et c'est délibéré : la
 * colonne s'appelle `validite_devis_jours` — elle vit à côté d'une dizaine
 * d'autres champs d'entreprise et doit dire de quoi elle parle —, quand la règle
 * ne connaît que `validiteJours`. Sans ce passage, la lecture rendait
 * silencieusement le défaut de 30 jours pour un artisan qui avait réglé 15 : le
 * champ était `undefined`, donc « jamais réglé ». Vu en suite, pas à l'écran.
 */
export function conditionsDepuisEntreprise(
  ligne:
    | {
        validiteDevisJours?: number | null;
        acomptePourcent?: string | null;
        delaiPaiementJours?: number | null;
        moyensPaiement?: string | null;
        rappelerPenalitesDevis?: boolean | null;
        textePiedDocuments?: string | null;
        conditionsGenerales?: string | null;
      }
    | null
    | undefined
): Conditions {
  return lireConditions({
    validiteJours: ligne?.validiteDevisJours,
    acomptePourcent: ligne?.acomptePourcent,
    delaiPaiementJours: ligne?.delaiPaiementJours,
    moyensPaiement: ligne?.moyensPaiement,
    rappelerPenalites: ligne?.rappelerPenalitesDevis,
    textePied: ligne?.textePiedDocuments,
    // Jamais réglé → le texte d'origine : c'est ce qu'il a demandé, « remplie
    // d'un texte par défaut ». Effacé (chaîne vide) → vide, rien ne s'imprime.
    conditionsGenerales:
      ligne?.conditionsGenerales === null || ligne?.conditionsGenerales === undefined
        ? TEXTE_ORIGINE_CONDITIONS_GENERALES
        : ligne.conditionsGenerales,
  });
}
