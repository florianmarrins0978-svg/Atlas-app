/**
 * Les dates qu'un envoi refuse — et la phrase qui NOMME le bon coupable.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **Deux défauts se tenaient l'un derrière l'autre, et le second cachait le
 * premier.**
 *
 * `envoyerAuClientAction` fige le devis (`envoyerDevis` : statut « envoyé »,
 * PDF archivé, numéro consommé, document immuable) **puis** crée le lien du
 * client. Quand la seconde moitié refusait une date, la première avait déjà eu
 * lieu : le devis était parti pour l'application, et n'existait nulle part pour
 * le client. En rouvrant, le patron lisait « Ce devis est parti chez votre
 * client : il ne se modifie plus » — une phrase fausse sur une pièce comptable
 * qui ne se réécrit pas.
 *
 * **Et le refus accusait le mauvais coupable.** Il disait « Une des dates
 * proposées n'est plus libre », alors que l'occupation d'une journée ne refuse
 * plus rien depuis sa règle du 23 août 2026 — *« si l'utilisateur juge qu'il
 * peut rajouter un chantier, il doit pouvoir le faire quand même »*. Le seul
 * motif qui subsiste est la FENÊTRE : une date passée, ou au-delà de dix-huit
 * mois. Le patron cherchait donc une autre date libre pour un jour qui n'avait
 * jamais été pris. Une erreur qui envoie chercher au mauvais endroit coûte plus
 * cher que pas d'erreur du tout (`AGENTS.md`).
 *
 * **Cette fonction sert les deux côtés**, et c'est ce qui referme le premier
 * défaut : l'action la consulte AVANT de figer quoi que ce soit, le dépôt la
 * consulte à l'écriture. Une seule règle (`CLAUDE.md` §3) — la recopier aurait
 * laissé revenir l'écart qu'on vient de payer.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Format `AAAA-MM-JJ`, celui de PostgreSQL pour le type `date`. */
type JourIso = string;

export type RefusDate = {
  date: JourIso;
  /**
   * `"passee"` et `"trop_loin"` là où le dépôt ne connaissait que
   * `"hors_fenetre"`. Les deux se réparent par des gestes opposés — avancer ou
   * reculer —, et une phrase unique ne pouvait dire ni l'un ni l'autre.
   */
  motif: "passee" | "trop_loin";
};

export function datesHorsFenetre(
  dates: readonly JourIso[],
  horizon: { debut: JourIso; fin: JourIso }
): RefusDate[] {
  // Les jours ISO se comparent comme du texte : « 2026-09-03 » < « 2026-09-04 »
  // est vrai lettre à lettre, à condition que le format soit fixe — il l'est,
  // c'est celui de la colonne `date`.
  return dates.flatMap<RefusDate>((date) =>
    date < horizon.debut
      ? [{ date, motif: "passee" }]
      : date > horizon.fin
        ? [{ date, motif: "trop_loin" }]
        : []
  );
}

/**
 * Ce que le patron lit, et **le geste qui le débloque**.
 *
 * Un refus qui ne nomme pas la porte suivante envoie chercher au hasard : c'est
 * la règle du dépôt, et c'est exactement ce que l'ancienne phrase faisait.
 */
export function motifDatesRefusees(refus: readonly RefusDate[]): string {
  if (refus.length === 0) return "";
  // Un seul motif suffit à dire quoi faire, et deux phrases empilées se lisent
  // moins bien qu'une (`CLAUDE.md` §3, le moins de mots possible). Le passé
  // prime : c'est le cas qu'on rencontre, et le plus facile à corriger.
  const passee = refus.find((r) => r.motif === "passee");
  return passee
    ? "Cette date est déjà passée : votre client ne pourra pas la retenir. Choisissez un jour à venir."
    : "Cette date dépasse dix-huit mois. Choisissez un jour plus proche.";
}
