/**
 * Ce qui manque à l'identité d'une entreprise, et ce que chaque absence
 * empêche.
 *
 * **Décision du patron, le 14 août 2026 (planche `atlas-trois-questions.html`,
 * question 3, réponse « A ») : on BLOQUE L'ENVOI d'un devis dont l'identité est
 * incomplète — jamais sa rédaction.** La raison tient en une phrase : un devis
 * FIGE l'identité de l'émetteur au moment où il part. Le corriger le lendemain
 * ne change pas celui que le client a sous les yeux, ni le PDF qu'il a
 * téléchargé. Un simple avertissement se lit une fois, se contourne d'un doigt,
 * et se paie deux semaines plus tard quand le client réclame le SIRET.
 *
 * **Pourquoi une fonction pure, et pas une vérification à chaque endroit.**
 * Trois écrans posent la même question : celui de l'identité (qui signale
 * champ par champ), celui de l'envoi (qui refuse), et l'action serveur (qui
 * refuse aussi, parce qu'une adresse se tape). `CLAUDE.md` §3 l'interdit
 * formellement : *jamais de règle dupliquée entre l'affichage et la
 * vérification* — deux implémentations finissent toujours par diverger, et ici
 * la divergence serait un devis parti sans SIRET pendant que l'écran affirmait
 * le contraire.
 *
 * **Ce qui n'est PAS ici, et pourquoi.** La forme juridique, le téléphone,
 * l'e-mail, le numéro de TVA et le titulaire du compte manquent souvent et
 * n'empêchent rien : un devis sans téléphone reste un devis valable. Les
 * ajouter transformerait un garde-fou en corvée, et un garde-fou qui agace
 * finit contourné.
 */

/** Les seuls champs dont l'absence arrête un envoi. */
export type ChampIdentite = "nom" | "adresse" | "siret" | "iban";

export type ManqueIdentite = {
  champ: ChampIdentite;
  /** L'étiquette telle qu'elle est écrite sur l'écran de l'identité. */
  etiquette: string;
  /** Ce que l'absence empêche — jamais « obligatoire », qui n'apprend rien. */
  empeche: string;
};

/**
 * Les quatre phrases, ÉCRITES UNE SEULE FOIS.
 *
 * L'écran de l'identité les affiche sous le champ vide, l'écran d'envoi les
 * répète dans sa liste. Recopiées, elles auraient fini par se contredire — et
 * le patron aurait lu deux raisons différentes pour un même champ.
 */
const REGLES: readonly ManqueIdentite[] = [
  {
    champ: "nom",
    etiquette: "Nom de l'entreprise",
    empeche: "Sans nom, vos documents n'ont pas d'émetteur.",
  },
  {
    champ: "adresse",
    etiquette: "Adresse du siège",
    empeche: "Elle figure en tête de chaque devis et de chaque facture.",
  },
  {
    champ: "siret",
    etiquette: "SIRET",
    empeche: "Vos factures ne sont pas conformes sans lui.",
  },
  {
    champ: "iban",
    etiquette: "IBAN",
    empeche: "Sans lui, votre client reçoit un devis qu'il ne peut pas payer.",
  },
] as const;

/** Ce que la règle a besoin de savoir. Volontairement partiel : elle ne lit
 *  rien d'autre, et une entreprise absente se traite comme une entreprise vide. */
export type IdentiteLue = {
  nom?: string | null;
  adresse?: string | null;
  siret?: string | null;
  iban?: string | null;
} | null | undefined;

/** Un champ vide, ou rempli d'espaces, est un champ manquant. */
function vide(valeur: string | null | undefined): boolean {
  return (valeur ?? "").trim() === "";
}

/**
 * Ce qui manque, dans l'ordre où le patron le corrigera : de haut en bas de
 * l'écran de l'identité. Une liste vide veut dire que le devis peut partir.
 */
export function manquesIdentite(identite: IdentiteLue): ManqueIdentite[] {
  const valeurs: Record<ChampIdentite, string | null | undefined> = {
    nom: identite?.nom,
    adresse: identite?.adresse,
    siret: identite?.siret,
    iban: identite?.iban,
  };
  return REGLES.filter((r) => vide(valeurs[r.champ]));
}

/** Le devis peut-il partir ? */
export function identiteComplete(identite: IdentiteLue): boolean {
  return manquesIdentite(identite).length === 0;
}

/** La phrase que l'écran d'envoi met sous son bouton éteint. */
export function empechePar(champ: ChampIdentite): string {
  return REGLES.find((r) => r.champ === champ)!.empeche;
}

/**
 * Le refus rendu par le serveur, en une phrase.
 *
 * **Un refus attendu se rend en VALEUR DE RETOUR, jamais en exception** : le
 * message d'une exception levée par une action serveur n'arrive jamais jusqu'au
 * patron — Next.js le remplace en production par un identifiant opaque, et son
 * banc sert une version bâtie (`AGENTS.md`). Il lirait « une erreur est
 * survenue » et n'aurait aucun moyen de comprendre.
 */
export function refusIdentiteIncomplete(manques: ManqueIdentite[]): string {
  const noms = manques.map((m) => m.etiquette);
  const liste =
    noms.length === 1 ? noms[0] : `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`;
  return `Votre devis est prêt, mais il partirait sans ${liste}. Complétez « Mon entreprise » dans les réglages : le devis vous attend tel quel.`;
}
