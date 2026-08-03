/**
 * Le libellé du « je propose une autre date », sur la page que le client ouvre.
 *
 * **Le défaut qu'il ferme.** Il était écrit « Aucune des deux » en dur. Or le
 * patron choisit **une ou deux** dates au moment d'envoyer — c'est l'arrêt 1 de
 * `docs/AGENT.md`, et sa seule question avant que le devis parte. Avec une
 * seule date, son client lisait « Aucune des deux » en face d'une seule ligne.
 *
 * C'est la seule page que le client voit, et elle porte le sérieux du patron.
 *
 * Ici plutôt que dans le composant : une règle se teste sans base ni navigateur
 * (`CLAUDE.md` §3), et l'importer depuis l'écran entraînait toute la chaîne de
 * connexion à la base.
 */
export function libelleAutreDate(nombreDeDates: number): string {
  if (nombreDeDates === 0) return "Je propose une date :";
  if (nombreDeDates === 1) return "Cette date ne me convient pas — je propose :";
  if (nombreDeDates === 2) return "Aucune des deux — je propose :";
  return "Aucune de ces dates — je propose :";
}
