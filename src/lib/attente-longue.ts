/**
 * Ce que l'écran dit quand l'attente s'éternise.
 *
 * **Le manque que ça comble.** Le 13 août 2026, l'attente de la dictée a cessé
 * d'être muette : les points soufflent et une phrase annonce « Atlas rédige… ».
 * Restait une question, posée au patron et tranchée par lui d'un « oui fait
 * ça » : *une vague qui souffle depuis trente secondes redevient une vague qui
 * ne dit rien.* Un geste sans fin ne renseigne pas plus qu'un geste immobile —
 * il rassure les dix premières secondes, puis il inquiète.
 *
 * **Trois temps, et chacun dit une chose de plus que le précédent :**
 *
 * | | Ce que l'écran dit | Pourquoi ce moment-là |
 * |---|---|---|
 * | 0 s | « Atlas rédige… » | la chaîne prend deux à dix secondes ; il n'y a rien à signaler |
 * | 12 s | « C'est plus long que d'habitude » | au-delà de la bande normale, sans être soupçonneux |
 * | 45 s | l'écran renonce | assez long pour qu'une chaîne lente aboutisse, assez court pour ne pas fixer un écran mort |
 *
 * **Les phrases tiennent sur UNE LIGNE, et c'est une contrainte de place, pas
 * de style.** Elles vivent dans une colonne de 190 px, à côté du titre « Un
 * chantier ». Dès qu'une phrase passe à deux lignes, la colonne prend toute sa
 * largeur et le titre se casse en deux — mesuré sur son écran de 390 px, et
 * visible seulement à la capture. Un écran qui se réorganise pendant qu'on
 * attend inquiète plus qu'il ne rassure.
 *
 * Mesuré dans la vraie page, sur son écran : 31 caractères font 163 px et
 * tiennent sur une ligne ; 33 en font 181 et passent à deux. Le plafond est
 * donc posé à 31 — mais **c'est la largeur qui décide, pas le compte** : le
 * plafond n'est qu'une sentinelle rapide, et la vraie règle est le NOMBRE DE
 * LIGNES DU TITRE, mesuré au navigateur dans chacun des deux états.
 *
 * **Le même défaut existe hors de ce fichier, et il est antérieur :** le
 * message de fin, « 1 information reprise — relisez avant de créer. », fait
 * 47 caractères et casse le titre à chaque dictée réussie. Non touché — c'est
 * une phrase que le patron voit depuis des jours sans s'en plaindre, et la
 * réécrire est son choix, pas le nôtre (`TODO.md`).
 *
 * **Ce qui a été écrit puis retiré, pour mémoire :** « vous pouvez déjà saisir,
 * rien de ce que vous écrivez ne sera écrasé », puis « saisissez à la main ».
 * C'est vrai — la dictée ne remplit que les champs restés vides — mais ça ne
 * valait pas de faire bouger l'écran : les champs sont déjà sous ses doigts, et
 * personne n'a besoin qu'on lui dise qu'un champ vide se remplit. La garantie,
 * elle, reste éprouvée dans `scripts/test-attente-longue.ts` : elle porte le
 * comportement, pas la phrase.
 *
 * **Renoncer n'annule rien.** L'appel n'est pas interrompu : s'il finit par
 * répondre, les champs se remplissent et l'écran le dit. On rend la main, on ne
 * ferme pas la porte — abandonner pour de bon obligerait à tout redicter alors
 * que la réponse était peut-être à une seconde.
 */
export type EtapeAttente = "normale" | "longue" | "abandonnee";

/** Au-delà de la bande normale de la chaîne (deux à dix secondes). */
export const SEUIL_LONGUE_MS = 12_000;

/** Assez long pour qu'une chaîne lente aboutisse, assez court pour ne pas fixer un écran mort. */
export const SEUIL_ABANDON_MS = 45_000;

export function etapeAttente(ecouleMs: number): EtapeAttente {
  // Une durée négative n'existe pas, mais une horloge qui recule, si : deux
  // relevés pris de part et d'autre d'un changement d'heure suffisent. La
  // traiter comme « on vient de commencer » vaut mieux que d'annoncer un
  // abandon à la première milliseconde.
  if (!Number.isFinite(ecouleMs) || ecouleMs < 0) return "normale";
  if (ecouleMs >= SEUIL_ABANDON_MS) return "abandonnee";
  if (ecouleMs >= SEUIL_LONGUE_MS) return "longue";
  return "normale";
}

/**
 * La phrase qui va avec l'étape.
 *
 * Elles vivent ici, et non dans l'écran, pour la même raison que les règles
 * métier : ce qui décide se lit et s'éprouve sans navigateur. L'écran affiche,
 * il ne choisit pas.
 */
export function phraseAttente(etape: EtapeAttente): string {
  switch (etape) {
    case "normale":
      return "Atlas rédige…";
    case "longue":
      // **Courte, et c'est une contrainte de PLACE, pas de style.** Mesurée sur
      // son écran de 390 px, la première version — qui ajoutait « vous pouvez
      // déjà saisir, rien ne sera écrasé » — occupait 184 px et cassait « Un
      // chantier » en deux lignes, en plein milieu de l'attente. Un titre qui
      // se réorganise sous les yeux pendant qu'on patiente inquiète plus qu'il
      // ne rassure ; c'est la famille de défaut que seule une capture voit.
      //
      // Ce qui a été sacrifié, et pourquoi ça ne manque pas : les champs sont
      // là, sous ses doigts, et rien n'empêche de les remplir. La seule chose
      // qu'il ne peut pas deviner, c'est que ce délai n'est pas normal.
      return "C'est plus long que d'habitude.";
    case "abandonnee":
      // On ne dit pas « la dictée a échoué » : on n'en sait rien, et l'appel
      // court peut-être encore. On dit ce qui est constatable — elle n'a pas
      // répondu — et on rend le geste.
      return "Pas de réponse. Réessayez.";
  }
}
