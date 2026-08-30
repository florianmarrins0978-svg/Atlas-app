// **Préchauffer ou bâtir : sur une petite machine, il faut choisir.**
//
// ─────────────────────────────────────────────────────────────────────────────
// **Sa plainte du 29 août 2026 :** *« l'appli est en mode lent, les fichiers
// n'arrivent pas à charger, elle bug souvent »*. Sa capture montrait le bandeau
// « Version rapide en construction — 2 écrans sur 32 déjà prêts », et sa fiche
// disait « construction en cours » — jamais « échouée ». Depuis des jours.
//
// **Ce n'était pas une lenteur, c'était un blocage.** Quatre pistes ont été
// mesurées avant celle-ci, et les quatre sont fausses — elles sont écrites ici
// pour que personne ne les repaie :
//
//   | Ce qui a été essayé sur `next build`   | Pic mémoire |
//   |----------------------------------------|-------------|
//   | tel quel (3 workers)                   | 2 452 Mo    |
//   | `experimental.cpus: 1`                 | 2 471 Mo    |
//   | sans typecheck ni source maps          | 2 734 Mo    |
//   | `NODE_OPTIONS=--max-old-space-size`    | 2 500 Mo    |
//
// Aucun réglage ne fait maigrir cette construction, et le dernier dit pourquoi :
// **ce projet bâtit avec Turbopack, écrit en Rust.** Sa mémoire est allouée
// hors du tas de V8, où aucune option de Node n'a de prise. Chercher de ce
// côté-là est perdu d'avance.
//
// ─────────────────────────────────────────────────────────────────────────────
// **La vraie cause, mesurée sur le serveur de développement :**
//
//   | Serveur de développement        | total   | dont `next-server` |
//   |---------------------------------|---------|--------------------|
//   | avant préchauffage              |   658 Mo|   504 Mo           |
//   | après les 32 écrans préchauffés | 1 545 Mo| 1 391 Mo           |
//
// **Le préchauffage coûte 887 Mo**, et il les garde : un écran compilé en mode
// développement reste en mémoire dans le serveur. Sur l'espace du patron —
// 8,3 Go dont 5,5 déjà pris, soit **2 900 Mo disponibles** — le compte est sans
// appel :
//
//   2 900 − 887 (préchauffage) = 2 013 Mo pour une construction qui en veut 2 500.
//
// Il manque 500 Mo. Le noyau tue la construction, le veilleur en relance une,
// et le banc reste lent **pour toujours** — c'est exactement la boucle qu'il
// vivait. Sans le préchauffage, la construction dispose de 2 900 Mo pour 2 500 :
// elle passe.
//
// ─────────────────────────────────────────────────────────────────────────────
// **L'arbitrage, et il n'est pas symétrique.**
//
// Le préchauffage existe pour une bonne raison — le 504 du 9 août 2026 : en
// mode développement, un écran neuf se compile à l'ouverture, et le mandataire
// de GitHub abandonne avant. Le sacrifier coûte donc quelques écrans lents.
//
// Mais le comparer honnêtement :
//
//   | | Ce qu'on paie | Pendant |
//   |---|---|---|
//   | **avec** préchauffage | la construction ne finit JAMAIS | toujours |
//   | **sans** préchauffage | des écrans neufs lents | le temps d'une construction |
//
// Le second se termine ; le premier, non. On préfère une gêne qui s'arrête à
// une gêne définitive.
//
// **Et l'on ne retire rien aux machines qui ont la place.** La décision se
// prend sur la mémoire réellement disponible, pas sur une supposition : un
// espace confortable préchauffe comme avant.

/** Pic mesuré de `next build` sur ce projet, en mégaoctets (29 août 2026). */
export const CONSTRUCTION_MO = 2500;

/** Ce que le préchauffage des 32 écrans ajoute au serveur, en mégaoctets. */
export const PRECHAUFFAGE_MO = 887;

/**
 * Marge de sécurité.
 *
 * Ni décorative ni ronde par hasard : les deux chiffres ci-dessus sont des
 * pics observés sur UNE machine, et une construction qui dépasse de dix
 * mégaoctets se fait tuer aussi sûrement qu'une qui dépasse de cinq cents.
 * Se tromper ici coûte le banc entier ; se tromper dans l'autre sens coûte
 * quelques écrans lents.
 */
export const MARGE_MO = 200;

/** Au-dessous de ce seuil, préchauffer condamne la construction. */
export const SEUIL_MO = CONSTRUCTION_MO + PRECHAUFFAGE_MO + MARGE_MO;

/**
 * Peut-on préchauffer sans empêcher la construction d'aboutir ?
 *
 * @param {number | null | undefined} disponibleMo Mémoire allouable, en Mo —
 *   `MemAvailable` du noyau, jamais `MemFree` : le second ignore le cache
 *   récupérable et refuserait de préchauffer sur des machines qui le peuvent.
 * @returns {{ possible: boolean, motif: string | null }} `motif` est écrit pour
 *   être lu par le patron, jamais par nous : il dit ce qui va se passer et
 *   quand cela s'arrête.
 */
export function peutPrechauffer(disponibleMo) {
  // **Une mesure impossible n'est pas un feu vert.** Sans chiffre, on ne sait
  // pas si la machine tient — et le défaut qu'on répare ici est précisément
  // celui d'un banc qui ne bâtit jamais. On préchauffe quand même : refuser
  // sur une machine confortable ramènerait le 504 du 9 août sans raison, et
  // c'est le cas le plus fréquent. Mais on le DIT, pour qu'un banc bloqué ne
  // reste pas inexpliqué.
  if (typeof disponibleMo !== "number" || !Number.isFinite(disponibleMo) || disponibleMo <= 0) {
    return {
      possible: true,
      motif: "mémoire disponible inconnue : préchauffage lancé sans garantie pour la construction",
    };
  }

  if (disponibleMo < SEUIL_MO) {
    return {
      possible: false,
      motif:
        `Mémoire trop juste (${Math.round(disponibleMo)} Mo libres, il en faudrait ${SEUIL_MO}) : ` +
        "les écrans ne sont pas préchauffés, sans quoi la version rapide ne pourrait jamais " +
        "se construire. Les premiers écrans seront lents à ouvrir — le temps de la construction, " +
        "pas au-delà.",
    };
  }

  return { possible: true, motif: null };
}

/**
 * La mémoire allouable de cette machine, en mégaoctets.
 *
 * **`MemAvailable` de `/proc/meminfo`, et pas `os.freemem()`.** Le second rend
 * `MemFree`, qui ne compte pas le cache que le noyau rendra sans broncher : sur
 * l'espace du patron il vaut 143 Mo quand 2 900 sont réellement allouables.
 * S'en servir refuserait de préchauffer sur toutes les machines, y compris
 * celles qui n'ont aucun problème.
 *
 * @param {(chemin: string, encodage: string) => string} lire Injecté pour que
 *   la lecture s'éprouve sans dépendre du `/proc` de la machine qui joue le
 *   contrôle — un `/proc/meminfo` ne se fabrique pas.
 * @returns {number | null} `null` quand le chiffre est introuvable : on ne
 *   devine pas une mémoire, on dit qu'on ne sait pas.
 */
export function memoireDisponibleMo(lire) {
  try {
    const ligne = lire("/proc/meminfo", "utf8")
      .split("\n")
      .find((l) => l.startsWith("MemAvailable:"));
    if (!ligne) return null;
    const ko = Number(ligne.replace(/[^0-9]/g, ""));
    return Number.isFinite(ko) && ko > 0 ? Math.round(ko / 1024) : null;
  } catch {
    // Un système sans `/proc` (macOS) n'est pas une anomalie : on ne sait pas,
    // et `peutPrechauffer` sait quoi faire d'un `null`.
    return null;
  }
}
