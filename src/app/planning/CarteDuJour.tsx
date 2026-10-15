"use client";

import { Fragment } from "react";
import { jourIso } from "@/lib/jour";
import { colors, font, voile } from "@/lib/design-tokens";
import type { Creneau, JourIso } from "@/lib/disponibilites";
import type { ChantierPourAbsence } from "@/lib/equipe-absente";
import { jourLisibleCourt } from "@/lib/mois";
import {
  blocsDeLaJournee,
  rangDeLaFiche,
  ditLeCompteDemi,
  ditQuiPart,
  etatDemi,
  MOT_DEMI,
  type Demi,
} from "@/lib/planning-jour";
import { ceQueLeJourPorte, momentsOfferts, type MomentDArrivee } from "@/lib/creneaux-chantier";
import { equipesDuJour } from "@/lib/equipes-par-jour";
import type { AbsenceDuPlanning, ChantierPlanning, GestesCarte } from "./types-du-planning";
import { ditCeQuIlOccupe } from "./outils-du-planning";
import {
  Choisir,
  LieuDuChantier,
  MotAChoisir,
  MotEnOr,
  PasEncoreSigne,
  Pastille,
  PastilleEquipe,
  RetourAEnvoyer,
} from "./ElementsDuPlanning";
import { PasLaCeJour } from "./PasLaCeJour";
import { AjoutAuJour } from "./AjoutAuJour";
import { FeuilleChantier } from "./FeuilleChantier";

/**
 * UNE MOITIÉ DE JOURNÉE QUE PERSONNE N'OCCUPE.
 *
 * **Écrite une fois, dessinée à deux endroits** : seule, quand plus aucun
 * chantier ne la suit ; sous le nom d'un chantier, quand elle le précède dans
 * la journée (`libresAvant`). Deux copies de cette ligne auraient divergé au
 * premier changement de pastille (`CLAUDE.md` §3).
 */
function LigneLibre({
  demi,
  occupation,
  marge = 16,
  onPoser,
}: {
  demi: Demi;
  occupation: { pris: readonly ChantierPlanning[]; charge: number };
  marge?: number;
  /**
   * OÙ REPOSER LE MORCEAU qu'il tient au doigt — absent le reste du temps.
   *
   * **Le geste ne s'offre que quand il tient quelque chose** : un « Poser ici »
   * qui vivrait sur chaque demi-journée libre ferait un bouton par ligne pour
   * un geste qu'il fait deux fois par mois.
   */
  onPoser?: () => void;
}) {
  return (
    <div
      data-atlas="demi"
      data-bloc={demi}
      data-sans-chantier="1"
      className="flex flex-wrap items-center gap-2"
      style={{ marginTop: marge }}
    >
      <Pastille etat={etatDemi(occupation)} />
      <span
        className="w-[70px] flex-shrink-0 whitespace-nowrap text-[10px] font-semibold uppercase leading-[1.15]"
        style={{ letterSpacing: "0.06em", color: colors.ink }}
      >
        {MOT_DEMI[demi]}
      </span>
      <span data-atlas="compte" className="ml-auto text-[12px]" style={{ color: colors.muted }}>
        {ditLeCompteDemi(occupation)}
      </span>
      {onPoser && (
        <button
          type="button"
          data-atlas="poser-le-morceau"
          onClick={onPoser}
          className="min-h-[44px] rounded-full px-3.5 text-[12.5px]"
          style={{ color: colors.or, boxShadow: `inset 0 0 0 1px ${colors.or}` }}
        >
          Poser ici
        </button>
      )}
    </div>
  );
}

/**
 * L'INTERRUPTEUR À DEUX POSITIONS DE « DÉPLACER ».
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sa demande du 10 septembre 2026**, après avoir essayé la planche
 * `appli/deplacer-plus-simple.html` : *« fais celui-là, juste tu retires la
 * journée. Il faut garder le bouton déplacer ; lorsque l'on clique dessus on
 * arrive sur ce bouton matin - aprem, on clique sur l'un ou l'autre et le
 * bouton disparaît, la sélection s'est faite et le bouton déplacer
 * réapparaît. »*
 *
 * **Pourquoi un interrupteur et non trois pastilles** — sa remarque de la
 * veille : *« j'ai l'impression que c'est inversé »*. Trois pastilles rondes
 * dont une est allumée ne disent pas si l'allumée est là où le chantier EST ou
 * là où il IRA. Un interrupteur, lui, ne se lit que dans un sens : la position
 * tenue est l'état courant.
 *
 * **Et « Journée » n'est plus une position**, parce que ce n'en était pas une :
 * elle ne décrivait pas un départ mais une étendue, et la choisir réécrivait la
 * durée du chantier (`deplacerChantier`).
 * ───────────────────────────────────────────────────────────────────────────
 */
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DÉPLACER : LE JOUR, PUIS LE MOMENT — sa demande du 17 septembre 2026
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * *« Lorsque je clique sur déplacer ça me fait apparaître le planning et je
 * sélectionne un jour et le matin ou l'aprem ou journée pour réellement
 * déplacer mon client, parce que là c'est trop de clics à faire. »* Puis,
 * devant `appli/deplacer-sur-le-calendrier.html` : *« je choisis la deux, le
 * planning au-dessus, et la A : on déplace que la demi-journée du jour
 * sélectionné »*.
 *
 * **Sept appuis sont devenus trois.** Avant : Déplacer, la moitié à rendre,
 * ouvrir le tiroir, toucher le morceau, refermer, ouvrir le jour d'accueil,
 * Poser ici. Maintenant : Déplacer, le jour, le moment.
 *
 * **Il vit DANS LA FICHE, et nulle part ailleurs** — la planche le montrait
 * ainsi, et c'est enfin tenable depuis le 17 septembre 2026 : pendant le
 * geste, le mois passe entier au-dessus et la fiche descend dessous
 * (`voletDetache`). Elle ne disparaît donc plus quand il tourne le mois pour
 * atteindre son jour d'accueil, et le repli qu'il avait fallu écrire sous le
 * calendrier pour ce seul cas est parti avec.
 *
 * **Les mots sont en gras, sans contour** — sa règle du 17 septembre : une
 * pastille à contour a la forme des pastilles d'équipe, qui ouvrent une liste ;
 * ici ce sont des gestes.
 */
function BandeauDeplacement({
  chantier,
  jourSource,
  vers,
  onChoisir,
  onAnnuler,
}: {
  chantier: ChantierPlanning | undefined;
  jourSource: JourIso;
  /** Le jour d'accueil touché, ou `null` tant qu'il n'a pas choisi. */
  vers: JourIso | null;
  /**
   * **IL N'Y A PLUS QU'UNE PLACE — 17 septembre 2026.**
   *
   * Ce bloc était monté à deux endroits : dans la fiche du jour, et en repli
   * sous le calendrier. Le second n'existait que parce que la fiche vivait
   * DANS la semaine du jour ouvert et disparaissait au premier mois tourné —
   * or tourner le mois est exactement ce qu'il fait pour atteindre son jour.
   *
   * Depuis que le mois passe entier au-dessus pendant le geste (`voletDetache`
   * de `MoisCharge`), la fiche survit au mois tourné : le repli est devenu du
   * code mort, et il est parti avec sa prop (`CLAUDE.md` §4 quinquies). Une
   * seule place, une seule phrase — et le nom du chantier n'a plus à être
   * redit, puisqu'il est toujours en titre trois lignes plus haut.
   */
  onChoisir: (moment: MomentDArrivee) => void;
  onAnnuler: () => void;
}) {
  if (!chantier) return null;
  // **Ce qui part commande ce qui peut arriver**, et la règle est dans `lib` :
  // une demi-journée ne devient pas une journée, une journée ne tient pas sur
  // une demi-journée. L'écran ne fait que montrer ce qu'elle autorise.
  const partants = ceQueLeJourPorte(
    {
      jour: chantier.datePlanifiee as JourIso | null,
      moment: chantier.creneauDebut,
      dureeDemiJournees: chantier.dureeDemiJournees,
    },
    (chantier.creneaux ?? []) as readonly Creneau[],
    jourSource
  );
  const moments = momentsOfferts(partants.length);

  return (
    <div data-atlas="deplacement-en-cours" data-vers={vers ?? undefined} className="mt-2.5">
      {vers ? (
        <>
          <span className="block text-[12.5px]" style={{ color: colors.or }}>
            {`${jourLisibleCourt(vers).toLowerCase()}. Quel moment ?`}
          </span>
          <div className="mt-1 flex flex-wrap items-center gap-x-[18px] gap-y-1">
            {moments.map((m) => (
              <MotDuGeste key={m} data-atlas={`vers-${m}`} onClick={() => onChoisir(m)}>
                {MOT_ARRIVEE[m]}
              </MotDuGeste>
            ))}
            <MotDuGeste data-atlas="annuler-deplacer" onClick={onAnnuler}>
              Annuler
            </MotDuGeste>
          </div>
        </>
      ) : (
        /* ─── « ANNULER » SUR LA LIGNE DE LA CONSIGNE ────────────────────
           **Sa retouche du 17 septembre 2026 :** *« le Annuler tu le mets en
           noir gras à droite de "touchez le jour au-dessus", genre 2 cm sur sa
           droite »*. Il était gris pâle, sur la ligne du dessous : on le
           cherchait. Il prend l'encre des deux gestes qu'il remplace le temps
           du déplacement.

           **2 cm RÉELS, et c'est pourquoi ce n'est pas `2cm`** : l'unité `cm`
           d'une feuille de style vaut 96 dpi nominaux, soit 1,25 cm sous la
           règle sur son téléphone. Son écran fait ~61 px par centimètre.

           **L'écart se COMPRIME plutôt que de pousser le bouton dehors.**
           Mesuré sur 320 px de large : à 122 px fixes, « Annuler » finissait
           pile sur le bord, zéro marge — un nom plus long et il sortait.

           **La ligne ne vaut que pour le choix du JOUR** : au moment suivant,
           trois mots s'ajoutent et ne tiennent pas à côté de la phrase. */
        <div className="flex items-baseline">
          {/* La phrase ne se coupe PAS : elle est ce qu'il lit, et l'écart est
              ce qui doit céder. Sans cela elle rendait « Touchez le jour au- /
              dessus » sur deux lignes — vu à l'écran, jamais par un test. */}
          <span className="whitespace-nowrap text-[12.5px]" style={{ color: colors.or }}>
            Touchez le jour au-dessus
          </span>
          <span aria-hidden className="min-w-[18px] flex-[0_1_122px]" />
          <MotDuGeste data-atlas="annuler-deplacer" onClick={onAnnuler}>
            Annuler
          </MotDuGeste>
        </div>
      )}
    </div>
  );
}

/** Les trois mots d'arrivée, écrits une fois. */
const MOT_ARRIVEE: Record<MomentDArrivee, string> = {
  matin: "Matin",
  apres_midi: "Après-midi",
  journee: "Journée",
};

/**
 * UN MOT QUI FAIT UN GESTE — en gras, sans contour.
 *
 * **Sa règle du 17 septembre 2026** : *« mets des mots en gras plutôt que des
 * boutons »*. Une pastille à contour a exactement la forme des pastilles
 * d'équipe posées juste au-dessus — or celles-là ouvrent une liste, tandis que
 * celles-ci font un geste. Même forme, deux natures.
 *
 * **Il se vise quand même** : le remplissage lui donne 40 px de haut, parce
 * qu'un mot nu n'offre rien au pouce.
 */
function MotDuGeste({
  children,
  onClick,
  alerte = false,
  ...reste
}: {
  children: React.ReactNode;
  onClick: () => void;
  alerte?: boolean;
} & Record<string, unknown>) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...reste}
      className="flex-shrink-0 cursor-pointer border-0 bg-transparent px-0 py-[11px] text-[13.5px] font-bold"
      style={{ color: alerte ? colors.alert : colors.ink, WebkitTapHighlightColor: "transparent" }}
    >
      {children}
    </button>
  );
}

/**
 * LA FICHE D'UNE JOURNÉE — écrite UNE fois, branchée à deux endroits.
 *
 * Sous le calendrier quand on touche un jour, et sous une ligne des planifiés.
 * Sa demande du 21 août : *« quand je clique sur Monsieur Martins dans la
 * liste, il faut que ça m'affiche le même bandeau déroulant que lorsque je
 * clique sur un chiffre du planning du mois »*. Deux copies auraient fini par
 * proposer des gestes différents selon l'endroit où l'on touche.
 *
 * **Le chantier passe au-dessus de ses demi-journées** — la règle et son
 * pourquoi sont dans `blocsDeLaJournee`.
 */
export function CarteDuJour({
  cle,
  jour,
  seulement,
  attache,
  ecriture,
  nombreSalaries,
  ouvert,
  setOuvert,
  feuille,
  setFeuille,
  sansDate,
  nomEquipe,
  tetesDe,
  lignesEquipes,
  occupationDe,
  chantiersDuJour,
  basculerEquipe,
  reposer,
  morceauEnMain,
  deplacerLeJour,
  retirerDuJour,
  demanderSuppression,
  poser,
  poserUnClient,
  attenteClient,
  poserALaPlace,
  devisExpires,
  relancerLeDevisExpire,
  relireLeDevisExpire,
  morceaux,
  onPrendreMorceau,
  refus,
  taches,
  travauxChanges,
  absencesDuJour,
  cocheRefuseeDe,
  joursDeLaPastilleDe,
  fermerLeJour,
  rouvrirLeJour,
  retourAEnvoyer,
}: {
  cle: string;
  jour: JourIso;
  /** Qui n'est pas là ce jour-là — voir §267. */
  absencesDuJour: (jour: JourIso) => AbsenceDuPlanning[];
  /** Peut-on la cocher sur cette demi-journée — voir §293, et le 28 septembre. */
  cocheRefuseeDe: (rang: number, c: ChantierPourAbsence, demi: "matin" | "apres_midi") => boolean;
  /** Ce que la pastille écrit sous le nom — « ven. », ou rien. Voir §295. */
  joursDeLaPastilleDe: (
    rang: number,
    c: ChantierPourAbsence,
    demi?: "matin" | "apres_midi"
  ) => string;
  fermerLeJour: (jour: JourIso, rang: number, quand?: "matin" | "apres_midi" | null) => void;
  rouvrirLeJour: (id: string) => void;
  /**
   * Le chantier SEUL qu'on déplie, quand la carte sort d'une ligne des
   * planifiés.
   *
   * **Sa correction du 22 août 2026 :** *« quand je clique sur le nom du
   * chantier, il y a une répétition qui se crée : il y a marqué deux fois la
   * date, deux fois le nom. Or sur le premier nom, il faudrait qu'on clique et
   * que ça se transforme en le menu déroulant qu'on a juste en dessous. »*
   *
   * La ligne des planifiés porte déjà le jour, le nom, la durée et l'équipe :
   * les redire dessous, c'est écrire deux fois la même chose à deux centimètres
   * d'écart. La carte ne garde alors que ce que la ligne ne dit pas — les
   * demi-journées, ce qui reste libre, et la feuille.
   *
   * Absent sous le calendrier : là, la carte EST le titre du jour, et elle
   * porte tous les chantiers.
   */
  seulement?: string;
  /**
   * OÙ LA FICHE SE RATTACHE — et `undefined` quand elle ne se rattache à rien.
   *
   * **Sa correction du 4 septembre 2026 :** *« lorsque je clique sur un jour,
   * le client doit être rattaché ; or là, il est juste en dessous. Pareil
   * lorsque je clique directement sur le nom de mon client. »*
   *
   * `colonne` est la position HORIZONTALE de la pointe : le centre de la case
   * touchée dans le mois, le début du nom dans la liste des planifiés. Le
   * calendrier la calcule — lui seul connaît la colonne — et la fiche la
   * dessine, parce qu'elle se rattache aussi là où le calendrier n'existe pas.
   *
   * **Rattachée, elle prend aussi son relief** : fond de plage, filet et une
   * ombre portée. Son fond n'est qu'à 4 % du fond de page — sans relief, on ne
   * la distinguerait pas de ce qu'elle interrompt.
   *
   * **Rien d'autre ne diffère**, et c'est le but : deux cartes qui se seraient
   * mises à proposer des gestes différents selon l'endroit où l'on touche sont
   * exactement ce que sa demande du 21 août 2026 interdit.
   */
  attache?: { colonne: string };
} & GestesCarte) {
  const feuilleIci = feuille && feuille.cle === cle ? feuille.chantierId : null;

  // **LE WEEK-END EST UNE JOURNÉE COMME UNE AUTRE.**
  //
  // *Sa règle du 23 août 2026 :* « le samedi et le dimanche, l'utilisateur doit
  // pouvoir le proposer ; s'il a des salariés qui font des extras, il doit
  // pouvoir sélectionner ces deux jours ».
  //
  // La fiche répondait « Jamais proposé. » et n'offrait aucun geste : un
  // cul-de-sac, sur un jour où il travaille pour de bon. Le serveur, lui, ne
  // l'a jamais refusé — `jourRetenable` accepte le samedi depuis toujours, et
  // c'est écrit noir sur blanc dans `disponibilites.ts`. C'était donc l'ÉCRAN
  // qui interdisait ce que la règle permettait.
  //
  // **Ce qui ne change pas :** le week-end n'est toujours pas SUGGÉRÉ parmi les
  // six premiers jours (`premiersJoursLibres`). Pouvoir le choisir n'est pas se
  // le voir proposer d'office — proposer un dimanche à un particulier n'est
  // presque jamais ce qu'il veut.

  const duJour = chantiersDuJour(jour);
  const occupe = (c: ChantierPlanning, demi: Demi) =>
    occupationDe(jour, demi).pris.some((x) => x.id === c.id);

  // **Le chantier déplié, et ce qui reste libre — dans cet ordre.** Sa
  // correction du 22 août 2026 : *« l'après-midi de libre passe sous la feuille
  // de chantier, or il doit rester en dessous du matin même s'il est libre ;
  // ça ne change rien »*. La demi-journée vide appartient à la journée, pas au
  // chantier : elle se rangeait donc après lui, c'est-à-dire après sa feuille,
  // à trois écrans du matin qu'elle complète.
  //
  // Les autres chantiers du jour, eux, s'effacent : la ligne des planifiés leur
  // en donne une à chacun, et les redire ici les écrirait deux fois.
  const blocs = blocsDeLaJournee(duJour, occupe).filter(
    (b) => !seulement || b.type === "libre" || b.chantier.id === seulement
  );
  // Le dernier chantier du jour, et les moitiés libres qui le suivent : elles
  // se dessinent dans son bloc, au-dessus de « Déplacer  Retirer » (sa
  // consigne du 18 septembre 2026). `blocsDeLaJournee` ne pose des blocs
  // « libre » qu'en queue, donc tout ce qui suit le dernier chantier est libre.
  const dernierChantier = blocs.reduce((r, b, i) => (b.type === "chantier" ? i : r), -1);
  const libresApres = blocs
    .slice(dernierChantier + 1)
    .flatMap((b) => (b.type === "libre" ? [b.demi] : []));

  /**
   * OÙ REPOSER LE MORCEAU — la règle, pour TOUTE moitié libre de ce jour.
   *
   * **Sa seconde capture du 16 septembre 2026 :** *« je l'ai enlevée puis j'ai
   * essayé de la remettre au même endroit, ça a bugué »* — le matin rendu,
   * l'après-midi gardé par le chantier, et rien à toucher sur le matin.
   *
   * `LigneLibre` est écrite une fois et montée à DEUX endroits : en queue de
   * journée, et sous le nom du chantier qu'elle précède (`libresAvant`, sa
   * précision du 10 septembre). Seul le premier recevait le geste — donc la
   * moitié rendue, qui tombe dans le second dès que le chantier garde l'autre
   * moitié, ne se reposait jamais là. Deux montages d'une même ligne dont un
   * seul porte le geste, c'est la divergence que `CLAUDE.md` §3 interdit : la
   * condition vit désormais ICI, une fois, et les deux la reçoivent.
   */
  const poserIci = (demi: Demi) =>
    ecriture && morceauEnMain ? () => reposer(morceauEnMain, jour, demi) : undefined;

  // ─── LA FICHE SE COLLE SOUS SON CHANTIER — sa correction du 10 septembre
  // 2026. La règle, et ce qu'elle concilie, vivent dans `rangDeLaFiche` : elle
  // s'éprouve sans navigateur, là où le défaut, lui, ne se voyait qu'à deux
  // chantiers dans la même journée.
  const apresLaFiche = rangDeLaFiche(blocs, feuilleIci);
  const laFiche = feuilleIci ? (
    <FeuilleChantier
      key={feuilleIci}
      chantier={duJour.find((c) => c.id === feuilleIci) ?? null}
      feuille={taches[feuilleIci]}
      ecriture={ecriture}
      travauxChanges={(liste) => travauxChanges(feuilleIci, liste)}
    />
  ) : null;

  return (
    <>
      {/* ─── ELLE SE RATTACHE À CE QU'IL A TOUCHÉ ───────────────────────────
          **Sa correction du 4 septembre 2026 :** *« lorsque je clique sur un
          jour, le client doit être rattaché ; or là, il est juste en dessous.
          Pareil lorsque je clique directement sur le nom de mon client. »*

          **UNE seule pointe dans le code, deux endroits où elle se pose** : la
          case du mois lui donne sa colonne, la ligne des planifiés la met sous
          le nom. Deux dessins de la même attache auraient divergé au premier
          ajustement (`CLAUDE.md` §3).

          La géométrie est celle de la maquette qu'il a validée : un carré de
          10 px tourné à 45°, dont la pointe DÉPASSE de six pixels au-dessus de
          la fiche. Elle existait déjà et ne se voyait pas — mesurée sur
          l'application, elle commençait **un pixel sous** le bord haut, donc
          entièrement posée dessus et de la même couleur. */}
      <div className={attache ? "relative" : undefined}>
        {attache && (
          <span
            aria-hidden="true"
            data-atlas="encoche"
            className="absolute z-[2] h-[10px] w-[10px]"
            style={{
              bottom: "100%",
              left: attache.colonne,
              // `bottom: 100%` colle la pointe au bord haut de la fiche quelle
              // que soit sa marge — la seule ancre qui ne se décale pas quand
              // l'écart change. Les 8 px la font mordre dessus, pour qu'aucun
              // filet ne l'en sépare.
              transform: "translate(-50%, 8px) rotate(45deg)",
              background: colors.card,
              borderLeft: `1px solid ${colors.lineSoft}`,
              borderTop: `1px solid ${colors.lineSoft}`,
            }}
          />
        )}
      <div
        data-atlas="carte-jour"
        data-jour={jour}
        className={
          attache
            ? "mt-[9px] rounded-[14px] px-[15px] py-[14px]"
            : "mx-[18px] mt-4 rounded-[10px] px-[15px] py-[14px]"
        }
        style={
          attache
            ? {
                background: colors.card,
                // Un décalage ET un flou : un halo sans décalage n'est pas une
                // ombre, c'est un contour de plus.
                boxShadow: `0 6px 20px ${voile(colors.ink, 0.07)}`,
                border: `1px solid ${colors.lineSoft}`,
              }
            : { background: colors.card }
        }
      >
        {/* **« Aujourd'hui », en or, au-dessus de la date** — sa planche du
            14 octobre 2026 (`appli/fiche-du-jour-en-mieux.html`). C'est sa règle
            du 9 septembre pour la liste du bas ; la fiche du jour, elle, ne
            disait que la date. La date reste : « Aujourd'hui » s'ajoute. */}
        {!seulement && jour === jourIso(new Date()) && (
          <p
            data-atlas="aujourdhui-fiche"
            className="mb-2 text-center text-[11px] font-semibold uppercase leading-none"
            style={{ letterSpacing: "0.2em", color: colors.or }}
          >
            Aujourd’hui
          </p>
        )}
        {!seulement && (
          <p
            className="mb-3.5 text-center text-[12.5px] font-bold uppercase leading-none"
            style={{ letterSpacing: "0.14em", color: colors.ink }}
          >
            {jourLisibleCourt(jour)}
          </p>
        )}

        {/* ─── « JE NE SUIS PAS LÀ » — sa demande du 6 septembre 2026 ────────

            **IL ÉTAIT EN BAS DE LA CARTE, ET C'EST LA CAPTURE QUI L'A
            DÉPLACÉ.** Le raisonnement tenait : c'est le geste le moins fréquent
            des trois, et le mettre en tête ferait lire « pas là » avant de lire
            ce qui est posé.

            Sur l'écran, il tombait **derrière le tiroir du bas** — `fixed`, à
            `--atlas-barre`, z-19 — et les noms des salariés étaient coupés en
            deux. Un geste qu'on ne peut pas viser ne vaut pas son rang dans une
            liste de priorités.

            **Et l'on n'a PAS ajouté de défilement forcé pour le rattraper** :
            le dépôt en a retiré un le 3 septembre, précisément parce qu'il
            soignait le symptôme et non la place. La carte naît sous le doigt,
            donc son HAUT est visible par construction — c'est là que le geste
            va. */}
        {/* ─── CE QUI N'A PAS PU PARTIR — 11 septembre 2026 ────────────────
            Sa panne : *« il ne se pose sur aucune demi-journée ! »*. Le geste
            partait dans le vide — sa page avait survécu à son serveur — et
            l'écran ne disait rien. Un appui qui n'a aucun effet et aucun
            message se lit comme une application cassée, et il n'a alors aucun
            moyen de savoir qu'un rechargement répare tout. */}
        {refus && (
          /* **Une phrase, pas un bouton.** Elle n'a rien à faire faire : le
             geste suivant l'efface de lui-même (`setRefus(null)` en tête de
             chaque). Un bouton qui ne sert qu'à effacer un message demande un
             appui de plus pour rien — et il porterait un rayon carré, que sa
             règle du 12 août interdit. */
          <p
            data-atlas="refus-du-geste"
            className="mb-2 mt-1 rounded-[9px] px-3 py-2.5 text-[13px]"
            style={{ background: voile(colors.bordeaux, 0.1), color: colors.bordeaux }}
          >
            {refus}
          </p>
        )}

        {ecriture && !seulement && (
          <PasLaCeJour
            jour={jour}
            absences={absencesDuJour(jour)}
            lignesEquipes={lignesEquipes}
            nombreSalaries={nombreSalaries}
            nomEquipe={nomEquipe}
            fermer={fermerLeJour}
            rouvrir={rouvrirLeJour}
          />
        )}

        {blocs.map((bloc, rang) => {
          // La fiche se glisse ICI quand c'est le rang qu'on a calculé — un
          // seul endroit dans l'arbre, donc une seule règle de placement.
          const suite = rang === apresLaFiche ? laFiche : null;

          if (bloc.type === "libre") {
            // **Les moitiés libres qui SUIVENT le dernier chantier se dessinent
            // dans son bloc**, au-dessus de « Déplacer  Retirer » — voir
            // `libresApres`. Ici il ne reste que la fiche à poser à son rang.
            if (rang > dernierChantier && dernierChantier >= 0) return <Fragment key={`libre-${bloc.demi}`}>{suite}</Fragment>;
            return (
              <Fragment key={`libre-${bloc.demi}`}>
                <LigneLibre
                  demi={bloc.demi}
                  occupation={occupationDe(jour, bloc.demi)}
                  marge={rang === 0 ? 8 : 16}
                  onPoser={poserIci(bloc.demi)}
                />
                {suite}
              </Fragment>
            );
          }

          const c = bloc.chantier;
          // **Au CHANTIER, plus à la demi-journée.** « Déplacer » écrit un
          // départ et une durée sur le chantier entier : le rattacher à une
          // moitié de journée n'avait de sens que tant que le bouton vivait sur
          // sa ligne, et il en ouvrait alors deux à la fois.
          // **Les DEUX temps du geste**, pas seulement le premier : sans le
          // second, « Déplacer » et « Retirer » revenaient dès qu'il avait
          // touché son jour d'accueil — deux gestes offerts pendant qu'un
          // troisième attend sa réponse. Vu à l'écran, jamais par un test.
          const choixDeplacer =
            (ouvert?.quoi === "deplacer" || ouvert?.quoi === "deplacer-quand") &&
            ouvert.cle === cle &&
            ouvert.chantierId === c.id;

          return (
            <Fragment key={c.id}>
            <div
              data-atlas="bloc-chantier"
              data-chantier={c.id}
              style={{ marginTop: rang === 0 ? 0 : 16 }}
            >
              {/* **Le compte « 1 chantier · complet » a disparu.** Sa
                  demande du 22 août : *« supprime-moi la notion "un chantier"
                  en gris ; on n'a pas besoin d'avoir cette information-là »*.
                  Ce que la journée porte se voit déjà aux pastilles de chaque
                  demi-journée, et au calendrier juste au-dessus. */}
              {!seulement && (
                <button
                  type="button"
                  data-atlas="nom-du-jour"
                  onClick={() =>
                    setFeuille(feuilleIci === c.id ? null : { chantierId: c.id, cle })
                  }
                  aria-expanded={feuilleIci === c.id}
                  className="flex w-full cursor-pointer items-start gap-2.5 border-0 bg-transparent p-0 text-left"
                >
                  <span className="min-w-0 flex-1">
                  <span
                    className="block"
                    style={{
                      fontFamily: font.display,
                      fontSize: 19,
                      lineHeight: 1.2,
                      color: colors.ink,
                    }}
                  >
                    {c.nom}
                  </span>
                  {/* **La durée, ici aussi.** Elle était sur la ligne des
                      planifiés et nulle part dans la fiche du jour : en ouvrant
                      une journée depuis le calendrier, on ne savait pas si le
                      chantier tenait la demi-journée ou trois jours. Même
                      fonction, même or, même place que sur la ligne — deux
                      écritures pour une seule durée finiraient par diverger. */}
                  <span
                    data-atlas="duree-du-jour"
                    className="mt-[3px] block text-[12.5px]"
                    style={{ color: colors.or }}
                  >
                    {ditCeQuIlOccupe(c)}
                  </span>
                  <PasEncoreSigne chantier={c} />
                  <LieuDuChantier chantier={c} />
                  {retourAEnvoyer(c.id, jour) && <RetourAEnvoyer />}
                  </span>
                  {/* **LE CHEVRON DIT QUE LA FICHE S'OUVRE** — sa réponse du
                      3 octobre 2026, « la C » : *« le fait de cliquer pour
                      faire apparaître la fiche chantier n'est pas intuitif »*.
                      Il pivote quand elle est ouverte : un sens, pas une
                      décoration. */}
                  <span
                    data-atlas="chevron-fiche"
                    aria-hidden="true"
                    className="mt-[-2px] grid h-10 w-10 flex-none place-items-center rounded-full"
                    style={{
                      color: colors.or,
                      background: voile(colors.or, 0.1),
                      transform: feuilleIci === c.id ? "rotate(180deg)" : undefined,
                      transition: "transform 0.28s cubic-bezier(.2,.7,.2,1)",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                      <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>
              )}

              {/* **LES MOITIÉS LIBRES QUI PRÉCÈDENT, SOUS SON NOM.** Sa
                  précision du 10 septembre 2026 : *« le nom doit rester en
                  premier, ensuite matin et ensuite aprèm »*. Émises comme des
                  blocs à part, elles ouvraient la fiche sur « libre » — on
                  lisait ce qui manque avant de savoir de qui il s'agit. Ici,
                  l'ordre du jour est tenu ET le nom reste en tête. */}
              {bloc.libresAvant.map((demi) => (
                <LigneLibre
                  key={`avant-${demi}`}
                  demi={demi}
                  occupation={occupationDe(jour, demi)}
                  onPoser={poserIci(demi)}
                />
              ))}

              {bloc.demis.map((demi) => {
                const o = occupationDe(jour, demi);
                // **Ceux de CE jour** (migration 0093) : la coche peut ne valoir
                // qu'à partir du 4e jour, et la carte montre un seul jour.
                const rangs = equipesDuJour(c.equipes, jour)[demi];
                // **Qui part VRAIMENT ce jour-là** — un congé se déduit, il ne
                // s'écrit pas (sa proposition C du 8 septembre 2026). Un absent
                // nommé sur la journée où il ne vient pas, c'est le défaut qu'il
                // a photographié le 7.
                const rangsPresents = rangs.filter(
                  (r) => !absencesDuJour(jour).some((a) => a.rang === r)
                );
                const choixEquipe =
                  ouvert?.quoi === "equipe" &&
                  ouvert.cle === cle &&
                  ouvert.chantierId === c.id &&
                  ouvert.demi === demi;

                return (
                  <div
                    key={demi}
                    data-atlas="demi"
                    data-bloc={demi}
                    className="mt-2 flex flex-wrap items-center gap-2"
                  >
                    <Pastille etat={etatDemi(o)} />
                    <span
                      className="w-[70px] flex-shrink-0 whitespace-nowrap text-[10px] font-semibold uppercase leading-[1.15]"
                      style={{ letterSpacing: "0.06em", color: colors.ink }}
                    >
                      {MOT_DEMI[demi]}
                    </span>

                    {/* ─── QUI PART VRAIMENT CE JOUR-LÀ — sa proposition C ──
                        La coche vaut pour tout le chantier ; la carte, elle,
                        montre UN jour. Écrire « Julien » sur le jeudi où il est
                        en congé, c'est le défaut qu'il a photographié le
                        7 septembre — deux vérités à trois centimètres, ici
                        entre la ligne « Julien n'est pas là » du haut et la
                        pastille du chantier juste en dessous. */}
                    {nombreSalaries <= 0 ? null : !ecriture ? (
                      // Un salarié LIT qui part. La règle vit dans la pastille
                      // elle-même, pas recopiée ici (`CLAUDE.md` §3).
                      <PastilleEquipe
                        ecriture={false}
                        vide={rangs.length === 0}
                        onClick={() => undefined}
                        libelle={ditQuiPart(rangsPresents.map(nomEquipe))}
                        tetes={tetesDe(rangsPresents)}
                      />
                    ) : choixEquipe ? (
                      // **On COCHE, on ne choisit pas une seule fois.** La liste
                      // reste ouverte tant qu'il n'a pas fini, et le calendrier
                      // se repeint derrière à chaque coche — sinon il faudrait
                      // refermer pour voir l'effet, et rouvrir pour corriger.
                      <Choisir mots>
                        {lignesEquipes.map((e) => {
                          const cochee = rangs.includes(e.rang);
                          // **Elle n'est pas là sur au moins un jour de CE
                          // chantier** — son signalement du 7 septembre 2026.
                          // La règle vit dans `equipe-absente.ts`, et le serveur
                          // applique la même : l'écran ne fait que la montrer.
                          // **Absente PARTOUT** : la coche n'annoncerait
                          // personne, et le serveur la refuse. Absente sur
                          // certains jours seulement : elle reste cochable, et
                          // la pastille dit lesquels (sa proposition C).
                          // **La demi-journée compte** : sur la ligne du
                          // matin, un congé qui ne prend que l'après-midi ne
                          // retire pas le jour. Sans elle, la pastille
                          // annoncerait un jour de moins que la vérité.
                          const jours = joursDeLaPastilleDe(e.rang, c, demi);
                          // **La règle du serveur, et elle seule** (28 septembre
                          // 2026) : l'écran la recalculait sur la JOURNÉE et
                          // grisait Julien l'après-midi d'un matin d'absence.
                          const absente = cocheRefuseeDe(e.rang, c, demi);
                          // **Des mots, plus des pastilles — sa planche du
                          // 18 septembre 2026.** Le prénom retenu passe en
                          // noir, souligné d'or ; les autres restent en or. La
                          // coche partielle (sa proposition C) se lit aux jours
                          // écrits à côté du prénom, comme avant.
                          return (
                            <MotAChoisir
                              key={e.rang}
                              data-choix={e.rang}
                              retenu={cochee}
                              absente={absente}
                              onClick={() => basculerEquipe(c.id, jour, demi, e.rang)}
                            >
                              {nomEquipe(e.rang)}
                              {/* **Les jours de PRÉSENCE, pas d'absence** —
                                  « ven. » répond à « quand vient-il », là où
                                  « pas jeudi » oblige à soustraire de tête. */}
                              {jours && (
                                <span className="ml-1 text-[12.5px]" style={{ color: colors.muted }}>
                                  {jours}
                                </span>
                              )}
                            </MotAChoisir>
                          );
                        })}
                        {/* « Fermer », en gris, à droite : une sortie, pas un
                            geste. Il garde le repère `data-fini` des suites. */}
                        <span className="ml-auto">
                          <MotEnOr doux data-fini="1" onClick={() => setOuvert(null)}>
                            Fermer
                          </MotEnOr>
                        </span>
                      </Choisir>
                    ) : (
                      <PastilleEquipe
                        vide={rangs.length === 0}
                        libelle={ditQuiPart(rangsPresents.map(nomEquipe))}
                        tetes={tetesDe(rangsPresents)}
                        onClick={() =>
                          setOuvert({ quoi: "equipe", cle, chantierId: c.id, demi })
                        }
                      />
                    )}

                  </div>
                );
              })}

              {/* ─── LES DEUX GESTES DU CHANTIER, UNE SEULE FOIS ─────────────
                  **Ils étaient sur CHAQUE ligne de demi-journée jusqu'au
                  3 septembre 2026, et c'était deux fautes en une.**

                  La première est une redite : `deplacer` et `retirerDuJour`
                  prennent un CHANTIER, jamais une moitié de journée — la demi
                  ne servait qu'à savoir laquelle des deux lignes ouvrait la
                  liste. Un chantier à la journée affichait donc « Déplacer » et
                  « Retirer » deux fois, à quinze pixels d'écart, pour un seul
                  geste. C'est exactement ce qu'il a fait retirer ailleurs :
                  *« c'est le même chantier, pas besoin de répéter »*.

                  La seconde est une question de place. La ligne alignait
                  pastille + mot + équipe + deux boutons dans 324 px : il a fallu
                  resserrer les boutons à 9 px de marge pour que « Retirer » ne
                  bascule pas à la ligne suivante. Sortis de la ligne, ils
                  reprennent leur taille, et la demi-journée respire.

                  **Ils gardent leurs repères `deplacer` et `retirer`** : c'est
                  le même geste, à une autre place — les suites le désignent par
                  ce qu'il FAIT, pas par la ligne où il se trouvait. */}
              {/* ─── LES MOITIÉS LIBRES QUI SUIVENT, AVANT LES GESTES ─────────
                  **Sa consigne du 18 septembre 2026 au soir :** *« le Déplacer
                  Retirer doit être en bas à droite, en dessous de l'aprem, au-
                  dessus du Ajouter »*. Sur le dernier chantier du jour, la
                  moitié restée libre passe donc ICI, sous ses demi-journées,
                  et les deux mots viennent après elle. La ligne est la même
                  `LigneLibre`, avec le même geste de repose : écrite une fois. */}
              {rang === dernierChantier &&
                libresApres.map((demi) => (
                  <LigneLibre
                    key={`apres-${demi}`}
                    demi={demi}
                    occupation={occupationDe(jour, demi)}
                    marge={8}
                    onPoser={poserIci(demi)}
                  />
                ))}
              {ecriture && (
                <div
                  data-atlas="actes-chantier"
                  className="mt-2.5 flex flex-wrap items-center justify-end gap-1.5"
                >
                  {choixDeplacer ? (
                    /* ─── LE GESTE SE DESSINE ICI — sa planche du 17 sept. 2026
                       La ligne en or dit le jour touché, les mots disent le
                       moment. Le bloc est celui du repli sous le calendrier,
                       écrit une seule fois. */
                    <div className="w-full">
                      <BandeauDeplacement
                        chantier={c}
                        jourSource={ouvert.jourSource}
                        vers={ouvert.quoi === "deplacer-quand" ? ouvert.vers : null}
                        onChoisir={(moment) =>
                          ouvert.quoi === "deplacer-quand" &&
                          deplacerLeJour(c.id, ouvert.jourSource, ouvert.vers, moment)
                        }
                        onAnnuler={() => setOuvert(null)}
                      />
                    </div>
                  ) : (
                    <>
                      {/* **DES MOTS, PAS DES PASTILLES — 17 septembre 2026.**
                          *« Mets des mots en gras plutôt que des boutons pour
                          déplacer retirer. »* Une pastille à contour a
                          exactement la forme des pastilles d'équipe posées
                          juste au-dessus — or celles-là ouvrent une liste,
                          tandis que celles-ci font un geste. Même forme, deux
                          natures. Ils gardent leur place, à droite. */}
                      <MotDuGeste
                        data-atlas="deplacer"
                        onClick={() =>
                          setOuvert({
                            quoi: "deplacer",
                            cle,
                            chantierId: c.id,
                            jourSource: jour,
                          })
                        }
                      >
                        Déplacer
                      </MotDuGeste>
                      <MotDuGeste data-atlas="retirer" onClick={() => retirerDuJour(c.id)}>
                        Retirer
                      </MotDuGeste>
                      {/* **SUPPRIMER SUR LE JOUR MÊME, la B de sa planche du
                          7 octobre 2026.** Un client qui a accepté par erreur
                          demandait deux gestes : Retirer, puis le glisser dans
                          « Sans date ». Le mot vit à côté des deux autres, à
                          leur place ; en rouge parce qu'il ne se repose pas. */}
                      <MotDuGeste data-atlas="supprimer" alerte onClick={() => demanderSuppression(c)}>
                        Supprimer
                      </MotDuGeste>
                    </>
                  )}
                </div>
              )}
            </div>
            {suite}
            </Fragment>
          );
        })}

        {!seulement && ecriture && (
          <AjoutAuJour
            cle={cle}
            jour={jour}
            ouvert={ouvert}
            setOuvert={setOuvert}
            sansDate={sansDate}
            poser={poser}
            poserUnClient={poserUnClient}
            attenteClient={attenteClient}
            poserALaPlace={poserALaPlace}
            devisExpires={devisExpires}
            relancerLeDevisExpire={relancerLeDevisExpire}
            relireLeDevisExpire={relireLeDevisExpire}
            morceaux={morceaux}
            morceauEnMain={morceauEnMain}
            onPrendreMorceau={onPrendreMorceau}
          />
        )}

      </div>
      </div>
    </>
  );
}
