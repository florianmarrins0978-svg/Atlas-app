/**
 * **Ce qui trahit une phrase recopiée au lieu d'une ligne de devis rédigée.**
 *
 * Sa demande du 20 août 2026 : dicter le chantier dans le devis et que
 * l'intelligence artificielle *« rédige ça sous forme de belles phrases »*,
 * même quand il pense à voix haute (« j'aimerais tailler ma haie, enfin je ne
 * sais plus, je crois que c'est vingt mètres linéaires »).
 *
 * **Pourquoi cette règle vit ici, et pas dans le script qui la joue.** La
 * rédaction dépend d'un modèle de langage : elle ne peut être éprouvée qu'avec
 * une clé, donc sur sa machine ou en ligne, jamais dans l'environnement de
 * développement (`AGENTS.md`). Un contrôle qu'on ne peut pas voir rougir ne
 * prouve rien — celui-ci est donc découpé en deux : la RÈGLE, pure, éprouvée
 * ici contre des libellés volontairement mauvais
 * (`scripts/test-retouches-devis.ts`), et son APPLICATION au modèle réel
 * (`scripts/verifier-dictee-devis.mts`), qui tourne là où il y a une clé.
 *
 * Elle ne juge pas le style : elle attrape les six marques d'une transcription
 * qui n'a pas été retravaillée. Un devis qui porte « j'aimerais tailler ma
 * haie » part chez un client, et se lit comme une note de brouillon.
 */

/** Ce qu'un libellé de devis ne doit jamais porter, avec la raison en clair. */
const MARQUES: readonly { motif: RegExp; defaut: string }[] = [
  {
    motif: /\b(je|j'|mon|ma|mes|moi|nous)\b/i,
    defaut: "parle à la première personne",
  },
  {
    motif: /\b(j'aimerais|je voudrais|il veut|il faudrait|il faut|on doit)\b/i,
    defaut: "garde le verbe de la demande au lieu du nom du travail",
  },
  {
    motif: /\b(euh|enfin|je crois|je ne sais plus|je ne suis plus s[ûu]r|peut-[êe]tre|il me semble|quelque chose comme)\b/i,
    defaut: "garde une hésitation de la dictée",
  },
  { motif: /[.?…]\s*$/, defaut: "se termine par une ponctuation de phrase" },
  { motif: /^[a-zà-ÿ]/, defaut: "ne commence pas par une majuscule" },
];

/** Au-delà, ce n'est plus un libellé mais un morceau de la dictée. */
export const LONGUEUR_MAX_LIBELLE = 70;

/**
 * Tout ce qui cloche dans un libellé — vide si la ligne est présentable.
 *
 * Rend **la liste** et non un booléen : quand le contrôle rougit sur sa
 * machine, la raison doit être lisible sans relancer quoi que ce soit.
 */
export function defautsDeRedaction(libelle: string): string[] {
  const texte = libelle.trim();
  if (!texte) return ["est vide"];

  const defauts = MARQUES.filter(({ motif }) => motif.test(texte)).map(({ defaut }) => defaut);
  if (texte.length > LONGUEUR_MAX_LIBELLE) {
    defauts.push(`fait ${texte.length} caractères — c'est une phrase, pas un libellé`);
  }
  return defauts;
}
