/**
 * Les unités qu'on propose pour un tarif — et pourquoi une liste alors que la
 * case était libre.
 *
 * **Sa demande, le 13 août 2026**, capture des tarifs à l'appui : *« crée-moi un
 * bandeau déroulant avec infos à choisir, jours/hommes, m² etc. »* Il a choisi
 * le bandeau déroulant parmi les deux formes dessinées
 * (`maquettes/atlas-unite-deroulante.html`).
 *
 * **Ce que la case libre coûtait, et qui ne se voyait pas.** L'unité n'est pas
 * décorative : c'est elle qui autorise la multiplication par une quantité au
 * moment du chiffrage, et c'est elle qui désigne un tarif de main d'œuvre
 * (`src/lib/tarif-main-oeuvre.ts`). Or ce rapprochement se fait sur le TEXTE de
 * l'unité, à la lettre près : « jour/homme » est reconnu, « jours/homme » ne
 * l'est pas. Une faute de frappe ne produit donc aucune erreur — elle produit
 * un tarif qui cesse de se multiplier, **en silence**, sur un devis qui part
 * chez le client.
 *
 * **Ce qui ne se discute pas : la liste ne ferme rien.** Un élagueur a des
 * unités qu'aucune liste ne devinera — le stère, l'arbre, la tonne de grumes.
 * Le bandeau se termine donc par une ligne libre. Enfermer le choix lui
 * retirerait ce qu'il a aujourd'hui : ce serait un recul déguisé en confort.
 *
 * Ce fichier ne décide de rien d'autre. Il ne corrige pas les unités déjà
 * saisies — « m2 » enregistré reste « m2 », et c'est volontaire : réécrire ses
 * données à son insu pour les faire entrer dans notre liste changerait des
 * prix sans qu'il l'ait demandé.
 */

export type UniteProposee = {
  /** Ce qui est enregistré, à la lettre près. */
  valeur: string;
  /** Ce que ça veut dire, quand ce n'est pas évident. Rien de plus. */
  quoi: string | null;
};

/**
 * Les six unités proposées, dans l'ordre du bandeau.
 *
 * **« jour/homme » vient en tête, et sa graphie n'est pas au choix** : c'est
 * exactement celle que `chiffrerMainOeuvre` reconnaît. La renommer ici ferait
 * disparaître le prix de main d'œuvre de la grille sans qu'aucun type ne
 * bronche — `scripts/test-unites-tarif.ts` monte la garde sur ce point précis.
 */
export const UNITES_PROPOSEES: readonly UniteProposee[] = [
  { valeur: "jour/homme", quoi: "main d'œuvre" },
  { valeur: "m²", quoi: "surface" },
  { valeur: "ml", quoi: "mètre linéaire" },
  { valeur: "heure", quoi: null },
  // « ne se multiplie pas » aurait été FAUX, et le dire ainsi sur l'écran
  // aurait installé une croyance que le code ne tient pas : un forfait porté
  // par une quantité confirmée se multiplie comme les autres
  // (`proposition-prix.ts`). Ce qui ne se multiplie jamais, c'est un tarif
  // SANS unité — d'où la ligne « Aucune unité » du bandeau.
  { valeur: "forfait", quoi: "un prix global" },
  { valeur: "tonne", quoi: null },
];

/** Les espaces de bord ne distinguent pas deux unités : ils les font diverger. */
export function normaliserUnite(brut: string): string {
  return brut.trim().replace(/\s+/g, " ");
}

/**
 * L'unité enregistrée figure-t-elle dans la liste proposée ?
 *
 * Comparaison **exacte** (aux espaces près), et c'est le fond du sujet : « m2 »
 * n'est pas « m² » pour le moteur de prix, donc il ne doit pas l'être ici non
 * plus. Faire semblant de les confondre à l'écran laisserait croire que le
 * tarif est reconnu alors qu'il ne l'est pas.
 */
export function uniteProposee(valeur: string | null | undefined): UniteProposee | null {
  if (!valeur) return null;
  const cherchee = normaliserUnite(valeur);
  return UNITES_PROPOSEES.find((u) => u.valeur === cherchee) ?? null;
}

/** Une unité saisie à la main, que la liste ne connaît pas — le stère, l'arbre. */
export function estUniteLibre(valeur: string | null | undefined): boolean {
  return normaliserUnite(valeur ?? "") !== "" && uniteProposee(valeur) === null;
}

/** Ce qu'il PRONONCE, en face de ce qu'on enregistre — voir `uniteDictee`. */
const UNITES_DITES: readonly { dit: RegExp; valeur: string }[] = [
  { dit: /^(m(?:e|è)tres?\s*lin(?:e|é)aires?|ml|m\s*lin(?:e|é)aire)$/i, valeur: "ml" },
  { dit: /^(m(?:e|è)tres?\s*carr(?:e|é)s?|m2|m²)$/i, valeur: "m²" },
  { dit: /^(heures?|h)$/i, valeur: "heure" },
  { dit: /^(jours?\s*[\/-]?\s*hommes?|journ(?:e|é)es?\s*hommes?)$/i, valeur: "jour/homme" },
  { dit: /^(forfaits?|au\s*forfait|prix\s*global)$/i, valeur: "forfait" },
  { dit: /^(tonnes?|t)$/i, valeur: "tonne" },
];

/** Au-delà, ce n'est plus une unité mais un bout de phrase — on n'en garde rien. */
const LONGUEUR_MAX_UNITE = 20;

/**
 * L'unité telle qu'il la PRONONCE, ramenée à celle qu'on enregistre.
 *
 * **Sa demande du 20 août 2026** : dicter le chantier dans le devis plutôt que
 * de le taper — *« j'aimerais tailler ma haie, c'est une haie qui fait quelque
 * chose comme vingt mètres linéaires »*. Personne ne dit « ml » à voix haute.
 *
 * **Pourquoi ramener au mot exact de la liste, plutôt que de garder le sien.**
 * L'unité n'est pas décorative : « jour/homme » désigne un tarif de main
 * d'œuvre, à la lettre près (voir en tête de ce fichier). Enregistrer « jours
 * homme » parce qu'il l'a dit au pluriel produirait un tarif qui cesse de se
 * multiplier, en silence, sur un devis qui part chez son client.
 *
 * **Mais la liste ne ferme rien, ici non plus.** Un mot qu'elle ignore — le
 * stère, l'arbre, le sac — est gardé tel quel : c'est une vraie unité de son
 * métier, et la refuser lui ferait perdre une quantité qu'il a bel et bien
 * dictée. Ce qui est refusé, c'est ce qui n'est pas une unité du tout : un
 * chiffre, une phrase, une longueur invraisemblable.
 */
export function uniteDictee(brut: unknown): string | null {
  if (typeof brut !== "string") return null;
  const dit = normaliserUnite(brut);
  if (!dit) return null;

  for (const { dit: motif, valeur } of UNITES_DITES) {
    if (motif.test(dit)) return valeur;
  }

  // Un chiffre dans l'unité trahit une quantité recopiée au mauvais endroit
  // (« 20 mètres ») : la garder écrirait « 20 × 20 m » sur le devis.
  if (/\d/.test(dit)) return null;
  if (dit.length > LONGUEUR_MAX_UNITE) return null;
  return dit;
}
