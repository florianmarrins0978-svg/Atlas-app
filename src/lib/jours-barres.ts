import { libelleDuree } from "@/server/disponibilites";

// Ce qu'un jour barré veut dire — et pourquoi la phrase d'avant était fausse.
//
// **Le patron, le 16 août 2026**, capture de l'écran d'envoi à l'appui :
// *« j'ai l'impression que lorsque je veux remettre une journée sur le dix-huit,
// je ne peux pas ou alors c'est parce que je n'ai pas sectionné la
// demi-journée »*. Il cherchait la cause du mauvais côté — et l'écran l'y
// envoyait.
//
// **Ce qu'un jour barré signifie vraiment.** `joursSansPlace` ne répond pas à
// « ce jour est-il pris ? » mais à « un chantier de CETTE durée peut-il y
// COMMENCER ? ». Les deux ne coïncident pas, et l'écart n'a rien d'exotique —
// reproduit avant d'écrire une ligne, avec un seul chantier posé le 19 :
//
//     18 août · ½ journée → proposable   (le calendrier du planning le dit LIBRE)
//     18 août · 1 journée → proposable
//     18 août · 2 jours   → BARRÉ        (le 18 est pourtant vide)
//
// Le 18 est barré parce que deux jours partis du 18 déborderaient sur le 19,
// qui est plein. La règle est juste : sans elle, le chantier mordrait sur une
// journée déjà prise. **C'est la phrase qui mentait** — « les jours barrés sont
// déjà pris » — en désignant une occupation qui n'existe pas, et en envoyant
// chercher au mauvais endroit. Le dépôt paie ce genre d'erreur depuis le début
// (`AGENTS.md` : *un message qui accuse à tort coûte plus cher que pas
// d'erreur du tout*).
//
// ─── DEUX PUBLICS, DEUX PHRASES — ET CE N'EST PAS UN CAPRICE ─────────────────
//
// **Le patron a droit à la durée ; son client, non.** La consigne est ancienne
// et tenue par un contrôle (`test-creneaux-planning.ts` : *« le client ne voit
// jamais la demi-journée »*) : rien du découpage de son planning ne part chez
// le client — ni « matin », ni « après-midi », ni créneau, ni durée. Il ne
// reçoit que des DATES.
//
// La première version de ce module l'avait enfreinte, en toute bonne foi : la
// durée du chantier semblait appartenir au client puisque c'est le sien. La
// batterie l'a refusée — *« la durée du chantier a fuité vers la page du
// client »* — et c'est elle qui a raison : ce n'est pas à une session de
// rouvrir un arbitrage du patron.
//
// D'où `duree === null` : la phrase reste vraie, et ne dit rien de plus.
//
// **Et la durée n'est pas qu'une formalité côté patron** : elle lui montre le
// levier. Sur l'écran d'envoi, elle se change juste au-dessus du calendrier —
// passer de « 2 jours » à « 1 journée » rouvre le 18. Le refus cesse d'être une
// impasse. Le client, lui, n'a aucun levier à actionner : lui nommer la durée ne
// lui servirait à rien, et coûterait la consigne.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La phrase sous le calendrier, quand au moins un jour est barré.
 *
 * `null` pour l'écran du CLIENT — voir l'en-tête : il n'apprend rien du
 * découpage du planning de son artisan.
 *
 * **Le cas de la demi-journée est à part, et pas par coquetterie** : une
 * demi-journée ne peut déborder sur rien — elle tient dans un seul créneau. Lui
 * servir « soit le chantier déborderait » serait rouvrir le défaut qu'on
 * corrige, en sens inverse.
 */
export function phraseJoursBarres(dureeDemiJournees: number | null): string {
  if (dureeDemiJournees === null) {
    return "Les jours barrés ne peuvent pas accueillir votre chantier.";
  }
  const duree = Math.max(1, Math.trunc(dureeDemiJournees));
  if (duree === 1) {
    return "Les jours barrés n'ont plus de place, même pour une demi-journée.";
  }
  return (
    `Les jours barrés ne peuvent pas accueillir ${libelleDuree(duree)} : ` +
    "soit ils sont pris, soit le chantier déborderait sur un jour qui l'est."
  );
}

/**
 * Ce qu'entend, sur un jour barré, une personne qui n'utilise pas ses yeux.
 *
 * Elle doit apprendre la même chose que celle qui voit la phrase — sans quoi
 * l'un des deux publics garde la version fausse.
 */
export function libelleJourBarre(dureeDemiJournees: number | null): string {
  if (dureeDemiJournees === null) return "ne peut pas accueillir votre chantier";
  const duree = Math.max(1, Math.trunc(dureeDemiJournees));
  if (duree === 1) return "plus de place, même pour une demi-journée";
  return `ne peut pas accueillir ${libelleDuree(duree)}`;
}
