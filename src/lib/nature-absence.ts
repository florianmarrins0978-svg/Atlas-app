// La nature d'une absence : ce qu'elle dit au comptable, et si le jour compte
// travaillé.
//
// Sa planche du 5 novembre 2026, validée (`appli/soignee/motif-absence.html`) :
// six motifs d'un appui, au planning et dans Réglages, Équipe.
//
// **Déplacement et Formation comptent TRAVAILLÉS.** Le salarié n'est pas libre
// pour un chantier (l'absence le retire des dates proposées, comme toujours),
// mais sa journée est payée. C'est le piège trouvé en dessinant : une absence
// d'Atlas est née le 14 août 2026 pour « une équipe qui doit partir en
// déplacement pour cinq jours » ; la compter absente aurait retiré ces jours
// de sa paie.
//
// **Une absence SANS nature compte absente**, et l'écran des jours travaillés
// demande pourquoi : un jour retiré à tort se voit et se corrige ; un jour
// compté travaillé à tort partirait payé sans que personne le remarque.

export const NATURES_ABSENCE = ["conge", "maladie", "sans_solde", "deplacement", "formation", "autre"] as const;

export type NatureAbsence = (typeof NATURES_ABSENCE)[number];

/** Les mots de l'écran, et du PDF du comptable. */
export const LIBELLE_NATURE: Record<NatureAbsence, string> = {
  conge: "Congé",
  maladie: "Maladie",
  sans_solde: "Sans solde",
  deplacement: "Déplacement",
  formation: "Formation",
  autre: "Autre",
};

/** Une valeur venue de l'écran ou de la base, relue : inconnue, elle ne vaut rien. */
export function natureLue(valeur: unknown): NatureAbsence | null {
  return typeof valeur === "string" && (NATURES_ABSENCE as readonly string[]).includes(valeur)
    ? (valeur as NatureAbsence)
    : null;
}

/** Le jour d'une absence de cette nature compte-t-il travaillé ? */
export function compteTravaille(nature: NatureAbsence | null): boolean {
  return nature === "deplacement" || nature === "formation";
}

/** « Compté travaillé. » ou « Compté absent. » sous les motifs, rien sans motif. */
export function phraseDuCompte(nature: NatureAbsence | null): string | null {
  if (nature === null) return null;
  return compteTravaille(nature) ? "Compté travaillé." : "Compté absent.";
}
