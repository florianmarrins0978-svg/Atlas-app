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

/**
 * DE QUELLE PIÈCE ON PARLE — et pourquoi cette fonction a dû l'apprendre.
 *
 * **Sa règle du 11 septembre 2026, sur la planche de la facture sans devis :**
 * *« ça ouvre une page de FACTURE, du même dessin. Un écran qui dit "devis" sur
 * ce qu'on facture se photographie et s'envoie au client. »*
 *
 * Une facture faite sans devis peut partir vide exactement comme un devis, et
 * pour les mêmes raisons — aucune ligne, un total nul, une ligne « à chiffrer ».
 * La RÈGLE est donc la même ; seul le NOM de la pièce change. Écrire une
 * seconde fonction « peutPreparerFacture » aurait mis deux règles pour une
 * question, et c'est celle qu'on aurait oublié de corriger qui aurait laissé
 * partir une facture à 0,00 € (`CLAUDE.md` §3).
 */
export type PieceAPreparer = "devis" | "facture";

export function peutPreparerLaPiece(
  lignes: readonly LignePrix[],
  piece: PieceAPreparer = "devis"
): VerdictPreparation {
  const cette = piece === "facture" ? "Cette facture" : "Ce devis";
  const leLa = piece === "facture" ? "la facture" : "le devis";
  const preteA = piece === "facture" ? "prête" : "prêt";

  if (lignes.length === 0) {
    return {
      possible: false,
      probleme: `${cette} n'a aucune ligne : ${piece === "facture" ? "elle" : "il"} partirait à 0,00 €.`,
      marcheASuivre:
        piece === "facture"
          ? "Appuyez sur « Remplir la facture » et posez ce que vous avez fait, avec son montant."
          : "Ajoutez une ligne ci-dessus avec son montant, ou enregistrez un tarif dans " +
            "Réglages pour que ce type de prestation soit chiffré tout seul la prochaine fois.",
    };
  }

  // Des lignes qui existent mais ne totalisent rien, c'est le même piège avec
  // un visage plus rassurant : l'écran paraît rempli.
  const total = lignes.reduce((acc, l) => acc.plus(new Decimal(l.montant || "0")), new Decimal(0));
  if (total.lessThanOrEqualTo(0)) {
    return {
      possible: false,
      probleme: `Le total de ${leLa} est de 0,00 € : il n'y a rien à facturer.`,
      marcheASuivre:
        piece === "facture"
          ? "Renseignez le montant de chaque ligne avant d'envoyer la facture."
          : "Renseignez le montant de chaque ligne avant de préparer le devis.",
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
      marcheASuivre: `Posez leur montant ci-dessus. ${cette} sera ${preteA} dès qu'aucune ligne n'attend plus rien.`,
    };
  }

  // Une ligne sans libellé laisse au client une ligne muette en face d'un
  // montant. On ne bloque pas pour autant : c'est au patron de juger, et une
  // description peut se corriger sur l'écran du devis.
  return { possible: true };
}

/**
 * Cette ligne attend-elle encore son prix ?
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **LE DRAPEAU NE DÉCIDE PAS SEUL — SA TROISIÈME CAPTURE DU 31 AOÛT 2026.**
 *
 * Son devis brouillon, en PDF, portait « à chiffrer » en face du dessouchage
 * et de la tonte, un seul montant visible (560,00 €) — et un **Total HT de
 * 2 280,00 €**. Le document se contredisait sur la même page : le total
 * comptait 1 720 € que le tableau refusait de montrer.
 *
 * **C'est pire que le blocage qui l'a produit.** Un devis bloqué se voit ; un
 * devis dont le total ne correspond pas aux lignes part chez le client, qui
 * additionne, n'y arrive pas, et cesse de croire le reste. Le dépôt le dit
 * déjà pour les plans d'arrosage : deux chiffres qui se contredisent dans le
 * même écran, c'est toute la liste qu'on cesse de croire.
 *
 * **L'invariant, et il vaut partout :** un montant posé RÉPOND à la question,
 * quel que soit l'état du drapeau. « À chiffrer » est réservé aux lignes qui
 * ne portent réellement rien.
 *
 * **Pourquoi c'est sûr, et ce n'est pas une supposition :** les deux seuls
 * chemins qui lèvent le drapeau écrivent `montant: "0"` avec lui
 * (`devis-depuis-dictee.ts`, `appliquer-proposition.ts`). Un montant non nul
 * sur une ligne marquée ne peut donc venir que d'une saisie du patron — jamais
 * d'un prix deviné (`CLAUDE.md` §4).
 *
 * **Et la règle était déjà écrite ici, une fois** : l'écran du devis complet
 * l'appliquait (`l.aChiffrer && montantDeLaLigne(l) <= 0`), le PDF non, et
 * l'envoi non plus. Trois lectures d'une même question, dont deux fausses
 * (`CLAUDE.md` §3).
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function ligneAttendSonPrix(ligne: LignePrix): boolean {
  return Boolean(ligne.aChiffrer) && !(Number(ligne.montant || "0") > 0);
}

/**
 * CE QU'UNE CASE DE MONTANT PORTE — et ce n'est JAMAIS « 0 ».
 *
 * **Sa règle, redite trois fois, la dernière le 11 septembre 2026 :** *« ce que
 * je veux, c'est que les cases pour les montants, il y ait marqué 0 en gris
 * pour qu'on sache que c'est là qu'il faut écrire, mais que lorsqu'on clique
 * dessus ça soit vide : on peut direct écrire le chiffre sans avoir à supprimer
 * des 0 »*.
 *
 * **Le défaut se voit sur ses captures, et il coûte de l'argent :** la case
 * portait un `0` RÉEL, venu du zéro que la base met par défaut. Il a tapé 450
 * derrière, et elle a affiché **0450** ; puis 250, et **0250**. Ces deux fois le
 * nombre tombait juste ; un zéro de plus au mauvais endroit part chez le client.
 *
 * **CE QUI A CHANGÉ LE 11 SEPTEMBRE AU SOIR, ET POURQUOI.** La première version
 * de cette règle ne vidait la case que sur une ligne portant le drapeau « à
 * chiffrer », pour qu'un zéro VOULU — une ligne offerte — reste écrit. C'était
 * défendable et **il l'a tranché dans l'autre sens** : il veut taper sans jamais
 * rien effacer, sur toutes les cases de montant.
 *
 * Ce que l'ancienne réserve craignait ne se perd pas : **le montant calculé, lui,
 * reste affiché** à côté de la case — une gratuité continue de s'écrire
 * « 0,00 € » en toutes lettres, là où elle se lit. C'est la case de SAISIE qui
 * se tait, pas le document.
 *
 * **Et c'est une valeur de DÉPART, jamais un affichage recalculé à chaque
 * frappe** : dérivée au rendu, la case se viderait au premier « 0 » tapé, et
 * « 0,50 » deviendrait impossible à écrire.
 *
 * **`montantEstNul` porte la question, `prixAEcrire` la réponse**, et la
 * séparation vient d'un défaut réel : l'écran des prix affiche ses montants
 * FORMATÉS (« 1 120,50 »), et `prixAEcrire` appliquée à ce texte-là le lisait
 * comme illisible, donc comme nul — elle vidait une case qui portait mille cent
 * vingt euros. La question se pose donc sur la valeur BRUTE, et le formatage
 * vient après (`test-prix-e2e.ts` l'a attrapé).
 */
export function montantEstNul(valeur: string): boolean {
  const n = Number(String(valeur).replace(",", ".").trim());
  return !Number.isFinite(n) || n === 0;
}

export function prixAEcrire(prixUnitaire: string): string {
  return montantEstNul(prixUnitaire) ? "" : prixUnitaire;
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
  const attente = lignes.filter(ligneAttendSonPrix);
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
