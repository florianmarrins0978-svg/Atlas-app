// Comment un salarié s'appelle à l'écran — et quand il ne s'écrit rien.
//
// **Sa demande du 10 août 2026, qui a créé ce fichier :** *« soit équipe A
// équipe B, soit l'utilisateur pourra mettre des noms et prénoms. Mais s'il n'a
// pas d'équipe et qu'il ne met rien, il ne faut pas qu'il y ait quand même
// écrit équipe A équipe B. »*
//
// **Sa demande du 26 août 2026, qui l'a coupé en deux** (planche 97, réponse
// **A**) : *« un curseur + ou − qui définit le nombre de salariés que possède
// l'entreprise et pouvoir affilier des noms. Ceux-là permettront d'ajouter ces
// noms au chantier, et plus les équipes A ou B. Néanmoins les équipes doivent
// toujours servir à définir le niveau de remplissage du planning : 2 équipes =
// 2 chantiers par jour, comme avant, ça ne bouge pas. »*
//
// ─────────────────────────────────────────────────────────────────────────────
// **DEUX NOMBRES, DEUX MÉTIERS — et c'est tout l'objet de la coupure.**
//
//   · `entreprises.nombre_equipes`   → la CAPACITÉ du planning. Elle ne nomme
//                                      personne, et plus une seule fonction
//                                      d'ici ne la lit pour écrire un libellé.
//   · `entreprises.nombre_salaries`  → combien de GENS, donc combien de noms se
//                                      règlent et s'affilient à une
//                                      demi-journée de chantier.
//
// Tant qu'un seul chiffre portait les deux, régler l'un déréglait l'autre en
// silence : monter la capacité à trois faisait apparaître une « Équipe C » que
// personne n'employait, et un artisan à quatre salariés mais un seul chantier à
// la fois n'avait aucun moyen de le dire.
//
// **« Équipe A / B » a donc disparu du vocabulaire**, à sa demande expresse. Le
// repli d'un salarié sans nom est son RANG — « Salarié 3 ».
// ─────────────────────────────────────────────────────────────────────────────
//
// **UNE SEULE FONCTION décide d'un libellé.** Elle sert au planning, à la
// revalidation serveur et aux documents. Deux implémentations divergeraient, et
// le jour où elles divergent l'écran promet quelqu'un que le serveur ne connaît
// pas. C'est la règle de `CLAUDE.md` §3, et elle a déjà été payée ailleurs
// (`ARCHITECTURE.md` §50).

/**
 * Le maximum de salariés réglables — et la borne du `rang` en base
 * (`CHECK ("rang" >= 1 AND "rang" <= 20)`, migration 0034).
 *
 * Les deux doivent rester d'accord : un écran qui proposerait un vingt et
 * unième rang ferait échouer l'écriture sans rien expliquer.
 */
export const MAX_SALARIES = 20;

/**
 * Le maximum d'équipes — la capacité du planning
 * (`CHECK ("nombre_equipes" >= 1)`, migration 0019, plafonnée ici).
 */
export const MAX_EQUIPES = 20;

/** Un salarié tel que la base le porte — `nom` absent est un état normal. */
export type SalarieNommable = {
  /** 1 à 20. Décide du repli et de l'ordre. */
  rang: number;
  nom?: string | null;
};

/**
 * Comment ce salarié s'écrit — ou `null` quand il ne faut RIEN écrire.
 *
 * Trois cas, et le premier est celui que le patron a nommé le 10 août :
 *
 * 1. **Aucun salarié → `null`.** Un artisan seul n'a personne à distinguer.
 *    Écrire un nom d'organisation à quelqu'un qui travaille seul serait lui
 *    inventer une entreprise qu'il n'a pas.
 * 2. **Un nom écrit → ce nom**, débarrassé de ses espaces. Un champ contenant
 *    trois espaces n'est pas un nom : le traiter comme tel afficherait une
 *    ligne vide, indiscernable de sa voisine.
 * 3. **Rien d'écrit → « Salarié N ».** C'est un repli assumé, pas une
 *    invention : il ne prétend rien savoir de personne, mais on ne laisse
 *    jamais deux lignes indiscernables sur un écran où l'on coche.
 *
 * **Le repli EXISTE, et ce n'est pas un détail de confort.** Le laisser tomber
 * ferait disparaître des cases à cocher pour tous ceux qui n'ont pas encore
 * tapé les prénoms de leurs gars : leurs chantiers deviendraient du jour au
 * lendemain impossibles à attribuer, sans un mot pour le dire.
 *
 * `null` veut dire « n'écris rien », jamais « écris une chaîne vide ».
 * L'appelant doit alors omettre l'élément, pas afficher du blanc.
 */
export function libelleSalarie(
  salarie: SalarieNommable | null | undefined,
  nombreSalaries: number
): string | null {
  // Zéro salarié : rien à distinguer, donc rien à écrire. Le compteur est borné
  // à 0 côté écran comme côté serveur, mais une valeur aberrante en base ne doit
  // pas se traduire par un nom inventé.
  if (!Number.isFinite(nombreSalaries) || nombreSalaries <= 0) return null;

  const ecrit = salarie?.nom?.trim();
  if (ecrit) return ecrit;

  if (!salarie) return null;
  const rang = Math.trunc(salarie.rang);
  if (rang < 1 || rang > MAX_SALARIES) return null;
  return `Salarié ${rang}`;
}

/**
 * Les salariés à montrer, dans l'ordre, pour un nombre donné.
 *
 * Complète les rangs manquants : le patron peut avoir nommé le troisième sans
 * jamais avoir touché le deuxième, et le deuxième doit quand même exister à
 * l'écran. Écarte ce qui dépasse le compteur — ces lignes sont conservées en
 * base à dessein (redescendre puis remonter ne perd pas un nom), mais elles ne
 * se montrent pas.
 *
 * **Le plancher est ZÉRO, et non un.** C'est ce qui distingue ce compteur de
 * celui des équipes : un artisan seul n'a aucun salarié, et lui montrer une
 * ligne « Salarié 1 » l'inviterait à se nommer lui-même.
 */
export function salariesAffiches<T extends SalarieNommable>(
  salaries: readonly T[],
  nombreSalaries: number
): (T | SalarieNommable)[] {
  const brut = Math.trunc(nombreSalaries);
  const borne = Math.min(MAX_SALARIES, Math.max(0, Number.isFinite(brut) ? brut : 0));
  const parRang = new Map(salaries.map((e) => [e.rang, e]));
  return Array.from({ length: borne }, (_, i) => parRang.get(i + 1) ?? { rang: i + 1, nom: null });
}

/**
 * Combien d'équipes ce chantier mobilise, d'après les salariés qu'on y a cochés.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **C'EST LA SEULE PIÈCE OÙ LES DEUX NOMBRES SE RENCONTRENT**, et elle existe
 * pour tenir sa consigne : *« les équipes doivent toujours servir à définir le
 * niveau de remplissage du planning — 2 équipes = 2 chantiers par jour, comme
 * avant, ça ne bouge pas »*.
 *
 * Avant la coupure, l'écran cochait des ÉQUIPES : leur nombre était la charge,
 * et il ne pouvait pas dépasser la capacité puisqu'il n'existait pas plus de
 * cases que d'équipes. Maintenant qu'on coche des GENS, les deux se décollent —
 * trois gars sur une entreprise à deux chantiers par jour, c'est possible.
 *
 * **Le plafond n'est donc pas un ajustement, c'est ce qui évite la régression :**
 * sans lui, un chantier à trois gars fermerait à lui seul une journée qui en
 * accepte deux, et le planning refuserait au client des jours réellement libres.
 *
 * **Et à effectif égal, le résultat est identique à celui d'avant** — ce qui est
 * exactement le cas de son entreprise, dont le compteur de salariés a été repris
 * du nombre d'équipes (migration 0067). Sa correction du 22 août 2026 tient donc
 * toujours : Julien ET Antoine chez Mr Eric ferment bien la demi-journée.
 *
 * **Zéro coché vaut UN, et non zéro.** Un chantier posé occupe du monde, même
 * quand personne n'y est encore nommé ; le compter zéro afficherait libre une
 * journée déjà prise.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function equipesMobilisees(salariesCoches: number, nombreEquipes: number): number {
  const capacite = Math.max(1, Math.trunc(nombreEquipes) || 1);
  const coches = Math.max(0, Math.trunc(salariesCoches) || 0);
  return Math.min(capacite, Math.max(1, coches));
}

/**
 * La phrase qui accompagne le compteur d'ÉQUIPES, dans Réglages.
 *
 * **Aucun mot de métier ici**, et c'est une consigne explicite : « chantiers de
 * front » a été soumis au patron et rejeté — *« pour moi rien »*. La phrase dit
 * ce que le réglage CHANGE, pas comment on l'appelle.
 */
export function phraseDuCompteur(nombreEquipes: number): string {
  return nombreEquipes <= 1
    ? "Un chantier à la fois : un jour pris n'est plus proposé."
    : "Un jour reste proposé tant qu'une équipe est libre.";
}

/**
 * La phrase qui accompagne le compteur de SALARIÉS.
 *
 * Elle dit ce que le réglage change — quels noms se cocheront sur une
 * demi-journée —, jamais ce qu'il est. Et elle ne parle pas d'équipes : les deux
 * compteurs sont côte à côte, et les mélanger dans une phrase remettrait dans
 * la tête du patron la confusion qu'on vient de retirer du code.
 */
export function phraseDesSalaries(nombreSalaries: number): string {
  return nombreSalaries <= 0
    ? "Seul : rien à cocher sur un chantier."
    : "Leurs noms se cochent sur chaque demi-journée.";
}
