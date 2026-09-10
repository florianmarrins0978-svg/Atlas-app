"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useAncrageDuGeste } from "@/components/atlas/useAncrageDuGeste";
import Link from "next/link";
import { getPlanificationEtat, trierParDatePlanifiee } from "@/lib/chantier-etat";
import { estAuCalendrier } from "@/lib/onglet-chantier";
import { jourIso } from "@/lib/jour";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { cheminAutorise, peutModifierLePlanning, type Role } from "@/lib/acces-roles";
import { colors, font, libelleCaps, surPlein, texteSituation, voile } from "@/lib/design-tokens";
import MoisCharge, { fondDeLEtat } from "@/components/atlas/MoisCharge";
import {
  cleCreneau,
  creneauxDuChantier,
  dureeDuChantier,
  DUREE_PAR_DEFAUT_DEMI_JOURNEES,
  type JourIso,
} from "@/lib/disponibilites";
import { fusionnerAbsences, type AbsenceEquipe } from "@/lib/absences-equipe";
import {
  joursAbsentsDuChantier,
  joursDeLaPastille,
  type ChantierPourAbsence,
} from "@/lib/equipe-absente";
import { noterAbsenceAction, retirerAbsenceAction } from "@/app/reglages/actions";

/**
 * Une absence, telle que le PLANNING en a besoin.
 *
 * `AbsenceEquipe` — ce que lit le calcul de disponibilité — ne porte que
 * l'équipe et les dates. L'écran, lui, a besoin de deux choses de plus :
 * l'`id` pour retirer la ligne d'un appui, et le `rang` pour écrire le NOM de
 * la personne au lieu d'un numéro.
 */
export type AbsenceDuPlanning = AbsenceEquipe & { id: string; rang: number };
import { communeDeLAdresse } from "@/lib/commune-adresse";
import {
  jourAbrege,
  jourLisibleCourt,
  MOIS_LONGS,
} from "@/lib/mois";
import {
  blocsDeLaJournee,
  DEMIS,
  ditLeCompteDemi,
  ditLaDuree,
  ditQuiPart,
  etatDemi,
  MOT_DEMI,
  departDuChantier,
  occupationDemi,
  type Demi,
  type EtatDemi,
} from "@/lib/planning-jour";
import { equipesMobilisees, libelleSalarie, salariesAffiches } from "@/lib/equipes";
import FinDeChantier from "./FinDeChantier";
import LigneRetirable from "@/components/atlas/LigneRetirable";
import PortesDuChantier from "./PortesDuChantier";
import TiroirDesRetires from "@/components/atlas/TiroirDesRetires";
import { useRetraits } from "@/components/atlas/useRetraits";
import { lienAppel, liensItineraire } from "@/lib/itineraire";
import type { FeuilleDuChantier } from "@/server/repositories/devis";

/**
 * La feuille d’un chantier, et si son retour a déjà été posé.
 *
 * **Les deux voyagent ensemble**, parce que le bouton de fin de chantier doit
 * être figé DÈS L’OUVERTURE de la fiche — pas seulement dans la session où
 * l’on a appuyé. Sa demande du 9 septembre 2026.
 */
type FeuilleEtRetour = FeuilleDuChantier & {
  retourPose: boolean;
  /** Ce qu’il a photographié du chantier — vu AVANT le travail, pas après. */
  photos: { id: string; storageKey: string }[];
};
import { NOTE_MAX } from "@/lib/note-chantier";
import {
  basculerEquipeAction,
  deplacerChantierAction,
  ecrireNoteChantierAction,
  deplanifierChantierAction,
  planifierChantierAction,
  supprimerChantierAction,
  tachesDuChantierAction,
} from "./actions";

/**
 * LE PLANNING — le mois, la journée qui s'ouvre dessous, la semaine en bas.
 *
 * **Cet écran suit la planche 84 trait pour trait** (`appli/planning-simple.html`).
 * Le patron l'a essayée deux soirées durant, corrigée neuf fois, puis tranché le
 * 21 août 2026 : *« maintenant tu peux coder cette version de la maquette !
 * Ne modifie rien ! Ne change rien ! Code trait pour trait cette maquette. »*
 *
 * Ce qui l'a fait naître, le 19 août : *« cette page est beaucoup trop
 * compliquée à comprendre pour les utilisateurs »*.
 *
 * ─── CE QUI GOUVERNE QUOI ────────────────────────────────────────────────
 *
 * **Le mois vise, la semaine lit.** Sa correction du 19 août : *« je veux un
 * accès au mois ; ce dont je te parlais pour la semaine, c'était pour les
 * chantiers planifiés »*. Le calendrier reste donc au mois — c'est lui qui sert
 * à poser une date lointaine — et la semaine ne gouverne que la liste du bas.
 * Les deux ne sont pas deux navigations qui se concurrencent : toucher un jour
 * du mois amène la liste sur SA semaine.
 *
 * ─── LES RÈGLES SONT AILLEURS ────────────────────────────────────────────
 *
 * Rien ne se décide ici : `src/lib/planning-jour.ts` porte les états, les
 * comptes et l'ordre des blocs, et il est éprouvé sans base ni navigateur
 * (`CLAUDE.md` §3). Cet écran affiche ce qu'il rend.
 */

type EquipesParDemi = { matin: number[]; apres_midi: number[] };

/**
 * Un chantier tel que le planning le lit — la forme rendue par
 * `listerChantiersPourPlanning`.
 *
 * **Exporté depuis le 22 août 2026** : l'écran d'envoi montre la même journée
 * (`JourneeRegardee`), et une seconde définition aurait divergé au premier
 * champ ajouté.
 */
export type ChantierPlanning = {
  id: string;
  nom: string;
  clientNom: string | null;
  devisEnvoyeAt: Date | string | null;
  datePlanifiee: string | null;
  creneauDebut: string | null;
  dureeDemiJournees: number | null;
  dureePrevue?: string | null;
  /** Les rangs d'équipe cochés, demi-journée par demi-journée (migration 0058). */
  equipes: EquipesParDemi;
  /** L'adresse du chantier, telle qu'elle est en base — jamais devinée. */
  adresseChantier?: string | null;
  /**
   * Le pense-bête du chantier, lu et écrit sur la feuille.
   *
   * **Modifiable sur l'objet** (`chantier.note = …` après enregistrement) : la
   * feuille est remontée à chaque changement de chantier, et repeindre toute la
   * liste pour un champ de texte ferait clignoter le planning sous le doigt.
   */
  note?: string | null;
  clientTelephone?: string | null;
  envoiEnvoyeAt: Date | string | null;
  envoiExpireAt: Date | string | null;
  envoiReponse: "acceptee" | "refusee" | null;
  termineAt: Date | string | null;
  factureEnvoyeeAt: Date | string | null;
};

export type EtatAgendaPlanning = {
  configure: boolean;
  relie: boolean;
  actif: boolean;
  enPanne: boolean;
};

// ─── Les dates, comme la planche les calcule ──────────────────────────────
const enDate = (iso: JourIso) => new Date(`${iso}T12:00:00Z`);

function lundiDe(iso: JourIso): JourIso {
  const d = enDate(iso);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/**
 * Combien de jours la liste montre quand on l ouvre en grand.
 *
 * **Sept, et non six.** Ses exemples du 9 septembre en donnaient six — « du 8
 * au 13 » — mais une fenetre de sept jours porte une semaine entiere : quel
 * que soit le jour ou il ouvre l appli, il voit le meme jour de la semaine
 * suivante. A six, le lundi ne voit jamais le lundi.
 */
const JOURS_DE_LA_FENETRE = 7;

function plusDeJours(iso: JourIso, n: number): JourIso {
  const d = enDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Les créneaux qu'occupe un chantier posé — week-ends sautés. */
function creneauxDe(c: ChantierPlanning) {
  if (!c.datePlanifiee) return [];
  return creneauxDuChantier(
    {
      jour: c.datePlanifiee,
      moment: c.creneauDebut === "apres_midi" ? "apres_midi" : "matin",
    },
    c.dureeDemiJournees ?? DUREE_PAR_DEFAUT_DEMI_JOURNEES
  );
}

export default function PlanningClient({
  initialChantiers,
  nombreEquipes = 1,
  nombreSalaries = 0,
  equipesNommees = [],
  agenda = { configure: false, relie: false, actif: false, enPanne: false },
  absences = [],
  role = null,
  chantierDemande = null,
}: {
  initialChantiers: ChantierPlanning[];
  /** La CAPACITÉ : combien de chantiers tiennent dans une journée. */
  nombreEquipes?: number;
  /**
   * Combien de GENS l'entreprise emploie — sa demande du 26 août 2026.
   *
   * C'est LUI qui décide des noms cochables sur une demi-journée, et plus le
   * nombre d'équipes. Le défaut est zéro : un artisan seul n'a personne à
   * cocher, et lui proposer une case lui inventerait une organisation qu'il
   * n'a pas.
   */
  nombreSalaries?: number;
  equipesNommees?: { rang: number; nom: string | null }[];
  agenda?: EtatAgendaPlanning;
  /**
   * Les équipes qui ne sont pas là (14 août 2026, `ARCHITECTURE.md` §109).
   *
   * **Elles entrent dans la même charge que les chantiers** : sans quoi ce
   * calendrier montrerait un jour libre que l'écran d'envoi refuserait au
   * client — deux vérités sur la même capacité, sur deux écrans qui se suivent.
   */
  /**
   * Les absences de la fenêtre — avec leur `id` et le `rang` de la personne
   * depuis le 6 septembre 2026, pour que le planning puisse fermer et rouvrir
   * un jour sans quitter l'écran (`ARCHITECTURE.md` §267).
   */
  absences?: AbsenceDuPlanning[];
  /**
   * Le RÔLE de la personne, résolu au serveur (`src/app/planning/page.tsx`).
   *
   * **Il ne protège rien** — c'est `GardeAcces` qui refuse — mais il évite de
   * dessiner des portes closes : le chevron qui mène à la fiche du chantier
   * (devis, prix, facture) et le lien qui relie l'agenda de l'entreprise. Un
   * salarié qui les appuierait serait renvoyé ici même, et un renvoi sans
   * explication se lit comme une panne.
   *
   * **Le filtre est la MÊME fonction que celle qui refuse** (`cheminAutorise`),
   * jamais une seconde liste : un lien caché dont l'adresse répondrait quand
   * même serait un mensonge, et l'inverse une panne (`CLAUDE.md` §3).
   */
  role?: Role | null;
  /**
   * Le chantier sur lequel ouvrir — `?chantier=<id>`, lu au serveur.
   *
   * **Sa réponse du 4 septembre 2026 : « sa journée ».** Un chantier posé
   * n'a plus d'écran à lui (`ARCHITECTURE.md` §254) ; le déposer sur le mois
   * courant, à lui de retrouver sa ligne, c'est l'errance du 8 août 2026.
   *
   * **Un identifiant qui ne désigne rien de VISIBLE ne fait rien** : ni
   * erreur, ni écran vide. Un signet dont le chantier a été retiré ouvre le
   * planning du jour, ce qui n'est pas une panne.
   */
  chantierDemande?: string | null;
}) {
  // Les deux portes que cet écran propose, décidées par la règle des rôles —
  // jamais par une liste écrite ici. Sans rôle (cas d'un rendu hors session),
  // on ne retire rien : l'écran est celui d'avant ce lot.
  const ouvertes = {
    fiche: role === null || cheminAutorise(role, "/chantiers"),
    agenda: role === null || cheminAutorise(role, "/reglages/agenda"),
    /**
     * **ÉCRIRE SUR LE PLANNING** — décision du patron, 30 août 2026 : *« un
     * salarié peut uniquement CONSULTER son planning »*.
     *
     * Ce qui suit ne PROTÈGE rien, et il ne faut pas s'y tromper : ce qui
     * refuse est `exigerEcritureSurLePlanning`, au serveur, dans chacune des
     * six actions. Ceci évite de proposer un geste qui sera refusé — un bouton
     * qui répond « action indisponible » se lit comme une panne, et le salarié
     * appellerait le patron un lundi matin.
     *
     * **La MÊME fonction que celle qui refuse** (`CLAUDE.md` §3) : un bouton
     * caché dont l'action répondrait quand même serait un mensonge, et
     * l'inverse une panne.
     */
    ecriture: role === null || peutModifierLePlanning(role),
  };

  const [chantiers, setChantiers] = useState<ChantierPlanning[]>(initialChantiers);
  const aujourdHui = jourIso(new Date());

  /**
   * ─── ARRIVER PAR `?chantier=<id>` : SA JOURNÉE, PORTES LEVÉES ──────────────
   *
   * **Sa réponse du 4 septembre 2026.** C'est ce qui permet à la fiche du
   * chantier de partir (`ARCHITECTURE.md` §254) : elle était le seul endroit où
   * retomber une fois la date posée, puisqu'un chantier posé quitte l'onglet
   * « Chantiers » (`onglet-chantier.ts`).
   *
   * **Il se lit DANS L'ÉTAT DE DÉPART, pas dans un effet.** Un effet aurait
   * peint le mois courant, puis sauté sur le bon — une cascade de rendus que
   * l'œil voit, et que le lint refuse à juste titre. Le paramètre vient du
   * serveur : il est là au premier rendu, il n'y a rien à attendre.
   *
   * **Introuvable, ou retiré : on ne dit rien.** Le planning du jour s'ouvre
   * normalement — un signet dont le chantier a été supprimé n'est pas une
   * panne, et une page d'erreur le lui ferait croire.
   */
  const viseDemande = chantierDemande
    ? (initialChantiers.find((c) => c.id === chantierDemande) ?? null)
    : null;
  /** Le jour sur lequel le calendrier s'ouvre : le sien, sinon aujourd'hui. */
  const jourDArrivee = viseDemande?.datePlanifiee ?? aujourdHui;

  const [curseur, setCurseur] = useState(() => {
    const d = enDate(jourDArrivee as JourIso);
    return { annee: d.getUTCFullYear(), mois: d.getUTCMonth() };
  });
  const [jourTouche, setJourTouche] = useState<JourIso | null>(null);
  /**
   * ─── LA LISTE PART DU JOUR, ET NON DU LUNDI — sa demande du 9 septembre 2026
   *
   * *« Les jours du planning doivent avancer chaque jour : quand on est le 8,
   * c'est du 8 au 13 ; le 9, du 9 au 14. Et pour voir apparaître les jours
   * grisés en bas, il faut appuyer sur la flèche retour arrière. »*
   *
   * **Ce que cette fenêtre glissante RÉPARE, et c'est lui qui l'a vu :** la
   * semaine du lundi mettait des journées DÉJÀ FAITES en tête de liste, avec la
   * même pastille et la même encre que celles à venir. Le salarié qui ouvre
   * l'appli le matin y lisait un chantier de plus à faire. Une fenêtre qui part
   * d'aujourd'hui n'en contient aucune ; celles qu'on va chercher avec la
   * flèche arrivent éteintes.
   */
  const [debutFenetre, setDebutFenetre] = useState<JourIso>(jourDArrivee as JourIso);
  /**
   * **Ce qu'on regarde : la journée, ou les sept jours.** Sa demande du même
   * jour : *« qu'on ait seulement la journée d'aujourd'hui, pour avoir moins
   * d'informations ; néanmoins, en un clic, le visuel de la semaine »*. La
   * journée est le défaut à chaque arrivée sur l'écran — c'est ce qu'il a
   * demandé, et c'est ce que le salarié cherche à sept heures du matin.
   */
  const [portee, setPortee] = useState<"jour" | "semaine">("jour");
  /** D'où le doigt est parti — `null` tant qu'aucun balayage n'est en cours. */
  const departBalayage = useRef<{ x: number; y: number } | null>(null);

  /**
   * Passer de la journée aux sept jours, et l'inverse.
   *
   * **Revenir sur la journée REPART d'aujourd'hui.** Sans cela, celui qui a
   * reculé de trois fenêtres retomberait sur une journée d'il y a trois
   * semaines sans comprendre pourquoi — et il la lirait comme la sienne.
   */
  function allerVers(quoi: "jour" | "semaine") {
    setPortee(quoi);
    if (quoi === "jour") setDebutFenetre(aujourdHui);
  }
  const [, enTransition] = useTransition();

  const grilleRef = useRef<HTMLDivElement>(null);
  /**
   * **Ce qu'il touche ne doit pas lui échapper.** Ouvrir une fiche en referme
   * une autre ; si celle-ci était plus haut, tout remonte de sa hauteur et la
   * ligne touchée sort de l'écran (`useAncrageDuGeste`).
   */
  const ancrer = useAncrageDuGeste();

  /**
   * Le retrait DÉFINITIF reste branché ici — il ne se confond pas avec
   * « Retirer » de la fiche du jour.
   *
   * « Retirer » rend le chantier à « Sans date » ; celui-ci le supprime. Le
   * planning est l'un des huit endroits qui suppriment (`ARCHITECTURE.md` §48),
   * et le geste vit sur « Sans date » — la seule liste où l'on se débarrasse
   * d'un chantier plutôt que de le poser.
   */
  const retraits = useRetraits({ valider: (id) => supprimerChantierAction(id) });
  const visibles = useMemo(
    () => chantiers.filter((c) => !retraits.estRetire(c.id)),
    [chantiers, retraits]
  );

  /**
   * CE QUE LE CALENDRIER PEINT — et depuis le 31 août 2026, les jours passés
   * aussi.
   *
   * **Sa question :** *« est-ce que le planning garde en mémoire les chantiers
   * passés ? »* — non : `estAuPlanning` les refusait dès le lendemain, et son
   * mois de juillet était blanc alors qu'il y avait travaillé tous les jours.
   * Il a choisi la proposition **B** (planche 98) : le jour passé garde ses
   * couleurs, et la mémoire tient **deux ans**.
   *
   * **`estAuCalendrier` et non `estAuPlanning` élargie** : la seconde décide de
   * l'onglet, et un chantier passé doit rester dans « Terminés ». Les élargir
   * ensemble l'aurait remis dans deux onglets — le défaut du 6 août 2026.
   *
   * **Ce que ce changement RÉPARE en passant.** L'écran d'envoi peint le même
   * calendrier (`MoisCharge`) à partir de la liste BRUTE, sans ce tamis : un
   * jour passé y portait déjà ses chantiers pendant que le planning l'affichait
   * vide. Deux vérités sur la même journée, à un écran d'écart — ce que
   * `CLAUDE.md` §3 interdit nommément. Elles se rejoignent.
   */
  const planifies = useMemo(
    () => trierParDatePlanifiee(visibles.filter((c) => estAuCalendrier(c, aujourdHui))),
    [visibles, aujourdHui]
  );

  /**
   * Ceux qui attendent un jour — c'est eux qu'on pose.
   *
   * **`getPlanificationEtat` et non un filtre local.** Un chantier dont le
   * client est en train de choisir sa date n'est PAS à poser : le patron qui le
   * poserait lui-même prendrait une date que le client s'apprête peut-être à
   * contredire.
   */
  const sansDate = useMemo(
    () => visibles.filter((c) => getPlanificationEtat(c) === "a_planifier"),
    [visibles]
  );

  /** Ni posables ni oubliables : leur date se décide chez le client. */
  const attenteClient = useMemo(
    () => visibles.filter((c) => getPlanificationEtat(c) === "attente_client"),
    [visibles]
  );

  /**
   * Quels chantiers occupent quelle demi-journée — construit UNE fois.
   *
   * Le calendrier interroge quarante-deux jours, la fiche du jour deux
   * demi-journées, la liste sept jours : autant de parcours de la liste
   * complète à chaque rendu. Une seule carte les sert tous, et surtout elle
   * garantit qu'ils comptent la même chose.
   */
  const parCreneau = useMemo(() => {
    const m = new Map<string, ChantierPlanning[]>();
    for (const c of planifies) {
      for (const x of creneauxDe(c)) {
        const cle = cleCreneau(x);
        const siens = m.get(cle);
        if (siens) siens.push(c);
        else m.set(cle, [c]);
      }
    }
    return m;
  }, [planifies]);

  /**
   * Combien d'équipes manquent sur chaque demi-journée.
   *
   * `fusionnerAbsences` sur une carte VIDE rend exactement cela : le nombre
   * d'équipes absentes par créneau, plafonné au nombre d'équipes. La réemployer
   * évite d'écrire une seconde fois la règle des bornes incluses, qui vit dans
   * `src/lib/absences-equipe.ts`.
   */
  /**
   * ─── FERMER UN JOUR DEPUIS LE PLANNING — 6 septembre 2026 ────────────────
   *
   * **Ce qui existait déjà, et qu'on ne refait pas.** Une absence retire une
   * place ce jour-là, et les trois chemins la voient : l'écran d'envoi, l'envoi
   * lui-même, et la revérification quand le client répond
   * (`envois-devis.ts`, `fusionnerAbsences`). Ce lot ne touche PAS à ce
   * calcul — il ne fait que rapprocher le geste.
   *
   * **Ce qui manquait :** pour dire « je ne suis pas là mardi », il fallait
   * quitter le planning, ouvrir Réglages, puis Équipe, descendre jusqu'aux
   * absences et taper deux dates. Le geste vit désormais là où il regarde ses
   * jours.
   *
   * **La liste est tenue ICI, en état.** Sans cela, fermer un jour n'aurait
   * rien changé à l'écran avant un rechargement — et il aurait appuyé deux
   * fois, ce qui pose deux absences.
   */
  const [absencesVues, setAbsencesVues] = useState<AbsenceDuPlanning[]>(absences);

  /**
   * **Le serveur reste la source.** Une navigation qui rend des absences
   * neuves doit les remplacer, pas les laisser périmées derrière un état local.
   *
   * **Ajusté PENDANT le rendu, pas dans un effet.** Écrit en `useEffect`, ce
   * rattrapage repeint l'écran une seconde fois pour rien — et la règle de
   * lint le refuse (« cascading renders »). Comparer la liste précédente ici
   * est le geste que React documente pour ce cas précis : le rendu en cours est
   * abandonné et repris avec la bonne valeur, sans passer par le navigateur.
   */
  const [absencesRendues, setAbsencesRendues] = useState(absences);
  if (absencesRendues !== absences) {
    setAbsencesRendues(absences);
    setAbsencesVues(absences);
  }

  const absentesParCreneau = useMemo(
    () => fusionnerAbsences(new Map(), absencesVues, nombreEquipes),
    [absencesVues, nombreEquipes]
  );

  /** Qui n'est pas là ce jour-là — par rang, avec l'`id` pour pouvoir défaire. */
  /**
   * Les jours d'un chantier où cette personne n'est pas là — son signalement du
   * 7 septembre 2026.
   *
   * **Elle regarde TOUTES les absences, pas celles du jour affiché.** Un
   * chantier de deux jours traverse deux journées, et une coche d'équipe vaut
   * pour le chantier entier : n'interroger que le jour ouvert laisserait
   * cocher quelqu'un absent le lendemain (`equipe-absente.ts`).
   */
  const joursAbsentsDe = useCallback(
    (rang: number, c: ChantierPourAbsence) => joursAbsentsDuChantier(rang, c, absencesVues),
    [absencesVues]
  );

  /**
   * Ce que la pastille écrit sous le nom — « ven. » quand il ne vient qu'un
   * jour sur deux. Vide le reste du temps, c'est-à-dire presque toujours.
   *
   * Sa proposition C, retenue le 8 septembre 2026 : il coche une fois, et
   * l'application dit les jours. La règle vit dans `equipe-absente.ts`.
   */
  const joursDeLaPastilleDe = useCallback(
    (rang: number, c: ChantierPourAbsence, demi?: "matin" | "apres_midi") =>
      joursDeLaPastille(rang, c, absencesVues, jourAbrege, demi),
    [absencesVues]
  );

  const absencesDuJour = useCallback(
    (jour: JourIso) =>
      absencesVues.filter((a) => a.premierJour <= jour && jour <= a.dernierJour),
    [absencesVues]
  );

  /**
   * Fermer une journée pour une personne — une absence d'UN jour.
   *
   * **Optimiste, comme le reste du planning** : le doigt doit voir tout de
   * suite. Si le serveur refuse, on retire la ligne posée d'avance plutôt que
   * de laisser un jour barré qui ne l'est pas — un jour qu'il croit fermé et
   * qui part chez un client est exactement ce qu'on cherche à éviter.
   */
  const fermerLeJour = useCallback(
    async (jour: JourIso, rang: number, quand: "matin" | "apres_midi" | null = null) => {
      const provisoire: AbsenceDuPlanning = {
        id: `provisoire-${rang}-${jour}`,
        equipeId: `provisoire-${rang}`,
        rang,
        premierJour: jour,
        dernierJour: jour,
        // **Une demi-journée n'occupe qu'une moitié**, y compris pendant la
        // seconde où l'écran devance le serveur : sans ces deux bornes, la
        // journée entière se barrerait puis se corrigerait sous ses yeux.
        premierDemi: quand ?? "matin",
        dernierDemi: quand ?? "apres_midi",
      };
      setAbsencesVues((v) => [...v, provisoire]);

      const formulaire = new FormData();
      formulaire.set("rang", String(rang));
      formulaire.set("premierJour", jour);
      formulaire.set("dernierJour", jour);
      // Rien à envoyer pour une journée entière : le serveur met ses valeurs
      // par défaut, et le geste courant reste exactement ce qu'il était.
      if (quand) {
        formulaire.set("premierDemi", quand);
        formulaire.set("dernierDemi", quand);
      }
      const r = await noterAbsenceAction(formulaire);

      setAbsencesVues((v) =>
        r.ok
          ? v.map((a) => (a.id === provisoire.id ? { ...a, id: r.id } : a))
          : v.filter((a) => a.id !== provisoire.id)
      );

      // ─── CE QUE LE CONGÉ VIENT DE DÉFAIRE SE REPEINT ICI ────────────────
      // **Sans cette ligne, l'écran MENT jusqu'au prochain rechargement.** Le
      // serveur a retiré cette personne des chantiers que le congé traverse
      // (sa consigne du 8 septembre 2026, « corrige à la racine ») ; la liste
      // du navigateur, elle, porterait encore « ✓ Julien » — c'est-à-dire
      // exactement les deux vérités contradictoires qu'il a photographiées, à
      // ceci près qu'elles seraient désormais de notre fait.
      //
      // **Et cette disparition EST le message.** La carte du jour est ouverte
      // sous ses yeux : la pastille s'en va, il le voit. Une phrase par-dessus
      // expliquerait ce que l'écran montre déjà (`CLAUDE.md` §3). Aux
      // Réglages, où rien de tout cela n'est visible, c'est l'inverse — et
      // c'est là que la phrase est écrite.
      if (r.ok && r.chantiersLiberes.length > 0) {
        const liberes = new Set(r.chantiersLiberes.map((c) => c.id));
        setChantiers((liste) =>
          liste.map((c) =>
            liberes.has(c.id)
              ? {
                  ...c,
                  equipes: {
                    matin: c.equipes.matin.filter((x) => x !== rang),
                    apres_midi: c.equipes.apres_midi.filter((x) => x !== rang),
                  },
                }
              : c
          )
        );
      }
    },
    []
  );

  /** Rouvrir : on retire la ligne, et on la remet si le serveur n'a pas suivi. */
  const rouvrirLeJour = useCallback(
    async (id: string) => {
      const retiree = absencesVues.find((a) => a.id === id);
      if (!retiree) return;
      setAbsencesVues((v) => v.filter((a) => a.id !== id));
      const r = await retirerAbsenceAction(id);
      if (!r.ok) setAbsencesVues((v) => [...v, retiree]);
    },
    [absencesVues]
  );

  const occupationDe = useCallback(
    (jour: JourIso, demi: Demi) => {
      // **Le week-end porte sa charge comme les autres.** Sa règle du 23 août
      // 2026 : il y travaille en extra, et un samedi chargé qui s'affiche vide
      // lui ferait poser un second chantier par-dessus.
      const cle = cleCreneau({ jour, moment: demi });
      return occupationDemi(
        parCreneau.get(cle) ?? [],
        nombreEquipes,
        absentesParCreneau.get(cle) ?? 0,
        // **Ce que l'écran sait déjà, et qu'il ne disait pas à la charge.** Les
        // gens cochés sur la demi-journée sont sous les yeux du patron ; les
        // ignorer faisait annoncer « incomplet » un mardi où ses deux gars
        // étaient chez Mr. Eric (22 août 2026).
        //
        // **Plafonné à la capacité depuis le 26 août** : on coche désormais des
        // SALARIÉS, et trois gars sur un même chantier ne doivent pas fermer une
        // journée qui accepte deux chantiers (`equipesMobilisees`).
        (c) =>
          equipesMobilisees(
            (demi === "matin" ? c.equipes.matin : c.equipes.apres_midi).length,
            nombreEquipes
          )
      );
    },
    [parCreneau, absentesParCreneau, nombreEquipes]
  );

  const lignesEquipes = useMemo(
    () => salariesAffiches(equipesNommees, nombreSalaries),
    [equipesNommees, nombreSalaries]
  );

  /**
   * Le nom d'un salarié, ou son rang en repli — et `null` sans aucun salarié.
   *
   * `libelleSalarie` décide seule : elle sert aussi au serveur et aux documents,
   * et deux implémentations divergeraient le jour où l'artisan nomme le
   * troisième sans avoir touché le deuxième (`src/lib/equipes.ts`).
   */
  const nomEquipe = useCallback(
    (rang: number) =>
      libelleSalarie(lignesEquipes.find((e) => e.rang === rang) ?? null, nombreSalaries) ??
      `Salarié ${rang}`,
    [lignesEquipes, nombreSalaries]
  );

  // ─── Ce qui est ouvert : au plus une chose à la fois ────────────────────
  //
  // Deux listes ouvertes ensemble, et l'on coche dans l'une en croyant agir sur
  // l'autre. `cle` dit DANS QUELLE carte : la fiche du jour est rendue à deux
  // endroits — sous le calendrier et sous une ligne des planifiés — et c'est le
  // même composant, écrit une fois.
  type Ouvert =
    | { quoi: "equipe"; cle: string; chantierId: string; demi: Demi }
    // **`demi` a disparu d'ici le 3 septembre 2026, et c'est un nettoyage, pas
    // une perte.** Il n'existait que pour empêcher la liste des trois moments
    // de s'ouvrir dans les DEUX lignes d'un chantier à la journée — six boutons
    // pour un seul geste. Les deux gestes vivent désormais sur UNE rangée par
    // chantier : il n'y a plus qu'une place où les ouvrir, et une donnée qui ne
    // décide plus de rien se retire plutôt que de se traîner.
    | { quoi: "deplacer"; cle: string; chantierId: string }
    // **« ajout-quand » a disparu le 9 septembre 2026**, et c'est le même
    // nettoyage : un second temps qui demandait « Matin, Après-midi ou
    // Journée » après avoir touché le nom du chantier. La durée étant déjà en
    // base, cette question n'ajoutait rien et écrasait ce que le devis avait
    // fixé (voir `poser`). L'état qui la portait s'en va avec elle.
    | { quoi: "ajout-qui"; cle: string };
  const [ouvert, setOuvert] = useState<Ouvert | null>(null);

  /** La feuille de chantier ouverte, et dans quelle carte. */
  const [feuille, setFeuille] = useState<{ chantierId: string; cle: string } | null>(null);

  /** La carte d'un jour dépliée sous une ligne des planifiés. */
  const [carteListe, setCarteListe] = useState<{ apres: string; jour: JourIso } | null>(null);
  /**
   * Le chantier dont le chevron vient d'ouvrir ses portes — son allure C.
   *
   * On garde le chantier ENTIER, et non son identifiant : la liste est
   * repeinte à chaque enregistrement de note, et un identifiant seul obligerait
   * à la reparcourir pour retrouver ce que le doigt désigne déjà.
   */
  /**
   * **Levées d'emblée quand on arrive par `?chantier=<id>`** — sa réponse du
   * 4 septembre 2026. Le mois, lui, est déjà calé sur sa journée : voir
   * `viseDemande`, tout en haut. Refermer la feuille laisse donc le patron
   * devant SA date, et non devant le mois courant.
   */
  const [portes, setPortes] = useState<ChantierPlanning | null>(viseDemande);

  /** Ce que porte la feuille de chaque chantier — chargé une fois, jamais deux. */
  const [taches, setTaches] = useState<Record<string, FeuilleEtRetour>>({});

  useEffect(() => {
    if (!feuille) return;
    if (taches[feuille.chantierId]) return;
    let vivant = true;
    tachesDuChantierAction(feuille.chantierId).then((quoi) => {
      if (vivant) setTaches((t) => ({ ...t, [feuille.chantierId]: quoi }));
    });
    return () => {
      vivant = false;
    };
  }, [feuille, taches]);

  /**
   * Toucher un jour du mois.
   *
   * **Le mois vise, la semaine lit** : la liste des planifiés arrive sur la
   * semaine de ce jour. Sans cela, on aurait deux navigations qui s'ignorent —
   * exactement le genre d'écran qu'il trouve incompréhensible.
   *
   * **Une case d'un autre mois fait basculer le calendrier.** Sans cela, l'écran
   * affichait « Lundi 27 juillet » sous un calendrier titré « août » : les deux
   * se contredisaient, et rien ne disait lequel croire.
   */
  function toucherLeJour(jour: JourIso) {
    setOuvert(null);
    setFeuille(null);
    setCarteListe(null);
    const d = enDate(jour);
    if (d.getUTCFullYear() !== curseur.annee || d.getUTCMonth() !== curseur.mois) {
      setCurseur({ annee: d.getUTCFullYear(), mois: d.getUTCMonth() });
    }
    setDebutFenetre(jour);
    setJourTouche((cur) => (cur === jour ? null : jour));
  }

  /**
   * ─── PLUS DE `scrollIntoView` : LA FICHE S'OUVRE À LA PLACE DE LA CASE ─────
   *
   * **Ce qu'il y avait ici, et pourquoi ça a disparu le 3 septembre 2026.** La
   * fiche du jour était rendue SOUS le calendrier entier ; deux fois de suite
   * le patron a écrit « rien ne s'ouvre quand je touche un jour », avec
   * quarante contrôles au vert — posée hors du champ, elle laissait l'écran
   * mort sous le doigt. On la ramenait donc de force.
   *
   * **Le remède soignait le symptôme, pas la place.** Depuis la maquette qu'il
   * a retenue, la fiche se déplie ENTRE la semaine qui porte le jour et la
   * suivante (`MoisCharge`, prop `volet`) : elle naît sous le doigt, et il n'y
   * a plus rien à rattraper. Un défilement automatique serait même nuisible —
   * il déplacerait la case qu'il vient de toucher.
   */

  // ─── Les gestes, tous rendus au serveur puis relus ──────────────────────

  /**
   * Cocher ou décocher une équipe.
   *
   * **L'écran repeint avec ce que la base rend**, jamais avec ce qu'il a
   * supposé : deux appuis rapprochés sur la même pastille se croiseraient
   * sinon, et le dernier arrivé gagnerait sur l'autre.
   */
  function basculerEquipe(chantierId: string, demi: Demi, rang: number) {
    enTransition(async () => {
      const etat = await basculerEquipeAction(chantierId, demi, rang);
      if (!etat) return;
      setChantiers((liste) =>
        liste.map((c) => (c.id === chantierId ? { ...c, equipes: etat } : c))
      );
    });
  }

  /**
   * Déplacer, et repeindre avec CE QUE LA BASE REND.
   *
   * **La durée ne se recalcule pas ici**, et c'est la règle de la maison
   * (`CLAUDE.md` §3) : elle vient de la dictée — « 3 jours » fait six
   * demi-journées — et le serveur la relit. Un écran qui écrirait « une
   * demi-journée » parce qu'on a touché « Matin » mentirait jusqu'au prochain
   * rechargement, et sur un chantier de trois jours ce sont deux jours de
   * travail qui disparaîtraient de l'affichage.
   */
  function deplacer(chantierId: string, demi: Demi) {
    setOuvert(null);
    enTransition(async () => {
      const r = await deplacerChantierAction(chantierId, demi);
      if (!r.succes) {
        // **Un refus avalé est un défaut muet**, et le dépôt l'a déjà payé le
        // 11 août 2026 : « Impossible d'enregistrer la note » sans que personne
        // puisse savoir laquelle des quatre causes s'appliquait. Ici le `return`
        // seul rendait « Déplacer » indistinguable d'un bouton mort — c'est
        // précisément ce qu'il a signalé le 23 août.
        //
        // Journalisé plutôt que levé : le message d'une exception d'action
        // serveur n'arrive jamais jusqu'à lui (`AGENTS.md`).
        console.error("Déplacement refusé", { chantierId, demi, erreur: r.erreur });
        return;
      }
      setChantiers((liste) =>
        liste.map((c) => (c.id === chantierId ? { ...c, ...r.etat } : c))
      );
    });
  }

  /**
   * « Retirer » rend le chantier à « Sans date » — il ne l'efface pas.
   *
   * Effacé, il serait à ressaisir ; là, il redescend dans la liste d'attente,
   * d'où on le repose ailleurs.
   */
  function retirerDuJour(chantierId: string) {
    setOuvert(null);
    setFeuille(null);
    enTransition(async () => {
      await deplanifierChantierAction(chantierId);
      setChantiers((liste) =>
        liste.map((c) => (c.id === chantierId ? { ...c, datePlanifiee: null } : c))
      );
    });
  }

  /**
   * Poser un chantier sur un jour — SANS lui demander quand.
   *
   * ───────────────────────────────────────────────────────────────────────────
   * **Sa remarque du 9 septembre 2026 :** *« quand je clique sur Claudette il me
   * propose 3 choix, alors que si Claudette c'est un chantier 1 journée, deux,
   * ou une demi, ça doit se mettre tout seul — je dois pas avoir à choisir »*.
   *
   * **Et les trois boutons ne demandaient rien qui manquait.** La durée est déjà
   * en base : elle vient du devis, ou de sa dictée — « 3 jours » fait six
   * demi-journées. Ce qu'ils proposaient, c'était d'ÉCRASER cette durée-là :
   * « Matin » sur un chantier d'une journée le raccourcissait à une
   * demi-journée, en silence, et l'après-midi repartait à la vente.
   *
   * Sans choix, `planifierChantier` garde la durée du chantier et cherche la
   * demi-journée où elle tient (`departPossible`) — la même règle que le jour
   * proposé au client, jamais une seconde (`CLAUDE.md` §3).
   *
   * **La moitié de journée se rattrape, la durée ne se voyait pas.** Un chantier
   * posé le matin qu'il voulait l'après-midi se déplace d'un appui — « Déplacer »
   * est là pour ça, et n'a pas bougé. Une journée devenue demi-journée, elle, ne
   * se lisait nulle part avant le jour du chantier.
   * ───────────────────────────────────────────────────────────────────────────
   *
   * On repeint avec ce que la base rend, jamais avec ce que l'écran a supposé
   * (voir `deplacer`).
   */
  function poser(chantierId: string, jour: JourIso) {
    setOuvert(null);
    enTransition(async () => {
      const r = await planifierChantierAction(chantierId, jour);
      if (!r.succes) return;
      setChantiers((liste) =>
        liste.map((c) => (c.id === chantierId ? { ...c, ...r.etat } : c))
      );
      setDebutFenetre(jour);
    });
  }

  const joursDeLaSemaine = useMemo(
    () =>
      Array.from({ length: portee === "jour" ? 1 : JOURS_DE_LA_FENETRE }, (_, i) =>
        plusDeJours(debutFenetre, i)
      ),
    [debutFenetre, portee]
  );

  /**
   * Les chantiers d'un jour, sans doublon — un chantier à la journée n'y est
   * qu'une fois.
   *
   * **Il lit `parCreneau`, jamais `occupationDe` — et un samedi le prouve.**
   *
   * `occupationDe` répond à « quelle est la CHARGE de cette demi-journée » : le
   * week-end, elle rend zéro, parce que la planche 84 n'y propose rien et n'y
   * dessine aucune barre. Cette fonction-ci répond à autre chose : « qu'est-ce
   * qui EST POSÉ ce jour-là ». Passer par la première effaçait de l'écran un
   * chantier posé un samedi — invisible au planning, alors qu'`onglet-chantier`
   * l'y range toujours. Deux vérités sur le même chantier (`CLAUDE.md` §3), et
   * le cul-de-sac du 8 août recommencé : « il se range dans les planifiés, mais
   * comment moi je fais pour y accéder ? »
   *
   * Trouvé le 22 août 2026, la batterie ayant traversé minuit un vendredi soir :
   * le contrôle « un chantier, un seul onglet » a posé sa date sur un SAMEDI et
   * n'a plus trouvé le chantier nulle part.
   */
  const chantiersDuJour = useCallback(
    (jour: JourIso) => {
      const vus = new Map<string, ChantierPlanning>();
      for (const demi of DEMIS) {
        for (const c of parCreneau.get(cleCreneau({ jour, moment: demi })) ?? []) {
          vus.set(c.id, c);
        }
      }
      return [...vus.values()];
    },
    [parCreneau]
  );

  const titreSemaine = useMemo(() => {
    const debut = enDate(debutFenetre);
    // **La fin se calcule, elle ne se lit pas au rang 6** : sur la vue journée
    // le tableau n'a qu'une case, et `joursDeLaSemaine[6]` y valait `undefined`
    // — une date invalide dans le titre, sur un écran qu'il regarde tous les
    // matins.
    const fin = enDate(plusDeJours(debutFenetre, JOURS_DE_LA_FENETRE - 1));
    const moisDebut = MOIS_LONGS[debut.getUTCMonth()];
    const moisFin = MOIS_LONGS[fin.getUTCMonth()];
    return debut.getUTCMonth() === fin.getUTCMonth()
      ? `${debut.getUTCDate()} – ${fin.getUTCDate()} ${moisFin}`
      : `${debut.getUTCDate()} ${moisDebut} – ${fin.getUTCDate()} ${moisFin}`;
  }, [joursDeLaSemaine]);

  const joursAvecChantiers = joursDeLaSemaine.filter((j) => chantiersDuJour(j).length > 0);

  /** Ce que porte une carte de journée — les mêmes gestes aux deux endroits. */
  const gestesCarte = {
    ecriture: ouvertes.ecriture,
    nombreSalaries,
    absencesDuJour,
    joursAbsentsDe,
    joursDeLaPastilleDe,
    fermerLeJour,
    rouvrirLeJour,
    ouvert,
    setOuvert,
    feuille,
    setFeuille,
    sansDate,
    nomEquipe,
    lignesEquipes,
    occupationDe,
    chantiersDuJour,
    basculerEquipe,
    deplacer,
    retirerDuJour,
    poser,
    taches,
  };

  return (
    <div
      style={{
        backgroundColor: colors.cream,
        color: colors.ink,
        fontFamily: font.body,
        minHeight: "100%",
      }}
    >
      <div className="pb-16">
        <EnTeteEcran surtitre="Vos journées" titre="Planning" />

        {/* Le raccordement de l'agenda — sa demande du 9 août 2026. Il
            disparaît quand tout va bien : un bandeau permanent sur l'écran le
            plus consulté devient du décor, et le jour où il annonce une panne
            personne ne le voit. La planche ne le montre pas parce qu'elle
            n'avait pas d'agenda ; le retirer laisserait un client retenir un
            jour où le patron est déjà pris. */}
        {/* **Pas pour un salarié** : relier l'agenda de l'entreprise est un
            réglage du patron, et le lien le renverrait ici même. Un renvoi sans
            explication se lit comme une panne. */}
        {ouvertes.agenda && (!agenda.relie || !agenda.actif || agenda.enPanne) && (
          <div className="mt-5 px-[26px]">
            <Link
              href="/reglages/agenda"
              className="flex items-center justify-between py-3.5"
              style={{ borderBottom: `1px solid ${colors.line}` }}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15px]" style={{ fontFamily: font.display }}>
                  {agenda.enPanne
                    ? "Votre agenda n'est plus lu"
                    : !agenda.relie
                      ? "Relier mon agenda Google"
                      : "Votre agenda est en pause"}
                </span>
                <span
                  className="block text-[12.5px] leading-snug"
                  style={{ color: colors.muted }}
                >
                  {agenda.enPanne
                    ? "Un client peut retenir un jour où vous êtes déjà pris."
                    : !agenda.relie
                      ? "Sans lui, Atlas ne voit pas les rendez-vous notés ailleurs."
                      : "Reprendre la lecture pour éviter les doublons."}
                </span>
              </span>
              <span className={`ml-4 flex-shrink-0 ${libelleCaps}`} style={{ color: colors.or }}>
                {agenda.configure ? "Ouvrir" : "Connecter"}
              </span>
            </Link>
          </div>
        )}

        {/* ─── LE MOIS ──────────────────────────────────────────────────────
            **Le dessin vit désormais dans `MoisCharge`**, depuis le 22 août
            2026 : l'écran d'envoi montre le MÊME calendrier quand le patron
            choisit une date à proposer (sa demande, planche 91). Deux
            calendriers écrits séparément ne peindraient plus la même journée à
            deux écrans d'écart — `CLAUDE.md` §3. Les quatre choix de la planche
            84 y sont commentés, avec leur pourquoi. */}
        <div ref={grilleRef} className="mx-[12px] mt-[18px]">
          <MoisCharge
            curseur={curseur}
            setCurseur={setCurseur}
            aujourdHui={aujourdHui}
            jourTouche={jourTouche}
            onToucherJour={toucherLeJour}
            occupationDe={occupationDe}
            // **La semaine que lit la liste du bas, teintée dans le mois.** Les
            // deux navigations cessent de s'ignorer : toucher un jour amenait
            // déjà la liste sur sa semaine, mais changer de semaine ne disait
            // rien au mois, et rien ne montrait d'où venait la liste.
            semaineLue={lundiDe(debutFenetre)}
            // ─── LA FICHE DU JOUR, DANS LE MOIS ────────────────────────────
            //
            // **Sa maquette du 3 septembre 2026.** Elle s'ouvre entre la
            // semaine qui porte le jour et la suivante, l'encoche pointant la
            // case. C'est ce qui a supprimé le `scrollIntoView` plus haut.
            volet={(jour, colonne) => (
              <CarteDuJour
                cle="jour"
                jour={jour}
                // La pointe vise le CENTRE de la case touchée : c'est le
                // calendrier qui donne la colonne, lui seul la connaît.
                attache={{ colonne }}
                {...gestesCarte}
                // **Un jour passé se lit, il ne s'écrit pas** (planche 98). Ce
                // n'est pas une précaution de style : cocher un salarié ou
                // déplacer une demi-journée sur un chantier fait il y a huit
                // mois ne veut rien dire, et un geste possible est un geste
                // qu'on fait par erreur. C'est le MÊME drapeau que celui du
                // salarié en lecture seule — une seconde façon de rendre une
                // carte inerte aurait divergé de la première.
                ecriture={gestesCarte.ecriture && jour >= aujourdHui}
              />
            )}
          />
        </div>

        {/* ─── LA JOURNÉE, OU LES SEPT JOURS ───────────────────────────────
            **Le mot « Planifiés » est parti le 9 septembre 2026, à sa demande.**
            Il titrait une liste qui n'a plus besoin d'être nommée : sous le
            calendrier, ce qui suit ne peut être que des chantiers posés, et
            l'écran a déjà « Planning » écrit en tête. Un titre qui répète son
            écran est du bruit (`CLAUDE.md` §3).

            **On passe de l'une à l'autre AU DOIGT** — son choix du même jour :
            *« pas en appuyant sur deux gros boutons, quelque chose de plus
            subtil »*. Les deux points disent où l'on est, et se touchent aussi :
            un geste qui ne se voit pas ne s'apprend pas seul. */}
        <div
          data-atlas="portee-liste"
          className="mt-[22px] flex items-center justify-center gap-[9px]"
        >
          {(["jour", "semaine"] as const).map((quoi) => (
            <button
              key={quoi}
              type="button"
              data-atlas={`point-${quoi}`}
              aria-pressed={portee === quoi}
              aria-label={quoi === "jour" ? "La journée" : "Les sept jours"}
              onClick={() => allerVers(quoi)}
              className="flex h-[34px] w-[34px] cursor-pointer items-center justify-center border-0 bg-transparent p-0"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <i
                className="block h-[6px] w-[6px] rounded-full"
                style={{
                  background: portee === quoi ? colors.or : colors.chevron,
                  transform: portee === quoi ? "scale(1.5)" : "none",
                  transition: "background 300ms, transform 300ms",
                }}
              />
            </button>
          ))}
        </div>

        {/* Les flèches ne servent qu'en grand : sur la journée, il n'y a rien à
            feuilleter, et deux cibles inertes se touchent quand même. */}
        {portee === "semaine" && (
        <div className="mx-[18px] mt-[14px] flex items-center justify-between gap-2.5">
          <Fleche
            libelle="Sept jours avant"
            signe="‹"
            onClick={() => setDebutFenetre((d) => plusDeJours(d, -JOURS_DE_LA_FENETRE))}
          />
          <div className="flex-1 text-center">
            <b
              data-atlas="semaine-titre"
              className="block text-[15px] font-bold leading-[1.2]"
              style={{ color: colors.ink }}
            >
              {titreSemaine}
            </b>
          </div>
          <Fleche
            libelle="Sept jours après"
            signe="›"
            onClick={() => setDebutFenetre((d) => plusDeJours(d, JOURS_DE_LA_FENETRE))}
          />
        </div>
        )}

        {/* **Le balayage vit ICI, sur la liste elle-même.** Posé plus haut, il
            aurait pris le doigt qui fait défiler le calendrier. */}
        <div
          data-atlas="liste-planifies"
          onPointerDown={(e) => {
            departBalayage.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={(e) => {
            const d = departBalayage.current;
            departBalayage.current = null;
            if (!d) return;
            const dx = e.clientX - d.x;
            const dy = e.clientY - d.y;
            // **Plus horizontal que vertical, et quarante pixels au moins** :
            // sans ces deux conditions, un simple défilement du pouce changerait
            // de vue sans qu'on comprenne pourquoi.
            if (Math.abs(dx) < 40 || Math.abs(dx) <= Math.abs(dy)) return;
            allerVers(dx < 0 ? "semaine" : "jour");
          }}
        >
        {joursAvecChantiers.length === 0 ? (
          <p className="mx-[18px] mt-3.5 text-center text-[13.5px]" style={{ color: colors.muted }}>
            {portee === "jour" ? "Rien de posé ce jour-là." : "Aucun chantier posé sur ces sept jours."}
          </p>
        ) : (
          joursAvecChantiers.map((jour) => (
            /* ─── LA DATE DANS UNE PASTILLE — sa proposition D, choisie ────────
               Sa question du 23 août 2026 : *« comment on peut faire pour que la
               date ressorte par rapport au nom du client ? »*, puis, la planche
               en main (`appli/la-date-qui-ressort.html`, quatre propositions
               qu'il a comparées du doigt) : ***« D »***.

               **CE QUI N'ALLAIT PAS, ET IL SE MESURE.** La date et le nom
               portaient exactement la même encre — `colors.ink` — et le nom fait
               19 px en serif contre 12,5 px en capitales. Deux tailles ne font
               pas une hiérarchie quand la couleur est identique : la date se
               lisait comme une étiquette de plus, pas comme une séparation.

               **Le filet disparaît avec elle.** Il séparait deux journées ; la
               pastille le fait mieux et le garder poserait deux séparateurs pour
               une seule couture. C'est aussi ce que la planche montrait.

               **Ce que ça coûte, et il l'a accepté en choisissant :** l'écran a
               été refait sans un seul aplat inutile, et voici trois blocs de
               couleur de plus sur une semaine chargée. Le papier (`rustTint`)
               est le plus discret des fonds de la charte — et il est dérivé du
               FOND, donc il reste sombre sur Nuit et sur Sylve au lieu de poser
               un pavé blanc au milieu de l'écran.

               **Le contrôle a été VU ROUGE** contre le défaut qu'il prétend
               attraper : la pastille rendue transparente le fait tomber en
               donnant la couleur lue — « la date ne porte aucun fond :
               rgba(0, 0, 0, 0) ». Un contrôle jamais vu rouge ne prouve rien
               (`AGENTS.md`). */
            <div
              key={jour}
              data-atlas="jour-planifie"
              data-passe={jour < aujourdHui ? "1" : undefined}
              className="mx-[18px] mt-5"
            >
              {/* ─── « AUJOURD'HUI », EN DORÉ — sa proposition B, choisie ──────
                  Sa demande du 9 septembre 2026 : *« si on est le 8 septembre
                  y'a écrit 8 septembre ; ça serait bien que ce soit marqué
                  aujourd'hui en doré, en premier — comme ça au premier coup
                  d'œil, le salarié qui ouvre l'appli le matin la tête
                  enfarinée, il sait que M. Martins sous aujourd'hui c'est le
                  client qu'il doit faire »*.

                  **`or` ET NON `orTexte` — sa correction du 9 septembre :**
                  *« utilise le doré qu'on utilise dans l'appli ! »*. Il a
                  raison, et pas seulement par goût : **la durée du chantier,
                  trois pixels plus bas, est déjà en `colors.or`**. L'or
                  assombri posait donc deux dorés différents dans le même bloc,
                  à se toucher — exactement le genre d'écart qu'on ne voit pas
                  en codant et qui saute aux yeux sur l'écran.

                  **Ce que ça coûte, et il l'a tranché en connaissance :** l'or
                  plein sur ce papier pâle donne **2,03 à 2,53** de contraste
                  selon la charte, là où `orTexte` tenait 3,92. Le mot reste à
                  19 px en gras — la taille faisait partie du correctif et elle
                  ne bouge pas. **La façon de garder le VRAI or ET la lisibilité
                  existe** : c'est la proposition D de
                  `appli/aujourd-hui-en-tete.html`, la pastille d'encre, qui
                  donne 4,56 à 5,81. Il l'a vue et a préféré celle-ci.

                  Les autres journées ne bougent pas : 12 px, encre sur papier,
                  14,07 de contraste. */}
              <p className="text-center leading-none">
                <span
                  data-atlas="date-planifiee"
                  data-aujourdhui={jour === aujourdHui ? "1" : undefined}
                  className={
                    jour === aujourdHui
                      ? "inline-block rounded-full px-[17px] py-[8px] text-[19px] font-bold uppercase"
                      : "inline-block rounded-full px-[15px] py-[7px] text-[12px] font-bold uppercase"
                  }
                  style={{
                    letterSpacing: jour === aujourdHui ? "0.08em" : "0.14em",
                    background: colors.rustTint,
                    color:
                      jour === aujourdHui
                        ? colors.or
                        : jour < aujourdHui
                          ? colors.muted
                          : colors.ink,
                  }}
                >
                  {jour === aujourdHui ? "Aujourd’hui" : jourLisibleCourt(jour)}
                </span>
              </p>
              {chantiersDuJour(jour).map((c) => {
                const toutes = [...new Set([...c.equipes.matin, ...c.equipes.apres_midi])].sort(
                  (a, b) => a - b
                );
                const deplie = carteListe?.apres === c.id;
                // **Le même nom REFERME ce qu'il a ouvert.** Sa correction du
                // 22 août : la ligne « se transforme en le menu déroulant »,
                // elle ne le pousse pas plus bas à chaque appui.
                const ouvrir = (e: { currentTarget: HTMLElement }) => {
                  // La ligne du chantier reste immobile sous le doigt, quoi
                  // qu'on referme au-dessus d'elle. Le nom du client est ce
                  // qu'il cherche des yeux : c'est lui qu'on ancre, pas la
                  // fiche qui s'ouvre en dessous.
                  ancrer(e.currentTarget.closest("[data-atlas='ligne-planifiee']"));
                  setOuvert(null);
                  if (deplie) {
                    setCarteListe(null);
                    setFeuille(null);
                    return;
                  }
                  setCarteListe({ apres: c.id, jour });
                  setFeuille({ chantierId: c.id, cle: `liste:${c.id}` });
                };
                return (
                  <div
                    key={c.id}
                    data-atlas="ligne-planifiee"
                    /* **Le chantier se désigne par son identifiant, pas par un
                       lien.** Les contrôles visaient la ligne par le `href` du
                       chevron ; celui-ci pivote désormais au lieu de mener au
                       chantier, et trois suites se sont retrouvées à attendre un
                       élément disparu. Un attribut posé pour ça ne dépend
                       d'aucun choix d'apparence. */
                    data-chantier={c.id}
                  >
                    <div className="mt-3 flex items-center gap-2.5">
                      <button
                        type="button"
                        data-atlas="nom-planifie"
                        onClick={ouvrir}
                        className="flex-1 cursor-pointer border-0 bg-transparent p-0 text-left"
                        style={{
                          fontFamily: font.display,
                          fontSize: 19,
                          lineHeight: 1.2,
                          // **Une journée déjà faite s'éteint.** On ne la voit
                          // que si l'on est allé la chercher avec la flèche ;
                          // gardée en pleine encre, elle se lirait comme un
                          // chantier de plus à faire — c'est lui qui l'a vu.
                          color: jour < aujourdHui ? colors.muted : colors.ink,
                        }}
                      >
                        <span className="block">{c.nom}</span>
                        {/* **La durée, jamais le moment** — sa demande du
                            22 août, retenue sur la planche 86 : *« ce n'est pas
                            clair quand il y a marqué le matin et
                            l'après-midi »*. La demi-journée se lit deux lignes
                            plus bas, sur la ligne MATIN.

                            **Et elle passe SOUS le nom** — sa demande du
                            23 août : *« le "une journée" en doré, mets-le sous
                            le nom »*. À côté, elle disputait la largeur au nom
                            et à l'équipe : « Chantier test — Abri Pornic »
                            cassait en deux lignes et la durée finissait seule
                            en dessous, à gauche, sans qu'on sache à quoi elle
                            se rapportait. Vu sur sa capture. */}
                        <span
                          data-atlas="duree-planifiee"
                          className="mt-[3px] block text-[12.5px]"
                          style={{ color: jour < aujourdHui ? colors.muted : colors.or }}
                        >
                          {ditLaDuree(dureeDuChantier(c))}
                        </span>
                        {/* **Le lieu, sous la durée.** C'est la deuxième
                            question après « qui » — et sur quatre clients qui
                            s'appellent Martins, c'est la seule qui distingue. */}
                        <LieuDuChantier chantier={c} />
                      </button>
                      {/* La pastille MÈNE AU JOUR au lieu d'ouvrir un choix : un
                          chantier à la journée porte deux listes d'équipes —
                          matin et après-midi, indépendantes — et une pastille
                          unique ne saurait pas laquelle modifier. */}
                      {/* **Elle MÈNE au jour, elle ne coche rien** — mais elle
                          a l'apparence de celle qui coche, et c'est ce qui
                          compte pour qui la regarde. Un salarié la lit donc en
                          texte (30 août 2026) ; le nom du chantier, à côté,
                          ouvre déjà la journée, donc il ne perd aucun geste. */}
                      {nombreSalaries > 0 && (
                        <PastilleEquipe
                          vide={toutes.length === 0}
                          onClick={ouvrir}
                          avecPlus={false}
                          ecriture={ouvertes.ecriture}
                          libelle={ditQuiPart(toutes.map(nomEquipe))}
                        />
                      )}
                      {/* **LE CHEVRON FAIT MONTER LES PORTES — son allure C,
                          choisie le 4 septembre 2026** sur
                          `appli/facture-au-planning.html` : *« je préfère la
                          C »*. Rien au repos, une feuille à l'appui.

                          **Il menait à `/chantiers/[id]` jusqu'ici**, et ce
                          n'était pas un caprice : un chantier POSÉ quitte
                          l'onglet « Chantiers » (`src/lib/onglet-chantier.ts`),
                          si bien que le planning est le seul endroit d'où
                          l'atteindre. C'est ce qu'il signalait le 8 août 2026 —
                          *« il se range dans les chantiers planifiés, mais
                          comment moi je fais pour avoir accès au devis ? »*.

                          **La feuille tient cette promesse mieux que le lien** :
                          elle porte le devis, la facture et la fiche client,
                          nommés et datés, au lieu d'un écran d'où il fallait
                          repartir. C'est ce qui permet à la fiche du chantier de
                          disparaître — sa décision du 1er septembre.

                          Le NOM, lui, garde son geste : il déplie la journée. Un
                          chevron promet qu'on part quelque part, un nom qu'il
                          s'ouvre : les deux se distinguent toujours. */}
                      {ouvertes.fiche && <ChevronDesPortes chantier={c} onPortes={setPortes} />}
                    </div>
                    {deplie && (
                      <CarteDuJour
                        cle={`liste:${c.id}`}
                        jour={carteListe.jour}
                        seulement={c.id}
                        // **Sous le NOM, et non au centre** — sa correction du
                        // 4 septembre 2026 : *« pareil lorsque je clique
                        // directement sur le nom de mon client »*. Ici la
                        // pointe ne vise pas une case mais le mot qu'il vient
                        // de toucher, qui commence au bord gauche de la ligne.
                        // Vingt-deux pixels : le retrait de la fiche plus la
                        // demi-largeur de la pointe.
                        attache={{ colonne: "22px" }}
                        {...gestesCarte}
                        ecriture={gestesCarte.ecriture && carteListe.jour >= aujourdHui}
                      />
                    )}
                  </div>
                );
              })}
              {/* **Le geste d'ajout suit la JOURNÉE, pas le dernier volet.**
                  C'est ce que montre la planche 86 : un seul « + » sous les
                  chantiers du jour, quel que soit le nombre de volets ouverts.
                  Et il n'existe pas pour un salarié (30 août 2026). */}
              {/* **Pas de « + » sur une journée passée** : on n'ajoute pas un
                  chantier à un jour qui a déjà eu lieu. */}
              {ouvertes.ecriture && jour >= aujourdHui && (
              <AjoutAuJour
                cle={`ajout:${jour}`}
                jour={jour}
                ouvert={ouvert}
                setOuvert={setOuvert}
                sansDate={sansDate}
                poser={poser}
              />
              )}
            </div>
          ))
        )}
        </div>

        {/* ─── CE QUI N'A PAS ENCORE DE JOUR — dans le tiroir du bas ────── */}
        <TiroirDuBas
          ecriture={ouvertes.ecriture}
          sansDate={sansDate}
          attenteClient={attenteClient}
          jourTouche={jourTouche}
          poser={poser}
          retraits={retraits}
          portesOuvertes={ouvertes.fiche}
          onPortes={setPortes}
        />
      </div>

      {/* Les portes du chantier, montées par le chevron — son allure C. Posée
          ici, hors de la liste : une feuille rendue dans la ligne descendrait
          avec elle au défilement, et la coquille est déjà `fixed`. */}
      <PortesDuChantier
        chantier={portes}
        aujourdHui={aujourdHui}
        onFermer={() => setPortes(null)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// LES PIÈCES DE L'ÉCRAN
// ─────────────────────────────────────────────────────────────────────────

/**
 * Le chevron qui fait monter les portes d'un chantier — son allure C.
 *
 * **Il vit dans une pièce, et non recopié à trois endroits.** Trois listes le
 * portent depuis le 4 septembre 2026 — les journées, « Sans date » et « En
 * attente du client » —, et un chevron recopié aurait changé de couleur ou de
 * taille dans l'une des trois le jour où l'on retouche les deux autres.
 *
 * **Le NOM ne le remplace pas** : sa consigne du 4 septembre. Un chevron
 * promet qu'on part quelque part, un nom qu'il s'ouvre.
 */
function ChevronDesPortes({
  chantier,
  onPortes,
}: {
  chantier: ChantierPlanning;
  onPortes: (c: ChantierPlanning) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPortes(chantier)}
      aria-label={`Ouvrir le chantier — ${chantier.nom}`}
      className="flex-shrink-0 cursor-pointer border-0 bg-transparent px-0.5 text-[19px]"
      style={{ color: colors.chevron }}
    >
      ›
    </button>
  );
}

function Fleche({
  libelle,
  signe,
  onClick,
}: {
  libelle: string;
  signe: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={libelle}
      onClick={onClick}
      className="h-[42px] w-[42px] flex-shrink-0 cursor-pointer rounded-full text-[19px] leading-none"
      style={{
        border: `1px solid ${colors.line}`,
        background: colors.card,
        color: colors.ink,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {signe}
    </button>
  );
}

/**
 * Le titre d'une section du planning.
 *
 * **`encadre` lui donne la pastille d'un JOUR** — sa demande du 26 août 2026,
 * capture à l'appui : *« le "sans date", mets-le comme le vendredi 28 août, avec
 * le rectangle ovale qui l'entoure, même couleur, tout pareil. "En attente du
 * client", fais pareil. »*
 *
 * **Pourquoi les deux, et pas « Planifiés ».** « Sans date » et « En attente du
 * client » occupent la MÊME place dans la lecture qu'un jour : ce sont des
 * chantiers qui n'ont pas encore le leur. « Planifiés », lui, coiffe le bloc
 * DANS lequel les jours vivent — lui donner la même pastille emboîterait une
 * pastille dans une pastille et écraserait la hiérarchie qu'on vient de rendre
 * lisible.
 *
 * **Le fond et l'encre viennent des mêmes jetons que la pastille du jour**
 * (`colors.rustTint`, `colors.ink`), et jamais d'une valeur recopiée : deux
 * chartes sont sombres, et une couleur écrite en clair y serait illisible
 * (`CLAUDE.md` §3).
 */
function TitreSection({
  children,
  encadre = false,
  ...reste
}: {
  children: React.ReactNode;
  encadre?: boolean;
} & React.HTMLAttributes<HTMLParagraphElement>) {
  if (!encadre) {
    return (
      <p
        {...reste}
        className="mx-[18px] mt-[26px] text-center text-[13px] font-bold uppercase leading-none"
        style={{ letterSpacing: "0.16em", color: colors.ink }}
      >
        {children}
      </p>
    );
  }
  return (
    <p {...reste} className="mx-[18px] mt-[26px] text-center leading-none">
      <span
        data-atlas="titre-encadre"
        className="inline-block rounded-full px-[15px] py-[7px] text-[12px] font-bold uppercase"
        style={{ letterSpacing: "0.14em", background: colors.rustTint, color: colors.ink }}
      >
        {children}
      </span>
    </p>
  );
}




function Pastille({ etat }: { etat: EtatDemi }) {
  return (
    <i
      data-atlas="pastille"
      data-etat={etat}
      className="inline-block h-[11px] w-[11px] flex-shrink-0 rounded-[3px]"
      style={
        etat === "libre"
          ? { background: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }
          : { background: fondDeLEtat(etat) }
      }
    />
  );
}

function Petit({
  children,
  onClick,
  retenue,
  fini,
  serre,
  absente,
  partielle,
  ...reste
}: {
  children: React.ReactNode;
  onClick: () => void;
  retenue?: boolean;
  fini?: boolean;
  /**
   * **Cette personne n'est pas là ce jour-là** — son signalement du
   * 7 septembre 2026 : *« il doit être grisé et on ne doit pas pouvoir le
   * sélectionner »*.
   *
   * **Grise TOUJOURS, n'interdit que la COCHE.** Une pastille déjà cochée
   * reste cliquable pour être retirée : c'est le seul chemin qui existe pour
   * réparer une coche antérieure au congé, et c'est exactement l'état qu'il a
   * photographié. Le gris dit alors qu'il faut la retirer, il n'enferme pas
   * dedans.
   *
   * **Ce que l'écran décide ici, c'est l'apparence, jamais la règle** : le
   * refus vit dans `equipe-absente.ts` et le serveur l'applique aussi
   * (`CLAUDE.md` §3).
   */
  absente?: boolean;
  /**
   * **Cochée, mais pas sur tous les jours du chantier** — sa proposition C,
   * retenue le 8 septembre 2026.
   *
   * **Un aplat ne peut pas porter une exception**, et c'est lui qui l'a relevé
   * sur la maquette : *« la phrase dit Julien en congé mais il est quand même
   * coché en vert, c'est normal ? »* Non — on lit l'aplat, pas ce qui
   * l'accompagne. Le cerne vert sans fond dit « oui, mais pas partout », et la
   * pastille porte alors les jours.
   */
  partielle?: boolean;
  /**
   * Resserré à 9 px, comme `.demi .petit` sur la planche 84.
   *
   * **Trois pixels par côté, et c'est la ligne entière qui tient ou se replie.**
   * Sur une ligne de demi-journée, l'écran aligne : pastille (11) + mot (70) +
   * équipe (75) + « Déplacer » + « Retirer », dans 324 px. Aux 12 px par défaut,
   * les deux boutons mesurent 74 et 62 — le total fait 324 pile, et « Retirer »
   * bascule à la ligne suivante. À 9 px ils font 68 et 56, et tout tient sur un
   * trait, comme sur la planche qu'il a validée.
   *
   * Trouvé en REGARDANT la capture, jamais par un test — la quatrième fois dans
   * ce dépôt (`CLAUDE.md` §5). La planche portait déjà la règle ; c'est la
   * transcription qui l'avait perdue.
   */
  serre?: boolean;
} & Record<string, unknown>) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...reste}
      disabled={absente && !retenue}
      aria-disabled={absente && !retenue ? true : undefined}
      data-absente={absente ? "1" : undefined}
      className={`flex-shrink-0 rounded-full py-[7px] text-[12px] ${
        absente && !retenue ? "cursor-not-allowed" : "cursor-pointer"
      } ${serre ? "px-[9px]" : "px-3"}`}
      style={{
        border: `1px solid ${
          absente
            ? colors.line
            : retenue || partielle
              ? colors.plein
              : fini
                ? colors.or
                : colors.line
        }`,
        background: retenue && !absente ? colors.plein : colors.card,
        color: absente
          ? colors.muted
          : retenue
            ? surPlein
            : partielle
              ? colors.plein
              : fini
                ? colors.or
                : colors.inkSoft,
        // **Le gris se voit, sans effacer.** À 0,5 la pastille disparaissait sur
        // les deux chartes sombres, mesuré : un nom qu'on ne lit plus ne dit pas
        // « absent », il dit « rien ».
        opacity: absente ? 0.72 : undefined,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {children}
    </button>
  );
}

/**
 * La pastille d'équipe.
 *
 * **Le « ＋ » qui dit qu'on peut en ajouter un autre.** Sa remarque du 21 août :
 * *« l'utilisateur voit marqué Paul, mais il ne se dit pas qu'il peut cliquer
 * dessus pour ajouter un autre gars »*. Un signe collé au nom coûte huit pixels
 * et se lit comme une invitation ; une phrase aurait pris une ligne.
 */
function PastilleEquipe({
  libelle,
  vide,
  onClick,
  avecPlus = true,
  ecriture = true,
}: {
  libelle: string;
  vide: boolean;
  /** L'événement est transmis : l'appelant y trouve la ligne à garder immobile. */
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  avecPlus?: boolean;
  /**
   * Faux pour un salarié (30 août 2026) : il LIT qui part, il ne le change pas.
   *
   * **Le nom reste**, c'est ce qui lui dit avec qui il travaille — mais rendu
   * en texte plutôt qu'en bouton. Un bouton d'apparence identique invite à un
   * geste que le serveur refuse, et le refus se lit alors comme une panne.
   *
   * **Et rien du tout quand personne n'est coché** : la pastille « vide » est
   * une invitation à cocher, et lui ne peut pas.
   */
  ecriture?: boolean;
}) {
  if (!ecriture) {
    if (vide) return null;
    return (
      <span
        data-atlas="equipe-lecture"
        className="flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px]"
        style={{ background: colors.plein, color: surPlein }}
      >
        {libelle}
      </span>
    );
  }

  return (
    <button
      type="button"
      data-atlas="equipe"
      data-vide={vide ? "1" : "0"}
      onClick={onClick}
      className="flex-shrink-0 cursor-pointer whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px]"
      style={{
        border: vide ? `1px dashed ${colors.or}` : "0",
        background: vide ? "transparent" : colors.plein,
        color: vide ? colors.or : surPlein,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {libelle}
      {avecPlus && !vide && (
        <span className="ml-1.5 text-[11px] opacity-65" aria-hidden="true">
          ＋
        </span>
      )}
    </button>
  );
}

/**
 * OÙ VA CE CHANTIER — la commune, sous sa durée.
 *
 * **Sa maquette du 3 septembre 2026.** L'adresse existait en base et ne servait
 * qu'aux boutons de la feuille : Maps, Waze, « copier l'adresse » la lisaient
 * sans jamais la montrer. Sur une liste où quatre clients s'appellent Martins,
 * c'est pourtant la seule chose qui dit LEQUEL.
 *
 * **Rien quand on ne sait pas.** `communeDeLAdresse` rend `null` plutôt que de
 * deviner, et la ligne disparaît alors : un nom de rue écrit à la place d'une
 * commune ferait partir le patron au mauvais endroit (`CLAUDE.md` §4).
 *
 * **Elle ne peut pas déborder.** La ligne des planifiés est mesurée au pixel
 * (`test-ligne-planning-e2e.ts`) : une commune longue est coupée plutôt que de
 * pousser la colonne — c'est le nom du client qui commande la largeur.
 */
function LieuDuChantier({ chantier }: { chantier: ChantierPlanning }) {
  const commune = communeDeLAdresse(chantier.adresseChantier);
  if (!commune) return null;
  return (
    <span
      data-atlas="lieu-du-chantier"
      className="mt-[2px] block truncate text-[11.5px] leading-[1.5]"
      style={{ color: colors.muted }}
    >
      {commune}
    </span>
  );
}

/** La rangée de boutons qui remplace ce qu'on vient de toucher. */
function Choisir({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-atlas="choisir"
      className="mt-1 flex flex-wrap justify-start gap-1.5"
      style={{ flexBasis: "100%" }}
    >
      {children}
    </div>
  );
}

type GestesCarte = {
  /**
   * Cette personne a-t-elle le droit de MODIFIER le planning ?
   *
   * Faux pour un salarié : la carte du jour ne montre alors ni pastille
   * d'équipe, ni « Déplacer », ni « Retirer », ni « Ajouter un chantier ».
   * Elle continue de montrer le jour, les chantiers, qui part et la feuille.
   */
  ecriture: boolean;
  /**
   * **À une seule équipe, aucune pastille.** Il n'y a personne à désigner :
   * écrire un nom d'organisation à un artisan qui travaille seul lui
   * inventerait une organisation qu'il n'a pas — le patron l'a interdit le
   * 10 août 2026 (`src/lib/equipes.ts`). La planche 84 en montre deux ; elle ne
   * dit rien du cas où il n'y en a aucun, et c'est la règle d'avant qui tranche.
   *
   * **C'est le compteur des SALARIÉS depuis le 26 août 2026**, et non celui des
   * équipes : les deux se sont séparés, et c'est le nombre de gens qui décide
   * s'il y a quelqu'un à cocher.
   */
  nombreSalaries: number;
  ouvert:
    | { quoi: "equipe"; cle: string; chantierId: string; demi: Demi }
    | { quoi: "deplacer"; cle: string; chantierId: string }
    | { quoi: "ajout-qui"; cle: string }
    | null;
  setOuvert: (o: GestesCarte["ouvert"]) => void;
  feuille: { chantierId: string; cle: string } | null;
  setFeuille: (f: { chantierId: string; cle: string } | null) => void;
  sansDate: ChantierPlanning[];
  nomEquipe: (rang: number) => string;
  lignesEquipes: { rang: number; nom?: string | null }[];
  occupationDe: (jour: JourIso, demi: Demi) => { pris: readonly ChantierPlanning[]; charge: number };
  chantiersDuJour: (jour: JourIso) => ChantierPlanning[];
  basculerEquipe: (chantierId: string, demi: Demi, rang: number) => void;
  deplacer: (chantierId: string, demi: Demi) => void;
  retirerDuJour: (chantierId: string) => void;
  poser: (chantierId: string, jour: JourIso) => void;
  taches: Record<string, FeuilleEtRetour>;
};

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
function BasculeDemi({
  depart,
  onChoisir,
}: {
  depart: Demi;
  onChoisir: (demi: Demi) => void;
}) {
  return (
    <span
      data-atlas="bascule-demi"
      className="flex overflow-hidden rounded-full"
      style={{ border: `1px solid ${colors.line}`, background: colors.card }}
    >
      {DEMIS.map((d) => {
        const tenue = d === depart;
        return (
          <button
            key={d}
            type="button"
            data-vers={d}
            aria-pressed={tenue}
            onClick={() => onChoisir(d)}
            className="cursor-pointer px-3.5 py-[7px] text-[12px]"
            style={{
              border: 0,
              // L'aplat porte la position tenue ; `surPlein` donne l'encre qui
              // s'y lit, sur les sept chartes — dont les deux sombres, où les
              // pôles s'inversent (`CLAUDE.md` §3).
              // `colors.plein` et `surPlein` : le même couple que les pastilles
              // retenues de cet écran. Une couleur écrite en clair serait juste
              // cinq chartes sur sept, et illisible sur les deux sombres.
              background: tenue ? colors.plein : "transparent",
              color: tenue ? surPlein : colors.inkSoft,
            }}
          >
            {MOT_DEMI[d]}
          </button>
        );
      })}
    </span>
  );
}

/**
 * LE GESTE D'AJOUT D'UNE JOURNÉE — écrit une fois, posé à deux endroits.
 *
 * **Il appartient au JOUR, pas au chantier.** Sur la planche 86 il vit sous la
 * liste des chantiers de la journée, après le dernier volet ; le laisser dans
 * le volet d'un chantier le ferait apparaître autant de fois qu'il y a de
 * chantiers, et laisserait croire qu'on ajoute quelque chose À ce chantier.
 *
 * Sa demande du 21 août tient toujours : *« le "+ Ajouter un chantier", tu le
 * mets en dessous, un rond avec un plus ; je ne veux pas qu'il soit affilié à
 * la case matin ou après-midi »*.
 */
function AjoutAuJour({
  cle,
  jour,
  ouvert,
  setOuvert,
  sansDate,
  poser,
}: {
  cle: string;
  jour: JourIso;
} & Pick<GestesCarte, "ouvert" | "setOuvert" | "sansDate" | "poser">) {
  // ─── RIEN À AJOUTER : PAS DE GESTE ────────────────────────────────────────
  //
  // **Sa remarque du 23 août 2026 :** *« lorsqu'aucun chantier n'attend de
  // jour, il ne faudrait pas que le bouton "Ajouter un chantier" apparaisse à
  // l'écran, car il peut nous induire en erreur »*.
  //
  // Et il a raison au sens strict : ce geste ne CRÉE rien. Il ouvre la liste
  // des chantiers qui attendent une date, et les pose sur la journée. Sans
  // aucun chantier en attente, il ne pouvait mener qu'à « Aucun chantier
  // n'attend de jour » — un cul-de-sac qui promet un chantier de plus et rend
  // une phrase. Pire : la même phrase s'écrivait déjà sous « Sans date », deux
  // lignes plus bas, si bien que l'écran la disait deux fois.
  //
  // **Le bouton ne se grise pas, il DISPARAÎT.** Un rond doré éteint reste un
  // rond doré : on appuie dessus pour savoir pourquoi il est éteint, et l'on
  // retombe dans le même cul-de-sac par un chemin plus long.
  if (sansDate.length === 0) return null;

  return (
    <>
      {ouvert?.quoi === "ajout-qui" && ouvert.cle === cle ? (
        <div className="mt-3.5 pt-3">
          {/* Plus de repli « Aucun chantier n'attend de jour » ici : on n'y
              arrive plus, puisque le geste lui-même n'existe pas dans ce cas.
              Le laisser aurait été une branche morte — et surtout la promesse
              qu'on peut encore tomber sur ce cul-de-sac. */}
          {/* **LE NOM POSE LE CHANTIER, ET C'EST TOUT** — sa remarque du
              9 septembre 2026. Il y avait ici un second temps : on touchait le
              nom, et trois boutons demandaient « Matin, Après-midi ou
              Journée ». La durée du chantier étant déjà en base, cette
              question-là ne comblait aucun trou — elle proposait d'écraser ce
              que le devis avait fixé (voir `poser`). Un geste, une pose. */}
          <Choisir>
            {sansDate.map((s) => (
              <Petit key={s.id} data-qui={s.id} onClick={() => poser(s.id, jour)}>
                {s.nom}
              </Petit>
            ))}
          </Choisir>
        </div>
      ) : (
        /* **Plus de filet au-dessus du « + »** — sa demande du 23 août 2026 :
           *« la ligne qui se trouve entre le nom et le "+ Ajouter un chantier",
           supprime-la »*. La planche 86 n'en porte pas : c'est l'écran qui en
           avait ajouté un, et il refermait la journée juste avant le geste qui
           la prolonge. */
        <div
          className="mt-3.5 flex items-center justify-center gap-2.5 pt-3 text-[12.5px]"
          style={{ color: colors.inkSoft }}
        >
          <button
            type="button"
            data-atlas="ajouter"
            aria-label="Ajouter un chantier"
            onClick={() => setOuvert({ quoi: "ajout-qui", cle })}
            className="h-[34px] w-[34px] cursor-pointer rounded-full text-[19px] leading-none"
            style={{
              border: `1px solid ${colors.or}`,
              background: "transparent",
              color: colors.or,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            +
          </button>
          <span>Ajouter un chantier</span>
        </div>
      )}
    </>
  );
}

/**
 * « Je ne suis pas là ce jour-là » — le raccourci du 6 septembre 2026.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE CE COMPOSANT NE FAIT PAS, ET C'EST L'ESSENTIEL.** Il ne décide RIEN
 * de la disponibilité. Fermer un jour écrit une absence d'un jour — la même
 * ligne que l'écran des Réglages —, et c'est `fusionnerAbsences` qui, comme
 * depuis le 14 août, retire la place. Les trois chemins la voient déjà :
 * l'écran d'envoi, l'envoi, et la revérification quand le client répond.
 *
 * **Une seconde façon de fermer un jour aurait divergé de la première**
 * (`CLAUDE.md` §3), et c'est la disponibilité qui l'aurait payé : un jour
 * fermé ici mais ouvert là-bas part chez un client.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * **SANS SALARIÉ, UN SEUL APPUI.** Sa correction du 6 septembre : *« c'est pas
 * les équipes, c'est le nom des salariés qu'il faut mettre »*. Quand il
 * travaille seul, il n'y a personne à désigner : une ligne, un appui, le jour
 * se ferme. La question « qui ? » ne s'ouvre que s'il a quelqu'un — la poser à
 * un artisan seul serait un geste de plus pour rien.
 *
 * **RIEN DE CACHÉ** (`PRODUCT.md`) : pas d'appui long, pas de glissement. Une
 * ligne visible dans la carte qu'il ouvre déjà en touchant un jour.
 *
 * **UN JOUR PASSÉ NE SE FERME PAS** : l'appelant ne rend ce bloc que sur un
 * jour à venir, par le même drapeau `ecriture` que le reste de la carte.
 */
/**
 * Les deux façons de restreindre une absence — la journée entière n'y est pas.
 *
 * **Son choix D2, le 8 septembre 2026, et c'est une mesure.** Trois pastilles
 * plus le mot « Quand » faisaient 440 px pour 354 disponibles : la ligne se
 * repliait dès qu'un écran était un peu plus étroit que le sien, et une
 * troisième pastille « La journée » ne tient pas davantage dans l'application
 * que sur la planche — vérifié à l'écran, pas supposé.
 *
 * **Toucher un nom pose la journée entière, tout de suite.** C'est le cas
 * courant, et il reste à un appui, exactement comme avant ce lot. Les deux
 * pastilles ci-dessous ne servent qu'à RESTREINDRE ce qui vient d'être posé —
 * le jour où ça compte.
 */
const MOMENTS_ABSENCE: { cle: "matin" | "apres_midi"; mot: string }[] = [
  { cle: "matin", mot: "Matin" },
  { cle: "apres_midi", mot: "Après-midi" },
];

/**
 * Une question et ses pastilles, sur la MÊME ligne.
 *
 * **Sa demande du 8 septembre 2026 :** *« Qui n'est pas là ? et Quand ? doivent
 * tenir sur la même ligne. »* C'est déjà la grammaire de sa carte du jour —
 * « APRÈS-MIDI [Qui ?] » — et le libellé n'a pas à prendre une ligne pour lui :
 * il annonce, il n'occupe pas.
 */
function LigneQuestion({
  libelle,
  children,
}: {
  libelle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-2">
      <span className={libelleCaps} style={{ color: colors.muted, flex: "none" }}>
        {libelle}
      </span>
      {children}
    </div>
  );
}

/**
 * La pastille des gestes d'une journée.
 *
 * **Elle existe parce que le même dessin était déjà écrit en dur** pour les
 * noms d'équipe, et qu'il fallait l'écrire une seconde fois le 7 septembre
 * 2026 pour « Quelqu'un n'est pas là » (son choix, variante A de la planche
 * « Deux mots du planning »). Deux copies du même bouton auraient divergé au
 * premier ajustement — c'est exactement ce que `CLAUDE.md` §3 interdit.
 *
 * **Le cerne est un `inset`, pas une bordure**, et c'est la mesure d'origine :
 * une bordure ajoute un pixel de chaque côté et décale la pastille de ses
 * voisines d'une demi-ligne. `min-h-[48px]` est la cible du pouce.
 */
function PastilleDuJour({
  children,
  onClick,
  retenue,
  ...reste
}: {
  children: React.ReactNode;
  onClick: () => void;
  /** Le choix par défaut, montré comme tel — « la journée », le cas courant. */
  retenue?: boolean;
} & Record<string, unknown>) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...reste}
      className="min-h-[48px] rounded-full px-4 text-[14px]"
      style={{
        backgroundColor: retenue ? colors.plein : colors.card,
        color: retenue ? surPlein : colors.ink,
        boxShadow: retenue ? "none" : `inset 0 0 0 1px ${colors.line}`,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {children}
    </button>
  );
}

/**
 * LE GESTE D'UNE ABSENCE — un +, deux mots, aucun contour.
 *
 * **Sa décision du 9 septembre 2026**, planche `appli/salarie-s-absente.html` :
 * *« Quelqu'un pas là faut le changer par salarié absent avec un petit +
 * plutôt que le gros bouton »*, puis *« Salarié absent + sans contour ! »*.
 *
 * **CE QUI REMPLACE LE CERNE, C'EST LE +, ET CE N'EST PAS UN ORNEMENT.** Le
 * 7 septembre, ce même geste était une phrase nue et lui a échappé une journée
 * entière : *« comment savoir qu'il faut cliquer dessus ? »*. On y avait
 * répondu par une pastille ; il la trouve trop grosse, et il a raison — mais
 * on ne peut pas retirer la pastille ET laisser du texte nu, ce serait
 * remettre le défaut du 7. Le + porte ce que le cerne portait : « ceci
 * s'appuie, et ça ajoute quelque chose ».
 *
 * **L'ENCRE RÉTRÉCIT, LA CIBLE NON** : 44 px de haut, pleine largeur. Un geste
 * qu'on rate avec des gants ne vaut pas mieux qu'un geste qu'on ne voit pas.
 */
function GesteAbsence({
  children,
  onClick,
  ...reste
}: {
  children: React.ReactNode;
  onClick: () => void;
} & Record<string, unknown>) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...reste}
      className="flex min-h-[44px] w-full items-center gap-2.5 py-[9px] text-left text-[14.5px]"
      style={{ color: colors.ink, WebkitTapHighlightColor: "transparent" }}
    >
      <span
        aria-hidden="true"
        className="text-[19px] leading-none"
        style={{ flex: "none", marginTop: -2 }}
      >
        +
      </span>
      <span>{children}</span>
    </button>
  );
}

function PasLaCeJour({
  jour,
  absences,
  lignesEquipes,
  nombreSalaries,
  nomEquipe,
  fermer,
  rouvrir,
}: {
  jour: JourIso;
  absences: AbsenceDuPlanning[];
  lignesEquipes: { rang: number; nom?: string | null }[];
  nombreSalaries: number;
  nomEquipe: (rang: number) => string;
  fermer: (jour: JourIso, rang: number, quand?: "matin" | "apres_midi" | null) => void;
  rouvrir: (id: string) => void;
}) {
  const [demande, setDemande] = useState(false);
  /** Qui il vient de poser absent — le seul à qui « Plutôt » s'adresse (D2). */
  const [quiManque, setQuiManque] = useState<number | null>(null);

  // **Le rang 1, c'est LUI.** Sans salarié, la seule ligne d'équipe qui existe
  // est la sienne : fermer le jour revient à noter son absence à ce rang-là.
  const rangs = nombreSalaries > 0 ? lignesEquipes.map((e) => e.rang) : [1];
  const absentsParRang = new Map(absences.map((a) => [a.rang, a]));
  const tousAbsents = rangs.every((r) => absentsParRang.has(r));

  /** Ce que porte l'absence qu'il vient de poser : la journée, ou une moitié. */
  const posee = quiManque === null ? undefined : absentsParRang.get(quiManque);
  const demiPosee =
    posee && posee.premierDemi === posee.dernierDemi ? (posee.premierDemi ?? null) : null;

  /**
   * Ramener une absence du jour à une seule demi-journée.
   *
   * **On retire et on repose**, plutôt que de modifier. Une action de mise à
   * jour aurait ajouté un troisième chemin d'écriture sur cette table — donc un
   * troisième endroit où la réconciliation des affectations pourrait être
   * oubliée (`ARCHITECTURE.md` §294). Reposer traverse celle qui existe déjà.
   */
  function restreindre(rang: number, quand: "matin" | "apres_midi") {
    const a = absentsParRang.get(rang);
    if (!a) return;
    rouvrir(a.id);
    fermer(jour, rang, quand);
  }

  const ligne = "flex min-h-[48px] w-full items-center justify-between gap-3 py-[11px] text-left";

  return (
    <div className="mt-1 border-t pt-1" style={{ borderColor: colors.lineSoft }}>
      {/* Ce qui est déjà fermé se DIT, et se défait du même geste. */}
      {absences.map((a) => (
        <button
          key={a.id}
          type="button"
          data-atlas="rouvrir-le-jour"
          onClick={() => rouvrir(a.id)}
          className={ligne}
        >
          <span className="min-w-0 flex-1 text-[14.5px]" style={{ color: colors.ink }}>
            {nombreSalaries > 0
              ? `${nomEquipe(a.rang)} n\u2019est pas là`
              : "Vous n\u2019êtes pas là"}
          </span>
          <span className={texteSituation} style={{ color: colors.muted, flex: "none" }}>
            Annuler
          </span>
        </button>
      ))}

      {/* ─── LE GESTE SE VOIT, IL NE SE DEVINE PLUS — 7 septembre 2026 ──────
          **Sa remarque, capture à l'appui :** *« y'a marqué "quelqu'un pas là"
          mais comment savoir qu'il faut cliquer dessus ? On comprend pas
          bien ! »* — et il avait raison : ce texte était un bouton depuis la
          veille, sans cerne, sans couleur, sans forme. Il avait exactement
          l'allure d'une phrase posée là, si bien qu'une fonction livrée le
          6 septembre était restée invisible.

          **Sa réponse du 7 septembre** était une pastille, comme les autres
          gestes de la feuille. **Le 9, il l'a trouvée trop grosse** — *« un
          petit + plutôt que le gros bouton »*, puis *« sans contour »*. Ce qui
          reconnaît le geste n'est donc plus le cerne mais le **+** (voir
          `GesteAbsence` : le pourquoi y est écrit en entier).

          **Pas de flèche au bout, et ce n'est pas un oubli** : sa règle du
          25 août. Un bouton n'a pas besoin d'une flèche pour dire qu'on
          l'appuie.

          **La ligne d'une absence DÉJÀ posée, elle, ne change pas.** Elle
          porte « Annuler » à droite, un mot qui nomme son geste : elle n'a
          jamais eu le défaut que celle-ci avait. */}
      {/* **Restreindre à une demi-journée, juste après l'avoir posée.**
          Son choix D2 : la journée est le geste courant, et ces deux pastilles
          ne servent qu'au jour où un rendez-vous ne prend qu'une matinée.
          Elles ne s'affichent QUE sur l'absence qu'il vient de poser — les
          faire vivre sous chaque ligne remettrait deux gestes là où il n'en
          faut qu'un. */}
      {quiManque !== null && absentsParRang.has(quiManque) && (
        <LigneQuestion libelle="Plutôt">
          {MOMENTS_ABSENCE.map((m) => (
            <PastilleDuJour
              key={m.cle}
              data-atlas="quand-absent"
              data-quand={m.cle}
              retenue={demiPosee === m.cle}
              onClick={() => restreindre(quiManque, m.cle)}
            >
              {m.mot}
            </PastilleDuJour>
          ))}
        </LigneQuestion>
      )}

      {/* ─── PLUS DE TITRE « CE JOUR-LÀ » — 9 septembre 2026 ──────────────
          *« Retire ce jour-là, on sait que c'est ce jour. »* La carte porte la
          date en tête, à deux centimètres au-dessus : le redire n'apprend rien
          et coûte une ligne sur un téléphone (`CLAUDE.md` §3). */}
      {!tousAbsents && (
        <div className="py-2">
          {nombreSalaries === 0 ? (
            <GesteAbsence
              data-atlas="fermer-le-jour"
              onClick={() => fermer(jour, 1)}
            >
              Je ne suis pas là
            </GesteAbsence>
          ) : !demande ? (
            /* **« Salarié absent ? », et le point d'interrogation est de lui**
               — son choix du 9 septembre, en trois fois : le mot, puis « sans
               contour », puis *« rajoute un ? à la fin »*.

               **Il dit vrai de ce que le geste fait :** ce bouton ne note rien,
               il ouvre la question « Qui ? » — la même grammaire que la
               pastille d'équipe juste en dessous. */
            <GesteAbsence
              data-atlas="fermer-le-jour"
              onClick={() => setDemande(true)}
            >
              Salarié absent&nbsp;?
            </GesteAbsence>
          ) : (
            /* ─── SON CHOIX D2, LE 8 SEPTEMBRE 2026 ────────────────────────
               Sa question : *« lorsque je note les congés, je peux les mettre
               seulement le matin ou seulement l'après-midi ? Sinon il faut
               corriger ça. »* Non — une absence prenait la journée entière, et
               un rendez-vous d'une heure lui coûtait la journée de son gars.

               **Deux lignes, « Qui » puis « Quand »**, chacune sur la ligne de
               ses pastilles : sa demande du même jour. Mesuré sur la planche,
               trois pastilles plus le mot ne tenaient QUE sur son téléphone —
               d'où deux pastilles, et rien de coché valant la journée.

               **Le cas courant reste en un appui** : il touche un nom, et
               c'est la journée. « Matin » et « Après-midi » n'existent que
               pour le jour où ça compte.

               **La question ne s'ouvre QUE s'il a quelqu'un.** Fermer la
               journée entière quand une seule personne manque lui coûterait un
               chantier que l'autre pouvait faire. */
            <>
              <LigneQuestion libelle="Qui">
                {rangs
                  .filter((r) => !absentsParRang.has(r))
                  .map((r) => (
                    <PastilleDuJour
                      key={r}
                      data-atlas="qui-nest-pas-la"
                      onClick={() => {
                        // **La journée entière, tout de suite.** Le cas courant
                        // reste à un appui : il touche un nom, c'est posé.
                        fermer(jour, r);
                        setQuiManque(r);
                        setDemande(false);
                      }}
                    >
                      {nomEquipe(r)}
                    </PastilleDuJour>
                  ))}
              </LigneQuestion>
            </>
          )}
        </div>
      )}
    </div>
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
function CarteDuJour({
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
  lignesEquipes,
  occupationDe,
  chantiersDuJour,
  basculerEquipe,
  deplacer,
  retirerDuJour,
  poser,
  taches,
  absencesDuJour,
  joursAbsentsDe,
  joursDeLaPastilleDe,
  fermerLeJour,
  rouvrirLeJour,
}: {
  cle: string;
  jour: JourIso;
  /** Qui n'est pas là ce jour-là — voir §267. */
  absencesDuJour: (jour: JourIso) => AbsenceDuPlanning[];
  /** Les jours d'un chantier où cette personne n'est pas là — voir §293. */
  joursAbsentsDe: (rang: number, c: ChantierPourAbsence) => JourIso[];
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
          if (bloc.type === "libre") {
            const o = occupationDe(jour, bloc.demi);
            return (
              <div
                key={`libre-${bloc.demi}`}
                data-atlas="demi"
                data-bloc={bloc.demi}
                data-sans-chantier="1"
                className="flex flex-wrap items-center gap-2"
                style={{ marginTop: rang === 0 ? 8 : 16 }}
              >
                <Pastille etat={etatDemi(o)} />
                <span
                  className="w-[70px] flex-shrink-0 whitespace-nowrap text-[10px] font-semibold uppercase leading-[1.15]"
                  style={{ letterSpacing: "0.06em", color: colors.ink }}
                >
                  {MOT_DEMI[bloc.demi]}
                </span>
                <span
                  data-atlas="compte"
                  className="ml-auto text-[12px]"
                  style={{ color: colors.muted }}
                >
                  {ditLeCompteDemi(o)}
                </span>
              </div>
            );
          }

          const c = bloc.chantier;
          // **Au CHANTIER, plus à la demi-journée.** « Déplacer » écrit un
          // départ et une durée sur le chantier entier : le rattacher à une
          // moitié de journée n'avait de sens que tant que le bouton vivait sur
          // sa ligne, et il en ouvrait alors deux à la fois.
          const choixDeplacer =
            ouvert?.quoi === "deplacer" && ouvert.cle === cle && ouvert.chantierId === c.id;

          return (
            <div
              key={c.id}
              data-atlas="bloc-chantier"
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
                  className="w-full cursor-pointer border-0 bg-transparent p-0 text-left"
                >
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
                    {ditLaDuree(dureeDuChantier(c))}
                  </span>
                  <LieuDuChantier chantier={c} />
                </button>
              )}

              {bloc.demis.map((demi) => {
                const o = occupationDe(jour, demi);
                const rangs = demi === "matin" ? c.equipes.matin : c.equipes.apres_midi;
                // **Qui part VRAIMENT ce jour-là** — la coche vaut pour tout le
                // chantier, la carte montre un seul jour (sa proposition C du
                // 8 septembre 2026). Un absent nommé sur la journée où il ne
                // vient pas, c'est le défaut qu'il a photographié le 7.
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
                      />
                    ) : choixEquipe ? (
                      // **On COCHE, on ne choisit pas une seule fois.** La liste
                      // reste ouverte tant qu'il n'a pas fini, et le calendrier
                      // se repeint derrière à chaque coche — sinon il faudrait
                      // refermer pour voir l'effet, et rouvrir pour corriger.
                      <Choisir>
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
                          const absente =
                            joursAbsentsDe(e.rang, c).length > 0 && jours === "";
                          return (
                            <Petit
                              key={e.rang}
                              serre
                              data-choix={e.rang}
                              retenue={cochee && jours === ""}
                              partielle={cochee && jours !== ""}
                              absente={absente}
                              onClick={() => basculerEquipe(c.id, demi, e.rang)}
                            >
                              {cochee ? "✓ " : ""}
                              {nomEquipe(e.rang)}
                              {/* **Les jours de PRÉSENCE, pas d'absence** —
                                  « ven. » répond à « quand vient-il », là où
                                  « pas jeudi » oblige à soustraire de tête. */}
                              {jours && (
                                <span className="ml-1 font-medium">{jours}</span>
                              )}
                            </Petit>
                          );
                        })}
                        <Petit serre data-fini="1" fini onClick={() => setOuvert(null)}>
                          Terminé
                        </Petit>
                      </Choisir>
                    ) : (
                      <PastilleEquipe
                        vide={rangs.length === 0}
                        libelle={ditQuiPart(rangsPresents.map(nomEquipe))}
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
              {ecriture && (
                <div
                  data-atlas="actes-chantier"
                  className="mt-2.5 flex flex-wrap items-center justify-end gap-1.5"
                >
                  {choixDeplacer ? (
                    <BasculeDemi
                      depart={departDuChantier(c)}
                      onChoisir={(demi) => deplacer(c.id, demi)}
                    />
                  ) : (
                    <>
                      <Petit
                        data-atlas="deplacer"
                        onClick={() => setOuvert({ quoi: "deplacer", cle, chantierId: c.id })}
                      >
                        Déplacer
                      </Petit>
                      <Petit data-atlas="retirer" onClick={() => retirerDuJour(c.id)}>
                        Retirer
                      </Petit>
                    </>
                  )}
                </div>
              )}
            </div>
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
          />
        )}

      </div>
      </div>

      {feuilleIci && (
        <FeuilleChantier
          key={feuilleIci}
          chantier={duJour.find((c) => c.id === feuilleIci) ?? null}
          feuille={taches[feuilleIci]}
          ecriture={ecriture}
          dansLeMois={Boolean(attache)}
        />
      )}
    </>
  );
}

/**
 * LE PENSE-BÊTE DU CHANTIER — « penser à prendre le broyeur ».
 *
 * **Sa demande du 23 août 2026**, et la planche 93 retenue : *« un petit
 * encadré où l'utilisateur peut marquer quelque chose [...] client plus
 * disponible à partir de neuf heures »*. Variante **A** : le cadre est ouvert
 * en permanence.
 *
 * **Pourquoi A plutôt que B**, et la raison n'est pas le confort. La planche
 * proposait aussi une ligne discrète « ＋ Ajouter une note », plus économe de
 * 96 px. Devant l'image, il a répondu : *« B, y'a rien ? Je vois rien »* — et
 * c'était le renseignement décisif. Une invitation qu'il ne voit pas sur une
 * capture, il ne la trouvera pas davantage sur un chantier.
 *
 * **Elle ne part sur AUCUN document.** Sa décision : *« elle peut rester là,
 * car les salariés auront accès au planning ; justement, c'est pour cela que je
 * voulait le devis sans les prix »*. Le PDF est le devis expurgé de ses prix ;
 * la note, elle, vit ici — et ses équipes la lisent en ouvrant la feuille.
 */
function NoteDuChantier({
  chantier,
  ecriture,
}: {
  chantier: ChantierPlanning;
  /**
   * **Un salarié LIT la note, il ne l'écrit pas** — 30 août 2026.
   *
   * Et il faut qu'il la lise : c'est la raison même pour laquelle elle existe.
   * Sa décision du 23 août : *« elle peut rester là, car les salariés auront
   * accès au planning »*. Le broyeur à prendre, le client dispo à 9 h — c'est
   * l'équipe sur place qui en a besoin.
   *
   * **Un cadre de saisie grisé aurait été le mauvais choix** : il se touche, il
   * ne répond pas, et l'on croit à une panne. Sans note, rien ne s'affiche —
   * un titre « Ma note » au-dessus du vide n'apprend rien (`CLAUDE.md` §3).
   */
  ecriture: boolean;
}) {
  // Semée depuis la liste, jamais relue au montage : la note descend déjà avec
  // le planning, et un second aller-retour l'afficherait vide une seconde.
  const [texte, setTexte] = useState(chantier.note ?? "");
  const [etat, setEtat] = useState<"repos" | "ecrit" | "enregistre" | "perdu">("repos");
  const [, enTransition] = useTransition();

  function enregistrer() {
    if (texte === (chantier.note ?? "")) return;
    enTransition(async () => {
      const r = await ecrireNoteChantierAction(chantier.id, texte);
      if (!r.succes) {
        // **Le refus se DIT.** Une note perdue en silence, c'est le broyeur
        // oublié — et il croirait l'avoir noté.
        setEtat("perdu");
        return;
      }
      chantier.note = r.note;
      setEtat("enregistre");
    });
  }

  if (!ecriture) {
    const ecrite = (chantier.note ?? "").trim();
    if (ecrite === "") return null;
    return (
      <div className="mt-3.5 pt-3" style={{ borderTop: `1px solid ${colors.line}` }}>
        <p
          className="m-0 mb-2 text-[10px] font-semibold uppercase leading-none"
          style={{ letterSpacing: "0.16em", color: colors.muted }}
        >
          La note
        </p>
        <p
          data-atlas="note-lecture"
          className="m-0 whitespace-pre-wrap break-words text-[14.5px] leading-[1.45]"
          style={{ color: colors.ink }}
        >
          {ecrite}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3.5 pt-3" style={{ borderTop: `1px solid ${colors.line}` }}>
      <p
        className="m-0 mb-2 text-[10px] font-semibold uppercase leading-none"
        style={{ letterSpacing: "0.16em", color: colors.muted }}
      >
        Ma note
      </p>
      <textarea
        data-atlas="note-chantier"
        value={texte}
        onChange={(e) => {
          setTexte(e.target.value.slice(0, NOTE_MAX));
          setEtat("ecrit");
        }}
        // **Enregistré en SORTANT du cadre, jamais par un bouton.** Il range
        // son téléphone et démarre : un bouton non touché perdrait la note.
        onBlur={enregistrer}
        placeholder="Penser à prendre le broyeur. Client dispo à partir de 9 h."
        rows={3}
        className="w-full resize-none rounded-[9px] px-3 py-2.5"
        style={{
          border: `1px solid ${colors.line}`,
          background: colors.card,
          color: colors.ink,
          // **16 px au moins.** En dessous, iOS grossit la page à la mise au
          // point et l'écran saute sous le doigt — un piège déjà payé ici.
          fontSize: 16,
          lineHeight: 1.45,
          WebkitTapHighlightColor: "transparent",
        }}
      />
      <p
        data-atlas="note-etat"
        className="m-0 mt-1.5 min-h-[17px] text-[12.5px]"
        style={{ color: etat === "perdu" ? colors.bordeaux : colors.rust }}
      >
        {etat === "enregistre"
          ? "Enregistré."
          : etat === "perdu"
            ? "La note n’a pas pu être enregistrée. Réessayez."
            : ""}
      </p>
    </div>
  );
}

/**
 * LA FEUILLE DE CHANTIER — le devis, sans un seul prix.
 *
 * Sa question du 21 août 2026 : *« le salarié ne doit pas avoir accès au prix.
 * Est-ce que tu peux me faire un PDF du devis sans les prix, ou est-ce que le
 * plus simple c'est de créer une fiche prestations sous le client ? »* — puis sa
 * réponse : *« je pense que le plus simple, ça serait de mettre le devis en PDF
 * sans les prix »*.
 *
 * **C'est le bon choix, et pour une raison de fond :** une fiche
 * « prestations » saisie à côté serait une SECONDE liste de ce qui est à faire.
 * Le devis change — une ligne ajoutée au téléphone, une quantité corrigée — et
 * les deux divergent en silence ; l'équipe part alors avec la version d'avant.
 *
 * **Les gestes de « Y aller » sont repris, pas réinventés** : sa demande du même
 * jour — *« reprends l'adresse cliquable qui ouvre Maps ou Waze — pas besoin
 * d'en mettre trois —, la possibilité d'appeler le client et de copier
 * l'adresse. Le reste, on n'en aura pas besoin. »* Les liens viennent de
 * `src/lib/itineraire.ts`, jamais recopiés à la main.
 *
 * **L'adresse ne s'AFFICHE plus** — sa demande du même message — mais elle sert
 * toujours : les quatre gestes la lisent sans la montrer.
 */
function FeuilleChantier({
  chantier,
  feuille,
  ecriture = true,
  dansLeMois = false,
}: {
  chantier: ChantierPlanning | null;
  feuille?: FeuilleEtRetour;
  /** Faux pour un salarié : la note se LIT, elle ne s'écrit pas (30 août 2026). */
  ecriture?: boolean;
  /** Dans le mois, elle suit les marges de la grille et non celles de la liste. */
  dansLeMois?: boolean;
}) {
  // **`key={chantier.id}` là où elle est rendue** : changer de chantier remonte
  // le composant, et « Adresse copiée » repart à zéro sans qu'un effet ait à le
  // remettre à la main — un effet qui appelle `setState` fait un rendu de plus
  // pour rien.
  const [copie, setCopie] = useState<"non" | "faite" | "refusee">("non");
  /**
   * La fin de chantier est dépliée : les lignes du devis cèdent la place.
   *
   * **Ce n'est qu'un écho**, jamais la source : c'est `FinDeChantier` qui
   * décide d'être ouvert ou non, parce que c'est lui qui charge son état à
   * l'ouverture. En tenir une seconde copie ici, c'est deux vérités pour une
   * question (`CLAUDE.md` §3) — et le jour où elles divergent, l'écran perd
   * ses lignes sur un bandeau replié.
   */
  const [finOuverte, setFinOuverte] = useState(false);

  if (!chantier) return null;
  const adresse = chantier.adresseChantier?.trim() || null;
  // **Deux destinations, plus trois.** Sa demande du 21 août : « pas besoin
  // d'en mettre trois ». Et « Maps », c'est **Google Maps** — sa demande du
  // 31 août 2026, capture à l'appui : *« pour Maps c'est Google Maps que je
  // veux »*. Le bouton servait Plans d'Apple, qui est ce que son iPhone appelle
  // « Plans » ; ce n'est pas ce qu'il ouvre pour aller sur un chantier.
  const liens = liensItineraire(adresse);
  const tel = lienAppel(chantier.clientTelephone);

  return (
    <div
      data-atlas="feuille"
      className={`${dansLeMois ? "" : "mx-[18px] "}mt-3 rounded-[10px] px-4 pb-[18px] pt-4`}
      style={{ background: colors.rustTint, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
    >
      <p
        className="m-0 text-center text-[10.5px] font-bold uppercase leading-none"
        style={{ letterSpacing: "0.24em", color: colors.or }}
      >
        {/* **« Fiche d'intervention » depuis le 8 septembre 2026** — sa demande,
            capture à l'appui : *« qui d'ailleurs devrait s'appeler fiche
            d'intervention, change le nom »*. Le mot a changé le jour où la
            feuille a cessé d'être un document à lire pour devenir ce que le
            salarié REMPLIT. */}
        Fiche d&apos;intervention
      </p>
      <p
        className="mb-0 mt-2.5 text-center"
        style={{ fontFamily: font.display, fontSize: 22, lineHeight: 1.15 }}
      >
        {chantier.clientNom ?? chantier.nom}
      </p>

      <div className="mt-2.5 flex gap-1.5">
        <Geste href={liens?.google ?? null}>Maps</Geste>
        <Geste href={liens?.waze ?? null}>Waze</Geste>
      </div>
      <div className="mt-1.5 flex gap-1.5">
        <Geste
          onClick={
            adresse
              ? async () => {
                  try {
                    await navigator.clipboard.writeText(adresse);
                    setCopie("faite");
                  } catch {
                    setCopie("refusee");
                  }
                }
              : null
          }
        >
          {copie === "faite"
            ? "Adresse copiée"
            : copie === "refusee"
              ? "Copie refusée"
              : "Copier l’adresse"}
        </Geste>
        <Geste href={tel}>Appeler le client</Geste>
      </div>

      <NoteDuChantier chantier={chantier} ecriture={ecriture} />

      {/* ─── CE QU'IL A PHOTOGRAPHIÉ DU CHANTIER ──────────────────────────
          **Sa remarque du 9 septembre 2026 :** *« j'ai joint des photos lorsque
          j'ai créé la fiche client de Julien, mais elles n'apparaissent nulle
          part »*, puis : *« elles devraient être au-dessus de Désherbage
          gravier »*.

          **Elles existaient**, et c'est le pire des cas : on ne les voyait que
          dans le tiroir « Fin de chantier », parmi les preuves à cocher —
          c'est-à-dire APRÈS le travail, dans un endroit qu'on n'ouvre qu'en
          partant. Or il les joint pour montrer le chantier à celui qui s'y
          rend : leur place est AVANT, avec la note et les lignes du devis.

          **Elles ne se cachent pas quand la fin de chantier s'ouvre.** La liste
          du devis, elle, disparaît parce qu'elle DEVIENT les cases à cocher ;
          les photos, non — elles restent ce qu'il faut regarder pendant qu'on
          coche. */}
      {(feuille?.photos ?? []).length > 0 && (
        <div className="mt-3.5 pt-3" style={{ borderTop: `1px solid ${colors.line}` }}>
          <div className="flex flex-wrap gap-2">
            {(feuille?.photos ?? []).map((photo) => (
              <a
                key={photo.id}
                href={`/api/fichiers/${photo.storageKey}`}
                target="_blank"
                rel="noreferrer"
                data-atlas="photo-du-chantier"
                className="h-[74px] w-[74px] overflow-hidden rounded-[11px]"
                style={{
                  // **Un fond, pour qu'une photo qui n'arrive pas laisse un cadre
                  // calme et non une image brisée** — le glyphe du navigateur se
                  // lit comme une panne de l'application.
                  backgroundColor: colors.rustTint,
                  boxShadow: `inset 0 0 0 1px ${colors.line}`,
                }}
              >
                <img src={`/api/fichiers/${photo.storageKey}`} alt="" className="h-full w-full object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ─── LES LIGNES DU DEVIS — ce qu'il y a à faire ────────────────────
          **Elles s'effacent quand la fin de chantier s'ouvre — sa proposition
          A, tranchée le 9 septembre 2026** (`appli/fiche-sans-doublon.html`).

          Vu sur une capture, par aucun test : les mêmes quatre lignes se
          lisaient deux fois sur le même écran, en liste ici puis en cases à
          cocher trois centimètres plus bas. Il fallait les comparer une à une,
          avec des gants, pour comprendre que c'étaient les mêmes.

          Elles ne sont pas perdues : elles SONT devenues les cases, et elles
          reviennent dès qu'il replie. */}
      <div
        className="mt-3.5 pt-3"
        style={{ borderTop: `1px solid ${colors.line}` }}
        hidden={finOuverte}
      >
        {(feuille?.taches ?? []).length === 0 ? (
          <p className="m-0 text-[14.5px] leading-[1.45]" style={{ color: colors.muted }}>
            {feuille === undefined ? "Lecture du devis…" : "Aucune ligne sur le devis."}
          </p>
        ) : (
          (feuille?.taches ?? []).map((t, i) => (
            <p
              key={`${t}-${i}`}
              className="relative mb-[9px] pl-3.5 text-[14.5px] leading-[1.45]"
            >
              <span
                aria-hidden="true"
                className="absolute left-0 top-2 h-[5px] w-[5px] rounded-full"
                style={{ background: colors.or }}
              />
              {t}
            </p>
          ))
        )}
      </div>

      {/* **LA FIN DE CHANTIER — sa décision du 8 septembre 2026.** Le bandeau
          se déplie ICI, sous les lignes du devis : il garde sous les yeux ce
          qu'il y avait à faire pendant qu'il coche. Une feuille qui monte
          l'aurait recouverte, et il aurait coché de mémoire. */}
      <FinDeChantier
        chantierId={chantier.id}
        dejaRendu={feuille?.retourPose ?? false}
        onOuvert={setFinOuverte}
      />

      {/* **Le bouton n'existe QUE s'il y a un devis à imprimer.** Sans devis, la
          route répond 404 : un bouton qui ouvre une erreur est pire qu'un bouton
          absent — il fait douter de l'application entière. Le cas ne devrait pas
          se présenter (le planning ne liste que des chantiers dont le devis est
          PARTI), mais « ne devrait pas » n'est pas « ne peut pas ». */}
      {feuille?.avecDevis && (
        <a
          data-atlas="pdf-sans-prix"
          href={`/api/chantiers/${chantier.id}/feuille/pdf`}
          target="_blank"
          rel="noreferrer"
          className="mx-auto mt-3 block w-max rounded-full px-5 py-2.5 text-[13px]"
          style={{ background: colors.plein, color: surPlein }}
        >
          Ouvrir le PDF sans les prix
        </a>
      )}
    </div>
  );
}

/**
 * Un des quatre gestes de la feuille.
 *
 * **Éteint plutôt qu'absent quand la donnée manque** : un bouton qui disparaît
 * fait chercher où il est passé ; éteint, il dit que c'est l'adresse qui
 * manque, et non l'application qui a changé.
 */
function Geste({
  href,
  onClick,
  children,
}: {
  href?: string | null;
  onClick?: (() => void) | null;
  children: React.ReactNode;
}) {
  const style = {
    border: `1px solid ${colors.line}`,
    background: colors.card,
    color: href || onClick ? colors.ink : colors.muted,
    opacity: href || onClick ? 1 : 0.45,
  } as const;
  const classe =
    "block flex-1 rounded-lg px-1.5 py-[11px] text-center text-[13px] no-underline";

  if (href) {
    return (
      <a className={classe} style={style} href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" className={classe} style={style} onClick={onClick}>
        {children}
      </button>
    );
  }
  return (
    <span className={classe} style={style}>
      {children}
    </span>
  );
}


/**
 * Le nom de cette liste, écrit une seule fois.
 *
 * **Il sert à DEUX endroits, et c'est tout le correctif du 7 septembre 2026 :**
 * le titre de la section, et la poignée qui l'annonce avant qu'on l'ouvre.
 * Écrits séparément, ils s'étaient mis à dire deux choses — « En attente du
 * client » dedans, « chez le client » dehors —, et c'est le raccourci du
 * dehors qu'il n'a pas compris.
 */
const EN_ATTENTE_DU_CLIENT = "En attente du client";

/**
 * LE TIROIR DU BAS — ce qui n'a pas encore de jour, à portée du pouce.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sa maquette du 3 septembre 2026, retenue telle quelle.**
 *
 * « Sans date » et « En attente du client » vivaient tout en bas d'un écran qui
 * porte déjà le mois, la journée ouverte et la semaine des planifiés. Or **poser
 * un chantier est le geste le plus actif de cet écran**, et il était le plus
 * loin du pouce : on touchait un jour en haut, on descendait, on posait, et l'on
 * remontait voir le résultat.
 *
 * **CE QUE ÇA COÛTE, ET IL FAUT LE DIRE :** ces deux listes étaient visibles en
 * faisant défiler ; elles demandent maintenant un appui. C'est le seul échange
 * de ce lot, et il a été accepté en connaissance de cause. La poignée les
 * NOMME et les COMPTE — « 3 sans date · 2 chez le client » —, si bien que rien
 * ne devient introuvable : ce qui se perdait était leur position, pas leur
 * existence.
 *
 * **La poignée change de mot dès qu'un jour est touché** : elle écrit alors « À
 * poser sur jeudi 3 septembre », en or. C'est la phrase que l'écran écrivait
 * déjà sous « Sans date » — rendue à l'endroit du geste plutôt qu'au bas de la
 * page.
 *
 * **Il n'existe pas quand il n'a rien à porter.** Sa règle du 23 août 2026, la
 * même qui a fait disparaître « Ajouter un chantier » : un geste qui ne peut
 * mener nulle part se retire au lieu de s'annoncer. Un salarié n'en voit que la
 * moitié « En attente du client », et rien du tout si elle est vide.
 * ───────────────────────────────────────────────────────────────────────────
 */
function TiroirDuBas({
  ecriture,
  sansDate,
  attenteClient,
  jourTouche,
  poser,
  retraits,
  portesOuvertes,
  onPortes,
}: {
  ecriture: boolean;
  sansDate: ChantierPlanning[];
  attenteClient: ChantierPlanning[];
  jourTouche: JourIso | null;
  poser: (chantierId: string, jour: JourIso) => void;
  /**
   * **Le type vient de la source, jamais recopié.** Une liste de champs écrite
   * ici aurait divergé au premier champ ajouté à `useRetraits` — et le tiroir
   * d'annulation se serait mis à recevoir autre chose que ce qu'il attend.
   */
  retraits: ReturnType<typeof useRetraits>;
  /**
   * ─── LES DEUX LISTES DU BAS ONT DES PORTES, ELLES AUSSI — 4 sept. 2026 ──
   *
   * **Elles n'avaient AUCUN lien vers le chantier** : ni chevron, ni bouton,
   * ni nom cliquable. Tant que la fiche existait, cela ne se voyait pas — la
   * liste des chantiers y menait. Elle est retirée le 4 septembre, et un
   * devis parti sans date y serait devenu injoignable : exactement le
   * cul-de-sac du 8 août 2026, *« comment moi je fais pour avoir accès au
   * devis ? »*, sous un autre nom.
   *
   * **La même feuille que les journées, la même règle** (`portesDuPlanning`,
   * qui rend le devis et la fiche client sur un chantier sans date, et pas la
   * facture — un chantier qui n'a pas eu lieu ne se facture pas).
   *
   * **Le chevron, jamais le nom.** Sa consigne du 4 septembre : la feuille ne
   * s'accroche pas au nom du chantier.
   */
  portesOuvertes: boolean;
  onPortes: (c: ChantierPlanning) => void;
}) {
  const [ouvert, setOuvert] = useState(false);

  // **« Sans date » n'existe que pour qui peut écrire** (30 août 2026) : ses
  // deux seuls gestes — poser et supprimer — sont refusés au serveur pour un
  // salarié, et une liste accompagnée de boutons morts se lit comme une panne.
  const aSansDate = ecriture && sansDate.length > 0;
  const aAttente = attenteClient.length > 0;
  if (!aSansDate && !aAttente) return null;

  /**
   * Ce que dit la poignée, et rien de plus.
   *
   * **Un jour touché change tout** : la question n'est plus « qu'ai-je en
   * attente » mais « qu'est-ce que je pose ici ». Le mot suit le geste.
   */
  const aPoser = aSansDate && jourTouche !== null;
  const resume = aPoser
    ? `À poser sur ${jourLisibleCourt(jourTouche).toLowerCase()}`
    : [
        aSansDate ? `${sansDate.length} sans date` : null,
        // **Le TITRE de la liste, pas un raccourci** — son choix du 7 septembre
        // 2026 (planche « Deux mots du planning », variante B). « 1 chez le
        // client » ne disait ni ce qui est chez lui, ni ce qu'on attend : il
        // l'a signalé le matin même, *« on comprend pas bien ! »*. La poignée
        // annonce désormais ce qu'on trouve dedans, mot pour mot.
        aAttente ? `${attenteClient.length} ${EN_ATTENTE_DU_CLIENT.toLowerCase()}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

  return (
    <div
      data-atlas="tiroir-planning"
      data-ouvert={ouvert ? "1" : "0"}
      className="fixed inset-x-0 z-[19] mx-auto max-w-md"
      style={{
        // **Juste au-dessus de la barre du bas, et mesuré par elle.**
        // `--atlas-barre` est sa hauteur réelle, indicateur d'accueil compris
        // (`globals.css`) : la recopier ici serait s'assurer qu'un jour l'une
        // bougera sans l'autre.
        bottom: "var(--atlas-barre)",
        background: colors.cream,
        borderTop: `1px solid ${colors.line}`,
        boxShadow: `0 -10px 28px ${voile(colors.ink, 0.08)}`,
      }}
    >
      {/* Le voile : sans lui, la poignée tranche net la rangée du mois qui
          passe dessous, et la coupure se lit comme un défaut d'affichage. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 h-6"
        style={{
          top: -24,
          background: `linear-gradient(to top, ${colors.cream}, ${voile(colors.cream, 0)})`,
        }}
      />
      <button
        type="button"
        data-atlas="poignee-tiroir"
        aria-expanded={ouvert}
        aria-controls="tiroir-du-bas"
        onClick={() => setOuvert((o) => !o)}
        className="flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-[18px] py-[15px] text-left"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <span
          className="min-w-0 flex-1 truncate text-[13px]"
          style={{ color: aPoser ? colors.or : colors.inkSoft }}
        >
          {resume}
        </span>
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke={colors.chevron}
          strokeWidth="2.2"
          style={{
            flex: "none",
            transform: ouvert ? "rotate(180deg)" : "none",
            transition: "transform 320ms cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          <path d="M5 15l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        id="tiroir-du-bas"
        className="overflow-hidden"
        // **FERMÉ, IL N'EXISTE PLUS POUR PERSONNE.**
        //
        // `max-height: 0` avec `overflow: hidden` ne cache rien : les boutons
        // gardent leur taille, le clavier les atteint encore par tabulation, et
        // un lecteur d'écran les annonce. Le navigateur, lui, les tient pour
        // VISIBLES — c'est ce qui a fait rougir `test-planning-e2e` : « Journée »
        // était trouvé, cliqué, et la poignée interceptait le doigt.
        //
        // `visibility` retire l'élément du doigt, du clavier et de la voix,
        // sans casser l'animation : à l'ouverture elle passe à `visible` tout de
        // suite, à la fermeture elle attend que le repli soit fini.
        style={{
          // **Une hauteur MAXIMALE, jamais une hauteur.** Le contenu varie —
          // trois chantiers sans date ou dix —, et une valeur fixe laisserait
          // soit un vide sous la dernière ligne, soit une liste coupée.
          maxHeight: ouvert ? 352 : 0,
          overflowY: ouvert ? "auto" : "hidden",
          visibility: ouvert ? "visible" : "hidden",
          transition: `max-height 420ms cubic-bezier(0.16,1,0.3,1), visibility 0s linear ${
            ouvert ? "0s" : "420ms"
          }`,
        }}
      >
        {/* ─── SANS DATE — et c'est d'ici qu'on POSE ──────────────────────── */}
        {/* **RIEN N'ATTEND DE JOUR : LA SECTION N'EXISTE PAS.** Sa question du
            25 août 2026 : *« est-ce que la catégorie sans date a un réel besoin
            d'exister ? »*. Elle en a un — c'est le seul endroit d'où un
            chantier reçoit sa date, et « Retirer » l'y renvoie — mais VIDE elle
            ne rend qu'un titre et un refus, au milieu d'un écran déjà long.

            C'est sa propre règle du 23 août, celle qui a fait disparaître
            « Ajouter un chantier » : un geste qui ne peut mener nulle part se
            retire au lieu de s'annoncer. La phrase du cul-de-sac vivait ici,
            et c'est elle que ce bouton promettait. */}
        {/* **PAS DE « SANS DATE » POUR UN SALARIÉ** — 30 août 2026. Cette
            section n'existe que pour deux gestes : poser un chantier sur le
            jour touché, et le supprimer. Les deux lui sont refusés au serveur.
            La laisser afficherait une liste de chantiers sans date accompagnée
            de boutons morts — sa propre règle du 23 août : un geste qui ne peut
            mener nulle part se retire au lieu de s'annoncer. */}
        {ecriture && sansDate.length > 0 && (
          <>
            <TitreSection encadre data-atlas="titre-sans-date">Sans date</TitreSection>
            <p
              data-atlas="ou-poser"
              className="mx-[18px] mt-2 text-center text-[12.5px]"
              style={{ color: colors.muted }}
            >
              {/* **Un samedi touché est un jour comme un autre** — sa règle
                  du 23 août 2026. La condition écartait le week-end : il
                  touchait son samedi, et l'écran continuait de lui dire de
                  toucher un jour. */}
              {jourTouche
                ? `À poser sur ${jourLisibleCourt(jourTouche).toLowerCase()}`
                : "Touchez d’abord un jour du calendrier"}
            </p>
            <div className="mx-[18px] mt-3">
              {sansDate.map((c, i) => (
                <LigneRetirable
                  key={c.id}
                  libelle={`le chantier ${c.nom}`}
                  retiree={retraits.estRetire(c.id)}
                  onRetirer={() => retraits.retirer(c.id, `le chantier ${c.nom}`)}
                  hauteurMax={64}
                  className="flex"
                >
                  <div
                    data-atlas="sans-date"
                    className="flex w-full items-center justify-between gap-2.5 py-[11px]"
                    // **Le filet SÉPARE deux lignes, il ne souligne pas la
                    // dernière** — sa demande du 26 août : *« supprime le trait
                    // sous Jean Louis »*. Avec un seul chantier en attente, le
                    // trait ne séparait rien : il soulignait un nom. C'est la
                    // règle qu'emploie déjà la liste « En attente du client »
                    // deux blocs plus bas, reprise ici plutôt qu'inventée.
                    style={{
                      borderBottom:
                        i === sansDate.length - 1 ? "none" : `1px solid ${colors.line}`,
                    }}
                  >
                    <span
                      className="min-w-0 flex-1 truncate"
                      style={{ fontFamily: font.display, fontSize: 19, lineHeight: 1.2 }}
                    >
                      {c.nom}
                    </span>
                    {portesOuvertes && <ChevronDesPortes chantier={c} onPortes={onPortes} />}
                    {jourTouche ? (
                      /* **UN SEUL BOUTON, ET LE JOUR EST DÉJÀ ÉCRIT AU-DESSUS.**
                         Les trois moments vivaient ici aussi — même question,
                         même défaut : ils écrasaient la durée que le devis avait
                         fixée (voir `poser`). Les laisser dans ce tiroir après
                         les avoir retirés de la carte du jour aurait fait deux
                         façons de poser un chantier, et c'est exactement ce que
                         `CLAUDE.md` §3 interdit : elles auraient divergé. */
                      <Petit data-poser="1" onClick={() => poser(c.id, jourTouche)}>
                        Poser
                      </Petit>
                    ) : (
                      <span className="text-[12.5px]" style={{ color: colors.muted }}>
                        en attente d’un jour
                      </span>
                    )}
                  </div>
                </LigneRetirable>
              ))}
            </div>
          </>
        )}

        {/* Le tiroir d'annulation vit DANS celui du bas, et non plus en fin de
            page. Deux tiroirs cloués au même bord se seraient recouverts ; et
            « Retirer » se déclenche depuis cette liste-ci, donc l'annulation
            doit être là où le geste a eu lieu. */}
        {ecriture && (
          <TiroirDesRetires
            dernier={retraits.dernier}
            nombre={retraits.nombre}
            onAnnuler={retraits.annuler}
            className="mt-6"
          />
        )}

        {/* ─── EN ATTENTE DU CLIENT ───────────────────────────────────────── */}
        {attenteClient.length > 0 && (
          <>
            <TitreSection encadre data-atlas="titre-attente-client">
              {EN_ATTENTE_DU_CLIENT}
            </TitreSection>
            <div className="mx-[18px] mt-3">
              {attenteClient.map((c, i) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2.5 py-[11px]"
                  style={{
                    borderBottom:
                      i === attenteClient.length - 1 ? "none" : `1px solid ${colors.line}`,
                  }}
                >
                  <span
                    className="min-w-0 flex-1 truncate"
                    style={{ fontFamily: font.display, fontSize: 19, lineHeight: 1.2 }}
                  >
                    {c.nom}
                  </span>
                  <span
                    className="flex-shrink-0 text-right text-[12.5px]"
                    style={{ color: colors.muted }}
                  >
                    Il choisit sa date
                  </span>
                  {portesOuvertes && <ChevronDesPortes chantier={c} onPortes={onPortes} />}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
