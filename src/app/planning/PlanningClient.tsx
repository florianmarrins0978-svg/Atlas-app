"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useAncrageDuGeste } from "@/components/atlas/useAncrageDuGeste";
import Link from "next/link";
import { getPlanificationEtat, trierParDatePlanifiee } from "@/lib/chantier-etat";
import { useRouter } from "next/navigation";
import { lienDeRelecture } from "@/lib/retour-au-planning";
import { estAuCalendrier } from "@/lib/onglet-chantier";
import { jourIso } from "@/lib/jour";
import { retourDuJourAttendu } from "@/lib/retour-intervention";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { cheminAutorise, peutModifierLePlanning, type Role } from "@/lib/acces-roles";
import { colors, font } from "@/lib/design-tokens";
import MoisCharge, { Fleche } from "@/components/atlas/MoisCharge";
import CouleursDesEtats from "@/components/atlas/CouleursDesEtats";
import { AUCUNE_COULEUR_CHOISIE, type CouleursPlanning } from "@/lib/couleurs-planning";
import type { NomCharte } from "@/lib/chartes";
import CouleursDuPlanning from "./CouleursDuPlanning";
import { cleCreneau, type Creneau, type JourIso } from "@/lib/disponibilites";
import { demiJourneesAPoser } from "@/lib/creneaux-chantier";
import { fusionnerAbsences } from "@/lib/absences-equipe";
import { cocheRefusee, joursDeLaPastille, type ChantierPourAbsence } from "@/lib/equipe-absente";
import { noterAbsenceAction, retirerAbsenceAction } from "@/app/reglages/actions";
import { masquerRappelAgendaAction } from "@/app/reglages/agenda/actions";
import type { BandeauAgenda } from "@/lib/agenda-externe";
import { jourAbrege, jourLisibleCourt, MOIS_LONGS } from "@/lib/mois";
import {
  ficheOuverteDOffice,
  DEMIS,
  ditQuiPart,
  occupationDemi,
  type Demi,
} from "@/lib/planning-jour";
import { equipesMobilisees, libelleSalarie, salariesAffiches } from "@/lib/equipes";
import type { DonneesDatesDuMois } from "./DatesDuMois";
import { datesDuMois as grouperLesDatesDuMois, type EnvoiDesDates } from "@/lib/dates-du-mois";
import PortesDuChantier from "./PortesDuChantier";
import { chantierDemandeAuPlanning, PARAM_CHANTIER_PLANNING } from "@/lib/lien-planning";
import QuestionDeSuppression from "./QuestionDeSuppression";
import { useRetraits } from "@/components/atlas/useRetraits";
import type { MomentDArrivee } from "@/lib/creneaux-chantier";
import {
  basculerEquipeAction,
  reposerDemiJourneeAction,
  deplacerCeQueLeJourPorteAction,
  deplanifierChantierAction,
  planifierChantierAction,
  poserALaPlaceAction,
  relancerLeDevisExpireAction,
  relireLeDevisExpireAction,
  supprimerChantierAction,
  tachesDuChantierAction,
} from "./actions";
import { equipesDuJour } from "@/lib/equipes-par-jour";
import type {
  AbsenceDuPlanning,
  ChantierPlanning,
  FeuilleEtRetour,
  OuvertDansLaCarte,
} from "./types-du-planning";
import { creneauxDe, ditCeQuIlOccupe } from "./outils-du-planning";
import {
  ChevronDesPortes,
  LieuDuChantier,
  PasEncoreSigne,
  PastilleEquipe,
  RetourAEnvoyer,
} from "./ElementsDuPlanning";
import { AjoutAuJour } from "./AjoutAuJour";
import { CarteDuJour } from "./CarteDuJour";
import { TiroirDuBas } from "./TiroirDuBas";

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

export default function PlanningClient({
  initialChantiers,
  nombreEquipes = 1,
  nombreSalaries = 0,
  equipesNommees = [],
  bandeauAgenda = null,
  absences = [],
  role = null,
  chantierDemande = null,
  relanceDemandee = null,
  retourDuJour = { demande: false, envoyes: [] },
  datesDuMois = null,
  couleurs = AUCUNE_COULEUR_CHOISIE,
  nomCharte = null,
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
  equipesNommees?: { rang: number; nom: string | null; photo?: string | null }[];
  /**
   * Ce que le haut de l'écran dit de l'agenda, décidé par
   * `bandeauAgendaDuPlanning` (`src/lib/agenda-externe.ts`) : une panne, une
   * proposition de relier, ou rien.
   */
  bandeauAgenda?: BandeauAgenda;
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
  /**
   * Le retour de la relecture d'un devis expiré (`lienRetourDeRelecture`) : ce
   * jour s'ouvre, à la question de la signature de ce chantier.
   */
  relanceDemandee?: { chantierId: string; jour: string } | null;
  /**
   * « Retour à envoyer » sous le chantier du jour, sa planche du 26 septembre
   * 2026 (réponse A). `demande` est déjà tranché au serveur : le réglage
   * allumé, la formule qui porte les retours, et une personne qui peut en
   * poser un. `envoyes` : les chantiers dont le retour d'aujourd'hui est parti.
   */
  retourDuJour?: { demande: boolean; envoyes: readonly string[] };
  /**
   * LES DATES DU MOIS DES CONTRATS (planche 130) : les envois partis, de quoi
   * joindre chaque client, l'adresse du lien. NULL pour qui ne pose pas le
   * planning : rien de tout cela ne descend chez lui.
   */
  datesDuMois?: DonneesDatesDuMois | null;
  /** Les couleurs du planning de l'entreprise (migration 0113), et l'apparence de la personne. */
  couleurs?: CouleursPlanning;
  nomCharte?: NomCharte | null;
}) {
  // **L'état vit ici** : le mois, la légende et la fiche du jour se repeignent
  // pendant qu'il choisit, avant même que la base ait répondu.
  const [couleursVues, setCouleursVues] = useState(couleurs);
  // Les deux portes que cet écran propose, décidées par la règle des rôles —
  // jamais par une liste écrite ici. Sans rôle (cas d'un rendu hors session),
  // on ne retire rien : l'écran est celui d'avant ce lot.
  // Masquée, la phrase part À L'INSTANT, sans attendre le serveur : il l'a
  // écartée d'un doigt, la voir rester une seconde se lirait comme un refus.
  // Le serveur l'écrit pour toujours ; s'il refuse, la raison est journalisée,
  // et la phrase reviendra au prochain chargement, ce qui dit vrai.
  const [rappelMasque, setRappelMasque] = useState(false);
  const masquerLeRappel = () => {
    setRappelMasque(true);
    void masquerRappelAgendaAction().then((r) => {
      if (!r.ok) console.error("[planning] masquer la phrase de l'agenda :", r.motif);
    });
  };

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
  const jourDArrivee = viseDemande?.datePlanifiee ?? (relanceDemandee?.jour as JourIso | undefined) ?? aujourdHui;

  const [curseur, setCurseur] = useState(() => {
    const d = enDate(jourDArrivee as JourIso);
    return { annee: d.getUTCFullYear(), mois: d.getUTCMonth() };
  });
  const [jourTouche, setJourTouche] = useState<JourIso | null>((relanceDemandee?.jour as JourIso | undefined) ?? null);
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
   * **Les sept jours sous le mois, ouverts ou non.** Jusqu'au 15 octobre 2026,
   * deux points choisissaient entre la journée d'aujourd'hui (le défaut) et la
   * semaine. Sa réponse du 15 octobre (`appli/deux-points-ou-la-semaine.html`) :
   * *« la semaine »*. Au repos, rien sous le mois ; le mot ouvre les sept jours.
   */
  const [semaineOuverte, setSemaineOuverte] = useState(false);
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
  const retraits = useRetraits({
    valider: async (id) => {
      const resultat = await supprimerChantierAction(id);
      // **Sa plainte du 12 septembre 2026**, et c'est cette ligne qui manquait.
      //
      // La liste de cet écran vit dans un `useState` : aucun rendu du serveur
      // ne la rattrape. Le tiroir ne masquait que six secondes — à sa
      // fermeture, la ligne revenait sous « Sans date », sur un chantier que
      // la base venait d'effacer, et il la retirait une seconde fois.
      //
      // Les tarifs, les photos et les lignes de prix le font déjà : c'est
      // l'écran qui garde une liste qui la tient à jour.
      if (resultat.succes) setChantiers((liste) => liste.filter((c) => c.id !== id));
      // **Un refus sur un chantier POSÉ se dit sous le calendrier** (7 octobre
      // 2026). Dans « Sans date », la ligne revient et porte son motif ; sur la
      // fiche du jour, le chantier reviendrait sans un mot (une facture émise
      // l'interdit, `supprimerChantier`).
      else if (chantiers.some((c) => c.id === id && c.datePlanifiee)) setRefus(resultat.erreur);
      return resultat;
    },
  });
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

  /**
   * LES DEMI-JOURNÉES QUI ATTENDENT UNE PLACE — sa demande du 10 septembre 2026.
   *
   * Un chantier posé sur MOINS de demi-journées qu'il n'en demande a rendu le
   * reste : c'est ce qu'il voit dans « Sans date », et ce qu'il repose où il
   * veut. La règle vit dans `demiJourneesAPoser`, jamais recopiée ici.
   */
  const morceaux = useMemo(
    () =>
      visibles
        .filter((c) => c.datePlanifiee)
        .map((c) => ({
          chantier: c,
          combien: demiJourneesAPoser(
            {
              jour: c.datePlanifiee,
              moment: c.creneauDebut,
              dureeDemiJournees: c.dureeDemiJournees,
            },
            (c.creneaux ?? []) as Creneau[]
          ),
        }))
        .filter((m) => m.combien > 0),
    [visibles]
  );

  /**
   * LES DATES DU MOIS À ENVOYER, ET CELLES QUI ATTENDENT LE CLIENT.
   *
   * Calculées sur la liste VIVANTE, pas au chargement : la dernière date posée
   * ouvre l'envoi à l'instant, sans recharger (sa demande du 27 septembre).
   * Un envoi parti s'ajoute ici aussitôt, et le client passe en attente.
   */
  const [envoisDesDates, setEnvoisDesDates] = useState<EnvoiDesDates[]>(datesDuMois?.envois ?? []);
  const lesDatesDuMois = useMemo(
    () => grouperLesDatesDuMois(datesDuMois ? visibles : [], envoisDesDates, aujourdHui),
    [datesDuMois, visibles, envoisDesDates, aujourdHui]
  );

  /** Ni posables ni oubliables : leur date se décide chez le client. */
  const attenteClient = useMemo(
    () => visibles.filter((c) => getPlanificationEtat(c) === "attente_client"),
    [visibles]
  );

  /**
   * LES DEVIS EXPIRÉS — sa demande du 7 octobre 2026 : 45 jours sans réponse,
   * le lien est mort et rien n'est vendu. Ni « Sans date » (ils s'y posaient
   * sans signature), ni « En attente du client » (il n'a plus rien où signer).
   */
  const devisExpires = useMemo(
    () => visibles.filter((c) => getPlanificationEtat(c) === "devis_expire"),
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
   * Cette personne peut-elle être cochée sur cette demi-journée du chantier ?
   * La règle du serveur (`cocheRefusee`), sur TOUTES les absences : un
   * chantier de deux jours traverse deux journées (son signalement du
   * 7 septembre 2026), et une coche se juge sur sa moitié (28 septembre).
   */
  const cocheRefuseeDe = useCallback(
    (rang: number, c: ChantierPourAbsence, demi: "matin" | "apres_midi") =>
      cocheRefusee(rang, c, absencesVues, false, demi),
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
                    lignes: c.equipes.lignes.filter((l) => l.equipe !== rang),
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
        // **Ceux de CE jour** — depuis le 15 septembre 2026 la coche peut ne
        // valoir qu'à partir du 4e jour, et compter « au moins un jour »
        // fermerait le lundi pour un gars qui ne vient que le jeudi.
        (c) => equipesMobilisees(equipesDuJour(c.equipes, jour)[demi].length, nombreEquipes)
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

  /**
   * Les têtes des salariés cochés qui en ont une, dans l'ordre des noms
   * (planche `appli/photo-des-salaries.html`, 27 septembre 2026). Un salarié
   * sans photo n'a rien ici : son nom suffit, comme avant.
   */
  const tetesDe = useCallback(
    (rangs: readonly number[]) =>
      rangs.flatMap((rang) => {
        const photo = equipesNommees.find((e) => e.rang === rang)?.photo;
        return photo ? [{ rang, photo }] : [];
      }),
    [equipesNommees]
  );

  // ─── Ce qui est ouvert : au plus une chose à la fois ────────────────────
  //
  // Deux listes ouvertes ensemble, et l'on coche dans l'une en croyant agir sur
  // l'autre. `cle` dit DANS QUELLE carte : la fiche du jour est rendue à deux
  // endroits — sous le calendrier et sous une ligne des planifiés — et c'est le
  // même composant, écrit une fois.
  // **Écrit UNE fois, au module** (`OuvertDansLaCarte`) : cette union vivait ici
  // ET dans les propriétés de la carte, mot pour mot. Deux rédactions d'une même
  // forme finissent par diverger — c'est le §3, et un état qui manque d'un côté
  // ne se voit qu'à l'exécution.
  type Ouvert = OuvertDansLaCarte;
  const [ouvert, setOuvert] = useState<Ouvert | null>(() =>
    relanceDemandee
      ? { quoi: "ajout-relance", cle: "jour", chantierId: relanceDemandee.chantierId, etape: "signe" }
      : null
  );
  const router = useRouter();
  // **L'adresse de retour ne sert qu'une fois** : un rechargement plus tard ne
  // doit pas rouvrir une question à laquelle il a déjà répondu.
  useEffect(() => {
    if (relanceDemandee) window.history.replaceState(null, "", "/planning");
  }, [relanceDemandee]);
  /**
   * LE MORCEAU QU'IL TIENT AU DOIGT — une demi-journée qui attend sa place.
   *
   * Sa demande du 10 septembre : *« la demi-journée de Mr Julien qui a été
   * retirée peut être replacée »*. On la touche dans « Sans date », puis on
   * touche la demi-journée qui l'accueille — deux gestes, comme poser un
   * chantier.
   */
  const [morceauEnMain, setMorceauEnMain] = useState<string | null>(null);

  /** La feuille de chantier ouverte, et dans quelle carte. */
  const [feuille, setFeuille] = useState<{ chantierId: string; cle: string } | null>(null);

  /** La carte d'un jour dépliée sous une ligne des planifiés. */
  const [carteListe, setCarteListe] = useState<{ apres: string; jour: JourIso } | null>(null);
  /**
   * ─── LA FEUILLE LEVÉE VIT DANS L'ADRESSE, ET NULLE PART AILLEURS ──────────
   *
   * Le chantier dont le chevron a ouvert les portes — son allure C, levées
   * d'emblée quand on arrive par `?chantier=<id>` (sa réponse du 4 septembre
   * 2026). Le mois, lui, est calé sur sa journée par `viseDemande`, tout en
   * haut : refermer la feuille laisse donc le patron devant SA date, et non
   * devant le mois courant.
   *
   * **Sa panne du 7 septembre 2026, revenue par l'autre bout :** *« lorsque je
   * fais retour j'arrive sur la page d'accueil, or je devrais arriver d'où je
   * suis parti. »* Depuis le 9 septembre, la flèche ne devine plus : elle lit
   * le journal des écrans traversés (`journal-de-navigation.ts`), qui note
   * **l'adresse complète**, paramètres compris — et son commentaire nomme
   * précisément ce cas-ci, `/planning?chantier=…`.
   *
   * Or le chevron ne posait ce paramètre nulle part : la feuille ne vivait que
   * dans un état React. Le journal enregistrait donc `/planning` tout court, et
   * la flèche du devis le ramenait sur le mois courant, feuille refermée — la
   * panne exacte qu'il avait fait corriger, à un mécanisme près.
   *
   * **On ne répare pas la flèche, on rend la feuille VISIBLE dans l'adresse**
   * (`CLAUDE.md` §4 quater) : c'est l'adresse que `lienVersLeChantierAuPlanning`
   * définit déjà, celle que `viseDemande` relit au montage, et celle que le
   * `?de=` employait avant le journal. Aucun second mécanisme, aucune seconde
   * vérité — la moitié qui manquait.
   *
   * **`replaceState` et non `pushState`** : lever une feuille n'est pas
   * changer d'écran. Une entrée d'historique par chevron obligerait à reculer
   * autant de fois qu'il en a touché avant de quitter le planning. Next.js
   * accorde son routeur sur ce geste (guide « Shallow routing on the client »),
   * donc le journal le voit.
   *
   * Les autres paramètres sont conservés : l'adresse se retouche, elle ne se
   * réécrit pas.
   *
   * **ET LA FEUILLE SE LIT DANS L'ADRESSE, ELLE N'EST PLUS GARDÉE À CÔTÉ.**
   * Un état React en parallèle aurait été une seconde vérité (`CLAUDE.md` §3) :
   * au retour, c'est l'adresse qui est juste — l'état, lui, revient tel qu'il
   * était en partant, c'est-à-dire refermé. Le chevron écrit donc, et l'écran
   * relit ; il n'y a qu'un seul endroit qui sait quelle feuille est levée.
   */
  /**
   * **L'ADRESSE D'ABORD, LE SERVEUR EN REPLI.** Revenir par la flèche remonte
   * l'écran sur une entrée d'historique dont le rendu serveur, lui, date de
   * l'arrivée — `chantierDemande` y vaut donc `null` alors que l'adresse porte
   * bien la feuille. Lire l'adresse au premier rendu les accorde ; au tout
   * premier chargement les deux disent la même chose, il n'y a rien à
   * réconcilier.
   */
  const [chantierLeve, setChantierLeve] = useState<string | null>(() =>
    typeof window === "undefined"
      ? chantierDemande
      : chantierDemandeAuPlanning(
          new URLSearchParams(window.location.search).get(PARAM_CHANTIER_PLANNING)
        )
  );

  const montrerLesPortes = useCallback((c: ChantierPlanning | null) => {
    const question = new URLSearchParams(window.location.search);
    if (c) question.set(PARAM_CHANTIER_PLANNING, c.id);
    else question.delete(PARAM_CHANTIER_PLANNING);
    const ecrit = question.toString();
    window.history.replaceState(null, "", ecrit ? `?${ecrit}` : window.location.pathname);
    setChantierLeve(c ? c.id : null);
  }, []);

  /**
   * **ET ON RELIT L'ADRESSE QUAND ELLE RECULE.** La flèche du devis revient par
   * `router.back()` : l'écran n'est pas remonté, et l'état qu'il retrouve est
   * celui d'avant — feuille refermée. L'adresse, elle, est juste. C'est le même
   * geste que `JournalDeNavigation` fait déjà sur `popstate`, pour la même
   * raison.
   *
   * **`popstate` plutôt que `useSearchParams`**, et ce n'est pas un détail de
   * style : ce crochet fait suspendre l'écran jusqu'au rendu du navigateur, et
   * le planning entier arrivait alors après coup — `test-ligne-planning-e2e`
   * l'a attrapé, la page n'ayant plus la même hauteur au moment où il mesure.
   */
  useEffect(() => {
    const relire = () =>
      setChantierLeve(
        chantierDemandeAuPlanning(
          new URLSearchParams(window.location.search).get(PARAM_CHANTIER_PLANNING)
        )
      );
    window.addEventListener("popstate", relire);
    return () => window.removeEventListener("popstate", relire);
  }, []);

  // Cherché dans la liste VIVANTE : `sansDate` et « en attente » en sont des
  // vues (`useMemo` plus bas), donc un chantier touché dans le tiroir du bas
  // s'y trouve aussi. Et un identifiant qui ne désigne plus rien ne lève
  // simplement aucune feuille — voir `chantierDemandeAuPlanning`.
  const portes = useMemo(
    () => (chantierLeve ? (chantiers.find((c) => c.id === chantierLeve) ?? null) : null),
    [chantierLeve, chantiers]
  );

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
  /**
   * ═══════════════════════════════════════════════════════════════════════
   * RENDRE À LA CARTE LES PIXELS QUE LES BANDES DU BAS LUI PRENNENT
   * ═══════════════════════════════════════════════════════════════════════
   *
   * **Le défaut, mesuré sur son écran** (390 × 664, compte de démonstration) :
   * la carte s'ouvre à 472 px, « + Absent ? » occupe 523 → 567, et le tiroir
   * commence à 565. **Deux pixels**, et `test-pas-la-ce-jour-e2e` refuse à
   * juste titre un geste qu'une bande fixe recouvre — c'est ce contrôle qui
   * avait attrapé, le 6 septembre, un geste entièrement caché dessous.
   *
   * **Ce n'est pas un défaut de réserve.** `.atlas-contenu` réserve déjà la
   * barre ET le tiroir (§323) : cela permet de faire défiler jusqu'au bas,
   * cela ne remonte pas ce qui est déjà à l'écran. La carte naît au MILIEU de
   * la page, sous le doigt, et rien ne garantit que les cent derniers pixels
   * soient libres à cet endroit-là.
   *
   * **CE QUE CE N'EST PAS, et deux contrôles l'ont prouvé dans la minute.** Le
   * `scrollIntoView` retiré le 3 septembre 2026 ramenait une fiche née HORS du
   * champ, à deux cents pixels de là : il déplaçait la case qu'on venait de
   * toucher. Une première version de ce rattrapage-ci vivait dans la CARTE, et
   * `test-ligne-planning-e2e` l'a refusée aussitôt — *« le client touché a
   * bougé de 956 px, il disparaît sous mes yeux »* : la même carte se déplie
   * aussi sous une ligne des planifiés, où la règle est que le nom touché ne
   * bouge PAS.
   *
   * Il vit donc sur **le geste**, pas sur la carte : on touche un jour du
   * calendrier, et rien d'autre ne le déclenche. Il rend exactement ce que les
   * bandes prennent, jamais plus, et ne fait rien quand le geste est déjà
   * dégagé — c'est-à-dire dans la plupart des journées.
   */
  function rendreLesPixelsDesBandes() {
    // Après la peinture : la carte n'existe pas encore au moment de l'appel.
    requestAnimationFrame(() => {
      const carte = document.querySelector<HTMLElement>('[data-atlas="carte-jour"]');
      const premier = carte?.querySelector<HTMLElement>("button");
      if (!premier) return;
      const style = getComputedStyle(document.documentElement);
      // Les deux bandes publient leur hauteur ; les recopier ici serait
      // s'assurer qu'un jour l'une bougera sans l'autre (`AtlasBottomNav`,
      // `TiroirDuBas`).
      const haut = (nom: string) => parseFloat(style.getPropertyValue(nom)) || 0;
      const plancher = window.innerHeight - haut("--atlas-barre") - haut("--atlas-tiroir");
      const manque = Math.round(premier.getBoundingClientRect().bottom - plancher);
      if (manque > 0) window.scrollBy({ top: manque, behavior: "smooth" });
    });
  }

  /**
   * LE DÉPLACEMENT EST-IL EN COURS ?
   *
   * Il décide d'une seule chose, et c'est sa demande du 17 septembre 2026 : le
   * mois passe alors ENTIER au-dessus, la fiche descendant dessous.
   *
   * **Il a remplacé `ficheDuJourVisible`**, qui répondait à « la fiche est-elle
   * encore là après le mois tourné ? » — une question qui ne se pose plus :
   * détachée de la semaine, elle y survit.
   */
  const enDeplacement =
    ouvert?.quoi === "deplacer" || ouvert?.quoi === "deplacer-quand";

  function toucherLeJour(jour: JourIso) {
    // ─── PENDANT UN DÉPLACEMENT, LE JOUR TOUCHÉ EST LA DESTINATION ─────────
    //
    // **Sa demande du 17 septembre 2026 :** *« ça me fait apparaître le
    // planning et je sélectionne un jour »*. Sans cette dérivation, le
    // calendrier ferait ce qu'il fait toujours — ouvrir la fiche de ce jour —
    // et le geste serait perdu au premier appui.
    //
    // **Et l'on ne touche NI au jour ouvert, NI à la fenêtre du bas** : la
    // fiche du chantier qui part doit rester où elle est, sinon il regarde
    // déjà autre chose au moment de choisir le moment.
    if (ouvert?.quoi === "deplacer") {
      setOuvert({ ...ouvert, quoi: "deplacer-quand", vers: jour });
      return;
    }
    if (ouvert?.quoi === "deplacer-quand") {
      // Il se ravise sur le jour : on garde le geste, on change la cible.
      setOuvert({ ...ouvert, vers: jour });
      return;
    }
    setOuvert(null);
    // **Seul ce jour-là, sa fiche s'ouvre avec la journée** — sa réponse du
    // 3 octobre 2026, « la C » (`appli/ouvrir-la-fiche.html`). Refermer le
    // jour referme tout.
    const seul = jourTouche === jour ? null : ficheOuverteDOffice(chantiersDuJour(jour));
    setFeuille(seul ? { chantierId: seul, cle: "jour" } : null);
    setCarteListe(null);
    const d = enDate(jour);
    if (d.getUTCFullYear() !== curseur.annee || d.getUTCMonth() !== curseur.mois) {
      setCurseur({ annee: d.getUTCFullYear(), mois: d.getUTCMonth() });
    }
    // **La liste du bas ne suit plus le jour touché** — sa réponse du
    // 7 octobre 2026, « la B » (`appli/planning-sans-doublon.html`). Elle
    // sautait sur ce jour depuis l'époque où la fiche s'ouvrait sous le
    // calendrier entier ; depuis qu'elle s'ouvre sous la case, le chantier se
    // lisait deux fois. Un jour ouvert retire la liste, et la refermer la rend
    // telle qu'elle était.
    setJourTouche((cur) => (cur === jour ? null : jour));
    rendreLesPixelsDesBandes();
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
  function basculerEquipe(chantierId: string, jour: JourIso, demi: Demi, rang: number) {
    enTransition(async () => {
      // **Le jour de la carte part avec le geste** — sa plainte du 15 septembre
      // 2026 : décocher Julien le jeudi ne doit décocher que le jeudi.
      const etat = await basculerEquipeAction(chantierId, demi, rang, jour);
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
  /**
   * CE QUE LE SERVEUR REND, dans la forme que l'écran repeint.
   *
   * `datePlanifiee` et `creneauDebut` restent le premier créneau : vingt
   * endroits les lisent encore, et l'écran ne doit pas les laisser diverger de
   * ce que la base vient d'écrire (`resumeDesCreneaux`, côté dépôt).
   */
  function etatDesCreneaux(creneaux: { jour: string; moment: Demi }[]) {
    const ordre = [...creneaux].sort((a, b) =>
      a.jour === b.jour ? (a.moment === b.moment ? 0 : a.moment === "matin" ? -1 : 1) : a.jour < b.jour ? -1 : 1
    );
    return {
      creneaux: ordre,
      datePlanifiee: ordre[0]?.jour ?? null,
      creneauDebut: ordre[0]?.moment ?? null,
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * CE QUI N'A PAS PU PARTIR, ÉCRIT À L'ÉCRAN — 11 septembre 2026
   * ═══════════════════════════════════════════════════════════════════════
   *
   * **Sa panne, captures à l'appui :** *« il ne se pose sur aucune demi-journée
   * ! »*, et *« quand c'est un client je ne peux pas remplir sa fiche »*. Les
   * deux gestes marchaient ; c'est sa PAGE qui avait survécu à son serveur —
   * son espace venait de basculer d'une version à l'autre, et une action
   * serveur postée depuis la page d'avant n'atteint plus rien.
   *
   * **Et l'écran ne disait RIEN.** Un appui, aucun effet, aucun message : le
   * défaut muet que `AGENTS.md` interdit — *« devant un défaut muet, la
   * première livraison n'est pas un correctif, c'est de rendre le défaut
   * bavard »*. Le `.then()` seul n'attrape pas un refus : la promesse est
   * REJETÉE, et rien ne s'exécute.
   *
   * **Ce qu'on écrit alors est ce qu'il doit FAIRE**, pas ce qui s'est passé :
   * recharger la page. C'est la seule chose qui répare une page vieillie, et
   * c'est la première question du dépôt devant un défaut qui ne se reproduit
   * pas (`HANDOVER.md`, piège 0).
   */
  const [refus, setRefus] = useState<string | null>(null);
  /**
   * LE DERNIER CLIENT POSÉ DEPUIS LE TIROIR — pour le défaire d'un mot.
   *
   * **La réversibilité après, plutôt que la confirmation avant** (principe 4
   * du produit, et sa planche du 18 septembre 2026) : le tiroir écrit « Mr.
   * Linotte est sur jeudi 17 septembre · Annuler » tant que c'est vrai. Rien
   * n'expire ; la ligne se tait d'elle-même dès que le chantier n'est plus sur
   * ce jour — déplacé, retiré, ou reposé ailleurs —, parce qu'elle se DÉDUIT
   * de la liste au lieu d'être un second état à tenir à jour.
   */
  const [dernierPose, setDernierPose] = useState<{ id: string; jour: JourIso } | null>(null);
  /** Le chantier dont on demande s'il faut le supprimer, le temps de la question. */
  const [aSupprimer, setASupprimer] = useState<ChantierPlanning | null>(null);
  const PAGE_VIEILLIE = "Rien n'est parti. Rechargez la page.";

  /**
   * DÉPLACER CE QUE LE JOUR PORTE — trois appuis au lieu de sept.
   *
   * **Sa demande du 17 septembre 2026 :** *« trop de clics à faire »*. Le geste
   * d'avant rendait la demi-journée au tiroir du bas, d'où il fallait aller la
   * reprendre et la reposer. Ici elle part et arrive en une écriture.
   *
   * **« La A »** : seule la demi-journée du jour de départ bouge. Les autres
   * jours du chantier restent où ils sont.
   */
  function deplacerLeJour(
    chantierId: string,
    jourSource: JourIso,
    vers: JourIso,
    moment: MomentDArrivee
  ) {
    setOuvert(null);
    setRefus(null);
    enTransition(async () => {
      const r = await deplacerCeQueLeJourPorteAction(chantierId, jourSource, vers, moment).catch(
        (e) => {
          console.error("Déplacement parti dans le vide", e);
          setRefus(PAGE_VIEILLIE);
          return null;
        }
      );
      if (!r) return;
      if (!r.succes) {
        // **Le refus du serveur EST la phrase montrée.** Chacun dit sa cause —
        // une demi-journée posée sur une journée entière, une place déjà prise —
        // et les recopier ici ferait deux écritures d'une même règle.
        setRefus(r.erreur);
        console.error("Déplacement refusé", { chantierId, jourSource, vers, moment, erreur: r.erreur });
        return;
      }
      setChantiers((liste) =>
        liste.map((c) => (c.id === chantierId ? { ...c, ...etatDesCreneaux(r.creneaux) } : c))
      );
    });
  }

  /**
   * REPOSER LE MORCEAU qu'il tient au doigt, sur la demi-journée touchée.
   *
   * *« La demi-journée de Mr Julien qui a été retirée peut être replacée. »*
   * Elle se pose où il veut — un autre jour, un autre moment ; le serveur
   * refuse seulement de poser plus que le chantier ne demande.
   */
  function reposer(chantierId: string, jour: JourIso, demi: Demi) {
    setMorceauEnMain(null);
    setRefus(null);
    enTransition(async () => {
      const r = await reposerDemiJourneeAction(chantierId, jour, demi).catch((e) => {
        console.error("Repose partie dans le vide", e);
        setRefus(PAGE_VIEILLIE);
        return null;
      });
      if (!r) return;
      if (!r.succes) {
        setRefus("Cette demi-journée n'a pas pu être reposée.");
        console.error("Repose refusée", { chantierId, jour, demi, erreur: r.erreur });
        return;
      }
      setChantiers((liste) => liste.map((c) => (c.id === chantierId ? { ...c, ...etatDesCreneaux(r.creneaux) } : c)));
    });
  }

  /**
   * « Retirer » rend le chantier à « Sans date » — il ne l'efface pas.
   *
   * Effacé, il serait à ressaisir ; là, il redescend dans la liste d'attente,
   * d'où on le repose ailleurs.
   *
   * **ET SES CRÉNEAUX PARTENT AVEC SA DATE** — sa panne du 16 septembre 2026.
   * `deplanifierChantier` les efface tous, sans condition ; ne retirer que la
   * date laissait l'écran avec les demi-journées d'avant, et le geste suivant
   * — reposer le chantier ailleurs — les gardait. Le chantier se peignait alors
   * sur son ancien jour, et une moitié semblait attendre une place qui n'existe
   * qu'à l'écran. Un état à moitié repeint est la divergence que `CLAUDE.md` §3
   * interdit.
   */
  function retirerDuJour(chantierId: string) {
    setOuvert(null);
    setFeuille(null);
    setRefus(null);
    enTransition(async () => {
      const r = await deplanifierChantierAction(chantierId);
      // **Un chantier déjà facturé garde sa date** — sa décision du
      // 21 septembre 2026. Sans ce garde-fou, il la perdait pour toujours, et
      // « Terminés » n'avait plus rien à écrire sur sa rangée. Repeindre l'écran
      // avant de savoir si le serveur a accepté afficherait « Sans date » sur un
      // chantier qui ne l'est pas : la divergence que `CLAUDE.md` §3 interdit.
      if (!r.succes) {
        setRefus(r.erreur);
        return;
      }
      setChantiers((liste) =>
        liste.map((c) => (c.id === chantierId ? { ...c, datePlanifiee: null, creneaux: [] } : c))
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
  /**
   * UN CLIENT POSÉ SUR UN JOUR — le chantier n'existait pas avant le geste.
   *
   * `poser` met à jour une ligne que la liste porte déjà ; ici on l'AJOUTE, et
   * l'on cale la fenêtre sur son jour pour qu'il le voie sans le chercher.
   */
  function poserUnClient(chantier: ChantierPlanning) {
    setChantiers((liste) => [...liste, chantier]);
    if (chantier.datePlanifiee) setDebutFenetre(chantier.datePlanifiee as JourIso);
  }

  function poser(chantierId: string, jour: JourIso) {
    setOuvert(null);
    enTransition(async () => {
      const r = await planifierChantierAction(chantierId, jour);
      if (!r.succes) return;
      setChantiers((liste) =>
        liste.map((c) => (c.id === chantierId ? { ...c, ...r.etat } : c))
      );
      setDebutFenetre(jour);
      setDernierPose({ id: chantierId, jour });
    });
  }

  /**
   * POSER UN CLIENT QUI ATTEND SON LIEN — son choix B du 7 octobre 2026.
   *
   * Rend le refus en mots, ou `null` : le geste s'écrit dans la fiche du jour,
   * qui reste ouverte tant qu'il n'est pas parti. Sans réponse lisible, un
   * appui sans effet se lirait comme une panne (`AGENTS.md`).
   */
  async function poserALaPlace(
    chantierId: string,
    jour: JourIso,
    signature: { maniere: "lien" } | { maniere: "papier"; demarrageAnticipe: boolean }
  ): Promise<string | null> {
    try {
      const r = await poserALaPlaceAction(chantierId, jour, signature);
      if (!r.succes) {
        console.error("Pose à sa place refusée", { chantierId, jour, erreur: r.erreur });
        return r.erreur;
      }
      setChantiers((liste) =>
        liste.map((c) =>
          c.id === chantierId
            ? { ...c, ...r.etat, envoiReponse: r.envoiReponse ?? c.envoiReponse }
            : c
        )
      );
      setOuvert(null);
      setDebutFenetre(jour);
      return null;
    } catch (e) {
      console.error("Pose à sa place partie dans le vide", e);
      return "Rien n'est parti. Rechargez la page.";
    }
  }

  /**
   * UN DEVIS EXPIRÉ QUI REVIENT — sa demande du 7 octobre 2026.
   *
   * Renvoyé (relu ou tel quel) avec un lien neuf qui ne montre que ce jour,
   * puis posé. **Par son lien** : l'écran du devis parti s'ouvre, celui d'où
   * part tout devis, avec « Ouvrir le SMS tout prêt » ; Atlas n'envoie rien
   * tout seul. **Sur papier** : posé et accepté, on reste ici.
   */
  async function relancerLeDevisExpire(
    chantierId: string,
    jour: JourIso,
    signature: { maniere: "lien" } | { maniere: "papier"; demarrageAnticipe: boolean }
  ): Promise<string | null> {
    try {
      const r = await relancerLeDevisExpireAction(chantierId, jour, signature);
      if (!r.succes) {
        console.error("Relance du devis expiré refusée", { chantierId, jour, erreur: r.erreur });
        return r.erreur;
      }
      if (signature.maniere === "lien") {
        router.push(`/chantiers/${chantierId}/export`);
        return null;
      }
      setChantiers((liste) =>
        liste.map((c) =>
          c.id === chantierId
            ? {
                ...c,
                ...r.etat,
                envoiReponse: r.envoiReponse ?? c.envoiReponse,
                // Le lien neuf vient d'être créé et accepté : le chantier n'est
                // plus un devis expiré.
                envoiExpireAt: null,
              }
            : c
        )
      );
      setOuvert(null);
      setDebutFenetre(jour);
      return null;
    } catch (e) {
      console.error("Relance du devis expiré partie dans le vide", e);
      return "Rien n'est parti. Rechargez la page.";
    }
  }

  /** Rouvre son devis aux prix du jour, puis la page du devis ; « Continuer » ramène ici. */
  async function relireLeDevisExpire(chantierId: string, jour: JourIso): Promise<string | null> {
    try {
      const r = await relireLeDevisExpireAction(chantierId);
      if (!r.succes) return r.erreur;
      router.push(lienDeRelecture(chantierId, jour));
      return null;
    } catch (e) {
      console.error("Relecture du devis expiré partie dans le vide", e);
      return "Rien ne s'est ouvert. Rechargez la page.";
    }
  }

  /** Ce que le tiroir peut encore défaire : le dernier posé, s'il est toujours là. */
  const poseADefaire = (() => {
    if (!dernierPose) return null;
    const c = chantiers.find((x) => x.id === dernierPose.id);
    return c && c.datePlanifiee === dernierPose.jour ? { chantier: c, jour: dernierPose.jour } : null;
  })();

  const joursDeLaSemaine = useMemo(
    () =>
      Array.from({ length: JOURS_DE_LA_FENETRE }, (_, i) =>
        plusDeJours(debutFenetre, i)
      ),
    [debutFenetre]
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
  // La règle vit dans `retourDuJourAttendu` ; l'écran ne fait que la montrer.
  const retourAEnvoyer = (chantierId: string, jour: JourIso) =>
    retourDuJourAttendu({
      demande: retourDuJour.demande,
      jour,
      aujourdHui,
      envoyeAujourdhui: retourDuJour.envoyes.includes(chantierId),
    });

  const gestesCarte = {
    ecriture: ouvertes.ecriture,
    nombreSalaries,
    absencesDuJour,
    cocheRefuseeDe,
    joursDeLaPastilleDe,
    fermerLeJour,
    rouvrirLeJour,
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
    demanderSuppression: setASupprimer,
    poser,
    poserUnClient,
    attenteClient,
    poserALaPlace,
    devisExpires,
    relancerLeDevisExpire,
    relireLeDevisExpire,
    morceaux,
    onPrendreMorceau: (id: string) => setMorceauEnMain((tenu) => (tenu === id ? null : id)),
    refus,
    taches,
    // **Les travaux écrits à la main remontent dans le cache de la feuille** :
    // sans cela, la refermer puis la rouvrir montrerait la liste d'avant
    // l'ajout, chargée « une fois, jamais deux ».
    travauxChanges: (chantierId: string, liste: string[]) =>
      setTaches((t) => (t[chantierId] ? { ...t, [chantierId]: { ...t[chantierId], taches: liste } } : t)),
    retourAEnvoyer,
  };

  return (
    <CouleursDesEtats couleurs={couleursVues} nomCharte={nomCharte}>
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

        {/* Le raccordement de l'agenda : sa demande du 9 août 2026, resserrée
            le 26 septembre (planche `appli/mon-agenda-simple.html`, C). La
            PANNE parle toujours : il se croit protégé du doublon. La
            proposition de relier se masque pour toujours, et une pause ne dit
            plus rien, puisque c'est lui qui l'a choisie. */}
        {/* **Pas pour un salarié** : relier l'agenda de l'entreprise est un
            réglage du patron, et le lien le renverrait ici même. Un renvoi sans
            explication se lit comme une panne. */}
        {ouvertes.agenda && bandeauAgenda !== null && !rappelMasque && (
          <div className="mt-5 px-[26px]">
            <div className="flex items-center justify-between py-3.5" style={{ borderBottom: `1px solid ${colors.line}` }}>
              <Link href="/reglages/agenda" className="min-w-0 flex-1">
                {/* **Une ligne pour le conseil, deux pour la panne** — sa planche
                    du 14 octobre 2026. La phrase du conseil redisait le titre ;
                    celle de la panne dit un risque, elle reste. Le titre passe en
                    texte courant et les deux gestes en minuscules : en capitales
                    espacées, « OUVRIR MASQUER » repoussait le titre sur deux
                    lignes (vu à l'écran). */}
                <span
                  className="block text-[14px]"
                  style={{ color: bandeauAgenda === "panne" ? colors.ink : colors.inkSoft }}
                >
                  {bandeauAgenda === "panne" ? "Votre agenda n'est plus lu" : "Vous pouvez relier votre agenda"}
                </span>
                {bandeauAgenda === "panne" && (
                  <span className="block text-[12.5px] leading-snug" style={{ color: colors.muted }}>
                    Un client peut retenir un jour où vous êtes déjà pris.
                  </span>
                )}
              </Link>
              <span className="ml-3 flex flex-shrink-0 items-center gap-3.5 text-[14px]">
                <Link href="/reglages/agenda" className="flex min-h-[44px] items-center" style={{ color: colors.or }}>
                  Ouvrir
                </Link>
                {/* « Masquer » n'existe pas pour la panne : ce n'est pas un
                    conseil qu'on écarte, c'est un raccordement qui a lâché. */}
                {bandeauAgenda === "proposer" && (
                  <button
                    type="button"
                    onClick={masquerLeRappel}
                    className="flex min-h-[44px] cursor-pointer items-center border-0 bg-transparent p-0 text-[14px]"
                    style={{ color: colors.muted }}
                  >
                    Masquer
                  </button>
                )}
              </span>
            </div>
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
            // deux navigations cessent de s'ignorer : changer de semaine ne
            // disait rien au mois, et rien ne montrait d'où venait la liste.
            // Sans liste à l'écran (un jour est ouvert), aucune semaine n'est lue.
            semaineLue={jourTouche === null && semaineOuverte ? lundiDe(debutFenetre) : null}
            // **Le patron seul** : c'est un réglage de l'entreprise, sa réponse
            // du 29 septembre 2026. Ses salariés voient ses couleurs.
            sousLaLegende={
              role === "proprietaire" ? (
                <CouleursDuPlanning couleurs={couleursVues} nomCharte={nomCharte} onChanger={setCouleursVues} />
              ) : null
            }
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
                // calendrier qui donne la colonne, lui seul la connaît. Il ne
                // la donne PAS quand la fiche est descendue sous le mois
                // entier — là, elle ne toucherait plus sa case et désignerait
                // la voisine. C'est le cerne du jour ouvert qui le dit.
                attache={colonne === null ? undefined : { colonne }}
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
            // ─── LE JOUR D'ACCUEIL, PEINT PENDANT LE GESTE ────────────────
            //
            // **Sa demande du 17 septembre 2026 :** *« je choisis la deux, le
            // planning au-dessus »*. Le jour touché reste marqué le temps qu'il
            // choisisse le moment — sans quoi il ne sait plus lequel il a pris,
            // et le calendrier ne répond pas à son doigt.
            jourRetenu={ouvert?.quoi === "deplacer-quand" ? ouvert.vers : null}
            // ─── LE MOIS ENTIER AU-DESSUS PENDANT LE GESTE ────────────────
            //
            // **Sa demande du 17 septembre 2026**, planche 120 « la A » :
            // *« faire en sorte que le planning apparaisse entier au-dessus de
            // Mr Linotte pour choisir un jour facilement »*. Au repos la fiche
            // s'ouvre entre deux semaines, rattachée à sa case (sa règle du
            // 4 septembre) ; le temps qu'il choisisse un jour d'accueil, elle
            // descend sous le mois pour ne plus rien lui cacher.
            voletDetache={enDeplacement}
          />
        </div>

        {/* ─── « LA SEMAINE », À LA PLACE DES DEUX POINTS ──────────────────
            **Sa réponse du 15 octobre 2026**, planche
            `appli/deux-points-ou-la-semaine.html` : *« la semaine »*. Les deux
            points (son choix du 9 septembre) montraient au repos les chantiers
            d'aujourd'hui ; depuis le 7 octobre la fiche d'un jour ouvert les
            porte déjà, et un point ne disait pas ce qu'il ouvrait. Un mot en or
            est un geste sur cet écran (sa planche du 18 septembre) : il ouvre
            les sept jours, et le même mot les referme. Au repos, rien dessous.

            Le repère `point-semaine` reste : il désigne toujours le geste qui
            ouvre les sept jours, et les suites s'y tiennent. */}
        <div data-atlas="portee-liste" className="mt-[14px] flex justify-center">
          <button
            type="button"
            data-atlas="point-semaine"
            aria-pressed={semaineOuverte}
            aria-expanded={semaineOuverte}
            onClick={() => setSemaineOuverte((o) => !o)}
            className="min-h-[44px] cursor-pointer border-0 bg-transparent px-2.5 text-[14.5px]"
            style={{
              color: semaineOuverte ? colors.ink : colors.or,
              textDecorationLine: semaineOuverte ? "underline" : "none",
              textDecorationColor: colors.or,
              textUnderlineOffset: 7,
              textDecorationThickness: 1.5,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            La semaine
          </button>
        </div>

        {/* **Un jour ouvert retire la liste, ses flèches avec elle** : sa fiche
            montre déjà ces chantiers, et les relire en dessous était le doublon
            qu'il a vu le 7 octobre 2026 (« la B »). */}
        {jourTouche === null && semaineOuverte && (
        <>
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

        {/* Le balayage entre la journée et la semaine est parti avec la
            journée : il n'y a plus qu'une vue à ouvrir, et « La semaine » la
            ferme. */}
        <div data-atlas="liste-planifies">
        {joursAvecChantiers.length === 0 ? (
          <p className="mx-[18px] mt-3.5 text-center text-[13.5px]" style={{ color: colors.muted }}>
            Aucun chantier posé sur ces sept jours.
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
                // **Ceux de CE jour** (migration 0093) : la ligne est celle d'une
                // journée, et Julien « à partir du 4e jour » ne se lit pas le 1er.
                const duJour = equipesDuJour(c.equipes, jour);
                const toutes = [...new Set([...duJour.matin, ...duJour.apres_midi])].sort(
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
                          {ditCeQuIlOccupe(c)}
                        </span>
                        <PasEncoreSigne chantier={c} />
                        {/* **Le lieu, sous la durée.** C'est la deuxième
                            question après « qui » — et sur quatre clients qui
                            s'appellent Martins, c'est la seule qui distingue. */}
                        <LieuDuChantier chantier={c} />
                  {retourAEnvoyer(c.id, jour) && <RetourAEnvoyer />}
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
                          tetes={tetesDe(toutes)}
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
                      {ouvertes.fiche && <ChevronDesPortes chantier={c} onPortes={montrerLesPortes} />}
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
                poserUnClient={poserUnClient}
                attenteClient={attenteClient}
                poserALaPlace={poserALaPlace}
                devisExpires={devisExpires}
                relancerLeDevisExpire={relancerLeDevisExpire}
                relireLeDevisExpire={relireLeDevisExpire}
                morceaux={morceaux}
                morceauEnMain={morceauEnMain}
                onPrendreMorceau={(id) =>
                  setMorceauEnMain((tenu) => (tenu === id ? null : id))
                }
              />
              )}
            </div>
          ))
        )}
        </div>
        </>
        )}

        {/* ─── CE QUI N'A PAS ENCORE DE JOUR — dans le tiroir du bas ────── */}
        <QuestionDeSuppression
          chantier={aSupprimer}
          onRenoncer={() => setASupprimer(null)}
          onConfirmer={(c) => {
            setASupprimer(null);
            // La fiche ouverte sur lui se referme : elle parlerait d'un chantier
            // qui vient de quitter le jour.
            setOuvert(null);
            setFeuille(null);
            retraits.retirer(c.id, `le chantier ${c.nom}`);
          }}
        />
        <TiroirDuBas
          ecriture={ouvertes.ecriture}
          sansDate={sansDate}
          morceaux={morceaux}
          morceauEnMain={morceauEnMain}
          onPrendreMorceau={(id) => setMorceauEnMain((tenu) => (tenu === id ? null : id))}
          attenteClient={attenteClient}
          devisExpires={devisExpires}
          jourTouche={jourTouche}
          poser={poser}
          poseADefaire={poseADefaire}
          defairePose={(id) => {
            setDernierPose(null);
            retirerDuJour(id);
          }}
          retraits={retraits}
          demanderSuppression={setASupprimer}
          portesOuvertes={ouvertes.fiche}
          onPortes={montrerLesPortes}
          datesDuMois={
            datesDuMois
              ? {
                  donnees: datesDuMois,
                  ...lesDatesDuMois,
                  onEnvoye: (e) => setEnvoisDesDates((l) => [...l, e]),
                }
              : null
          }
        />
      </div>

      {/* Les portes du chantier, montées par le chevron — son allure C. Posée
          ici, hors de la liste : une feuille rendue dans la ligne descendrait
          avec elle au défilement, et la coquille est déjà `fixed`. */}
      <PortesDuChantier
        chantier={portes}
        aujourdHui={aujourdHui}
        onFermer={() => montrerLesPortes(null)}
      />
    </div>
    </CouleursDesEtats>
  );
}
