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

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DÉPLACER CE QUE LE JOUR PORTE — sa décision du 17 septembre 2026
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **Sa demande :** *« lorsque je clique sur déplacer ça me fait apparaître le
 * planning et je sélectionne un jour et le matin ou l'aprem ou journée pour
 * réellement déplacer mon client, parce que là c'est trop de clics à faire »*.
 * Puis, devant la planche `appli/deplacer-sur-le-calendrier.html` : *« je
 * choisis la deux, le planning au-dessus, et la A : on déplace que la
 * demi-journée du jour sélectionné »*.
 *
 * **CE QUE « LA A » VEUT DIRE, et c'est la moitié qui compte.** Mr. Julien dure
 * huit jours ; déplacer depuis le 30 septembre n'emmène QUE ce que le chantier
 * occupe LE 30. Les sept autres jours ne bougent pas — un chantier ne se
 * replie pas parce qu'on a corrigé une journée.
 *
 * **Ce qui part commande ce qui peut arriver.** Une demi-journée ne peut pas
 * devenir une journée : elle occuperait une place que le devis ne vend pas, et
 * le calendrier compterait une charge que personne ne fait. Une journée ne peut
 * pas devenir une demi-journée : l'autre moitié serait perdue sans que rien ne
 * le dise. `momentsOfferts` ne propose donc que ce qui tient, et la règle le
 * refuse à nouveau en dessous — l'écran peut changer, la règle non.
 */

/** Où le chantier ARRIVE : le moment touché sur le jour d'accueil. */
export type MomentDArrivee = Moment | "journee";

/**
 * LES MOMENTS QU'ON A LE DROIT DE LUI MONTRER, selon ce qui part.
 *
 * **Un bouton qui n'écrit rien est pire qu'un bouton absent** : il se touche,
 * il ne répond pas, et l'on croit l'application en panne. Ce qui ne peut pas
 * aboutir ne s'affiche pas.
 */
export function momentsOfferts(combienPartent: number): MomentDArrivee[] {
  if (combienPartent === 1) return ["matin", "apres_midi"];
  if (combienPartent >= 2) return ["journee"];
  return [];
}

/** Ce que le chantier occupe CE jour-là — ce qui partira, et rien d'autre. */
export function ceQueLeJourPorte(
  chantier: ChantierPose,
  poses: readonly Creneau[],
  jour: JourIso
): Creneau[] {
  return creneauxOccupes(chantier, poses)
    .filter((c) => c.jour === jour)
    .sort(comparerCreneaux);
}

/**
 * LE DÉPLACEMENT LUI-MÊME — rendu en créneaux, ou refusé AVEC SA PHRASE.
 *
 * **Un refus se rend, il ne se lève pas** : l'appelant finit dans un écran, et
 * le message d'une exception d'action serveur n'arrive jamais jusqu'au patron
 * (`AGENTS.md`). Et chaque refus porte SA phrase — un « réessayez » pour trois
 * causes envoie chercher au mauvais endroit.
 */
export function deplacerCeQueLeJourPorte(
  chantier: ChantierPose,
  poses: readonly Creneau[],
  jourSource: JourIso,
  vers: { jour: JourIso; moment: MomentDArrivee }
): { creneaux: Creneau[] } | { refus: string } {
  const occupes = creneauxOccupes(chantier, poses);
  const partants = occupes.filter((c) => c.jour === jourSource);
  if (partants.length === 0) {
    return { refus: "Ce chantier n'occupe rien ce jour-là." };
  }
  if (!momentsOfferts(partants.length).includes(vers.moment)) {
    return {
      refus:
        partants.length === 1
          ? "Une demi-journée se repose sur une demi-journée, pas sur une journée entière."
          : "Une journée entière ne tient pas sur une demi-journée : l'autre moitié serait perdue.",
    };
  }

  const arrivants: Creneau[] =
    vers.moment === "journee"
      ? [
          { jour: vers.jour, moment: "matin" } as Creneau,
          { jour: vers.jour, moment: "apres_midi" } as Creneau,
        ]
      : [{ jour: vers.jour, moment: vers.moment } as Creneau];

  const restants = occupes.filter((c) => c.jour !== jourSource);
  const dejaPris = restants.filter((c) =>
    arrivants.some((a) => cleDuCreneau(a) === cleDuCreneau(c))
  );
  // **Sans ce refus, le chantier RÉTRÉCIT en silence** : deux demi-journées
  // partent, une seule arrive parce que l'autre place était déjà la sienne, et
  // c'est le jour du chantier qu'on découvre qu'il manque une moitié.
  if (dejaPris.length > 0) {
    return { refus: "Ce chantier occupe déjà ce moment-là." };
  }

  return { creneaux: [...restants, ...arrivants].sort(comparerCreneaux) };
}
