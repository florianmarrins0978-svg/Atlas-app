import { formeADuCapital } from "./formes-juridiques";
import { sirenDepuisSiret } from "./siren";
import { enEuros } from "./euros";

/**
 * Où — ou si — la forme juridique, le capital et le RCS s'impriment sur le
 * devis et la facture (migration 0072).
 *
 * **Le défaut est « aucune ».** Ces mentions existaient déjà en base sans
 * jamais s'imprimer (`formeJuridique`, depuis la migration 0039) : les faire
 * apparaître d'un coup sur le prochain devis d'un artisan qui l'avait saisie
 * sans le savoir serait une surprise sur une pièce que son client garde.
 * L'artisan choisit d'abord où — ou s'il — les affiche.
 */
export type PositionMentionsLegales = "sous_nom" | "bas" | "aucune";

export type DonneesMentionsLegales = {
  formeJuridique: string | null | undefined;
  capitalSocial: string | null | undefined;
  villeRcs: string | null | undefined;
  siret: string | null | undefined;
  position: PositionMentionsLegales;
};

/**
 * Les lignes telles qu'elles s'impriment — zéro, une, ou deux.
 *
 * **Un seul geste éteint tout.** `position === "aucune"` retire les deux
 * mentions ensemble : c'est le même réglage que celui qui les affiche, il
 * n'y a pas deux interrupteurs à retenir pour un artisan qui change d'avis.
 *
 * **Le numéro du RCS n'est JAMAIS ressaisi** : c'est le SIREN, les neuf
 * premiers chiffres du SIRET déjà affiché dans Identité
 * (`sirenDepuisSiret`). Sans SIRET connu, la ville seule ne fait pas une
 * mention valable : elle ne s'imprime pas plutôt que de partir incomplète.
 *
 * **Un champ vide n'imprime rien**, ligne par ligne — comme partout ailleurs
 * dans l'identité de l'entreprise (IBAN, numéro de TVA…). La forme peut
 * s'imprimer seule (« SASU »), sans capital connu ; le capital ne s'imprime
 * jamais sans la forme, qui le porte grammaticalement (« SASU au capital de
 * … »).
 */
export function lignesMentionsLegales(d: DonneesMentionsLegales): string[] {
  if (d.position === "aucune") return [];
  if (!formeADuCapital(d.formeJuridique)) return [];

  const forme = (d.formeJuridique ?? "").trim();
  if (forme === "") return [];

  const lignes: string[] = [];

  const capital = (d.capitalSocial ?? "").toString().trim();
  lignes.push(capital === "" ? forme : `${forme} au capital de ${enEuros(capital)}`);

  const ville = (d.villeRcs ?? "").trim();
  const siren = sirenDepuisSiret(d.siret);
  if (ville !== "" && siren) lignes.push(`RCS ${ville} ${siren}`);

  return lignes;
}
