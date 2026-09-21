/**
 * LES PLAFONDS DE PHOTOS — sa décision du 20 septembre 2026.
 *
 * *« Ça serait bien de pouvoir ajouter plusieurs photos en même temps […] par
 * contre il faut mettre un nombre de photos max »*, puis, devant l'inventaire :
 * *« Très bien, fais ça »*. Trois chiffres, et chacun tient une chose :
 *
 * | | | pourquoi |
 * |---|---|---|
 * | une sélection sur la pellicule | 15 | ce qu'une visite chez le client rapporte |
 * | une sélection sur le retour du jour, et les photos cochées d'un retour | 10 | ce que le client lit sur un téléphone ; au-delà il ne regarde plus |
 * | un chantier entier | 30 | la seule borne qui tienne vraiment — une sélection se recommence |
 *
 * **Pourquoi pas un plafond de 15 par chantier**, comme il l'avait d'abord
 * proposé : les photos du retour du jour SONT les photos du chantier (le retour
 * en « reprend » certaines), et 15 aurait bloqué le deuxième jour d'un chantier
 * de trois.
 *
 * **Les deux bornes de sélection se tiennent à l'écran, la borne du chantier
 * au serveur** — et c'est la même fonction qui sert les deux : une règle
 * recopiée entre l'affichage et la vérification finit toujours par diverger
 * (`CLAUDE.md` §3). Ni base, ni écran ici.
 */

export const PHOTOS_MAX_PAR_CHANTIER = 30;
export const PHOTOS_MAX_PAR_RETOUR = 10;

/** Combien une seule ouverture de la photothèque peut rapporter, selon l'écran. */
export const PHOTOS_PAR_SELECTION = {
  pellicule: 15,
  retour: PHOTOS_MAX_PAR_RETOUR,
} as const;

/** Ce qu'il reste de place sous un plafond — jamais négatif. */
export function placesRestantes(occupees: number, plafond: number): number {
  return Math.max(0, plafond - occupees);
}

/**
 * Pourquoi une photo de plus ne peut pas entrer sur ce chantier, ou `null`.
 *
 * **Rend une phrase, jamais une exception** : le message d'une exception levée
 * par une action serveur n'arrive jamais jusqu'au patron (`HANDOVER.md`,
 * piège 0 ter), et c'est cette phrase-là que l'écran affiche.
 */
export function refusDuPlafondDuChantier(existantes: number): string | null {
  return existantes >= PHOTOS_MAX_PAR_CHANTIER
    ? `${PHOTOS_MAX_PAR_CHANTIER} photos au plus par chantier.`
    : null;
}

/** Pourquoi ce retour ne peut pas partir avec autant de photos, ou `null`. */
export function refusDesPhotosDuRetour(cochees: number): string | null {
  return cochees > PHOTOS_MAX_PAR_RETOUR ? `${PHOTOS_MAX_PAR_RETOUR} photos au plus par retour.` : null;
}

/**
 * Ce qu'on garde d'une sélection, et pourquoi le reste n'entre pas.
 *
 * La photothèque du téléphone ne connaît aucune de nos bornes : elle rend ce
 * qu'il a coché. On retient les premières, dans l'ordre où il les a choisies,
 * jusqu'à la plus serrée des bornes — celle de la sélection, ou ce qui reste
 * sur le chantier. La phrase nomme la borne atteinte, pour qu'il sache
 * laquelle des deux l'arrête.
 */
export function limiterLaSelection<T>(
  choisies: readonly T[],
  bornes: { parSelection: number; restantesSurLeChantier: number }
): { retenues: T[]; raison: string | null } {
  const place = Math.min(bornes.parSelection, bornes.restantesSurLeChantier);
  if (choisies.length <= place) return { retenues: [...choisies], raison: null };
  const raison =
    bornes.restantesSurLeChantier < bornes.parSelection
      ? bornes.restantesSurLeChantier === 0
        ? refusDuPlafondDuChantier(PHOTOS_MAX_PAR_CHANTIER)!
        : `${bornes.restantesSurLeChantier} photo${bornes.restantesSurLeChantier > 1 ? "s" : ""} de plus au maximum sur ce chantier (${PHOTOS_MAX_PAR_CHANTIER} en tout).`
      : `${bornes.parSelection} photos au plus à la fois.`;
  return { retenues: choisies.slice(0, place), raison };
}
