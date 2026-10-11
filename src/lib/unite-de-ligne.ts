/**
 * L'UNITÉ D'UNE LIGNE QUAND ON N'A RIEN TOUCHÉ : « u ».
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Sa demande du 15 septembre 2026 :** *« ce qui serait bien c'est que l'u
 * soit mise sur le devis ou facture par défaut : si on ne touche à rien, elle
 * se pose, on la voit. Tout à l'heure j'ai voulu valider et j'avais pas mis u,
 * sauf que je le voyais en gris clair, je pensais qu'il était posé par
 * défaut. »*
 *
 * Le champ montrait « u » en texte d'attente — gris clair —, ce qui se lit
 * comme une valeur posée, et le papier sortait sans unité. Une pièce se compte
 * en « u » ; c'est le cas de presque toutes ses lignes, et c'est ce que le
 * papier doit dire quand il n'a rien précisé.
 *
 * **Une seule règle, pour l'écran ET le papier.** La base garde `NULL` quand
 * il n'a rien tapé — rien n'y est inventé —, et c'est ICI, à la lecture, que
 * `NULL` veut dire « u ». L'écrire aussi à l'insertion serait une seconde
 * règle : le jour où l'une change, un devis et sa facture ne diraient plus la
 * même chose.
 */
export const UNITE_PAR_DEFAUT = "u";

export function uniteDeLaLigne(unite: string | null | undefined): string {
  const propre = (unite ?? "").trim();
  return propre === "" ? UNITE_PAR_DEFAUT : propre;
}

/**
 * LES SEULES UNITÉS QU'UNE LIGNE PEUT PORTER — sa règle du 29 septembre 2026.
 *
 * *« Dans l'unité, il ne peut pas y avoir la mention arbre. Il doit y avoir que
 * les mentions qui sont déjà préenregistrées. Quand je parle d'un arbre, d'un
 * arbuste ou d'une plante, c'est la mention U qui doit apparaître. »*
 *
 * La dictée garde le mot prononcé (« trois arbres » : unité « arbre »), et
 * c'est juste pour la prestation, qui s'en sert à comparer les prix. Sur le
 * papier, non : une ligne de devis ou de facture ne porte que la rangée.
 */
export const UNITES_USUELLES = ["u", "ml", "m²", "m³", "kg", "h", "forfait"] as const;

/** Ce qu'on dit ou tape, ramené à la rangée. */
const FORMES_DITES: readonly { dit: RegExp; valeur: (typeof UNITES_USUELLES)[number] }[] = [
  { dit: /^(u|unit(e|é)s?)$/, valeur: "u" },
  { dit: /^(ml|m(e|è)tres?\s*lin(e|é)aires?|m\s*lin(e|é)aires?)$/, valeur: "ml" },
  { dit: /^(m2|m²|m(e|è)tres?\s*carr(e|é)s?)$/, valeur: "m²" },
  { dit: /^(m3|m³|m(e|è)tres?\s*cubes?)$/, valeur: "m³" },
  { dit: /^(kg|kilos?|kilogrammes?)$/, valeur: "kg" },
  { dit: /^(h|heures?)$/, valeur: "h" },
  { dit: /^(forfaits?|au\s*forfait)$/, valeur: "forfait" },
];

/**
 * L'unité qu'une ligne ENREGISTRE : une valeur de la rangée, ou `null`.
 *
 * `null` se lit « u » (`uniteDeLaLigne`) : un mot hors de la rangée, « arbre »,
 * « souche », « plante », ne s'invente pas en base, et c'est la règle déjà
 * posée pour une case laissée vide qui le fait imprimer « u ».
 */
export function uniteAdmise(brut: string | null | undefined): string | null {
  const dit = (brut ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  if (dit === "") return null;
  return FORMES_DITES.find((f) => f.dit.test(dit))?.valeur ?? null;
}
