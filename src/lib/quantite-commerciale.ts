// **Deux quantités, et il ne faut jamais les confondre.**
//
// | | Où elle vit | Ce qu'elle dit |
// |---|---|---|
// | **physique** | `prestations.quantite` | ce qu'il y a à faire : 800 mètres de haie |
// | **commerciale** | `lignes_prix.quantite` | ce qui est vendu sur cette ligne : 800 ml, ou 1 forfait |
//
// ─── Pourquoi elles ne se synchronisent PAS ─────────────────────────────────
//
// Une ligne de devis peut réunir plusieurs prestations — c'est sa règle du
// 7 août : *« l'abattage, le broyage et l'évacuation, c'est sur une ligne. »*
// Cette ligne-là se vend **au forfait** : elle n'a pas de quantité propre, et
// lui en fabriquer une (la somme ? celle du premier membre ?) donnerait un
// « 800 × 750 € » que personne n'a décidé.
//
// Mais les prestations qu'elle réunit, elles, gardent leurs mesures : le chêne
// fait toujours 70 cm et la haie toujours 800 mètres. Écraser la quantité
// physique pour qu'elle « colle » à la ligne effacerait la donnée du chantier
// pour arranger le document.
//
// ─── Ce qui a coûté cette règle ─────────────────────────────────────────────
//
// Le devis du 26 août 2026 : « Haie (tout genre) (800 ml) — Qté 1 — 14 000 € ».
// Le total était juste ; sa décomposition mentait. Le « 1 » n'était pas un
// forfait décidé, c'était une colonne que ce chemin n'a jamais renseignée
// (`ajouterLignePrix` écrivait `quantite: "1"` en dur). Le client lisait
// « 1 × 14 000 € » là où l'artisan avait dit « 800 mètres à 17,50 ».


/** Ce qu'une ligne de devis vend, et comment son montant se décompose. */
export type QuantiteCommerciale = {
  quantite: string;
  /** `null` sur un forfait : il ne se compte pas en unités. */
  unite: string | null;
  /**
   * D'où vient cette décomposition.
   *
   * `"prestation"` : la ligne vend UNE prestation mesurée, sa quantité est la
   * sienne. `"forfait"` : la ligne en réunit plusieurs, ou la seule n'a pas de
   * mesure — elle se vend en bloc, et c'est une décision, pas un défaut.
   */
  origine: "prestation" | "forfait";
};

export type PrestationVendue = {
  quantite?: string | null;
  unite?: string | null;
};

/**
 * La quantité commerciale d'une ligne, d'après les prestations qu'elle vend.
 *
 * **Une seule règle, et elle est volontairement stricte :** la quantité se
 * dérive quand la ligne vend **exactement une** prestation qui porte une mesure
 * complète. Tout le reste est un forfait.
 *
 * Additionner les quantités de plusieurs prestations serait le pire des cas :
 * 800 ml de haie plus 2 souches ne font pas 802 de quoi que ce soit.
 */
export function quantiteCommerciale(
  prestations: readonly PrestationVendue[]
): QuantiteCommerciale {
  const forfait: QuantiteCommerciale = { quantite: "1", unite: null, origine: "forfait" };
  if (prestations.length !== 1) return forfait;

  const seule = prestations[0];
  const unite = seule.unite?.trim();
  if (!seule.quantite || !unite) return forfait;

  const valeur = Number(String(seule.quantite).replace(",", "."));
  if (!Number.isFinite(valeur) || valeur <= 0) return forfait;

  return { quantite: String(valeur), unite, origine: "prestation" };
}

/**
 * Faut-il prévenir que le prix de grille ne couvre peut-être qu'un exemplaire ?
 *
 * **Un cas réel, et une décision qu'on ne prend pas à sa place.** « Dessouchage
 * de deux souches de 60 cm » : sa grille donne un prix pour une souche de 60 cm,
 * et rien ne dit si le devis doit le multiplier par deux ou si le déplacement
 * est déjà compris. Multiplier serait inventer un prix ; ignorer serait facturer
 * une souche pour deux.
 *
 * On ne tranche donc pas : la ligne garde le prix de la grille — c'est le
 * comportement d'aujourd'hui, celui qu'il connaît — et **l'écran le lui dit**.
 */
export function prevenirQuantiteNonMultipliee(
  prestations: readonly (PrestationVendue & { libelle?: string })[]
): string | null {
  if (prestations.length !== 1) return null;
  const seule = prestations[0];
  const unite = seule.unite?.trim();
  if (!seule.quantite || !unite) return null;
  const valeur = Number(String(seule.quantite).replace(",", "."));
  if (!Number.isFinite(valeur) || valeur <= 1) return null;
  // Seules les unités de COMPTAGE posent la question : une longueur ou un
  // tonnage se multiplient déjà par leur prix unitaire.
  if (["ml", "m²", "m³", "tonne", "stère", "heure", "jour"].includes(unite.toLowerCase())) return null;
  return (
    `« ${seule.libelle ?? "cette ligne"} » porte ${valeur} ${unite}${valeur > 1 ? "s" : ""} : ` +
    "le prix de votre grille est celui d'un seul. Vérifiez s'il doit être multiplié."
  );
}
