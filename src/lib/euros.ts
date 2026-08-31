// Un montant s'écrit partout de la même façon : « 1 674,00 € ».
//
// Deux écrans en portaient déjà chacun leur copie, et le troisième — le rapport
// « Devis préparé » — a commencé par afficher « 1674,00 € », sans l'espace des
// milliers. Un montant qui ne se lit pas comme les autres se relit deux fois.
const FORMAT_EUROS = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** Formate un montant décimal (chaîne « 1674.00 » ou nombre) en euros français. */
export function enEuros(montant: string | number): string {
  const valeur = typeof montant === "number" ? montant : Number(montant);
  const formate = FORMAT_EUROS.format(Number.isFinite(valeur) ? valeur : 0);
  // **`Intl` sépare les milliers par une espace fine insécable (U+202F)** —
  // illisible à l'écran, mais qui fait planter un PDF : l'encodage WinAnsi des
  // polices standard de `pdf-lib` ne la connaît pas (`document-commun.ts`,
  // `formatMontant`, avait déjà buté dessus pour les totaux). Trouvé le
  // 30 août 2026 en imprimant un capital social pour la première fois — le
  // premier montant à trois chiffres d'euros que ce formateur ait servi à un
  // PDF. La remplacer par l'espace insécable ORDINAIRE (U+00A0), que WinAnsi
  // connaît, rend ce formateur sûr partout, écran comme document.
  return formate.replace(/\u202f/g, "\u00a0");
}
