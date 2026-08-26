"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useAncrageDuGeste } from "@/components/atlas/useAncrageDuGeste";
import Link from "next/link";
import { getPlanificationEtat, trierParDatePlanifiee } from "@/lib/chantier-etat";
import { estAuPlanning } from "@/lib/onglet-chantier";
import { jourIso } from "@/lib/jour";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { cheminAutorise, type Role } from "@/lib/acces-roles";
import { colors, font, libelleCaps, surPlein } from "@/lib/design-tokens";
import MoisCharge, { fondDeLEtat } from "@/components/atlas/MoisCharge";
import {
  cleCreneau,
  creneauxDuChantier,
  DUREE_PAR_DEFAUT_DEMI_JOURNEES,
  type JourIso,
} from "@/server/disponibilites";
import { fusionnerAbsences, type AbsenceEquipe } from "@/lib/absences-equipe";
import {
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
  MOT_QUAND,
  quandDuChantier,
  occupationDemi,
  type Demi,
  type EtatDemi,
  type QuandChantier,
} from "@/lib/planning-jour";
import { equipesMobilisees, libelleSalarie, salariesAffiches } from "@/lib/equipes";
import LigneRetirable from "@/components/atlas/LigneRetirable";
import TiroirDesRetires from "@/components/atlas/TiroirDesRetires";
import { useRetraits } from "@/components/atlas/useRetraits";
import { lienAppel, liensItineraire } from "@/lib/itineraire";
import type { FeuilleDuChantier } from "@/server/repositories/devis";
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
  absences?: AbsenceEquipe[];
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
}) {
  // Les deux portes que cet écran propose, décidées par la règle des rôles —
  // jamais par une liste écrite ici. Sans rôle (cas d'un rendu hors session),
  // on ne retire rien : l'écran est celui d'avant ce lot.
  const ouvertes = {
    fiche: role === null || cheminAutorise(role, "/chantiers"),
    agenda: role === null || cheminAutorise(role, "/reglages/agenda"),
  };

  const [chantiers, setChantiers] = useState<ChantierPlanning[]>(initialChantiers);
  const aujourdHui = jourIso(new Date());

  const [curseur, setCurseur] = useState(() => {
    const d = enDate(aujourdHui);
    return { annee: d.getUTCFullYear(), mois: d.getUTCMonth() };
  });
  const [jourTouche, setJourTouche] = useState<JourIso | null>(null);
  const [lundi, setLundi] = useState<JourIso>(() => lundiDe(aujourdHui));
  const [, enTransition] = useTransition();

  const grilleRef = useRef<HTMLDivElement>(null);
  const carteRef = useRef<HTMLDivElement>(null);
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

  const planifies = useMemo(
    () => trierParDatePlanifiee(visibles.filter((c) => estAuPlanning(c, aujourdHui))),
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
  const absentesParCreneau = useMemo(
    () => fusionnerAbsences(new Map(), absences, nombreEquipes),
    [absences, nombreEquipes]
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
    // **`demi` compte ici aussi**, et c'est une réparation : sans elle, la liste
    // des trois moments s'ouvrait dans les DEUX lignes du chantier à la fois —
    // six boutons pour un seul geste, et le doigt tombait sur la mauvaise.
    // Un chantier à la journée porte deux lignes ; on n'en touche qu'une.
    | { quoi: "deplacer"; cle: string; chantierId: string; demi: Demi }
    | { quoi: "ajout-qui"; cle: string }
    | { quoi: "ajout-quand"; cle: string; chantierId: string };
  const [ouvert, setOuvert] = useState<Ouvert | null>(null);

  /** La feuille de chantier ouverte, et dans quelle carte. */
  const [feuille, setFeuille] = useState<{ chantierId: string; cle: string } | null>(null);

  /** La carte d'un jour dépliée sous une ligne des planifiés. */
  const [carteListe, setCarteListe] = useState<{ apres: string; jour: JourIso } | null>(null);

  /** Ce que porte la feuille de chaque chantier — chargé une fois, jamais deux. */
  const [taches, setTaches] = useState<Record<string, FeuilleDuChantier>>({});

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
    setLundi(lundiDe(jour));
    setJourTouche((cur) => (cur === jour ? null : jour));
  }

  /**
   * **Ouvrir ET amener à l'écran.** Deux fois de suite le patron a écrit « rien
   * ne s'ouvre quand je touche un jour », avec quarante contrôles au vert :
   * posée hors du champ, la fiche laissait l'écran mort sous le doigt.
   */
  useEffect(() => {
    if (!jourTouche) return;
    carteRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [jourTouche]);

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
  function deplacer(chantierId: string, quand: QuandChantier) {
    setOuvert(null);
    enTransition(async () => {
      const r = await deplacerChantierAction(chantierId, quand);
      if (!r.succes) {
        // **Un refus avalé est un défaut muet**, et le dépôt l'a déjà payé le
        // 11 août 2026 : « Impossible d'enregistrer la note » sans que personne
        // puisse savoir laquelle des quatre causes s'appliquait. Ici le `return`
        // seul rendait « Déplacer » indistinguable d'un bouton mort — c'est
        // précisément ce qu'il a signalé le 23 août.
        //
        // Journalisé plutôt que levé : le message d'une exception d'action
        // serveur n'arrive jamais jusqu'à lui (`AGENTS.md`).
        console.error("Déplacement refusé", { chantierId, quand, erreur: r.erreur });
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
   * Poser un chantier sur un jour — même règle : on repeint avec ce que la base
   * rend, jamais avec ce que l'écran a supposé (voir `deplacer`).
   */
  function poser(chantierId: string, jour: JourIso, quand: QuandChantier) {
    setOuvert(null);
    enTransition(async () => {
      const r = await planifierChantierAction(chantierId, jour, { quand });
      if (!r.succes) return;
      setChantiers((liste) =>
        liste.map((c) => (c.id === chantierId ? { ...c, ...r.etat } : c))
      );
      setLundi(lundiDe(jour));
    });
  }

  const joursDeLaSemaine = useMemo(
    () => Array.from({ length: 7 }, (_, i) => plusDeJours(lundi, i)),
    [lundi]
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
    const debut = enDate(joursDeLaSemaine[0]);
    const fin = enDate(joursDeLaSemaine[6]);
    const moisDebut = MOIS_LONGS[debut.getUTCMonth()];
    const moisFin = MOIS_LONGS[fin.getUTCMonth()];
    return debut.getUTCMonth() === fin.getUTCMonth()
      ? `${debut.getUTCDate()} – ${fin.getUTCDate()} ${moisFin}`
      : `${debut.getUTCDate()} ${moisDebut} – ${fin.getUTCDate()} ${moisFin}`;
  }, [joursDeLaSemaine]);

  const joursAvecChantiers = joursDeLaSemaine.filter((j) => chantiersDuJour(j).length > 0);

  /** Ce que porte une carte de journée — les mêmes gestes aux deux endroits. */
  const gestesCarte = {
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
          />
        </div>

        {/* ─── LA FICHE DU JOUR, DIRECTEMENT SOUS LE CALENDRIER ───────────── */}
        <div ref={carteRef}>
          {jourTouche && (
            <CarteDuJour cle="jour" jour={jourTouche} {...gestesCarte} />
          )}
        </div>

        {/* ─── PLANIFIÉS, à la semaine ────────────────────────────────────── */}
        <TitreSection>Planifiés</TitreSection>
        <div className="mx-[18px] mt-[18px] flex items-center justify-between gap-2.5">
          <Fleche
            libelle="Semaine précédente"
            signe="‹"
            onClick={() => setLundi((l) => plusDeJours(l, -7))}
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
            libelle="Semaine suivante"
            signe="›"
            onClick={() => setLundi((l) => plusDeJours(l, 7))}
          />
        </div>

        {joursAvecChantiers.length === 0 ? (
          <p className="mx-[18px] mt-3.5 text-center text-[13.5px]" style={{ color: colors.muted }}>
            Aucun chantier posé cette semaine.
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
            <div key={jour} data-atlas="jour-planifie" className="mx-[18px] mt-5">
              <p className="text-center leading-none">
                <span
                  data-atlas="date-planifiee"
                  className="inline-block rounded-full px-[15px] py-[7px] text-[12px] font-bold uppercase"
                  style={{ letterSpacing: "0.14em", background: colors.rustTint, color: colors.ink }}
                >
                  {jourLisibleCourt(jour)}
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
                          color: colors.ink,
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
                          style={{ color: colors.or }}
                        >
                          {ditLaDuree(c.dureeDemiJournees ?? DUREE_PAR_DEFAUT_DEMI_JOURNEES)}
                        </span>
                      </button>
                      {/* La pastille MÈNE AU JOUR au lieu d'ouvrir un choix : un
                          chantier à la journée porte deux listes d'équipes —
                          matin et après-midi, indépendantes — et une pastille
                          unique ne saurait pas laquelle modifier. */}
                      {nombreSalaries > 0 && (
                        <PastilleEquipe
                          vide={toutes.length === 0}
                          onClick={ouvrir}
                          avecPlus={false}
                          libelle={ditQuiPart(toutes.map(nomEquipe))}
                        />
                      )}
                      {/* **Le chevron MÈNE au chantier, il n'ouvre pas la
                          feuille.** La planche 84 lui donne le même geste que le
                          nom ; l'application ne le peut pas, et voici pourquoi.

                          Un chantier POSÉ quitte l'onglet « Chantiers »
                          (`src/lib/onglet-chantier.ts`) : le planning devient
                          alors le seul endroit d'où l'atteindre. Sans ce lien,
                          on retombe exactement sur ce qu'il a signalé le 8 août
                          2026 — *« il se range dans les chantiers planifiés,
                          mais comment moi je fais pour avoir accès au devis ? »*
                          —, et la réponse redeviendrait : on ne peut pas.

                          Le nom, lui, garde le geste de la planche : il ouvre la
                          journée et la feuille. Un chevron promet qu'on PART
                          quelque part, un nom qu'il se déplie : les deux gestes
                          se distinguent d'eux-mêmes. */}
                      {/* **LE CHEVRON RESTE UN LIEN VERS LE CHANTIER**, et
                          c'est un contrôle du dépôt qui l'a rappelé : *« depuis
                          le planning, le chantier mène à son devis »*
                          (`test-planning-vers-facture-e2e.ts`).

                          La planche 86 dessine un chevron qui pivote — mais
                          c'est son signe de repli à elle, pas le geste de cet
                          écran : ici le NOM déplie, et le chevron part. Les
                          confondre coûterait le seul chemin vers le devis d'un
                          chantier posé, puisqu'un chantier posé quitte l'onglet
                          « Chantiers » (`src/lib/onglet-chantier.ts`) et que la
                          feuille n'en offre aucun autre.

                          C'est exactement ce qu'il signalait le 8 août 2026 —
                          *« il se range dans les chantiers planifiés, mais
                          comment moi je fais pour avoir accès au devis ? »* — et
                          la réponse redeviendrait : on ne peut pas. */}
                      {ouvertes.fiche && (
                        <Link
                          href={`/chantiers/${c.id}`}
                          aria-label={`Ouvrir le chantier — ${c.nom}`}
                          className="cursor-pointer px-0.5 text-[19px] no-underline"
                          style={{ color: colors.chevron }}
                        >
                          ›
                        </Link>
                      )}
                    </div>
                    {deplie && (
                      <CarteDuJour
                        cle={`liste:${c.id}`}
                        jour={carteListe.jour}
                        seulement={c.id}
                        {...gestesCarte}
                      />
                    )}
                  </div>
                );
              })}
              {/* **Le geste d'ajout suit la JOURNÉE, pas le dernier volet.**
                  C'est ce que montre la planche 86 : un seul « + » sous les
                  chantiers du jour, quel que soit le nombre de volets ouverts. */}
              <AjoutAuJour
                cle={`ajout:${jour}`}
                jour={jour}
                ouvert={ouvert}
                setOuvert={setOuvert}
                sansDate={sansDate}
                poser={poser}
              />
            </div>
          ))
        )}

        {/* ─── SANS DATE — et c'est d'ici qu'on POSE ──────────────────────── */}
        <TitreSection>Sans date</TitreSection>
        {sansDate.length === 0 ? (
          <p className="mx-[18px] mt-2 text-center text-[12.5px]" style={{ color: colors.muted }}>
            Aucun chantier n’attend de jour.
          </p>
        ) : (
          <>
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
              {sansDate.map((c) => (
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
                    style={{ borderBottom: `1px solid ${colors.line}` }}
                  >
                    <span
                      className="min-w-0 flex-1 truncate"
                      style={{ fontFamily: font.display, fontSize: 19, lineHeight: 1.2 }}
                    >
                      {c.nom}
                    </span>
                    {jourTouche ? (
                      <span className="flex flex-shrink-0 gap-[5px]">
                        {(
                          [
                            ["matin", "Matin"],
                            ["apres", "Ap.-m."],
                            ["journee", "Journée"],
                          ] as [QuandChantier, string][]
                        ).map(([v, mot]) => (
                          <Petit
                            key={v}
                            data-poser={v}
                            onClick={() => poser(c.id, jourTouche, v)}
                          >
                            {mot}
                          </Petit>
                        ))}
                      </span>
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

        {/* Le tiroir, en fin de contenu et non par-dessus : il pousse la
            dernière ligne vers le haut au lieu de la masquer. */}
        <TiroirDesRetires
          dernier={retraits.dernier}
          nombre={retraits.nombre}
          onAnnuler={retraits.annuler}
          className="mt-6"
        />

        {/* ─── EN ATTENTE DU CLIENT ───────────────────────────────────────── */}
        {attenteClient.length > 0 && (
          <>
            <TitreSection>En attente du client</TitreSection>
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
                  <span style={{ fontFamily: font.display, fontSize: 19, lineHeight: 1.2 }}>
                    {c.nom}
                  </span>
                  <span className="text-right text-[12.5px]" style={{ color: colors.muted }}>
                    Il choisit sa date
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// LES PIÈCES DE L'ÉCRAN
// ─────────────────────────────────────────────────────────────────────────

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

function TitreSection({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mx-[18px] mt-[26px] text-center text-[13px] font-bold uppercase leading-none"
      style={{ letterSpacing: "0.16em", color: colors.ink }}
    >
      {children}
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
  ...reste
}: {
  children: React.ReactNode;
  onClick: () => void;
  retenue?: boolean;
  fini?: boolean;
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
      className={`flex-shrink-0 cursor-pointer rounded-full py-[7px] text-[12px] ${
        serre ? "px-[9px]" : "px-3"
      }`}
      style={{
        border: `1px solid ${retenue ? colors.rust : fini ? colors.or : colors.line}`,
        background: retenue ? colors.rust : colors.card,
        color: retenue ? surPlein : fini ? colors.or : colors.inkSoft,
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
}: {
  libelle: string;
  vide: boolean;
  /** L'événement est transmis : l'appelant y trouve la ligne à garder immobile. */
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  avecPlus?: boolean;
}) {
  return (
    <button
      type="button"
      data-atlas="equipe"
      data-vide={vide ? "1" : "0"}
      onClick={onClick}
      className="flex-shrink-0 cursor-pointer whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px]"
      style={{
        border: vide ? `1px dashed ${colors.or}` : "0",
        background: vide ? "transparent" : colors.rust,
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
    | { quoi: "deplacer"; cle: string; chantierId: string; demi: Demi }
    | { quoi: "ajout-qui"; cle: string }
    | { quoi: "ajout-quand"; cle: string; chantierId: string }
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
  deplacer: (chantierId: string, quand: QuandChantier) => void;
  retirerDuJour: (chantierId: string) => void;
  poser: (chantierId: string, jour: JourIso, quand: QuandChantier) => void;
  taches: Record<string, FeuilleDuChantier>;
};

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
          <Choisir>
            {sansDate.map((s) => (
              <Petit
                key={s.id}
                data-qui={s.id}
                onClick={() => setOuvert({ quoi: "ajout-quand", cle, chantierId: s.id })}
              >
                {s.nom}
              </Petit>
            ))}
          </Choisir>
        </div>
      ) : ouvert?.quoi === "ajout-quand" && ouvert.cle === cle ? (
        // **Le nom choisi prend la forme des autres lignes** — sa demande du
        // 21 août : « j'aimerais que le nom se mette au même niveau que ceux
        // qui sont déjà sélectionnés ». En petit gris à côté des boutons, il
        // se lisait comme une étiquette ; en serif, il se lit comme le
        // chantier qu'il va devenir.
        <div
          data-atlas="en-attente"
          className="mt-3.5 flex flex-wrap items-center gap-2 pt-3"
        >
          <span
            className="flex-1"
            style={{ fontFamily: font.display, fontSize: 19, lineHeight: 1.2, color: colors.ink }}
          >
            {sansDate.find((s) => s.id === ouvert.chantierId)?.nom ?? ""}
          </span>
          <span className="flex flex-shrink-0 gap-1.5">
            {(Object.keys(MOT_QUAND) as QuandChantier[]).map((v) => (
              <Petit
                key={v}
                data-quand={v}
                onClick={() => poser(ouvert.chantierId, jour, v)}
              >
                {MOT_QUAND[v]}
              </Petit>
            ))}
          </span>
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
}: {
  cle: string;
  jour: JourIso;
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
      <div
        data-atlas="carte-jour"
        data-jour={jour}
        className="mx-[18px] mt-4 rounded-[10px] px-[15px] py-[14px]"
        style={{ background: colors.card }}
      >
        {!seulement && (
          <p
            className="mb-3.5 text-center text-[12.5px] font-bold uppercase leading-none"
            style={{ letterSpacing: "0.14em", color: colors.ink }}
          >
            {jourLisibleCourt(jour)}
          </p>
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
                <div className="flex items-baseline gap-2.5">
                  <button
                    type="button"
                    data-atlas="nom-du-jour"
                    onClick={() =>
                      setFeuille(
                        feuilleIci === c.id ? null : { chantierId: c.id, cle }
                      )
                    }
                    className="flex-1 cursor-pointer border-0 bg-transparent p-0 text-left"
                    style={{
                      fontFamily: font.display,
                      fontSize: 19,
                      lineHeight: 1.2,
                      color: colors.ink,
                    }}
                  >
                    {c.nom}
                  </button>
                </div>
              )}

              {bloc.demis.map((demi) => {
                const o = occupationDe(jour, demi);
                const rangs = demi === "matin" ? c.equipes.matin : c.equipes.apres_midi;
                const choixEquipe =
                  ouvert?.quoi === "equipe" &&
                  ouvert.cle === cle &&
                  ouvert.chantierId === c.id &&
                  ouvert.demi === demi;
                const choixDeplacer =
                  ouvert?.quoi === "deplacer" &&
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

                    {nombreSalaries <= 0 ? null : choixEquipe ? (
                      // **On COCHE, on ne choisit pas une seule fois.** La liste
                      // reste ouverte tant qu'il n'a pas fini, et le calendrier
                      // se repeint derrière à chaque coche — sinon il faudrait
                      // refermer pour voir l'effet, et rouvrir pour corriger.
                      <Choisir>
                        {lignesEquipes.map((e) => {
                          const cochee = rangs.includes(e.rang);
                          return (
                            <Petit
                              key={e.rang}
                              serre
                              data-choix={e.rang}
                              retenue={cochee}
                              onClick={() => basculerEquipe(c.id, demi, e.rang)}
                            >
                              {cochee ? "✓ " : ""}
                              {nomEquipe(e.rang)}
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
                        libelle={ditQuiPart(rangs.map(nomEquipe))}
                        onClick={() =>
                          setOuvert({ quoi: "equipe", cle, chantierId: c.id, demi })
                        }
                      />
                    )}

                    {choixDeplacer ? (
                      // **Déplacer se CHOISIT aussi** : une liste, jamais une
                      // rotation qui déciderait à sa place. C'est la règle qu'il
                      // a posée pour l'équipe, et elle vaut partout.
                      <Choisir>
                        {/* **« Journée » disparaît au-delà d'une journée.**
                            Sur un chantier de trois jours, elle écrit le même
                            état que « Matin » — le départ, la durée étant
                            protégée — et l'une des deux ne faisait donc rien.
                            Un bouton qui n'écrit rien se retire ; le laisser en
                            expliquant serait pire, puisqu'il faut le lire pour
                            savoir de ne pas l'employer. */}
                        {(Object.keys(MOT_QUAND) as QuandChantier[])
                          .filter(
                            (v) =>
                              v !== "journee" ||
                              (c.dureeDemiJournees ?? DUREE_PAR_DEFAUT_DEMI_JOURNEES) <= 2
                          )
                          .map((v) => (
                            <Petit
                              key={v}
                              serre
                              data-vers={v}
                              retenue={quandDuChantier(c) === v}
                              onClick={() => deplacer(c.id, v)}
                            >
                              {MOT_QUAND[v]}
                            </Petit>
                          ))}
                      </Choisir>
                    ) : (
                      <>
                        <Petit
                          serre
                          data-atlas="deplacer"
                          onClick={() => setOuvert({ quoi: "deplacer", cle, chantierId: c.id, demi })}
                        >
                          Déplacer
                        </Petit>
                        <Petit serre data-atlas="retirer" onClick={() => retirerDuJour(c.id)}>
                          Retirer
                        </Petit>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {!seulement && (
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

      {feuilleIci && (
        <FeuilleChantier
          key={feuilleIci}
          chantier={duJour.find((c) => c.id === feuilleIci) ?? null}
          feuille={taches[feuilleIci]}
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
function NoteDuChantier({ chantier }: { chantier: ChantierPlanning }) {
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
}: {
  chantier: ChantierPlanning | null;
  feuille?: FeuilleDuChantier;
}) {
  // **`key={chantier.id}` là où elle est rendue** : changer de chantier remonte
  // le composant, et « Adresse copiée » repart à zéro sans qu'un effet ait à le
  // remettre à la main — un effet qui appelle `setState` fait un rendu de plus
  // pour rien.
  const [copie, setCopie] = useState<"non" | "faite" | "refusee">("non");

  if (!chantier) return null;
  const adresse = chantier.adresseChantier?.trim() || null;
  // **Deux destinations, plus trois.** Sa demande du 21 août : « pas besoin
  // d'en mettre trois ». `plans` est celle qu'il nomme « Maps » sur son
  // iPhone ; Google Maps sort, elle faisait doublon.
  const liens = liensItineraire(adresse);
  const tel = lienAppel(chantier.clientTelephone);

  return (
    <div
      data-atlas="feuille"
      className="mx-[18px] mt-3 rounded-[10px] px-4 pb-[18px] pt-4"
      style={{ background: colors.rustTint, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
    >
      <p
        className="m-0 text-center text-[10.5px] font-bold uppercase leading-none"
        style={{ letterSpacing: "0.24em", color: colors.or }}
      >
        Feuille de chantier
      </p>
      <p
        className="mb-0 mt-2.5 text-center"
        style={{ fontFamily: font.display, fontSize: 22, lineHeight: 1.15 }}
      >
        {chantier.clientNom ?? chantier.nom}
      </p>

      <div className="mt-2.5 flex gap-1.5">
        <Geste href={liens?.plans ?? null}>Maps</Geste>
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

      <NoteDuChantier chantier={chantier} />

      <div className="mt-3.5 pt-3" style={{ borderTop: `1px solid ${colors.line}` }}>
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
          style={{ background: colors.rust, color: surPlein }}
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
