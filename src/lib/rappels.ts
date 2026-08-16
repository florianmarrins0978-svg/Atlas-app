/**
 * Les deux rappels qu'Atlas peut vraiment tenir aujourd'hui.
 *
 * *Dessinés le 13 août 2026 (`maquettes/atlas-reglages-notifications.html`),
 * codés le 14 — rubrique « Notifications ».*
 *
 * ─── POURQUOI DEUX, ET PAS LES HUIT DE LA PLANCHE ───────────────────────────
 *
 * La planche listait huit familles d'alertes. Une seule existait — la réponse à
 * un devis — et elle le disait : *« rien ne part encore sur votre téléphone »*.
 * Dessiner les sept autres avec un interrupteur aurait fait valider un écran de
 * réglages qui ne règle rien, et le défaut ne serait apparu qu'à l'usage.
 *
 * **Ces deux-là se calculent avec ce que la base porte déjà**, sans nouveau
 * jalon ni nouveau geste :
 *
 *   · un devis parti, toujours valable, sans réponse depuis N jours ;
 *   · un chantier terminé, sans facture, depuis N jours.
 *
 * Les six autres attendent une donnée qui n'existe pas — au premier rang de
 * laquelle **« cette facture est payée »**, que rien n'enregistre. Une alerte
 * « facture impayée » bâtie sans cette donnée hurlerait sur toutes les
 * factures, pour toujours.
 *
 * ─── LA RÈGLE DES INTERRUPTEURS, ET ELLE VIENT DE LUI ───────────────────────
 *
 * Le patron, le 13 août 2026 : *« [des interrupteurs] seulement à celles où la
 * désactivation n'entraîne pas de problème juridique ou moral ou de
 * dysfonctionnement à l'appli »*.
 *
 * Ces deux rappels **se coupent**, et c'est légitime : ce sont des conforts. Ne
 * pas être rappelé qu'un devis dort ne fait rien perdre — le devis est toujours
 * là, sur la fiche du chantier. **Ce qui NE se coupe PAS**, en revanche, c'est
 * la réponse d'un client et le lien de devis expiré : les éteindre, ce serait
 * ne plus savoir qu'on a été refusé. Ces deux-là n'ont donc pas d'interrupteur,
 * et l'écran dit pourquoi.
 */

/** `null` : le rappel est éteint. Aucune colonne « actif » à côté du nombre —
 *  deux champs pour une seule idée finissent par se contredire. */
export type ReglagesRappels = {
  devisSansReponseJours: number | null;
  chantierNonFactureJours: number | null;
};

/**
 * Ce qui s'applique quand rien n'a jamais été réglé.
 *
 * **Allumés d'origine, et c'est un choix.** Un rappel éteint par défaut n'est
 * jamais découvert : il faudrait aller le chercher dans un écran de réglages
 * pour savoir qu'il existe. Sept et trois jours sont des délais de métier — un
 * client met une semaine à répondre, une facture se fait dans la semaine qui
 * suit le chantier.
 */
export const RAPPELS_PAR_DEFAUT: ReglagesRappels = {
  devisSansReponseJours: 7,
  chantierNonFactureJours: 3,
};

/** Bornes de bon sens, les mêmes à l'écran et au serveur. */
export const BORNES_RAPPELS = {
  devisSansReponseJours: { min: 1, max: 90 },
  chantierNonFactureJours: { min: 1, max: 90 },
} as const;

function jours(valeur: unknown, bornes: { min: number; max: number }): number | null {
  if (valeur === null || valeur === undefined || valeur === "") return null;
  const n = typeof valeur === "number" ? valeur : Number(String(valeur).trim());
  if (!Number.isFinite(n)) return null;
  // **On borne au lieu de refuser.** Une saisie hors bornes vient d'un doigt qui
  // a glissé, pas d'une intention ; refuser laisserait le champ vide, donc le
  // rappel éteint — l'inverse de ce qu'il voulait.
  return Math.min(bornes.max, Math.max(bornes.min, Math.round(n)));
}

/** Ce que la base rend, mis en forme. `undefined` = jamais réglé → le défaut. */
export function lireRappels(brut: Partial<Record<keyof ReglagesRappels, number | null>> | null | undefined): ReglagesRappels {
  return {
    // **`undefined` et `null` ne veulent PAS dire la même chose.** Jamais réglé
    // → le défaut d'Atlas. Réglé puis éteint (`null` en base) → rien n'est
    // rappelé. Les confondre rallumerait un rappel qu'il a délibérément coupé.
    devisSansReponseJours:
      brut?.devisSansReponseJours === undefined
        ? RAPPELS_PAR_DEFAUT.devisSansReponseJours
        : jours(brut.devisSansReponseJours, BORNES_RAPPELS.devisSansReponseJours),
    chantierNonFactureJours:
      brut?.chantierNonFactureJours === undefined
        ? RAPPELS_PAR_DEFAUT.chantierNonFactureJours
        : jours(brut.chantierNonFactureJours, BORNES_RAPPELS.chantierNonFactureJours),
  };
}

/** Ce qui part en base après une saisie — la même fonction que pour l'affichage. */
export function normaliserRappels(saisie: Partial<ReglagesRappels>): ReglagesRappels {
  return lireRappels({
    devisSansReponseJours: saisie.devisSansReponseJours ?? null,
    chantierNonFactureJours: saisie.chantierNonFactureJours ?? null,
  });
}

/**
 * L'instant avant lequel un envoi compte comme « sans réponse ».
 *
 * Rendu comme une DATE plutôt qu'un nombre de jours : la requête compare des
 * instants, et calculer la soustraction dans le SQL disperserait la règle entre
 * deux endroits.
 */
export function seuilAncienneté(maintenant: Date, joursEcoules: number): Date {
  return new Date(maintenant.getTime() - joursEcoules * 24 * 60 * 60 * 1000);
}

/** « depuis 8 jours », « depuis hier » — jamais une date brute à décoder. */
export function depuisCombien(maintenant: Date, quand: Date): string {
  const j = Math.floor((maintenant.getTime() - quand.getTime()) / (24 * 60 * 60 * 1000));
  if (j <= 0) return "aujourd'hui";
  if (j === 1) return "depuis hier";
  return `depuis ${j} jours`;
}
