import {
  creneauxPoses,
  DUREE_PAR_DEFAUT_DEMI_JOURNEES,
  type Creneau,
  type JourIso,
  type Moment,
} from "./disponibilites";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * OÙ UN CHANTIER EST POSÉ — et ce qui lui reste à poser
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **Sa demande du 10 septembre 2026**, planche `appli/liberer-une-demi-journee`
 * essayée puis retenue : *« je clique sur le matin, il devient vert et le matin
 * du vendredi devient libre, et une demi-journée de Mr Julien sort ; à la place
 * on ajoute un chantier comme d'habitude, et la demi-journée retirée peut être
 * replacée. »*
 *
 * **DEUX QUESTIONS QUI SE RESSEMBLENT ET QU'IL NE FAUT PAS CONFONDRE :**
 *
 * | | |
 * |---|---|
 * | ce que le chantier **demande** | `dureeDemiJournees`, lu de la dictée ou du devis |
 * | où il est **posé** | les créneaux, une ligne par demi-journée (migration 0085) |
 *
 * Leur écart est exactement ce que le patron voit dans « Sans date » : une
 * demi-journée demandée qui n'est posée nulle part.
 *
 * **Ces règles vivent ici, sans base et sans écran** : c'est ce qui permet de
 * les éprouver seules, et c'est la couche la plus basse (`CLAUDE.md` §4 sexies).
 */

/** Le chantier tel que la base le rend — ses trois colonnes d'origine. */
export type ChantierPose = {
  jour: JourIso | null;
  moment: Moment | string | null;
  dureeDemiJournees: number | null;
};

/** La clé d'une demi-journée, pour comparer sans se tromper de format. */
export function cleDuCreneau(c: Creneau): string {
  return `${c.jour}:${c.moment}`;
}

/**
 * LES DEMI-JOURNÉES RÉELLEMENT OCCUPÉES par un chantier.
 *
 * **La règle de repli n'est pas une commodité, c'est la sécurité du planning.**
 * La migration 0085 n'a recopié aucun chantier existant : sans ligne, un
 * chantier vaut le bloc d'un seul tenant que ses trois colonnes décrivent, et
 * c'est ce que `creneauxDuChantier` calcule depuis toujours. Rendre une liste
 * vide à la place libérerait d'un coup **toutes** les demi-journées déjà
 * prises — et l'écran d'envoi proposerait au client un jour occupé, ce que le
 * patron a signalé le 22 août 2026 (« je peux proposer le 24 alors qu'un client
 * a validé le 24 »).
 */
export function creneauxOccupes(chantier: ChantierPose, poses: readonly Creneau[]): Creneau[] {
  if (!chantier.jour) return poses.length > 0 ? [...poses] : [];
  const moment: Moment = chantier.moment === "apres_midi" ? "apres_midi" : "matin";
  // **La règle du repli vit dans `creneauxPoses`**, et une seule fois : c'est
  // elle que l'occupation emploie de son côté, et deux façons de répondre à
  // « quelles demi-journées prend-il » finiraient par se contredire.
  return creneauxPoses({
    jour: chantier.jour,
    moment,
    dureeDemiJournees: chantier.dureeDemiJournees,
    creneaux: poses,
  });
}

/**
 * COMBIEN DE DEMI-JOURNÉES ATTENDENT ENCORE UNE PLACE.
 *
 * Jamais négatif : un chantier posé sur plus de demi-journées qu'il n'en
 * demande — il a duré plus longtemps que prévu, et c'est lui qui le sait —
 * n'attend rien. Rendre `-1` ferait écrire « −1 demi-journée à poser » quelque
 * part, et ce genre de chiffre se lit comme un défaut de l'application.
 */
export function demiJourneesAPoser(chantier: ChantierPose, poses: readonly Creneau[]): number {
  const demande = chantier.dureeDemiJournees ?? DUREE_PAR_DEFAUT_DEMI_JOURNEES;
  return Math.max(0, demande - creneauxOccupes(chantier, poses).length);
}

/**
 * CE QUE LES TROIS COLONNES D'ORIGINE DOIVENT DIRE, une fois les créneaux posés.
 *
 * **Elles ne disparaissent pas, elles deviennent DÉRIVÉES.** Vingt fichiers les
 * lisent — la fiche de chantier, l'export d'agenda, le classement des terminés,
 * la fenêtre d'occupation. Les laisser diverger des créneaux, ce serait deux
 * vérités sur la même question (`CLAUDE.md` §3) ; une seule fonction les
 * recalcule donc, et c'est celle-ci.
 *
 * **Le premier créneau dans l'ordre du temps**, matin avant après-midi : c'est
 * ce que `datePlanifiee` a toujours voulu dire, « le jour où ça commence ».
 *
 * Plus aucun créneau : le chantier n'est plus posé. `jour` rend `null`, et
 * `chantier-etat.ts` le remet aussitôt dans « à planifier » — sans quoi il
 * resterait planifié un jour où il n'occupe rien.
 */
export function resumeDesCreneaux(poses: readonly Creneau[]): {
  jour: JourIso | null;
  moment: Moment | null;
  nombre: number;
} {
  if (poses.length === 0) return { jour: null, moment: null, nombre: 0 };
  const ordre = [...poses].sort(comparerCreneaux);
  return { jour: ordre[0].jour, moment: ordre[0].moment, nombre: ordre.length };
}

/** Le temps qui passe : le jour d'abord, puis le matin avant l'après-midi. */
export function comparerCreneaux(a: Creneau, b: Creneau): number {
  if (a.jour !== b.jour) return a.jour < b.jour ? -1 : 1;
  if (a.moment === b.moment) return 0;
  return a.moment === "matin" ? -1 : 1;
}

/**
 * RETIRER UNE DEMI-JOURNÉE, et rendre ce qui reste.
 *
 * **On part de ce qui est réellement occupé**, repli compris : libérer le
 * vendredi matin d'un chantier qui n'a encore aucune ligne doit écrire les
 * trois autres demi-journées, sinon le chantier perdrait tout ce que ses
 * colonnes disaient.
 */
export function sansLaDemi(
  chantier: ChantierPose,
  poses: readonly Creneau[],
  cible: Creneau
): Creneau[] {
  const clef = cleDuCreneau(cible);
  return creneauxOccupes(chantier, poses).filter((c) => cleDuCreneau(c) !== clef);
}

/**
 * AJOUTER UNE DEMI-JOURNÉE là où il la repose.
 *
 * **Deux fois la même n'ajoute rien** : un double appui ou un onglet resté
 * ouvert ferait occuper deux places avec une seule demi-journée, et le
 * calendrier compterait une charge que personne ne fait.
 */
export function avecLaDemi(
  chantier: ChantierPose,
  poses: readonly Creneau[],
  cible: Creneau
): Creneau[] {
  const actuels = creneauxOccupes(chantier, poses);
  const clef = cleDuCreneau(cible);
  if (actuels.some((c) => cleDuCreneau(c) === clef)) return actuels;
  return [...actuels, cible].sort(comparerCreneaux);
}
