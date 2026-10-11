/**
 * ─── DEUX ÉCRITURES DE LA MÊME DONNÉE NE PARTENT PAS ENSEMBLE ──────────────
 *
 * **Le défaut, mesuré le 11 septembre 2026.** Sur le devis, effacer le prix
 * accordé au client puis le reposer aussitôt laissait la base à `null` : le
 * champ quitté lançait son écriture (« aucune remise »), le bouton lançait la
 * sienne (« 5 % ») dans la foulée, et **rien ne garantissait leur ordre
 * d'arrivée**. Une fois sur trois, la seconde était doublée par la première.
 *
 * Ce n'est pas un défaut de contrôle : c'est un geste que le patron peut faire,
 * et dont le résultat dépendait du réseau.
 *
 * **Ce que la file fait, et rien de plus :** elle retient l'écriture en cours
 * et fait attendre la suivante. Les appels partent donc dans l'ordre où le
 * doigt les a déclenchés — celui qui a le dernier mot est le dernier geste.
 *
 * **Ce qu'elle ne fait PAS, délibérément :** ni annuler, ni regrouper, ni
 * rejouer. Une écriture qui échoue ne bloque pas les suivantes, et son refus
 * revient intact à l'appelant — c'est à lui de le montrer au patron.
 *
 * **Pure, et hors de React** : la règle s'éprouve sans monter un écran
 * (`scripts/test-ecritures-a-la-suite.ts`). Le hook qui la tient pour un
 * composant n'est qu'un support (`useEcrituresALaSuite`).
 */
export function fileDEcritures(): <T>(ecrire: () => Promise<T>) => Promise<T> {
  let derniere: Promise<unknown> = Promise.resolve();

  return function aLaSuite<T>(ecrire: () => Promise<T>): Promise<T> {
    // Le refus de l'écriture d'avant ne concerne pas celle-ci : on attend
    // qu'elle soit finie, pas qu'elle ait réussi.
    const envoi = derniere.catch(() => {}).then(ecrire);
    derniere = envoi;
    return envoi;
  };
}
