// Un achat, sa TVA, et ce qu'il reste à payer.
//
// **Sa demande du 12 août 2026 :** *« je veux également qu'on puisse intégrer
// la TVA due, donc les essences, les tronçonneuses »*. Jusque-là l'application
// ne connaissait que la TVA collectée — ce que ses clients lui versent — et
// l'écran ne pouvait donc pas répondre à la seule question qui l'intéresse :
// combien reste-t-il à payer.
//
// Retenu sur maquette (`docs/maquettes/37`), après quatre corrections de sa
// main.
//
// **Ce que ce fichier NE fait pas, et ne fera pas :** décider si une TVA est
// déductible. Les règles diffèrent selon la dépense et selon le véhicule, et
// Atlas n'a aucune source pour en juger. Il additionne ce que le patron
// confirme ; son comptable fait le tri (`CLAUDE.md` §4).

/** Deux façons pour un achat d'entrer : l'objectif, ou le clavier. */
export type SaisieAchat = "scan" | "main";

/**
 * La TVA contenue dans un total qui la comprend déjà.
 *
 * **Le piège, et il coûte cher :** la TVA d'un ticket de 120 € à 20 % n'est pas
 * 120 × 0,20 = 24 €, mais 20 €. Le total est TTC : la taxe est dedans, pas
 * dessus. Se tromper d'un cinquième sur chaque ticket fausse le relevé d'un
 * bout à l'autre de l'année, et rien à l'écran ne le dirait.
 *
 * Rend `null` sur tout ce qui n'est pas calculable — un total absent, un taux
 * nul ou négatif. On n'invente pas un montant à partir de rien.
 */
export function tvaDepuisTtc(totalTtc: number | null, tauxPourCent: number | null): number | null {
  if (totalTtc === null || tauxPourCent === null) return null;
  if (!Number.isFinite(totalTtc) || !Number.isFinite(tauxPourCent)) return null;
  if (tauxPourCent <= 0 || totalTtc < 0) return null;
  const tva = totalTtc - totalTtc / (1 + tauxPourCent / 100);
  // Deux décimales : c'est la monnaie, et une TVA à quatorze chiffres après la
  // virgule ne se recopie pas sur une déclaration.
  return Math.round(tva * 100) / 100;
}

/**
 * Ce qu'il reste à payer : collectée moins déductible.
 *
 * **Peut être négatif, et c'est un état normal** — un mois où l'on achète une
 * machine sans facturer grand-chose donne un crédit de TVA. L'écran doit
 * pouvoir l'écrire ; le borner à zéro cacherait précisément le mois où le
 * patron a le plus besoin de savoir.
 */
export function tvaDue(collectee: number, deductible: number): number {
  return Math.round((collectee - deductible) * 100) / 100;
}

/**
 * Un montant écrit à la main, tel qu'il arrive du clavier.
 *
 * Accepte la virgule autant que le point, l'euro collé au chiffre, et les
 * espaces des milliers : le patron tape « 1 234,50 € » sans y penser, et un
 * champ qui refuse sa façon d'écrire est un champ qu'il abandonne.
 *
 * Rend `null` sur ce qui n'est pas un nombre — jamais zéro, qui serait un
 * montant, donc un mensonge.
 */
export function montantSaisi(texte: string | null | undefined): number | null {
  if (texte === null || texte === undefined) return null;
  const propre = texte
    .replace(/ /g, " ")
    .replace(/[^\d,.\-]/g, "")
    .replace(/\s/g, "")
    .replace(",", ".");
  if (propre === "" || propre === "-" || propre === ".") return null;
  const n = Number(propre);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

/**
 * Ce qu'il faut au minimum pour enregistrer un achat.
 *
 * **Le fournisseur et la TVA, rien d'autre.** Le total et le taux sont utiles
 * mais pas indispensables : un ticket qui n'affiche que « TVA 3,20 € » se
 * saisit tel quel. Exiger davantage reviendrait à refuser l'achat plutôt qu'à
 * l'enregistrer incomplet — et un achat refusé est un achat perdu.
 */
export function achatComplet(fournisseur: string, tvaDeductible: number | null): boolean {
  return fournisseur.trim() !== "" && tvaDeductible !== null && tvaDeductible >= 0;
}
