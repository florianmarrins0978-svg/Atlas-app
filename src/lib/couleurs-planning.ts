/**
 * Les quatre couleurs du planning : rien, incomplet, complet, au-delà.
 *
 * **Sa demande du 29 septembre 2026**, planche `appli/couleurs-du-planning.html`,
 * et ses deux réponses : *« tout l'entreprise »*, puis *« met la même chose que
 * pour les couleurs des devis »*. Un réglage par ENTREPRISE (migration 0113),
 * un nuancier libre comme `L'allure de mes devis`.
 *
 * **`null` veut dire « celle de l'apparence »**, comme pour l'allure : écrire le
 * vert pâle d'origine le figerait, et il ne suivrait plus Nuit ni Sylve.
 */
import { contraste, detacher, estSombre, type Charte } from "./chartes";
import { couleurNettoyee } from "./allure-documents";
import type { EtatDemi } from "./planning-jour";

/**
 * Les quatre états d'une demi-journée, et le FÉRIÉ.
 *
 * **Le férié n'est pas un état** : une demi-journée fériée reste rien,
 * incomplète ou complète (sa règle du 6 novembre 2026 : *« on doit quand même
 * pouvoir mettre des chantiers dessus si on veut travailler ce jour-là »*). Il
 * peint la CASE du jour, pas sa barre. Mais sa couleur se règle au même endroit
 * que les quatre autres, sa réponse du même jour : *« réglable »*.
 */
export type CleCouleur = EtatDemi | "ferie";

export type CouleursPlanning = Record<CleCouleur, string | null>;

export const ETATS_DU_PLANNING: readonly EtatDemi[] = ["libre", "dispo", "plein", "dela"];

/** Ce que la feuille « Couleurs » règle, dans son ordre. */
export const COULEURS_DU_PLANNING: readonly CleCouleur[] = [...ETATS_DU_PLANNING, "ferie"];

export const AUCUNE_COULEUR_CHOISIE: CouleursPlanning = {
  libre: null,
  dispo: null,
  plein: null,
  dela: null,
  ferie: null,
};

/** Le nom de la variable CSS qui porte la couleur d'un état, ou le fond du férié. */
export function variableDeLEtat(etat: CleCouleur): string {
  return `--atlas-etat-${etat}`;
}

/** Le chiffre et la pastille posés sur le fond du férié choisi. */
export const VARIABLE_TEXTE_DU_FERIE = "--atlas-etat-ferie-texte";

/**
 * La couleur que l'apparence donne à un état quand rien n'est choisi.
 *
 * **Lue dans les jetons de la charte, jamais recopiée** : ce sont les mêmes que
 * `fondDeLEtat` prend en repli (`vertPale`, `rust`, `bordeaux`). « rien » n'a
 * pas de couleur : sa case est la plage d'une carte, d'où `card`.
 */
export function couleurDApparence(etat: CleCouleur, c: Charte): string {
  const jeton =
    etat === "dispo"
      ? c.jetons.vertPale
      : etat === "plein"
        ? c.jetons.rust
        : etat === "dela"
          ? c.jetons.bordeaux
          : etat === "ferie"
            ? c.jetons.carteBleuFond
            : c.jetons.card;
  // En minuscules, comme le rend un nuancier : c'est à elles que le choix se
  // compare, et un nuancier refuse une valeur en majuscules.
  return jeton.toLowerCase();
}

/**
 * Ce que les quatre colonnes valent, nettoyé.
 *
 * **Rien n'est cru sur parole** : ce qui n'est pas une couleur retombe sur
 * « celle de l'apparence ». La base porte le même `CHECK`.
 */
export function normaliserCouleursPlanning(
  brut: Partial<Record<CleCouleur, string | null | undefined>>
): CouleursPlanning {
  return {
    libre: couleurNettoyee(brut.libre),
    dispo: couleurNettoyee(brut.dispo),
    plein: couleurNettoyee(brut.plein),
    dela: couleurNettoyee(brut.dela),
    ferie: couleurNettoyee(brut.ferie),
  };
}

/**
 * Un choix qui vaut la couleur de l'apparence s'écrit VIDE.
 *
 * Le nuancier de l'écran rend la couleur d'aujourd'hui comme une autre valeur :
 * l'enregistrer en clair figerait l'état sur cette apparence-là, et il ne
 * suivrait plus quand on en change (même règle que `estLAllureParDefaut`).
 */
export function choixAEcrire(etat: CleCouleur, choisie: string | null, c: Charte): string | null {
  const propre = couleurNettoyee(choisie);
  if (!propre) return null;
  return propre === couleurDApparence(etat, c) ? null : propre;
}

/**
 * Les variables CSS à poser pour que le planning prenne SES couleurs.
 *
 * **Seules les couleurs choisies s'écrivent** : une variable absente laisse
 * `fondDeLEtat` retomber sur la couleur de l'apparence, au pixel près.
 *
 * **Sur une apparence sombre, la couleur est éclaircie juste assez pour se
 * voir**, et seulement là : un bordeaux foncé disparaît sur Nuit. C'est le même
 * `detacher` que la charte applique déjà à son bordeaux et à son vert pâle, au
 * même seuil (3) contre le fond et la plage. Sur les apparences claires, la
 * couleur sort intacte : c'est ce qu'il a validé sur la planche.
 */
export function variablesDesEtats(couleurs: CouleursPlanning, c: Charte): Record<string, string> {
  const sombre = estSombre(c.jetons);
  const sortie: Record<string, string> = {};
  for (const etat of COULEURS_DU_PLANNING) {
    const v = couleurs[etat];
    if (!v) continue;
    const fond = sombre ? detacher(v, [c.jetons.cream, c.jetons.card], 3, 1) : v;
    sortie[variableDeLEtat(etat)] = fond;
    // **Le chiffre du férié suit le fond qu'il a choisi** : l'encre ou la
    // plage de SA charte, la plus lisible des deux. Un bleu soutenu sur un
    // rouge pâle se lirait mal, et un fond foncé effacerait l'encre.
    if (etat === "ferie") sortie[VARIABLE_TEXTE_DU_FERIE] = texteSurLeFond(fond, c);
  }
  return sortie;
}

/**
 * Ce qui se lit sur ce fond : l'encre ou la plage de la charte, d'abord, pour
 * rester dans ses couleurs ; sur un fond de teinte moyenne où aucune des deux
 * ne tient 4,5 (le contrôle l'a trouvé sur Sylve), le noir ou le blanc.
 */
export function texteSurLeFond(fond: string, c: Charte): string {
  const lisible = [c.jetons.ink, c.jetons.card].filter((t) => contraste(fond, t) >= 4.5);
  const candidats = lisible.length ? lisible : ["#000000", "#ffffff"];
  return candidats.reduce((m, t) => (contraste(fond, t) > contraste(fond, m) ? t : m));
}

/**
 * Les trois raccourcis de chaque état, après celui de l'apparence.
 *
 * Ce sont ceux de la planche qu'il a validée, où ils se sont essayés.
 */
export const RACCOURCIS_DU_PLANNING: Record<CleCouleur, [string, string][]> = {
  libre: [["#ffffff", "Blanc"], ["#e3eadf", "Vert très pâle"], ["#e8e8e6", "Gris clair"]],
  dispo: [["#7d9a6d", "Vert"], ["#b98b47", "Doré"], ["#d0782a", "Orange"]],
  plein: [["#22456d", "Bleu nuit"], ["#1c1c1a", "Noir"], ["#7d9a6d", "Vert"]],
  dela: [["#b8322a", "Rouge"], ["#d0782a", "Orange"], ["#1c1c1a", "Noir"]],
  // Les deux autres teintes de sa planche des fériés (`appli/soignee/jours-feries.html`),
  // le bleu qu'il a choisi étant « Celle d'aujourd'hui ».
  ferie: [["#edded9", "Rouge pâle"], ["#e1cdf0", "Violet pâle"]],
};

/** Les colonnes de l'entreprise (migrations 0113 et 0168), lues une seule fois ici. */
export function couleursDepuisColonnes(
  e: {
    planningRien: string | null;
    planningIncomplet: string | null;
    planningComplet: string | null;
    planningAuDela: string | null;
    planningFerie?: string | null;
  } | null
): CouleursPlanning {
  if (!e) return AUCUNE_COULEUR_CHOISIE;
  return normaliserCouleursPlanning({
    libre: e.planningRien,
    dispo: e.planningIncomplet,
    plein: e.planningComplet,
    dela: e.planningAuDela,
    ferie: e.planningFerie,
  });
}
