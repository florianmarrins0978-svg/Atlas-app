/**
 * JUSQU'À QUAND UNE PIÈCE SE GARDE — corrigé le 6 novembre 2026.
 *
 * Le Code de commerce (L123-22) compte les dix ans **depuis la clôture de
 * l'exercice**, pas depuis la date de la pièce. Une facture de mars 2026 se
 * garde donc au moins jusqu'à fin 2036, et non mars 2036 comme on le comptait
 * jusqu'ici : effacée à la date anniversaire, elle partait avant son terme.
 *
 * **Atlas ne connaît pas l'exercice de chaque artisan** (décalé, ou premier
 * exercice de vingt-quatre mois). La règle prend donc le côté sûr, sa décision
 * du 6 novembre : la pièce se garde jusqu'au 31 décembre de son année plus
 * `annees` plus un. Une facture de 2026 se garde jusqu'au 31 décembre 2037,
 * ce qui couvre tout exercice qui la contient. Effacer un an trop tard ne
 * coûte presque rien ; effacer trop tôt est interdit.
 *
 * Le jour rendu est le DERNIER jour de conservation : la pièce peut partir le
 * lendemain.
 */
export function echeanceConservation(depuis: Date, annees: number): Date {
  return new Date(Date.UTC(depuis.getUTCFullYear() + annees + 1, 11, 31));
}

/**
 * L'ARCHIVE D'UN COMPTE FERMÉ EST-ELLE ÉCHUE ? Seulement quand la DERNIÈRE de
 * ses pièces l'est : on efface l'archive d'un bloc, jamais pièce par pièce (un
 * avoir tient à sa facture, une facture à son devis). Sans aucune date, on ne
 * conclut pas : rien n'est échu.
 */
export function archiveEchue(echeances: Date[], maintenant: Date): boolean {
  if (echeances.length === 0) return false;
  const derniere = Math.max(...echeances.map((d) => d.getTime()));
  return maintenant.getTime() > derniere + 24 * 60 * 60 * 1000 - 1;
}
