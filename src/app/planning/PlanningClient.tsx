"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { getPlanificationEtat, trierParDatePlanifiee } from "@/lib/chantier-etat";
import { estAuPlanning } from "@/lib/onglet-chantier";
import { jourIso } from "@/lib/jour";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import {
  cleCreneau,
  creneauxDuChantier,
  DUREE_PAR_DEFAUT_DEMI_JOURNEES,
  type JourIso,
} from "@/server/disponibilites";
import { fusionnerAbsences, type AbsenceEquipe } from "@/lib/absences-equipe";
import {
  grilleDuMois,
  jourLisibleCourt,
  estWeekEndIso,
  JOURS_COURTS,
  MOIS_LONGS,
} from "@/lib/mois";
import {
  blocsDeLaJournee,
  DEMIS,
  ditLeCompteDemi,
  ditLaDuree,
  ditLesEquipes,
  etatDemi,
  MOT_DEMI,
  MOT_QUAND,
  occupationDemi,
  partDeLaBarre,
  type Demi,
  type EtatDemi,
  type QuandChantier,
} from "@/lib/planning-jour";
import { equipesAffichees, libelleEquipe } from "@/lib/equipes";
import LigneRetirable from "@/components/atlas/LigneRetirable";
import TiroirDesRetires from "@/components/atlas/TiroirDesRetires";
import { useRetraits } from "@/components/atlas/useRetraits";
import { lienAppel, liensItineraire } from "@/lib/itineraire";
import type { FeuilleDuChantier } from "@/server/repositories/devis";
import {
  basculerEquipeAction,
  deplacerChantierAction,
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

type ChantierPlanning = {
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
  equipesNommees = [],
  agenda = { configure: false, relie: false, actif: false, enPanne: false },
  absences = [],
}: {
  initialChantiers: ChantierPlanning[];
  nombreEquipes?: number;
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
}) {
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
      if (estWeekEndIso(jour)) return occupationDemi<ChantierPlanning>([], nombreEquipes, 0);
      const cle = cleCreneau({ jour, moment: demi });
      return occupationDemi(
        parCreneau.get(cle) ?? [],
        nombreEquipes,
        absentesParCreneau.get(cle) ?? 0
      );
    },
    [parCreneau, absentesParCreneau, nombreEquipes]
  );

  const lignesEquipes = useMemo(
    () => equipesAffichees(equipesNommees, nombreEquipes),
    [equipesNommees, nombreEquipes]
  );

  /**
   * Le nom d'une équipe, ou sa lettre de repli — et `null` à une seule équipe.
   *
   * `libelleEquipe` décide seule : elle sert aussi au serveur et aux documents,
   * et deux implémentations divergeraient le jour où l'artisan nomme la
   * troisième sans avoir touché la deuxième (`src/lib/equipes.ts`).
   */
  const nomEquipe = useCallback(
    (rang: number) =>
      libelleEquipe(lignesEquipes.find((e) => e.rang === rang) ?? null, nombreEquipes) ??
      `Équipe ${rang}`,
    [lignesEquipes, nombreEquipes]
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
      if (!r.succes) return;
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

  const cases = useMemo(() => grilleDuMois(curseur.annee, curseur.mois), [curseur]);
  const surLeMois =
    enDate(aujourdHui).getUTCFullYear() === curseur.annee &&
    enDate(aujourdHui).getUTCMonth() === curseur.mois;

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
    nombreEquipes,
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
        {(!agenda.relie || !agenda.actif || agenda.enPanne) && (
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
            Quatre choix de la planche, et aucun n'est décoratif :
            1. les jours des autres mois DISPARAISSENT — ils ne portaient rien,
               et six cases de chiffres gris se lisent quand même ;
            2. les cases sont carrées et espacées : le doigt vise 44 px, et l'œil
               sépare les semaines sans un seul trait ;
            3. le week-end est une colonne TEINTÉE, pas un chiffre pâle — la
               teinte se voit du coin de l'œil ;
            4. aujourd'hui porte un cercle d'or, et un retour apparaît dès qu'on
               s'en éloigne : sans lui, on se perd à trois mois. */}
        <div ref={grilleRef} className="mt-[18px]">
          <div className="mx-[18px] flex items-center justify-between gap-2.5">
            <Fleche
              libelle="Mois précédent"
              signe="‹"
              onClick={() =>
                setCurseur((c) =>
                  c.mois === 0 ? { annee: c.annee - 1, mois: 11 } : { ...c, mois: c.mois - 1 }
                )
              }
            />
            <div className="flex-1 text-center">
              <b
                data-atlas="mois-titre"
                className="block text-[15px] font-bold leading-[1.2]"
                style={{ color: colors.ink }}
              >
                {MOIS_LONGS[curseur.mois]} {curseur.annee}
              </b>
            </div>
            <Fleche
              libelle="Mois suivant"
              signe="›"
              onClick={() =>
                setCurseur((c) =>
                  c.mois === 11 ? { annee: c.annee + 1, mois: 0 } : { ...c, mois: c.mois + 1 }
                )
              }
            />
          </div>

          <div
            className="mx-[12px] mb-1.5 mt-4 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase"
            style={{ letterSpacing: "0.1em", color: colors.muted }}
            aria-hidden="true"
          >
            {JOURS_COURTS.map((j, i) => (
              <span key={j} style={i >= 5 ? { color: "rgba(28,28,26,0.3)" } : undefined}>
                {j}
              </span>
            ))}
          </div>

          <div className="mx-[12px] grid grid-cols-7 gap-1" data-atlas="grille-mois">
            {cases.map((c) =>
              c.horsMois ? (
                <span key={c.jour} data-atlas="creux" style={{ aspectRatio: "1 / 1.06" }} />
              ) : (
                <button
                  key={c.jour}
                  type="button"
                  data-jour={c.jour}
                  aria-pressed={c.jour === jourTouche}
                  // **L'état reste ANNONCÉ, même s'il ne s'écrit plus.** La
                  // planche a retiré les mots de la case — c'est la couleur qui
                  // parle —, mais une couleur ne se lit pas à voix haute. Ce
                  // libellé est ce qui reste à qui n'emploie pas ses yeux, et
                  // c'est la même phrase que la fiche du jour : deux formules
                  // pour le même état finiraient par se contredire.
                  aria-label={`${jourLisibleCourt(c.jour)} — matin : ${ditLeCompteDemi(
                    occupationDe(c.jour, "matin")
                  )}, après-midi : ${ditLeCompteDemi(occupationDe(c.jour, "apres_midi"))}`}
                  onClick={() => toucherLeJour(c.jour)}
                  className="flex flex-col items-center justify-center gap-1 rounded-[10px] border-0 p-0"
                  style={{
                    aspectRatio: "1 / 1.06",
                    background:
                      c.jour === jourTouche
                        ? colors.rustTint
                        : c.weekEnd
                          ? "rgba(28,28,26,0.035)"
                          : "transparent",
                    boxShadow:
                      c.jour === jourTouche
                        ? `inset 0 0 0 1.5px ${colors.ink}`
                        : c.jour === aujourdHui
                          ? `inset 0 0 0 1.5px ${colors.or}`
                          : "none",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <span
                    className="text-[17px] leading-none"
                    style={{
                      fontFamily: font.display,
                      color:
                        c.jour === aujourdHui
                          ? colors.or
                          : c.weekEnd
                            ? "rgba(28,28,26,0.42)"
                            : colors.ink,
                      fontWeight: c.jour === aujourdHui ? 600 : 400,
                    }}
                  >
                    {c.numero}
                  </span>
                  <MarqueDuJour
                    matin={occupationDe(c.jour, "matin")}
                    apres={occupationDe(c.jour, "apres_midi")}
                    cache={c.weekEnd}
                  />
                </button>
              )
            )}
          </div>

          {/* Le retour n'existe QUE si l'on s'est éloigné : un bouton toujours
              là se lit comme une action à faire. */}
          {!surLeMois && (
            <button
              type="button"
              data-atlas="retour-aujourdhui"
              onClick={() => {
                const d = enDate(aujourdHui);
                setCurseur({ annee: d.getUTCFullYear(), mois: d.getUTCMonth() });
              }}
              className="mx-auto mt-3 block border-0 bg-transparent text-[11px] font-semibold uppercase"
              style={{ letterSpacing: "0.18em", color: colors.or }}
            >
              ← Aujourd’hui
            </button>
          )}
        </div>

        <Legende />

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
          joursAvecChantiers.map((jour, rangJour) => (
            <div
              key={jour}
              data-atlas="jour-planifie"
              className="mx-[18px] mt-4 pt-[13px]"
              style={{ borderTop: rangJour === 0 ? "none" : `1px solid ${colors.line}` }}
            >
              <p
                className="text-center text-[12.5px] font-bold uppercase leading-none"
                style={{ letterSpacing: "0.14em", color: colors.ink }}
              >
                {jourLisibleCourt(jour)}
              </p>
              {chantiersDuJour(jour).map((c) => {
                const toutes = [...new Set([...c.equipes.matin, ...c.equipes.apres_midi])].sort(
                  (a, b) => a - b
                );
                const deplie = carteListe?.apres === c.id;
                // **Le même nom REFERME ce qu'il a ouvert.** Sa correction du
                // 22 août : la ligne « se transforme en le menu déroulant »,
                // elle ne le pousse pas plus bas à chaque appui.
                const ouvrir = () => {
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
                        {c.nom}
                        {/* **La durée, jamais le moment** — sa demande du
                            22 août, retenue sur la planche 86 : *« ce n'est pas
                            clair quand il y a marqué le matin et
                            l'après-midi »*. La demi-journée se lit deux lignes
                            plus bas, sur la ligne MATIN. */}
                        <span
                          data-atlas="duree-planifiee"
                          className="ml-2 text-[12.5px]"
                          style={{ color: colors.or }}
                        >
                          {ditLaDuree(c.dureeDemiJournees ?? DUREE_PAR_DEFAUT_DEMI_JOURNEES)}
                        </span>
                      </button>
                      {/* La pastille MÈNE AU JOUR au lieu d'ouvrir un choix : un
                          chantier à la journée porte deux listes d'équipes —
                          matin et après-midi, indépendantes — et une pastille
                          unique ne saurait pas laquelle modifier. */}
                      {nombreEquipes > 1 && (
                        <PastilleEquipe
                          vide={toutes.length === 0}
                          onClick={ouvrir}
                          avecPlus={false}
                          libelle={ditLesEquipes(toutes.map(nomEquipe))}
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
                      <Link
                        href={`/chantiers/${c.id}`}
                        aria-label={`Ouvrir le chantier — ${c.nom}`}
                        className="cursor-pointer px-0.5 text-[19px] no-underline"
                        style={{ color: colors.chevron }}
                      >
                        ›
                      </Link>
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
              {jourTouche && !estWeekEndIso(jourTouche)
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
                    {jourTouche && !estWeekEndIso(jourTouche) ? (
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

/** Le fond d'un état — la même règle pour la barre, la pastille et la légende. */
function fondDeLEtat(etat: EtatDemi): string {
  if (etat === "dispo") return colors.vertPale;
  if (etat === "plein") return colors.rust;
  if (etat === "dela") return colors.bordeaux;
  return "transparent";
}

/**
 * Les deux barres sous le chiffre : le matin dessus, l'après-midi dessous.
 *
 * **Sa question du 21 août : « comment tu vas faire s'il y a dix équipes ? »**
 * Trois états ne tenaient pas : avec dix équipes, « il reste de la place »
 * couvre une équipe prise comme neuf. La barre se REMPLIT donc à la
 * proportion — deux prises sur dix, c'est un cinquième de barre.
 */
function MarqueDuJour({
  matin,
  apres,
  cache,
}: {
  matin: { pris: readonly unknown[]; charge: number };
  apres: { pris: readonly unknown[]; charge: number };
  cache?: boolean;
}) {
  const barre = (o: { pris: readonly unknown[]; charge: number }, quoi: string) => {
    const etat = etatDemi(o);
    return (
      <i
        key={quoi}
        data-demi={quoi}
        data-etat={etat}
        className="flex h-[6px] overflow-hidden rounded-[2px]"
        style={{ background: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
      >
        <span
          data-atlas="seg"
          className="h-full"
          style={{ width: `${partDeLaBarre(o.charge)}%`, background: fondDeLEtat(etat) }}
        />
      </i>
    );
  };
  return (
    <span
      data-atlas="marque"
      className="flex w-[24px] flex-col gap-[2.5px]"
      style={{ visibility: cache ? "hidden" : "visible" }}
    >
      {barre(matin, "matin")}
      {barre(apres, "apres_midi")}
    </span>
  );
}

/**
 * La légende : quatre états, puis la POSITION.
 *
 * **Les deux derniers rectangles sont vides tous les deux** — sa correction du
 * 21 août : *« le rectangle du matin, mets-le blanc comme celui de
 * l'après-midi »*. Rempli, le premier se lisait comme un cinquième état, juste
 * après « au-delà » ; il ne dit rien de la charge, seulement où est le matin.
 *
 * **« Libre » n'y figure pas**, et c'est délibéré : un carré vide se comprend
 * seul, et il a demandé que tout tienne sur UNE ligne.
 */
function Legende() {
  const carre = (etat: EtatDemi) => (
    <i
      data-atlas="carre"
      data-etat={etat}
      className="block h-[10px] w-[10px] flex-shrink-0 rounded-[3px]"
      style={
        etat === "libre"
          ? { background: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }
          : { background: fondDeLEtat(etat) }
      }
    />
  );
  const mots: [EtatDemi, string][] = [
    ["libre", "rien"],
    ["dispo", "incomplet"],
    ["plein", "complet"],
    ["dela", "au-delà"],
  ];
  return (
    <div
      data-atlas="legende"
      className="mx-[18px] mt-3.5 flex flex-nowrap items-center justify-center gap-1.5 text-[9px]"
      style={{ color: colors.muted }}
    >
      {mots.map(([etat, mot]) => (
        <span key={etat} className="flex flex-shrink-0 items-center gap-[5px] whitespace-nowrap">
          {carre(etat)} {mot}
        </span>
      ))}
      <span
        data-atlas="legende-position"
        className="flex flex-shrink-0 items-center gap-[7px] whitespace-nowrap"
      >
        <span className="flex w-[24px] flex-shrink-0 flex-col gap-[2.5px] self-stretch">
          {["matin", "apres_midi"].map((d) => (
            <i
              key={d}
              className="flex h-[6px] rounded-[2px]"
              style={{ background: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
            />
          ))}
        </span>
        <span className="flex flex-col gap-[2.5px] leading-none">
          <b
            className="flex h-[6px] items-center text-[9.5px] font-semibold"
            style={{ color: colors.inkSoft }}
          >
            matin
          </b>
          <b
            className="flex h-[6px] items-center text-[9.5px] font-semibold"
            style={{ color: colors.inkSoft }}
          >
            après-midi
          </b>
        </span>
      </span>
    </div>
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
        color: retenue ? "#faf9f5" : fini ? colors.or : colors.inkSoft,
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
  onClick: () => void;
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
        color: vide ? colors.or : "#faf9f5",
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
   * écrire « Équipe A » à un artisan qui travaille seul lui inventerait une
   * organisation qu'il n'a pas — le patron l'a interdit le 10 août 2026
   * (`src/lib/equipes.ts`). La planche 84 en montre deux ; elle ne dit rien du
   * cas où il n'y en a qu'une, et c'est la règle d'avant qui tranche.
   */
  nombreEquipes: number;
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
  return (
    <>
      {ouvert?.quoi === "ajout-qui" && ouvert.cle === cle ? (
        <div className="mt-3.5 pt-3" style={{ borderTop: `1px solid ${colors.line}` }}>
          {sansDate.length === 0 ? (
            <p className="m-0 text-[12px]" style={{ color: colors.muted }}>
              Aucun chantier n’attend de jour.
            </p>
          ) : (
            <Choisir>
              {sansDate.map((s) => (
                <Petit
                  key={s.id}
                  data-qui={s.id}
                  onClick={() =>
                    setOuvert({ quoi: "ajout-quand", cle, chantierId: s.id })
                  }
                >
                  {s.nom}
                </Petit>
              ))}
            </Choisir>
          )}
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
          style={{ borderTop: `1px solid ${colors.line}` }}
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
        <div
          className="mt-3.5 flex items-center justify-center gap-2.5 pt-3 text-[12.5px]"
          style={{ borderTop: `1px solid ${colors.line}`, color: colors.inkSoft }}
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
  nombreEquipes,
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

  if (estWeekEndIso(jour)) {
    return (
      <div
        data-atlas="carte-jour"
        data-jour={jour}
        className="mx-[18px] mt-4 rounded-[10px] px-[15px] py-[14px]"
        style={{ background: colors.card }}
      >
        <p
          className="mb-3.5 text-center text-[12.5px] font-bold uppercase leading-none"
          style={{ letterSpacing: "0.14em", color: colors.ink }}
        >
          {jourLisibleCourt(jour)}
        </p>
        <p className="m-0 text-center text-[13px]" style={{ color: colors.muted }}>
          Jamais proposé.
        </p>
      </div>
    );
  }

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

                    {nombreEquipes <= 1 ? null : choixEquipe ? (
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
                        libelle={ditLesEquipes(rangs.map(nomEquipe))}
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
                        {(Object.keys(MOT_QUAND) as QuandChantier[]).map((v) => (
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

/** Comment ce chantier se lit dans les trois boutons de « Déplacer ». */
function quandDuChantier(c: ChantierPlanning): QuandChantier {
  const duree = c.dureeDemiJournees ?? DUREE_PAR_DEFAUT_DEMI_JOURNEES;
  if (duree >= 2) return "journee";
  return c.creneauDebut === "apres_midi" ? "apres" : "matin";
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
          style={{ background: colors.rust, color: "#faf9f5" }}
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
