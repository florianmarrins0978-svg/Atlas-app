/**
 * L'ordre des cartes de l'accueil : **le plus récent en haut, et rien d'autre.**
 *
 * ─── SA DEMANDE DU 26 AOÛT 2026, capture à l'appui ──────────────────────────
 *
 * *« Je viens de recevoir un devis retourné, il devrait apparaître en premier.
 * L'ordre doit être dernier arrivé en tête de liste. Le plus récent en haut. »*
 *
 * Sur sa capture, la nouvelle du jour était DEUXIÈME, sous un rappel vieux de
 * treize jours. Rien ne le lui expliquait, et rien ne pouvait le lui expliquer :
 * l'ordre se décidait par SORTE de carte, pas par date.
 *
 * ─── CE QUE CETTE RÈGLE REMPLACE, ET POURQUOI ON L'ASSUME ───────────────────
 *
 * Elle remplace un arrangement qu'il avait lui-même choisi le 16 août : les
 * rappels devant, avec une place garantie aux réponses de clients. Cet
 * arrangement répondait à une vraie crainte — *trois chantiers sans devis
 * suffisaient à masquer TOUTES les réponses*, photographié et corrigé le jour
 * même.
 *
 * **L'ordre chronologique répond à la même crainte, et mieux :** une réponse
 * qui vient d'arriver est, par construction, la plus récente — elle passe donc
 * en tête, sans qu'aucune place ait besoin d'être réservée. Ce qu'un tressage
 * obtenait par une exception, la date l'obtient par la règle.
 *
 * **Ce que cela coûte, et il faut le dire :** une réponse VIEILLE et non
 * acquittée peut désormais passer derrière des rappels plus frais. L'ancien
 * tressage lui gardait une place ; celui-ci non. C'est le prix d'un ordre qui
 * s'explique en une phrase — et un ordre qu'on ne peut pas expliquer est un
 * ordre qu'on croit cassé, ce qui vient d'arriver.
 *
 * ─── CE QU'ELLE NE FAIT PAS ─────────────────────────────────────────────────
 *
 * Elle ne regarde ni la sorte, ni l'urgence, ni le montant. Une seule question :
 * **quand est-ce arrivé ?**
 *
 * Pure et sans base : c'est ce qui permet à `scripts/test-ordre-notifications.ts`
 * de l'éprouver sur les cas limites qu'un écran ne produit qu'un jour sur cent.
 */

/** Le minimum qu'une carte doit porter pour être rangée. */
export type CarteDatee = { quand: number };

/**
 * Range les cartes de la plus récente à la plus ancienne.
 *
 * **Le tri ne modifie pas ce qu'on lui donne.** Les tableaux viennent de l'état
 * d'un écran React : les trier sur place ferait muter une valeur que le rendu
 * suivant relit, et l'ordre changerait sans qu'aucune donnée ait bougé.
 *
 * **À date égale, l'ordre d'arrivée décide** — et il est stable, `Array.sort`
 * l'étant depuis longtemps. Deux cartes de la même seconde ne doivent pas
 * changer de place d'un rendu à l'autre : un écran qui se réordonne tout seul
 * sous le doigt fait rater le bouton qu'on visait.
 */
export function ordonnerLesCartes<T extends CarteDatee>(...sortes: T[][]): T[] {
  return sortes.flat().sort((a, b) => b.quand - a.quand);
}
