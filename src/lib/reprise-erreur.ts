// Ce qu'il reste à faire quand un écran est tombé — et surtout : **quand
// « Réessayer » ne peut pas marcher**.
//
// ─────────────────────────────────────────────────────────────────────────────
// **Le 11 août 2026, au soir, le patron envoie deux captures de son téléphone.**
//
//     Runtime ChunkLoadError
//     Failed to load chunk /_next/static/chunks/src_06hhplf._.js from module
//     […]/react-server-dom-turbopack-client.browser.development.js
//
// Puis, dessous, l'écran d'Atlas : « Une erreur — Cette page n'a pas pu
// s'afficher », et un seul bouton, « Réessayer ». L'indicateur de Next.js porte
// la mention **(stale)** : la page ouverte dans son onglet ne correspond plus au
// serveur qui la sert.
//
// **Ce bouton ne pouvait pas le sauver.** `reset()` refait le rendu du même
// arbre React, avec les mêmes adresses de morceaux gravées dans le code déjà
// chargé — celles d'une version que le serveur ne sert plus. Il échoue à
// l'identique, autant de fois qu'on appuie. Le patron avait donc un écran
// d'erreur poli, un bouton, et aucune issue.
//
// **Pourquoi cela lui arrive, à lui, et pas ici.** Son espace redémarre son
// serveur plusieurs fois par soirée : mise à jour du code, bascule du mode
// développement vers la version bâtie (`scripts/banc.mjs`), veilleur qui relève
// un serveur tombé. À chaque fois, les morceaux changent de nom. Son onglet,
// lui, reste ouvert des heures sur son téléphone — dix onglets sur la capture.
// Le premier lien qu'il touche ensuite demande un fichier qui n'existe plus.
//
// **Le seul remède est un rechargement complet de la page**, qui va rechercher
// la page d'accueil et ses morceaux auprès du serveur d'aujourd'hui. On le fait
// donc tout seul, sans rien lui demander.
//
// ─────────────────────────────────────────────────────────────────────────────
// **Une garde, et elle n'est pas facultative.** Recharger sur une erreur qui
// revient donnerait une page qui tourne en rond pour toujours — la pire des
// pannes sur un téléphone, parce qu'elle n'affiche jamais rien à lire. On ne
// recharge donc **qu'une fois par fenêtre** (voir `peutRechargerSeul`) ; passé
// cela, on rend la main au patron avec une phrase qui dit ce qu'on sait.

/** Ce qu'on affiche, et ce que fait le bouton. */
export type Reprise = {
  /** Le seul remède est de recharger la page entière ; `reset()` ne suffit pas. */
  rechargement: boolean;
  /** On recharge tout seul, sans attendre un geste. */
  automatique: boolean;
  /** La phrase de la carte. */
  phrase: string;
  /** Le libellé du bouton. */
  bouton: string;
};

/**
 * **Les formulations changent d'un navigateur à l'autre, et le patron est sur
 * Safari.** Chacune de ces lignes vient d'un message réel, pas d'une supposition :
 *
 * - `Failed to load chunk …` — Turbopack, celui de sa capture ;
 * - `Loading chunk 42 failed` / `Loading CSS chunk` — webpack, la version bâtie ;
 * - `Failed to fetch dynamically imported module` — Chrome, Edge ;
 * - `error loading dynamically imported module` — Firefox ;
 * - `Importing a module script failed` — **Safari**, donc son téléphone.
 *
 * Ajouter un motif ici est sans danger ; en retirer un rend une famille de
 * navigateurs au dénouement sans issue décrit en tête de fichier.
 */
const MOTIFS = [
  /failed to load chunk/i,
  /loading chunk \S+ failed/i,
  /loading css chunk/i,
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
];

/**
 * Cette erreur vient-elle d'un morceau de code que le serveur ne sert plus ?
 *
 * La cause est suivie sur quelques niveaux : React et Next.js enveloppent
 * volontiers l'erreur d'origine, et c'est elle seule qui porte le message.
 * La profondeur est bornée — une chaîne de causes peut boucler sur elle-même.
 */
export function estMorceauIntrouvable(erreur: unknown, profondeur = 0): boolean {
  if (profondeur > 4 || erreur === null || typeof erreur !== "object") return false;
  const e = erreur as { name?: unknown; message?: unknown; cause?: unknown };

  // Le nom que webpack et Turbopack donnent tous deux à cette panne.
  if (e.name === "ChunkLoadError") return true;

  if (typeof e.message === "string" && MOTIFS.some((m) => m.test(e.message as string))) return true;

  return estMorceauIntrouvable(e.cause, profondeur + 1);
}

/**
 * A-t-on le droit de recharger tout seul ?
 *
 * **Une fois par fenêtre, et pas davantage.** Cinq minutes séparent une panne
 * réparée par un rechargement (elle ne revient pas) d'une page qui tourne en
 * rond (elle revient dans la seconde). Sans cette borne, le remède deviendrait
 * la panne : un téléphone qui recharge sans fin n'affiche jamais rien à lire, et
 * le patron n'aurait même plus le message qui lui dirait quoi faire.
 *
 * @param dernier Horodatage du dernier rechargement automatique, ou `null`.
 */
export const FENETRE_RECHARGEMENT_MS = 5 * 60_000;

export function peutRechargerSeul(dernier: number | null, maintenant: number): boolean {
  if (dernier === null) return true;
  return maintenant - dernier > FENETRE_RECHARGEMENT_MS;
}

/**
 * Décide quoi montrer et quoi faire — sans toucher au navigateur, donc
 * éprouvable sans lui.
 *
 * @param phraseDeLEcran Ce que l'écran dit de sa propre panne (« Impossible de
 *   charger le planning… »). Elle ne sert **que** si la cause n'est pas un
 *   morceau manquant : l'annoncer alors désignerait le mauvais coupable — le
 *   planning n'y est pour rien, c'est la page entière qui a vieilli.
 */
export function repriseApresErreur(
  erreur: unknown,
  { phraseDeLEcran, rechargementPossible }: { phraseDeLEcran: string; rechargementPossible: boolean }
): Reprise {
  if (!estMorceauIntrouvable(erreur)) {
    return {
      rechargement: false,
      automatique: false,
      phrase: phraseDeLEcran,
      bouton: "Réessayer",
    };
  }

  if (rechargementPossible) {
    return {
      rechargement: true,
      automatique: true,
      phrase: "Atlas n'a pas retrouvé une partie de son code : la page se recharge.",
      bouton: "Recharger",
    };
  }

  // **Ne pas désigner un seul coupable ici.** Après un rechargement resté sans
  // effet, deux causes tiennent encore : une mise à jour en cours côté serveur,
  // ou une connexion coupée. Trancher au hasard enverrait chercher au mauvais
  // endroit — ce que ce dépôt paie cher à chaque fois.
  return {
    rechargement: true,
    automatique: false,
    phrase:
      "Atlas n'a pas retrouvé une partie de son code, même après un rechargement. " +
      "Une mise à jour est peut-être en cours, ou la connexion a coupé : réessayez dans une minute.",
    bouton: "Recharger",
  };
}
