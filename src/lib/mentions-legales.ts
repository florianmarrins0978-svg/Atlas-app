import { formeADuCapital } from "./formes-juridiques";
import { sirenDepuisSiret } from "./siren";
import { enEuros } from "./euros";

/**
 * Où la forme juridique, le capital et le RCS d'une société s'impriment sur le
 * devis et la facture (migration 0072).
 *
 * **« aucune » n'éteint plus rien — choix 4A du 3 octobre 2026.** Ces mentions
 * sont obligatoires sur les documents d'une société (Code de commerce,
 * R123-237), et le défaut « aucune » faisait partir sans elles les devis de
 * toute société qui n'avait pas touché au réglage. Il a choisi « sous le
 * nom » ; la valeur reste en base pour les comptes qui la portent
 * (`.claude/rules/deployment-safety.md`), et se lit comme « sous le nom »
 * (`positionEffective`). L'écran ne la propose plus.
 */
export type PositionMentionsLegales = "sous_nom" | "bas" | "aucune";

/** La place où les mentions s'impriment vraiment : jamais nulle part. */
export function positionEffective(position: PositionMentionsLegales | null | undefined): "sous_nom" | "bas" {
  return position === "bas" ? "bas" : "sous_nom";
}

export type DonneesMentionsLegales = {
  formeJuridique: string | null | undefined;
  capitalSocial: string | null | undefined;
  villeRcs: string | null | undefined;
  siret: string | null | undefined;
};

/**
 * Les lignes telles qu'elles s'impriment — zéro, une, ou deux. La position ne
 * décide plus que de la PLACE (`positionEffective`) ; elle ne les retire plus.
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

/**
 * LE CAPITAL TEL QU'IL S'ÉCRIT EN BASE — `numeric(12,2)`, jamais du texte.
 *
 * **Un « 1 500 € » saisi de travers ne s'écrit pas en base** : il romprait le
 * calcul ci-dessus (`enEuros` sur du texte), et PostgreSQL refuserait la ligne
 * entière — donc, à la porte, la création du compte tout entière pour une case
 * facultative.
 *
 * Trois réponses, et la nuance compte :
 *
 * | | |
 * |---|---|
 * | `null` | la case est vide : il n'y a pas de capital |
 * | une chaîne | le nombre, à deux décimales |
 * | `undefined` | **on n'a pas compris** : on ne touche à rien |
 *
 * `undefined` n'est pas un détail : sur l'écran des réglages, il laisse le
 * capital tel qu'il était plutôt que d'écrire n'importe quoi par-dessus.
 *
 * **Elle vit ICI et non dans le dépôt qui l'employait** : la porte du
 * 8 septembre 2026 écrit le même champ, et deux lectures d'un même chiffre
 * finissent par diverger (`CLAUDE.md` §3).
 */
/**
 * **CE QUE LA COLONNE PEUT PORTER, ET RIEN DE PLUS** — `numeric(12,2)`, soit
 * douze chiffres dont deux après la virgule.
 *
 * Trouvé le 13 septembre 2026 en balayant toutes les façons de remplir la
 * porte : un capital de quinze chiffres passait cette fonction sans un mot,
 * et PostgreSQL refusait la ligne (`22003`) — donc la création du compte
 * ENTIÈRE, pour une case facultative. Exactement ce que le commentaire
 * ci-dessus promettait d'éviter, et que seule la moitié « texte illisible »
 * tenait.
 *
 * La borne vit ici plutôt que dans un contrôle de l'écran : c'est la même
 * fonction qui décide pour l'écran et pour l'écriture, et deux bornes
 * finiraient par diverger (`CLAUDE.md` §3).
 */
const CAPITAL_MAX = 9_999_999_999.99;

export function capitalEnBase(brut: string | null | undefined): string | null | undefined {
  const net = (brut ?? "").trim();
  if (net === "") return null;
  // L'espace des milliers se tape (« 1 000 »), et l'insécable arrive du
  // presse-papiers : les deux se retirent, sans quoi `Number` rend NaN sur une
  // saisie parfaitement lisible.
  const nombre = Number(net.replace(/[\s\u00a0\u202f]/g, "").replace(",", "."));
  if (!Number.isFinite(nombre) || nombre < 0 || nombre > CAPITAL_MAX) return undefined;
  return nombre.toFixed(2);
}
