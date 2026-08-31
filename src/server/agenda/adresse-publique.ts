/**
 * L'adresse du site telle que le navigateur de l'artisan la connaît.
 *
 * **Le défaut du 9 août 2026, trouvé pendant qu'il autorisait Atlas chez
 * Google.** Le retour de Google construisait son adresse ainsi :
 *
 *     process.env.NEXTAUTH_URL ?? process.env.ATLAS_URL_PUBLIQUE ?? "http://localhost:3000"
 *
 * Or **aucune de ces deux variables n'est posée sur le banc d'essai**. Le
 * navigateur était donc renvoyé vers `localhost:3000` — c'est-à-dire vers le
 * téléphone lui-même. Le raccordement aboutissait, les jetons étaient
 * enregistrés, et l'artisan tombait sur une page morte : rien ne lui disait que
 * c'était fait.
 *
 * On part de ce que le navigateur a réellement demandé. Derrière le mandataire
 * d'un espace de travail, l'hôte public arrive dans `x-forwarded-host` — et
 * c'est exactement cet hôte que Google vient d'utiliser pour nous joindre,
 * puisque l'adresse de retour lui a été donnée à l'identique. Les variables
 * d'environnement ne servent plus que de secours, pour un déploiement caché
 * derrière un mandataire muet.
 *
 * Vit dans son propre fichier plutôt que dans la route : un fichier de route
 * Next.js ne peut exporter que ses verbes HTTP, et une règle enfouie là n'aurait
 * jamais pu être éprouvée.
 */
export function adressePublique(
  entetes: { get(nom: string): string | null },
  // `process.env` est typé strictement ici : on le prend tel quel plutôt que
  // d'élargir la signature, pour que l'appelant réel n'ait rien à savoir.
  environnement: { NEXTAUTH_URL?: string; ATLAS_URL_PUBLIQUE?: string } = {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    ATLAS_URL_PUBLIQUE: process.env.ATLAS_URL_PUBLIQUE,
  }
): string {
  /**
   * **L'ADRESSE DÉCLARÉE PASSE AVANT L'EN-TÊTE** — audit final, 29 août 2026.
   *
   * Cette fonction et `originePublique` répondent à la même question, et elles
   * y répondaient **dans l'ordre inverse** : celle-ci croyait l'en-tête d'abord,
   * l'autre l'adresse déclarée d'abord. Deux implémentations d'une même règle
   * finissent toujours par diverger (`CLAUDE.md` §3) — celles-ci l'avaient fait.
   *
   * **Ce que l'ancien ordre coûtait.** `x-forwarded-host` est écrit par le
   * client quand le mandataire de tête ne le réécrit pas — le cas par défaut de
   * plusieurs hébergeurs. Or cette adresse compose la **redirection de retour de
   * Google** : une valeur forgée renvoyait le navigateur, au retour d'une
   * autorisation, vers l'hôte de qui l'avait écrite.
   *
   * **Et le banc continue de marcher**, ce qui était toute la raison de l'ordre
   * d'origine : `ATLAS_URL_PUBLIQUE` n'y est pas posée, l'en-tête reprend donc la
   * main, et le défaut du 9 août — le navigateur renvoyé vers `localhost:3000`,
   * c'est-à-dire vers le téléphone lui-même — ne revient pas.
   *
   * `NEXTAUTH_URL` passe en dernier : elle ne gagnait déjà jamais contre un
   * en-tête présent, et ce n'est pas elle qui décrit l'adresse publique.
   */
  const declaree = (environnement.ATLAS_URL_PUBLIQUE ?? "").trim();
  if (declaree) return declaree.replace(/\/+$/, "");

  // `x-forwarded-host` peut porter une liste quand plusieurs mandataires se
  // succèdent : le premier est celui que le navigateur a demandé.
  const hote = entetes.get("x-forwarded-host")?.split(",")[0]?.trim() || entetes.get("host")?.trim();
  if (hote) {
    const protocole = entetes.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    return `${protocole}://${hote}`;
  }
  return environnement.NEXTAUTH_URL ?? "http://localhost:3000";
}
