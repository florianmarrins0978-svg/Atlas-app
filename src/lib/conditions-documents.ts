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

function texte(valeur: unknown): string | null {
  const t = typeof valeur === "string" ? valeur.trim() : "";
  return t === "" ? null : t;
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
  };
}

/** Ce qui part en base après une saisie. Même fonction que pour l'affichage. */
export function normaliserConditions(saisie: ConditionsLues): {
  validiteJours: number | null;
  acomptePourcent: string | null;
  delaiPaiementJours: number | null;
  moyensPaiement: string | null;
  rappelerPenalites: boolean;
  textePied: string | null;
} {
  const c = lireConditions({ ...saisie, validiteJours: saisie.validiteJours ?? null });
  return {
    validiteJours: c.validiteJours,
    acomptePourcent: c.acomptePourcent === null ? null : String(c.acomptePourcent),
    delaiPaiementJours: c.delaiPaiementJours,
    moyensPaiement: c.moyensPaiement,
    rappelerPenalites: c.rappelerPenalites,
    textePied: c.textePied,
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
export function lignesConditionsDevis(c: Conditions, totalTtc?: number): string[] {
  const lignes: string[] = [];

  if (c.acomptePourcent !== null) {
    // Le montant n'est écrit QUE s'il est connu. Sur l'aperçu des réglages il
    // ne l'est pas — et un chiffre inventé à cet endroit finirait imprimé.
    const montant =
      totalTtc !== undefined && Number.isFinite(totalTtc)
        ? ` — soit ${((totalTtc * c.acomptePourcent) / 100).toFixed(2).replace(".", ",")} €`
        : "";
    lignes.push(`Acompte de ${c.acomptePourcent} % à la commande${montant}.`);
  }

  if (c.delaiPaiementJours !== null) {
    lignes.push(
      c.delaiPaiementJours === 0
        ? "Paiement comptant à la fin des travaux."
        : `Paiement à ${c.delaiPaiementJours} jours à compter de la facture.`
    );
  }

  if (c.moyensPaiement !== null) lignes.push(`Moyens de paiement acceptés : ${c.moyensPaiement}.`);

  if (c.rappelerPenalites) {
    // Le TEXTE de la facture, rappelé mot pour mot : deux formulations
    // différentes pour la même pénalité se lisent comme deux pénalités.
    lignes.push(
      "En cas de retard de paiement : pénalités au taux de trois fois le taux d'intérêt légal, " +
        "et indemnité forfaitaire de 40 € pour frais de recouvrement."
    );
  }

  if (c.textePied !== null) lignes.push(c.textePied);

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
  });
}
