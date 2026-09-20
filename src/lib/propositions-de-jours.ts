import { joursDuBloc, joursDuChantier, jourSuivantOuvre, type JourIso } from "./disponibilites";

/**
 * LES JOURS QU'IL PROPOSE À SON CLIENT — le geste qu'il a dicté le
 * 17 septembre 2026, planche `appli/deux-jours-pas-colles.html` :
 *
 * *« Je dois cliquer sur un jour pour proposer la première date, puis sur le
 * deuxième pour proposer la deuxième date, et il faut un bouton on/off pour si
 * on souhaite faire une deuxième proposition. Néanmoins il faut par défaut que
 * si on a un chantier de 8 jours, si je clique sur le 23, qu'ils mettent les 8
 * d'affilée — et ensuite si je décide que non, en fait, le 25, je l'enlève :
 * je clique dessus pour l'enlever. »* Puis : *« il ne doit pas se décaler
 * d'une case, il doit s'effacer, et on clique sur le jour qu'on souhaite pour
 * le remettre ! »*
 *
 * Une PROPOSITION est la liste des jours du chantier. Un appui sur un jour
 * libre pose le bloc d'affilée quand rien ne manque, ou comble ce qui manque ;
 * un appui sur un jour du chantier l'efface, et rien ne bouge. Deux
 * propositions au plus — « une ou deux, jamais plus », la règle d'aujourd'hui
 * (`docs/AGENT.md` §2.2), vérifiée aussi par le serveur.
 *
 * **Pourquoi une fonction pure plutôt que vingt lignes dans l'écran.** La règle
 * s'éprouve sans navigateur, et l'écran ne décide de rien : il montre
 * (`CLAUDE.md` §3).
 */
export type Propositions = JourIso[][];

export type EtatDesPropositions = {
  propositions: Propositions;
  /** L'interrupteur « Vous proposez deux dates ». Allumé sans seconde liste : le prochain appui la commence. */
  secondeVoulue: boolean;
  /** La dernière touchée. Quand rien ne manque, c'est L'AUTRE — la plus ancienne — qu'un appui remplace. */
  active: number;
};

export type GesteSurUnJour =
  /** Le jour est dans une proposition : il s'efface. */
  | { geste: "effacer"; proposition: number }
  /** Une proposition attend des jours : celui-ci en devient un. */
  | { geste: "ajouter"; proposition: number }
  /** Rien ne manque : ce jour devient le premier d'un bloc d'affilée. */
  | { geste: "poser_le_bloc"; proposition: number };

export const PROPOSITIONS_AU_MAXIMUM = 2;

/**
 * Ce que ferait un appui sur ce jour — dit AVANT de le faire, parce que
 * l'écran doit demander au serveur si le jour tient (`verifierJourPropose`)
 * avec la bonne durée : un jour seul quand on comble, le bloc entier quand on
 * le pose.
 */
export function gesteSurUnJour(
  etat: EtatDesPropositions,
  jour: JourIso,
  dureeDemiJournees: number,
  /**
   * Combien de propositions cet écran autorise.
   *
   * **Deux chez le patron, UNE chez son client** — sa demande du 20 septembre
   * 2026 : *« lorsqu'elle clique sur proposer des jours, il faut mettre le même
   * système que nous »*. Le geste est le même, le nombre de propositions ne
   * l'est pas : elle propose SES jours, pas deux jeux au choix.
   *
   * C'est un paramètre et non une seconde fonction : réécrire la règle pour
   * l'écran du client, c'est se donner deux façons de poser un bloc, qui
   * divergeront (`CLAUDE.md` §3). Sans lui, un chantier d'un seul jour ouvrait
   * une SECONDE proposition au deuxième appui — la branche « une ou deux dates
   * au choix » ci-dessous —, ce qui n'a aucun sens de son côté à elle.
   */
  maximum: number = PROPOSITIONS_AU_MAXIMUM
): GesteSurUnJour {
  const dans = etat.propositions.findIndex((p) => p.includes(jour));
  if (dans >= 0) return { geste: "effacer", proposition: dans };
  if (etat.secondeVoulue && etat.propositions.length < maximum) {
    return { geste: "poser_le_bloc", proposition: etat.propositions.length };
  }
  const attendus = joursDuChantier(dureeDemiJournees);
  const manque = etat.propositions.findIndex((p) => p.length < attendus);
  // Une proposition vidée jusqu'au dernier jour repart comme au premier appui :
  // le bloc d'affilée, pas un jour seul.
  if (manque >= 0 && etat.propositions[manque].length === 0) return { geste: "poser_le_bloc", proposition: manque };
  if (manque >= 0) return { geste: "ajouter", proposition: manque };
  // Sur une journée, un second appui est une seconde date AU CHOIX — le geste
  // d'avant le 18 septembre 2026, gardé tel quel : « Proposez une ou deux
  // dates ». L'interrupteur s'allume tout seul.
  if (attendus === 1 && etat.propositions.length < maximum) {
    return { geste: "poser_le_bloc", proposition: etat.propositions.length };
  }
  // Au-delà de deux, le plus ancien choix cède la place — la règle d'avant,
  // « une ou deux dates, jamais trois », plutôt qu'un bouton qui ne répond pas.
  const derniere = Math.min(etat.active, Math.max(0, etat.propositions.length - 1));
  return { geste: "poser_le_bloc", proposition: etat.propositions.length > 1 ? 1 - derniere : derniere };
}

/**
 * L'état après l'appui. Effacer le dernier jour de la seconde proposition la
 * ferme et éteint l'interrupteur ; la première, vidée, reste là et dit ce qui
 * manque — c'est l'envoi qui refuse de partir sans date, pas le geste.
 */
export function toucherUnJour(
  etat: EtatDesPropositions,
  jour: JourIso,
  dureeDemiJournees: number,
  /** Voir `gesteSurUnJour` : une seule proposition sur l'écran du client. */
  maximum: number = PROPOSITIONS_AU_MAXIMUM
): EtatDesPropositions {
  const propositions = etat.propositions.map((p) => [...p]);
  const g = gesteSurUnJour(etat, jour, dureeDemiJournees, maximum);
  if (g.geste === "effacer") {
    const p = propositions[g.proposition];
    p.splice(p.indexOf(jour), 1);
    let secondeVoulue = etat.secondeVoulue;
    if (p.length === 0 && g.proposition === 1) {
      propositions.splice(g.proposition, 1);
      secondeVoulue = false;
    }
    return { propositions, secondeVoulue, active: Math.min(g.proposition, propositions.length - 1) };
  }
  if (g.geste === "ajouter") {
    propositions[g.proposition].push(jour);
    return { ...etat, propositions, active: g.proposition };
  }
  // Le bloc s'écarte de ce que l'autre proposition tient déjà : deux
  // propositions ne se marchent pas dessus, la cliente choisit entre deux.
  const autres = new Set(propositions.filter((_, i) => i !== g.proposition).flat());
  propositions[g.proposition] = blocEnEvitant(jour, dureeDemiJournees, autres);
  return {
    propositions,
    secondeVoulue: etat.secondeVoulue || propositions.length > 1,
    active: g.proposition,
  };
}

/**
 * Le bloc d'affilée depuis un premier jour, en sautant les jours qu'une autre
 * proposition tient. Sans rien à éviter, c'est exactement `joursDuBloc` —
 * les mêmes jours que `creneauxDuChantier` réservera à l'acceptation.
 */
export function blocEnEvitant(
  premier: JourIso,
  dureeDemiJournees: number,
  aEviter: ReadonlySet<JourIso>
): JourIso[] {
  if (aEviter.size === 0) return joursDuBloc(premier, dureeDemiJournees);
  const bloc: JourIso[] = [];
  let jour = premier;
  while (bloc.length < joursDuChantier(dureeDemiJournees)) {
    if (!aEviter.has(jour)) bloc.push(jour);
    jour = jourSuivantOuvre(jour);
  }
  return bloc;
}

/** Éteindre l'interrupteur retire la seconde proposition ; l'allumer attend son premier jour. */
export function basculerLaSeconde(etat: EtatDesPropositions): EtatDesPropositions {
  if (etat.secondeVoulue) {
    return { propositions: etat.propositions.slice(0, 1), secondeVoulue: false, active: 0 };
  }
  return { ...etat, secondeVoulue: true };
}

/** Ce qui manque à une proposition, en jours ; zéro quand elle est complète. */
export function joursManquants(proposition: readonly JourIso[], dureeDemiJournees: number): number {
  return Math.max(0, joursDuChantier(dureeDemiJournees) - proposition.length);
}

/**
 * LE MÊME GESTE, SUR LA SEULE LISTE DU CLIENT — sa demande du 20 septembre
 * 2026 : *« lorsqu'elle clique sur proposer des jours, s'il y a plusieurs jours
 * il faut mettre le même système que nous : les 4 dates s'affichent, elle
 * clique sur un jour sélectionné pour le désélectionner et reclique ailleurs
 * pour le déplacer »*.
 *
 * **Trois gestes, et le troisième est celui qu'il a fallu qu'il réclame :**
 * effacer un jour posé, COMBLER celui qui manque, ou reposer le bloc entier.
 * Sans « combler », un appui ailleurs remplaçait toute la sélection — donc
 * impossible de déplacer un seul jour sur quatre.
 *
 * Elle passe par `toucherUnJour` avec **une seule proposition autorisée** : la
 * règle reste écrite une fois, ici comme sur son écran d'envoi.
 */
export function toucherUnJourDuClient(
  jours: readonly JourIso[],
  jour: JourIso,
  /**
   * **DES JOURS, jamais des demi-journées** — et ce n'est pas une commodité.
   *
   * Le client n'apprend rien du découpage du planning de son artisan : ni
   * créneau, ni durée (`test-creneaux-planning.ts` le vérifie sur ce qui part
   * jusqu'à sa page). Il ne reçoit que la liste des jours que le patron lui a
   * proposés, et leur nombre suffit à poser le même bloc : `joursDuChantier`
   * ne lit de la durée que son compte de jours.
   */
  nombreDeJours: number
): JourIso[] {
  const etat: EtatDesPropositions = {
    propositions: [[...jours]],
    secondeVoulue: false,
    active: 0,
  };
  // Deux demi-journées par jour : la seule conversion, et elle rend exactement
  // `nombreDeJours` (`joursDuChantier` arrondit au jour supérieur).
  const apres = toucherUnJour(etat, jour, Math.max(1, nombreDeJours) * 2, 1);
  return [...(apres.propositions[0] ?? [])].sort();
}
