/**
 * Le libellé du « je propose », sur la page que le client ouvre.
 *
 * **Sa formulation, le 20 septembre 2026 :** *« quand il y a une date c'est :
 * cette date ne me convient pas ? Je propose »*, et *« quand il y a plusieurs
 * dates de proposées, mets la phrase au pluriel »*.
 *
 * **LE PLURIEL SE DÉCIDE SUR LES JOURS, PAS SUR LE NOMBRE DE PROPOSITIONS —
 * et c'est sa capture qui l'impose.** Le patron propose une ou deux dates
 * (arrêt 1, `docs/AGENT.md`), mais chacune peut porter plusieurs jours depuis
 * sa règle du 17 septembre. Sur son écran du 20, une seule proposition listait
 * « le jeudi 8 octobre, le vendredi 9, le lundi 12 et le mardi 13 octobre » —
 * quatre dates — et la ligne d'en dessous disait « cette date », au singulier.
 * Compter les propositions redonnerait exactement ce singulier-là.
 *
 * C'est la seule page que le client voit, et elle porte le sérieux du patron.
 *
 * Ici plutôt que dans le composant : une règle se teste sans base ni navigateur
 * (`CLAUDE.md` §3), et l'importer depuis l'écran entraînait toute la chaîne de
 * connexion à la base.
 */
export function libelleAutreDate(nombreDeJoursProposes: number): string {
  if (nombreDeJoursProposes <= 0) return "Je propose une date";
  if (nombreDeJoursProposes === 1) return "Cette date ne me convient pas ? Je propose";
  return "Ces dates ne me conviennent pas ? Je propose";
}

/**
 * « Les travaux sont prévus sur 4 jours. » — sa quatrième demande du même soir,
 * qu'il a dû redire parce que la phrase avait d'abord été posée dans la feuille
 * du calendrier : le client ne l'ouvre que si les dates ne lui conviennent pas,
 * et lisait donc quatre dates sans jamais savoir que le chantier en prend
 * quatre.
 *
 * `null` sur un chantier d'un seul jour : il n'y a rien à annoncer, et une
 * phrase qui dit « sur 1 jour » est du bruit (`CLAUDE.md` §3, le moins de mots
 * possible).
 *
 * **Le nombre vient des jours que le patron a proposés**, déjà écrits sur la
 * page — jamais de la durée en demi-journées, qui ne descend pas jusqu'au
 * client (`test-creneaux-planning.ts`).
 */
export function phraseDureeDesTravaux(nombreDeJours: number): string | null {
  if (nombreDeJours <= 1) return null;
  return `Les travaux sont prévus sur ${nombreDeJours} jours.`;
}

/** Le bouton qui retient les jours, au singulier ou au pluriel. */
export function libelleRetenir(nombreDeJours: number): string {
  return nombreDeJours > 1 ? "Retenir ces jours" : "Retenir cette date";
}

/**
 * Ce qui manque à sa proposition, dit en toutes lettres — ou `null` si elle est
 * complète.
 *
 * Le bouton ne s'éteint pas faute de jours : il répond, et c'est sa réponse qui
 * dit ce qui manque, au moment où cela mord (`CLAUDE.md` §217, la même leçon
 * que sur l'écran de connexion).
 */
export function refusDesJoursRetenus(
  joursRetenus: number,
  joursAttendus: number
): string | null {
  if (joursRetenus === 0) return "Touchez d'abord un jour dans le calendrier.";
  const manque = joursAttendus - joursRetenus;
  if (manque <= 0) return null;
  return manque === 1 ? "Il manque 1 jour." : `Il manque ${manque} jours.`;
}
