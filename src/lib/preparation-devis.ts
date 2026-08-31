import Decimal from "decimal.js";

// Un devis peut-il être préparé à partir de ces lignes de prix ?
//
// **Le défaut que cette fonction ferme.** Sur l'écran Prix, quand aucun tarif
// ne correspondait, l'application affichait « Aucun prix proposable » puis
// « Aucune ligne pour l'instant » — et laissait quand même le bouton
// « Préparer le devis → » actif. Le patron pouvait donc valider un prix
// inexistant, arriver sur un devis à **0,00 €**, et l'envoyer à son client.
// Aucun garde-fou nulle part : ni à la validation du prix, ni avant l'envoi.
//
// Un devis accepté est immuable : le corriger demande une nouvelle version.
//
// **Le vrai défaut n'était pas le bouton, c'était le silence.** L'écran disait
// ce qui avait échoué sans jamais dire quoi faire. Cette fonction porte donc
// aussi la marche à suivre — un bouton grisé sans explication se lit comme une
// application en panne, et c'est déjà arrivé sur l'écran de dictée.
//
// **Une seule fonction pour l'écran et pour le serveur** (`CLAUDE.md` §3) :
// deux implémentations de la même règle finissent toujours par diverger, et
// c'est l'écran qui aurait raison pendant que le serveur laisse passer.

/**
 * Le prix ne peut pas être validé en l'état — le message dit pourquoi.
 *
 * Elle vit ici, et non dans le fichier d'actions : Next.js n'accepte, dans un
 * module `"use server"`, que des exports de fonctions asynchrones. Une classe
 * exportée y annule **tous** les exports du module — l'application entière
 * renvoyait 500, et ni les types ni le lint ne le voyaient. Compiler n'est pas
 * fonctionner (`AGENTS.md`).
 */
export class PrixNonPreparableError extends Error {}

export type LignePrix = {
  libelle: string;
  montant: string;
  /**
   * Le travail est identifié, son prix ne l'est pas (migration 0070).
   *
   * **Absent, il vaut « non »** : les lignes d'avant le 27 août 2026 n'ont
   * jamais porté cet état, et rien ne doit prétendre le contraire.
   */
  aChiffrer?: boolean | null;
};

export type VerdictPreparation =
  | { possible: true }
  | {
      possible: false;
      /** Ce qui bloque, en une phrase, sans jargon. */
      probleme: string;
      /** Ce que le patron peut faire, tout de suite. */
      marcheASuivre: string;
    };

export function peutPreparerDevis(lignes: readonly LignePrix[]): VerdictPreparation {
  if (lignes.length === 0) {
    return {
      possible: false,
      probleme: "Ce devis n'a aucune ligne : il partirait à 0,00 €.",
      marcheASuivre:
        "Ajoutez une ligne ci-dessus avec son montant, ou enregistrez un tarif dans " +
        "Réglages pour que ce type de prestation soit chiffré tout seul la prochaine fois.",
    };
  }

  // Des lignes qui existent mais ne totalisent rien, c'est le même piège avec
  // un visage plus rassurant : l'écran paraît rempli.
  const total = lignes.reduce((acc, l) => acc.plus(new Decimal(l.montant || "0")), new Decimal(0));
  if (total.lessThanOrEqualTo(0)) {
    return {
      possible: false,
      probleme: "Le total de ce devis est de 0,00 € : il n'y a rien à facturer.",
      marcheASuivre: "Renseignez le montant de chaque ligne avant de préparer le devis.",
    };
  }

  // **Une ligne « à chiffrer » arrête le devis, et c'est tout son intérêt.**
  //
  // Sa demande du 27 août 2026 : *« le devis ne doit pas pouvoir être considéré
  // comme prêt à envoyer tant qu'une ligne nécessitant un prix n'est pas
  // chiffrée. »* Avant, ces lignes-là valaient 0 € : le total paraissait
  // correct, le devis partait, et le client lisait un travail à zéro euro.
  //
  // Le contrôle vient APRÈS celui du total : un devis entièrement à chiffrer
  // doit dire « aucune ligne n'a de prix », pas nommer la première.
  const attente = lignesEnAttenteDePrix(lignes);
  if (attente) {
    return {
      possible: false,
      probleme: attente,
      marcheASuivre: "Posez leur montant ci-dessus. Le devis sera prêt dès qu'aucune ligne n'attend plus rien.",
    };
  }

  // Une ligne sans libellé laisse au client une ligne muette en face d'un
  // montant. On ne bloque pas pour autant : c'est au patron de juger, et une
  // description peut se corriger sur l'écran du devis.
  return { possible: true };
}

/**
 * Les lignes qui attendent encore leur prix, nommées — ou `null` s'il n'y en a
 * aucune.
 *
 * **Elle existe parce que la règle était écrite DEUX FOIS** (`CLAUDE.md` §3) :
 * ici pour l'écran, et une seconde fois dans `envoyerDevis` avec sa propre
 * phrase. Les deux ont divergé, et c'est la capture du patron du 31 août 2026
 * qui l'a montré : « 2 lignes attendent **son** prix […] Posez-**le** sur
 * l'écran Prix ». Le pluriel n'avait été traité que sur le verbe.
 *
 * Le vrai coût n'est pas la faute d'accord : deux formulations de la même règle
 * finissent par dire deux choses différentes, et rien ne dit laquelle fait foi.
 */
export function lignesEnAttenteDePrix(lignes: readonly LignePrix[]): string | null {
  const attente = lignes.filter((l) => l.aChiffrer);
  if (attente.length === 0) return null;
  const noms = attente.map((l) => `« ${premiereLigne(l.libelle)} »`).join(", ");
  return attente.length === 1
    ? `${noms} attend son prix : cette ligne n'est pas gratuite, elle n'est pas chiffrée.`
    : `${attente.length} lignes attendent leur prix : ${noms}.`;
}

/** Une ligne peut réunir plusieurs travaux empilés : on n'en nomme qu'un. */
function premiereLigne(libelle: string): string {
  return libelle.split("\n")[0]?.trim() || "sans libellé";
}
