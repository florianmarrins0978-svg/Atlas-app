/**
 * Combien de temps garde-t-on la photo d'un diagnostic ?
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sa consigne du 20 août 2026, mot pour mot :** *« Prévois une conservation
 * temporaire configurable. Un diagnostic pourra ensuite être rattaché à un
 * chantier. Les règles de conservation devront pouvoir différer lorsqu'une
 * photo fait partie du dossier chantier. Ne grave pas une durée arbitraire dans
 * le code : rends la politique configurable. »*
 *
 * **Ce fichier est donc une RÈGLE, pas une durée.** Les nombres arrivent de la
 * configuration ; ce qui est écrit ici, c'est ce qu'on en fait — et
 * singulièrement les deux cas où l'on ne purge pas.
 *
 * **Pourquoi deux durées et non une.** Une photo prise en visite, sans client
 * ni chantier, n'a plus d'utilité une fois le résultat rendu : le diagnostic
 * survit à sa photo, il garde son nom de problème, sa date et sa fiche — c'est
 *-à-dire tout ce qui sert. Une photo versée au dossier d'un chantier, elle, est
 * une pièce du dossier : la purger au bout de trois mois viderait le dossier
 * d'un client toujours en cours. Les deux durées se règlent donc séparément.
 *
 * **Zéro signifie « on ne purge pas automatiquement »**, et c'est la valeur par
 * défaut du versant chantier. C'est délibéré : une purge par défaut effacerait
 * des pièces d'un dossier sans que personne l'ait demandé. Le versant libre, à
 * l'inverse, a une durée par défaut — ne rien purger du tout serait l'inverse
 * du principe (`docs/RGPD.md` §4 : ce qui n'est pas conservé ne peut pas fuir).
 *
 * Éprouvé sans base ni réseau (`scripts/test-retention-diagnostic.ts`).
 */

export type PolitiqueRetentionPhotos = {
  /** Jours de conservation d'une photo NON rattachée à un chantier. 0 = jamais purger. */
  libreJours: number;
  /** Jours de conservation d'une photo rattachée à un chantier. 0 = jamais purger. */
  chantierJours: number;
};

/**
 * Les valeurs de départ, et elles sont **discutables — c'est pour cela qu'elles
 * sont configurables**.
 *
 * 90 jours pour une photo libre : assez pour qu'il puisse rouvrir un diagnostic
 * d'il y a deux mois en revenant sur le même jardin, trop court pour constituer
 * un fonds d'images de domiciles privés.
 *
 * 0 pour une photo de chantier : elle suit le dossier, et c'est la suppression
 * du chantier qui l'emporte (`ON DELETE CASCADE`), pas une échéance.
 */
export const POLITIQUE_PAR_DEFAUT: PolitiqueRetentionPhotos = {
  libreJours: 90,
  chantierJours: 0,
};

const JOUR_MS = 24 * 60 * 60 * 1000;

/**
 * L'échéance de purge d'une photo — ou `null` quand il n'y en a pas.
 *
 * `null` n'est pas un oubli : c'est le cas « on garde », et il doit se lire
 * comme tel. Le chemin d'écriture n'inscrit alors rien dans la file de purge,
 * plutôt que d'y ranger une échéance lointaine qu'il faudrait ensuite se
 * rappeler d'ignorer.
 */
export function echeanceDePurge(
  creeLe: Date,
  rattacheeAUnChantier: boolean,
  politique: PolitiqueRetentionPhotos = POLITIQUE_PAR_DEFAUT
): Date | null {
  const jours = rattacheeAUnChantier ? politique.chantierJours : politique.libreJours;
  if (jours <= 0) return null;
  return new Date(creeLe.getTime() + jours * JOUR_MS);
}

/**
 * Lire la politique depuis la configuration, sans jamais laisser passer une
 * valeur qui n'a pas de sens.
 *
 * **Une valeur illisible retombe sur la valeur par défaut plutôt que sur zéro.**
 * `PHOTOS_DIAGNOSTIC_RETENTION_JOURS=trois` donnerait sinon « on ne purge
 * jamais » — soit exactement le contraire de ce que quelqu'un qui règle cette
 * variable cherche à obtenir. Un réglage mal écrit ne doit pas relâcher une
 * protection en silence.
 */
export function lirePolitique(
  brut: { libre?: string | null; chantier?: string | null },
  defaut: PolitiqueRetentionPhotos = POLITIQUE_PAR_DEFAUT
): PolitiqueRetentionPhotos {
  return {
    libreJours: lireJours(brut.libre, defaut.libreJours),
    chantierJours: lireJours(brut.chantier, defaut.chantierJours),
  };
}

function lireJours(valeur: string | null | undefined, defaut: number): number {
  if (valeur === undefined || valeur === null) return defaut;
  const propre = valeur.trim();
  if (propre === "") return defaut;
  const n = Number(propre);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return defaut;
  return n;
}
