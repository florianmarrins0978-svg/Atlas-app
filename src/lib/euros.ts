// Un montant s'écrit partout de la même façon : « 1 674,00 € ».
//
// Deux écrans en portaient déjà chacun leur copie, et le troisième — le rapport
// « Devis préparé » — a commencé par afficher « 1674,00 € », sans l'espace des
// milliers. Un montant qui ne se lit pas comme les autres se relit deux fois.
const FORMAT_EUROS = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** Formate un montant décimal (chaîne « 1674.00 » ou nombre) en euros français. */
export function enEuros(montant: string | number): string {
  const valeur = typeof montant === "number" ? montant : Number(montant);
  return FORMAT_EUROS.format(Number.isFinite(valeur) ? valeur : 0);
}
