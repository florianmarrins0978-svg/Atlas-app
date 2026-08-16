/**
 * Les trois rappels qu'Atlas peut vraiment tenir aujourd'hui.
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
 *   · un chantier ouvert depuis N jours dont AUCUN devis n'est parti ;
 *   · un devis parti, toujours valable, sans réponse depuis N jours ;
 *   · un chantier terminé, sans facture, depuis N jours.
 *
 * **Le premier a été demandé le 14 août 2026** : *« un rappel lorsque le chantier
 * a été ouvert mais le devis n'a pas été envoyé »*. Il ne se déduit PAS du
 * deuxième : celui-là part d'un envoi, et un devis jamais parti n'a pas de ligne
 * d'envoi à interroger. Le sien se lit sur le chantier — `createdAt` et
 * `devisEnvoyeAt`.
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
  chantierSansDevisJours: number | null;
  devisSansReponseJours: number | null;
  chantierNonFactureJours: number | null;
  /**
   * Le quatrième rappel : une facture dont le règlement n'est pas arrivé.
   *
   * *Dessiné le 16 août 2026 (`maquettes/atlas-rappel-facture-impayee.html`),
   * codé le même jour sur sa réponse :* ***« faut faire A plus B »***.
   *
   * **Le nombre de jours se compte APRÈS L'ÉCHÉANCE quand elle existe** —
   * Atlas connaît le délai de paiement réglé dans « Devis & factures » — et à
   * défaut après l'envoi de la facture. C'est le « A plus B » : l'échéance
   * quand on la connaît, un délai réglé sinon, et plus aucun cas muet.
   */
  factureImpayeeJours: number | null;
  /**
   * **Tous les combien il le redit — et pas tous les jours.**
   *
   * Sa demande du 16 août 2026 : *« je veux un rappel toutes les semaines ou
   * tous les quinze jours, mais pas qu'il y ait la notification tous les
   * jours »*. Sans ce rythme, la carte resterait à l'écran chaque jour jusqu'au
   * paiement — et au bout d'une semaine on ne la lit plus. C'est le rappel
   * entier qu'on perdrait.
   *
   * **Jamais nul :** ce n'est pas un interrupteur. Éteindre le rappel se fait
   * par `factureImpayeeJours`, et deux façons de l'éteindre finiraient par se
   * contredire.
   */
  factureImpayeeRythmeJours: number;
};

/**
 * Les trois rythmes proposés — et il n'y en a que trois, délibérément.
 *
 * Une case de saisie inviterait à écrire « 3 jours », ce qu'il vient
 * précisément d'exclure. Ce sont ses mots : *« toutes les semaines ou tous les
 * quinze jours »*, et « chaque jour » reste offert à qui le veut.
 */
export const RYTHMES_RAPPEL = [
  { jours: 1, libelle: "Chaque jour" },
  { jours: 7, libelle: "Chaque semaine" },
  { jours: 15, libelle: "Tous les 15 jours" },
] as const;

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
  // **Quatre jours, choisis par lui le 16 août 2026** — « la B et 4 » —, au
  // milieu des « deux, trois, quatre, cinq, six » qu'il avait énumérés.
  chantierSansDevisJours: 4,
  devisSansReponseJours: 7,
  chantierNonFactureJours: 3,
  // **Le lendemain de l'échéance.** Un client en retard l'est dès le premier
  // jour ; attendre pour le lui dire ne fait que retarder le coup de fil.
  factureImpayeeJours: 1,
  // Chaque semaine : celui du milieu, et celui qu'il a nommé en premier.
  factureImpayeeRythmeJours: 7,
};

/** Bornes de bon sens, les mêmes à l'écran et au serveur. */
export const BORNES_RAPPELS = {
  chantierSansDevisJours: { min: 1, max: 90 },
  devisSansReponseJours: { min: 1, max: 90 },
  chantierNonFactureJours: { min: 1, max: 90 },
  factureImpayeeJours: { min: 1, max: 90 },
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
    chantierSansDevisJours:
      brut?.chantierSansDevisJours === undefined
        ? RAPPELS_PAR_DEFAUT.chantierSansDevisJours
        : jours(brut.chantierSansDevisJours, BORNES_RAPPELS.chantierSansDevisJours),
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
    factureImpayeeJours:
      brut?.factureImpayeeJours === undefined
        ? RAPPELS_PAR_DEFAUT.factureImpayeeJours
        : jours(brut.factureImpayeeJours, BORNES_RAPPELS.factureImpayeeJours),
    // **Le rythme n'est jamais nul**, contrairement aux délais : il ne sert pas
    // à éteindre. Une valeur inconnue retombe sur « chaque semaine » plutôt que
    // de rendre le rappel muet — un rythme absent ne doit pas se lire comme un
    // rappel coupé.
    factureImpayeeRythmeJours: rythmeConnu(brut?.factureImpayeeRythmeJours),
  };
}

/** Un rythme de la liste, ou celui par défaut. Jamais une valeur inventée. */
export function rythmeConnu(valeur: unknown): number {
  const n = typeof valeur === "number" ? valeur : Number(valeur);
  return RYTHMES_RAPPEL.some((r) => r.jours === n) ? n : RAPPELS_PAR_DEFAUT.factureImpayeeRythmeJours;
}

/** Ce qui part en base après une saisie — la même fonction que pour l'affichage. */
export function normaliserRappels(saisie: Partial<ReglagesRappels>): ReglagesRappels {
  return lireRappels({
    chantierSansDevisJours: saisie.chantierSansDevisJours ?? null,
    devisSansReponseJours: saisie.devisSansReponseJours ?? null,
    chantierNonFactureJours: saisie.chantierNonFactureJours ?? null,
    factureImpayeeJours: saisie.factureImpayeeJours ?? null,
    factureImpayeeRythmeJours: saisie.factureImpayeeRythmeJours,
  });
}

/**
 * L'échéance d'une facture — « A plus B », sa réponse du 16 août 2026.
 *
 * **A :** le délai de paiement réglé dans « Devis & factures » court à partir de
 * l'envoi. C'est la date promise au client, celle qui définit le retard.
 * **B :** aucun délai réglé — il n'y a donc pas d'échéance, et on retombe sur le
 * jour de l'envoi. Le rappel paraîtra alors `factureImpayeeJours` après
 * l'envoi, comme les trois autres rappels comptent depuis leur événement.
 *
 * Rendre `null` aurait été le troisième choix, et il est écarté : un rappel qui
 * se tait faute de réglage est un rappel qu'on croit allumé.
 */
export function echeanceFacture(envoyeeLe: Date, delaiPaiementJours: number | null): Date {
  if (delaiPaiementJours === null) return envoyeeLe;
  return new Date(envoyeeLe.getTime() + delaiPaiementJours * 24 * 60 * 60 * 1000);
}

/**
 * Cette facture doit-elle être rappelée aujourd'hui ?
 *
 * **Le rythme n'avance QUE par un geste.** `repousseeLe` est la date du dernier
 * « Plus tard ». Tant qu'il n'a rien touché, la carte reste — une carte qui
 * s'endormirait toute seule pourrait passer un jour où il n'ouvre pas
 * l'application, et il ne saurait jamais qu'elle est passée (sa planche, écran
 * 5).
 */
export function rappelFactureDu(params: {
  maintenant: Date;
  echeance: Date;
  apresJours: number;
  rythmeJours: number;
  repousseeLe: Date | null;
}): boolean {
  const debut = params.echeance.getTime() + params.apresJours * 24 * 60 * 60 * 1000;
  if (params.maintenant.getTime() < debut) return false;
  if (params.repousseeLe === null) return true;
  const reveil = params.repousseeLe.getTime() + params.rythmeJours * 24 * 60 * 60 * 1000;
  return params.maintenant.getTime() >= reveil;
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

/**
 * Le nombre de jours pleins écoulés — la SEULE source du compte.
 *
 * Sortie séparée parce que l'étiquette du rappel qu'il a retenu l'affiche nu
 * (« Devis en attente · 14 jours ») pendant que la phrase le met en mots. Deux
 * calculs du même délai finiraient par se contredire d'une ligne à l'autre :
 * l'étiquette dirait 14 et la phrase « depuis 13 jours ».
 */
export function joursEcoules(maintenant: Date, quand: Date): number {
  return Math.max(0, Math.floor((maintenant.getTime() - quand.getTime()) / (24 * 60 * 60 * 1000)));
}

/** « depuis 8 jours », « depuis hier » — jamais une date brute à décoder. */
export function depuisCombien(maintenant: Date, quand: Date): string {
  const j = joursEcoules(maintenant, quand);
  if (j <= 0) return "aujourd'hui";
  if (j === 1) return "depuis hier";
  return `depuis ${j} jours`;
}
