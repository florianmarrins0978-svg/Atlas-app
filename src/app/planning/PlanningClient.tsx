"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getPlanificationEtat, trierParDatePlanifiee } from "@/lib/chantier-etat";
import { estAuPlanning } from "@/lib/onglet-chantier";
import { jourIso } from "@/lib/jour";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import {
  compterOccupation,
  creneauxDuChantier,
  cleCreneau,
  dureeEnDemiJournees,
  DUREE_PAR_DEFAUT_DEMI_JOURNEES,
  libelleOccupation,
  LIBELLE_MOMENT,
  MOMENTS,
  type JourIso,
  type Moment,
} from "@/server/disponibilites";
import {
  grilleDuMois,
  marqueDuJour,
  repartirParEquipe,
  jourLisibleCourt,
  estWeekEndIso,
  JOURS_COURTS,
  MOIS_LONGS,
  LEGENDE_MARQUES,
  type MarqueJour,
} from "@/lib/mois";
import { equipesAffichees, libelleEquipe } from "@/lib/equipes";
import FeuilleYAller from "@/components/atlas/FeuilleYAller";
import FeuilleEquipe from "@/components/atlas/FeuilleEquipe";
import LigneRetirable from "@/components/atlas/LigneRetirable";
import TiroirDesRetires from "@/components/atlas/TiroirDesRetires";
import { useRetraits } from "@/components/atlas/useRetraits";
import { planifierChantierAction, supprimerChantierAction, changerEquipeChantierAction } from "./actions";

/**
 * Le planning — le mois, et la journée qui s'ouvre dessous.
 *
 * *Variante « le mois », retenue par le patron le 10 août 2026 sur maquette
 * (`maquettes/atlas-planning.html`, `docs/INTEGRER-ORIGINE.md` §6 quater).*
 *
 * **Rien qui ressemble à un tableau** : pas de bordure, pas de fond de case, un
 * chiffre en serif et un point de 5 px dessous. Le calendrier doit se lire
 * d'abord comme des chiffres.
 *
 * **La journée s'ouvre DIRECTEMENT SOUS le calendrier, et s'amène à l'écran.**
 * Deux fois de suite le patron a écrit « rien ne s'ouvre quand je touche un
 * jour », avec quarante contrôles au vert : posée plus bas, elle s'ouvrait hors
 * du champ et l'écran paraissait mort.
 *
 * **Poser, c'est dire à la fois QUAND et QUI.** Le bouton ne s'arme qu'une fois
 * l'équipe choisie ; une date sans équipe laisse le travail à moitié fait.
 */

type ChantierPlanning = {
  id: string;
  nom: string;
  clientNom: string | null;
  devisEnvoyeAt: Date | string | null;
  datePlanifiee: string | null;
  creneauDebut: string | null;
  dureeDemiJournees: number | null;
  dureePrevue?: string | null;
  /** Le rang de l'équipe qui le tient. `null` = pas encore attribué. */
  rangEquipe: number | null;
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

export type RendezVousExterne = {
  debut: string;
  fin: string;
  intitule: string | null;
  journeeEntiere: boolean;
};

export default function PlanningClient({
  initialChantiers,
  nombreEquipes = 1,
  equipesNommees = [],
  agenda = { configure: false, relie: false, actif: false, enPanne: false },
  rendezVous = [],
}: {
  initialChantiers: ChantierPlanning[];
  nombreEquipes?: number;
  equipesNommees?: { rang: number; nom: string | null }[];
  agenda?: EtatAgendaPlanning;
  rendezVous?: RendezVousExterne[];
}) {
  const [chantiers, setChantiers] = useState<ChantierPlanning[]>(initialChantiers);
  const aujourdHui = jourIso(new Date());

  const [curseur, setCurseur] = useState(() => {
    const d = new Date(`${aujourdHui}T12:00:00Z`);
    return { annee: d.getUTCFullYear(), mois: d.getUTCMonth() };
  });
  const [jourOuvert, setJourOuvert] = useState<JourIso | null>(null);
  const [choix, setChoix] = useState<{ moment: Moment; rang: number } | null>(null);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const journeeRef = useRef<HTMLDivElement>(null);
  const grilleRef = useRef<HTMLDivElement>(null);

  // **Le retrait reste branché ici.** Le planning était l'un des huit endroits
  // qui suppriment (`ARCHITECTURE.md` §48) ; la refonte de l'écran ne doit pas
  // emporter le geste avec les trois anciennes listes. Il vit désormais sur
  // « Sans date » — celle qui reste, et la seule où l'on se débarrasse d'un
  // chantier plutôt que de le poser.
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
   * contredire. Le filtre écrit à la main ici les mélangeait, et les annonçait
   * tous « Devis accepté » — ce qui était faux pour la moitié d'entre eux.
   */
  const sansDate = useMemo(
    () => visibles.filter((c) => getPlanificationEtat(c) === "a_planifier"),
    [visibles]
  );

  /**
   * Ni posables ni oubliables : leur date se décide chez le client.
   *
   * Les taire les ferait disparaître entre deux listes, alors que ce sont
   * précisément ceux dont le patron se demande où ils en sont.
   */
  const attenteClient = useMemo(
    () => visibles.filter((c) => getPlanificationEtat(c) === "attente_client"),
    [visibles]
  );

  // **On pose un chantier sans date, ou on en DÉPLACE un déjà posé.** Retirer
  // ce second cas aurait supprimé en silence la seule façon de changer une date
  // — le geste existait depuis le 8 août, et rien dans la maquette ne demandait
  // de le reprendre.
  const [aPoserId, setAPoserId] = useState<string | null>(null);
  const aPoser = visibles.find((c) => c.id === aPoserId) ?? sansDate[0] ?? null;

  const dureeAPoser =
    aPoser?.dureeDemiJournees ??
    dureeEnDemiJournees(aPoser?.dureePrevue ?? null) ??
    DUREE_PAR_DEFAUT_DEMI_JOURNEES;

  const occupation = useMemo(
    () =>
      compterOccupation(
        planifies.map((c) => ({
          jour: c.datePlanifiee as string,
          moment: c.creneauDebut === "matin" || c.creneauDebut === "apres_midi" ? c.creneauDebut : null,
          dureeDemiJournees: c.dureeDemiJournees,
        }))
      ),
    [planifies]
  );

  const cases = useMemo(() => grilleDuMois(curseur.annee, curseur.mois), [curseur]);
  const lignesEquipes = equipesAffichees(equipesNommees, nombreEquipes);

  /** Le chantier dont la feuille « Y aller » est ouverte, ou `null`. */
  const [yAllerId, setYAllerId] = useState<string | null>(null);
  const yAller = planifies.find((c) => c.id === yAllerId) ?? null;

  /** Celui dont la pastille d'équipe est ouverte — geste A du 14 août 2026. */
  const [equipeDeId, setEquipeDeId] = useState<string | null>(null);
  const equipeDe = planifies.find((c) => c.id === equipeDeId) ?? null;

  /**
   * Amener le calendrier sous les yeux pour poser ou déplacer.
   *
   * **Écrit une fois** : le geste part maintenant de deux endroits — la liste
   * « Sans date » et la feuille du chevron, depuis que « Déplacer » a quitté la
   * ligne. Deux copies auraient divergé le jour où l'une des deux oublie de
   * refermer le jour ouvert, et l'écran se serait figé sur une journée qui ne
   * concerne plus le chantier qu'on déplace.
   */
  function amenerAuCalendrier(id: string) {
    setAPoserId(id);
    setJourOuvert(null);
    grilleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /**
   * « journée · Équipe A » sur la liste, « 14 août · journée · Équipe A » dans
   * la feuille — écrit **une seule fois**, parce que les deux disent la même
   * chose. Deux constructions de la même phrase finissent toujours par
   * diverger, et l'écart se voit à l'endroit précis où le patron compare.
   *
   * **CE QUE LA LIGNE DIT, ET CE QU'ELLE NE DIT PLUS.** Elle écrivait la
   * demi-journée de DÉPART : un chantier d'une journée entière annonçait
   * « matin », et un chantier de trois jours aussi. Le patron, le 13 août
   * 2026 : *« ça laisse à penser que juste le matin est bloqué alors que c'est
   * la journée »*. Elle dit désormais ce que le chantier OCCUPE
   * (`libelleOccupation`), et les mots sont les siens, arrêtés le 14 août sur
   * `docs/maquettes/53-le-mot-juste-sans-la-date.html` : « journée », et
   * « du 21 au 25 août » au-delà d'un jour.
   *
   * **LA DATE TOMBE SUR LA LISTE, PAS DANS LA FEUILLE**, et ce n'est pas une
   * inconséquence. Sa consigne : *« pas la date, elle est déjà présente juste
   * au-dessus »* — vrai du panneau du jour, qui se titre « Lundi 17 août ».
   * Dans la feuille du chevron, en revanche, elle n'est écrite **nulle part
   * ailleurs** : l'en retirer laisserait un chantier sans jour.
   *
   * `porteLaDate` évite le doublon : sur plusieurs jours le libellé contient
   * déjà « du 21 au 25 août », et la préfixer donnerait « 21 août · du 21 au
   * 25 août ».
   */
  function libelleQuand(c: ChantierPlanning, avecLaDate = false): string {
    const occupation = libelleOccupation(
      c.datePlanifiee as JourIso,
      c.creneauDebut === "matin" || c.creneauDebut === "apres_midi" ? c.creneauDebut : null,
      c.dureeDemiJournees
    );
    const jour =
      avecLaDate && !occupation.porteLaDate
        ? new Date(`${c.datePlanifiee}T12:00:00Z`).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
            timeZone: "UTC",
          })
        : null;
    const equipe = libelleEquipe(lignesEquipes.find((e) => e.rang === c.rangEquipe) ?? null, nombreEquipes);
    return [jour, occupation.texte, equipe].filter(Boolean).join(" · ");
  }

  /**
   * **Ouvrir ET amener à l'écran.** C'est le comportement que la maquette
   * obtenait par une ancre (`:target` + `scroll-margin-top`) ; ici c'est de
   * l'état React, mais l'effet doit rester le même — sans quoi l'écran paraît
   * mort sous le doigt.
   */
  useEffect(() => {
    if (!jourOuvert) return;
    journeeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [jourOuvert]);

  function ouvrirJour(jour: JourIso) {
    setRefus(null);
    setChoix(null);
    // **Une case du mois voisin fait basculer le calendrier.** Sans cela,
    // l'écran affichait « Lundi 27 juillet » sous un calendrier titré « août » :
    // les deux se contredisaient, et rien ne disait lequel croire. Vu en
    // capture, jamais autrement.
    const d = new Date(`${jour}T12:00:00Z`);
    if (d.getUTCFullYear() !== curseur.annee || d.getUTCMonth() !== curseur.mois) {
      setCurseur({ annee: d.getUTCFullYear(), mois: d.getUTCMonth() });
    }
    setJourOuvert((cur) => (cur === jour ? null : jour));
  }

  /** Qui occupe cette demi-journée, équipe par équipe. */
  function lignesDuMoment(jour: JourIso, moment: Moment) {
    const occupants = planifies
      // Le chantier qu'on déplace ne se compte pas comme occupant : sinon sa
      // propre demi-journée lui serait refusée, et on ne pourrait pas le
      // décaler d'une demi-journée. C'est ce que fait déjà le serveur.
      .filter((c) => c.id !== aPoser?.id)
      .filter((c) => {
        if (!c.datePlanifiee) return false;
        const depart: { jour: JourIso; moment: Moment } = {
          jour: c.datePlanifiee,
          moment: c.creneauDebut === "apres_midi" ? "apres_midi" : "matin",
        };
        const duree = c.dureeDemiJournees ?? DUREE_PAR_DEFAUT_DEMI_JOURNEES;
        return creneauxDuChantier(depart, duree).some((x) => cleCreneau(x) === cleCreneau({ jour, moment }));
      })
      .map((c) => ({ id: c.id, nom: c.nom, rangEquipe: c.rangEquipe }));
    return repartirParEquipe(occupants, nombreEquipes);
  }

  async function poser() {
    if (!aPoser || !jourOuvert || !choix) return;
    setEnCours(true);
    setRefus(null);
    try {
      const r = await planifierChantierAction(aPoser.id, jourOuvert, {
        moment: choix.moment,
        rangEquipe: nombreEquipes > 1 ? choix.rang : null,
      });
      if (!r.succes) {
        setRefus(r.erreur);
        return;
      }
      setChantiers((cur) =>
        cur.map((c) =>
          c.id === aPoser.id
            ? {
                ...c,
                datePlanifiee: jourOuvert,
                creneauDebut: choix.moment,
                dureeDemiJournees: dureeAPoser,
                rangEquipe: nombreEquipes > 1 ? choix.rang : null,
              }
            : c
        )
      );
      setChoix(null);
      setJourOuvert(null);
      setAPoserId(null);
    } finally {
      setEnCours(false);
    }
  }

  const marqueDe = (jour: JourIso): MarqueJour => marqueDuJour(jour, occupation, nombreEquipes);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-16">
        <EnTeteEcran surtitre="Vos journées" titre="Planning" />

        {/* Le raccordement de l'agenda — sa demande du 9 août 2026. Il
            disparaît quand tout va bien : un bandeau permanent sur l'écran le
            plus consulté devient du décor, et le jour où il annonce une panne
            personne ne le voit. */}
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
                <span className="block text-[12.5px] leading-snug" style={{ color: colors.muted }}>
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

        {/* ─── Le mois ──────────────────────────────────────────────────── */}
        <div ref={grilleRef} className="mt-[26px] px-[26px]">
          <div className="mb-4 flex items-baseline justify-between">
            <span style={{ fontFamily: font.display, fontSize: 21, lineHeight: 1 }}>
              {MOIS_LONGS[curseur.mois]}
            </span>
            <span className="flex items-center gap-4">
              <span className="text-[11px] uppercase" style={{ color: colors.muted, letterSpacing: "0.2em" }}>
                {curseur.annee}
              </span>
              <button
                type="button"
                aria-label="Mois précédent"
                onClick={() =>
                  setCurseur((c) => (c.mois === 0 ? { annee: c.annee - 1, mois: 11 } : { ...c, mois: c.mois - 1 }))
                }
                className="px-2 py-1 text-[15px]"
                style={{ color: colors.muted }}
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Mois suivant"
                onClick={() =>
                  setCurseur((c) => (c.mois === 11 ? { annee: c.annee + 1, mois: 0 } : { ...c, mois: c.mois + 1 }))
                }
                className="px-2 py-1 text-[15px]"
                style={{ color: colors.muted }}
              >
                ›
              </button>
            </span>
          </div>

          <div
            className="mb-2.5 grid grid-cols-7 gap-x-0 gap-y-0.5 text-center"
            style={{ color: colors.muted }}
            aria-hidden="true"
          >
            {JOURS_COURTS.map((j) => (
              <span key={j} className="text-[8px] uppercase" style={{ letterSpacing: "0.16em" }}>
                {j}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-0.5" data-atlas="grille-mois">
            {cases.map((c) => {
              const marque = c.horsMois ? "libre" : marqueDe(c.jour);
              const estAujourdHui = c.jour === aujourdHui;
              const ouvert = c.jour === jourOuvert;
              return (
                <button
                  key={c.jour}
                  type="button"
                  onClick={() => ouvrirJour(c.jour)}
                  aria-label={`${jourLisibleCourt(c.jour)}${legendeDeMarque(marque)}`}
                  aria-expanded={ouvert}
                  data-jour={c.jour}
                  data-marque={marque}
                  className="flex aspect-square flex-col items-center justify-center gap-[5px] rounded-full"
                  style={{
                    fontFamily: font.display,
                    fontSize: 15,
                    lineHeight: 1,
                    // **La couleur, jamais l'opacité, pour estomper.** Une
                    // animation d'arrivée finit à `opacity:1` et l'emporterait.
                    color: c.horsMois
                      ? colors.muted
                      : ouvert || estAujourdHui
                        ? colors.or
                        : c.weekEnd
                          ? "rgba(28,28,26,0.28)"
                          : colors.ink,
                    opacity: c.horsMois ? 0.3 : 1,
                    boxShadow: ouvert ? `inset 0 0 0 1px ${colors.or}` : "none",
                    WebkitTapHighlightColor: "transparent",
                    transition: "color .28s, box-shadow .28s",
                  }}
                >
                  {c.numero}
                  <Marque marque={c.horsMois ? "libre" : marque} />
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── La journée, DIRECTEMENT sous le calendrier ────────────────── */}
        {jourOuvert && (
          <div ref={journeeRef} className="mt-[26px] px-[26px]" data-atlas="journee" data-jour={jourOuvert}>
            <p style={{ fontFamily: font.display, fontSize: 23, lineHeight: 1.08, letterSpacing: "-0.012em" }}>
              {jourLisibleCourt(jourOuvert)}
            </p>

            {estWeekEndIso(jourOuvert) ? (
              // Le samedi rappelle la règle qui surprend : un chantier de deux
              // jours parti vendredi matin finit LUNDI.
              <p className="mt-3.5 text-[13px] leading-[1.6]" style={{ color: colors.muted }}>
                Jamais proposé. Un chantier de deux jours parti{" "}
                <span style={{ color: colors.ink }}>vendredi matin</span> se termine{" "}
                <span style={{ color: colors.ink }}>lundi</span>.
              </p>
            ) : (
              <JourneeOuvrable
                jour={jourOuvert}
                aPoser={aPoser}
                nombreEquipes={nombreEquipes}
                lignesEquipes={lignesEquipes}
                lignesDuMoment={lignesDuMoment}
                choix={choix}
                onChoisir={setChoix}
                onPoser={poser}
                enCours={enCours}
                refus={refus}
              />
            )}
          </div>
        )}

        {/* ─── La légende, et ce que « complet » veut dire ───────────────── */}
        <div className="mt-5 flex flex-wrap items-center gap-x-3.5 gap-y-1 px-[26px] text-[11px]" style={{ color: colors.muted }}>
          {LEGENDE_MARQUES.map((l) => (
            <span key={l.marque} className="flex items-center gap-1.5">
              <Marque marque={l.marque} />
              {l.texte}
            </span>
          ))}
        </div>
        <p className="mt-2.5 px-[26px] text-[11px] leading-[1.6]" style={{ color: colors.muted, opacity: 0.85 }}>
          {nombreEquipes > 1
            ? `« Complet » veut dire : vos ${nombreEquipes} équipes sont prises sur cette demi-journée.`
            : "« Complet » veut dire : cette demi-journée est prise."}
        </p>

        {/* ─── Sans date ─────────────────────────────────────────────────── */}
        <div className="mt-[30px] px-[26px] pt-[18px]" style={{ borderTop: `1px solid ${colors.line}` }}>
          <p className={`mb-2.5 ${libelleCaps}`} style={{ color: colors.muted }}>
            Sans date
          </p>
          {sansDate.length === 0 ? (
            <p className="text-[13px]" style={{ color: colors.muted }}>
              Aucun chantier n&apos;attend de jour.
            </p>
          ) : (
            sansDate.map((c) => {
              const vise = aPoser?.id === c.id;
              return (
                <LigneRetirable
                  key={c.id}
                  libelle={`le chantier ${c.nom}`}
                  retiree={retraits.estRetire(c.id)}
                  onRetirer={() => retraits.retirer(c.id, `le chantier ${c.nom}`)}
                  // Une ligne sur une seule rangée : les 170 px par défaut
                  // laisseraient un blanc sous elle.
                  hauteurMax={64}
                  className="flex"
                >
                  <button
                    type="button"
                    onClick={() => setAPoserId(c.id)}
                    aria-pressed={vise}
                    data-atlas="sans-date"
                    className="flex w-full items-baseline justify-between gap-3.5 py-[11px] text-left"
                  >
                    <span
                      className="min-w-0 flex-1 truncate"
                      style={{ fontFamily: font.display, fontSize: 16, lineHeight: 1.2, color: colors.ink }}
                    >
                      {c.nom}
                    </span>
                    <span
                      className="flex-shrink-0 whitespace-nowrap text-[12px]"
                      style={{ color: vise ? colors.or : colors.muted }}
                    >
                      {vise ? "À poser" : "Devis accepté"}
                    </span>
                  </button>
                </LigneRetirable>
              );
            })
          )}
        </div>

        {attenteClient.length > 0 && (
          <div className="mt-[30px] px-[26px] pt-[18px]" style={{ borderTop: `1px solid ${colors.line}` }}>
            <p className={`mb-2.5 ${libelleCaps}`} style={{ color: colors.muted }}>
              En attente du client
            </p>
            {attenteClient.map((c) => (
              <div key={c.id} className="flex items-baseline justify-between gap-3.5 py-[11px]">
                <span
                  className="min-w-0 flex-1 truncate"
                  style={{ fontFamily: font.display, fontSize: 16, lineHeight: 1.2, color: colors.ink }}
                >
                  {c.nom}
                </span>
                <span className="flex-shrink-0 whitespace-nowrap text-[12px]" style={{ color: colors.muted }}>
                  Il choisit sa date
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ─── Planifiés ─────────────────────────────────────────────────
            **Le planning était un cul-de-sac, et il ne doit pas le redevenir.**
            Le patron, le 8 août 2026 : « le client m'a retourné la date
            validée, il se range dans les chantiers planifiés, mais comment je
            fais pour avoir accès au devis ? Je dois pouvoir cliquer directement
            sur le client planifié, avoir un bouton à côté fin de chantier. »

            La maquette ne montre que le mois et la journée ; la reprendre telle
            quelle aurait refermé ce chemin sans que rien ne le dise. Le nom mène
            au chantier, « Créer la facture » à la facture. */}
        {planifies.length > 0 && (
          <div className="mt-[30px] px-[26px] pt-[18px]" style={{ borderTop: `1px solid ${colors.line}` }}>
            <p className={`mb-2.5 ${libelleCaps}`} style={{ color: colors.muted }}>
              Planifiés
            </p>
            {planifies.map((c) => (
              <div
                key={c.id}
                className="flex items-baseline justify-between gap-3.5 py-[11px]"
                style={{ borderBottom: `1px solid ${colors.line}` }}
              >
                <Link href={`/chantiers/${c.id}`} className="min-w-0 flex-1">
                  <span
                    className="block truncate"
                    style={{ fontFamily: font.display, fontSize: 16, lineHeight: 1.2, color: colors.ink }}
                  >
                    {c.nom}
                  </span>
                  <span className="block text-[12px]" style={{ color: colors.muted }}>
                    {libelleQuand(c)}
                  </span>
                </Link>
                {/* Aucune barrière de date, comme sur la fiche : c'est le patron
                    qui sait quand un chantier est fait, pas le calendrier. Le
                    geste reste sans danger — il bâtit la facture qu'il
                    vérifiera, il n'émet rien. */}
                <span className="flex flex-shrink-0 items-center gap-3">
                  {/* **LA PASTILLE D'ÉQUIPE — geste A, retenu le 14 août 2026**
                      (`docs/maquettes/52-appliquer-une-equipe.html`).

                      **Ce qu'elle règle.** L'équipe se lisait sur la ligne mais
                      ne s'y touchait pas : la changer demandait six gestes, à
                      commencer par « Déplacer » — un mot qui annonce une DATE.
                      Et surtout, un chantier SANS équipe n'écrivait rien du
                      tout : rien ne signalait qu'il en manquait une. Elle porte
                      donc « Équipe ? » en or pointillé quand il n'y en a pas.

                      **L'or et non le rouge** : il n'y a aucune faute à ne pas
                      avoir encore choisi. Le rouge est réservé aux refus
                      (`colors.alert`), et le confondre userait le seul signal
                      qui doit alarmer.

                      **« DÉPLACER » LUI A CÉDÉ LA PLACE, et ce n'est pas un
                      oubli.** À 390 px la ligne ne peut pas porter le nom, ce
                      qu'occupe le chantier, l'équipe, « Déplacer » et le
                      chevron — c'est le NOM qui aurait rétréci, et c'est la
                      seule chose qui dit de quel chantier il s'agit. Le geste
                      n'est pas perdu : il est passé dans la feuille du chevron,
                      comme « Créer la facture » avant lui. Le supprimer aurait
                      refermé la seule façon de changer une date.

                      Elle n'existe qu'à PLUSIEURS équipes : à une seule, il n'y
                      a personne à désigner et le mot « équipe » ne s'écrit nulle
                      part (`src/lib/equipes.ts`). */}
                  {nombreEquipes > 1 && (
                    <button
                      type="button"
                      aria-label={
                        c.rangEquipe == null
                          ? `Choisir l'équipe — ${c.nom}`
                          : `Changer l'équipe — ${c.nom}`
                      }
                      onClick={() => setEquipeDeId(c.id)}
                      className="whitespace-nowrap rounded-full px-3 py-[5px] text-[11.5px]"
                      style={
                        c.rangEquipe == null
                          ? { border: `1px dashed ${colors.or}`, color: colors.or }
                          : { backgroundColor: colors.rust, color: colors.cream, border: "1px solid transparent" }
                      }
                    >
                      {libelleEquipe(
                        lignesEquipes.find((e) => e.rang === c.rangEquipe) ?? null,
                        nombreEquipes
                      ) ?? "Équipe ?"}
                    </button>
                  )}
                  {/* **« Créer la facture » a quitté la ligne le 12 août 2026,
                      à sa demande** : *« il faut que le créer la facture, tu le
                      mettes dans le chevron. Il faut cliquer sur le chevron, la
                      page s'ouvre avec le GPS et tout machin, et là tu mets
                      créer la facture »*. Il est désormais dans la feuille.

                      Le chemin du planning vers la facture, ouvert le 8 août
                      2026 parce que l'écran était un cul-de-sac, n'est PAS
                      refermé — il passe par un appui de plus, et trois suites
                      le parcourent jusqu'au bout. Le rendre invisible serait
                      retomber dans le défaut d'origine ; c'est pourquoi la
                      feuille le porte en toutes lettres. */}

                  {/* **Le chevron doré — retenu sur maquette le 12 août 2026**
                      (`docs/maquettes/32-le-chevron.html`), après qu'il eut
                      écarté la flèche de navigation : *« je veux la même que
                      celle à côté de maps, le petit > »*.

                      Un chevron ne promet pas un DÉPART, il promet que quelque
                      chose S'OUVRE — ce qui reste vrai des chantiers sans
                      adresse, la feuille disant alors ce qui manque. Le cas
                      particulier a disparu avec le choix du signe.

                      Les 44 px sont invisibles mais ils sont là : le chevron
                      seul ferait une cible de dix-sept pixels, qu'on rate deux
                      fois sur trois avec des gants.

                      **Et ils sont pris SUR LES MARGES, pas sur le nom.** Quand
                      la ligne portait encore « Créer la facture », un
                      quarante-quatrième pixel de plus rognait la seule chose
                      qui dit de quel chantier il s'agit — vu sur capture à
                      390 px, « Chez M. Bernard » devenait « Chez M. … ». Les
                      marges négatives reprennent la hauteur de la ligne
                      (`-my-3`), la gouttière de 16 px (`-ml-2`) et le retrait
                      droit de l'écran (`-mr-[26px]`). Elles restent utiles
                      maintenant que la ligne s'est allégée : le carré touchable
                      tombe au bord de l'écran, là où le pouce arrive le plus
                      vite, sans rien coûter au nom. */}
                  <button
                    type="button"
                    aria-label={`Y aller — ${c.nom}`}
                    onClick={() => setYAllerId(c.id)}
                    // **`-mr-[2px]` depuis le 14 août 2026, à sa demande** :
                    // *« il faut déplacer d'un cm le "Déplacer" avec le chevron
                    // vers la gauche, le chevron doit être légèrement plus gros
                    // aussi »*. Le carré rentre dans le retrait au lieu de
                    // tomber au bord de l'écran — 24 px gagnés, mesurés sur la
                    // planche (`atlas-planning-equipe.html`).
                    //
                    // **Ces 24 px sont pris À LA COLONNE DU NOM**, et c'est le
                    // piège que ce commentaire notait depuis le 12 août : à
                    // 390 px, un nom long se coupe. Le contrôle de la planche
                    // le vérifie, et la ligne s'est allégée entre-temps.
                    //
                    // Les 44 px du carré NE BOUGENT PAS : c'est la cible, et le
                    // signe plus gros ne doit pas la rétrécir — on la rate deux
                    // fois sur trois avec des gants.
                    className="-my-3 -ml-2 -mr-[2px] flex h-11 w-11 flex-shrink-0 items-center justify-center self-center text-[21px]"
                    style={{ color: colors.or }}
                  >
                    <span aria-hidden="true">›</span>
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}

        {/* La feuille « Y aller », posée hors de la boucle : une par ligne
            créerait autant de calques que de chantiers planifiés, tous montés
            en même temps pour n'en montrer qu'un. */}
        {yAller && (
          <FeuilleYAller
            ouverte
            onFermer={() => setYAllerId(null)}
            chantierId={yAller.id}
            nomChantier={yAller.nom}
            clientNom={yAller.clientNom}
            adresse={yAller.adresseChantier ?? null}
            telephone={yAller.clientTelephone ?? null}
            // La date reste ICI, et seulement ici : la feuille est le seul
            // endroit où elle n'est écrite nulle part ailleurs.
            quand={libelleQuand(yAller, true)}
            // **Vide à une seule équipe** : `equipesAffichees` ne rend rien à
            // distinguer, et la feuille n'affiche alors aucune ligne d'équipe.
            equipes={
              nombreEquipes > 1
                ? equipesAffichees(lignesEquipes, nombreEquipes).map((e) => ({
                    rang: e.rang,
                    libelle: libelleEquipe(e, nombreEquipes) ?? `Équipe ${e.rang}`,
                  }))
                : []
            }
            rangEquipe={yAller.rangEquipe ?? null}
            onChangerEquipe={async (rang) => {
              const r = await changerEquipeChantierAction(yAller.id, rang);
              // La ligne du planning porte le nom de l'équipe : sans cette
              // écriture locale, elle garderait l'ancienne jusqu'au prochain
              // rechargement, et il croirait que rien n'a été pris.
              if (r.succes) {
                setChantiers((cur) =>
                  cur.map((c) => (c.id === yAller.id ? { ...c, rangEquipe: rang } : c))
                );
              }
              return r;
            }}
            // **« Déplacer » vit ici depuis le 14 août 2026**, la pastille
            // d'équipe lui ayant pris sa place sur la ligne (geste A). Le geste
            // n'a pas disparu : le retirer aurait refermé la seule façon de
            // changer une date, comme le planning l'avait été jusqu'au 8 août.
            onDeplacer={() => {
              setYAllerId(null);
              amenerAuCalendrier(yAller.id);
            }}
          />
        )}

        {/* La feuille de la pastille — une par écran, hors de la boucle : une
            par ligne monterait autant de calques que de chantiers planifiés. */}
        {equipeDe && (
          <FeuilleEquipe
            // La clé remet la feuille à neuf d'un chantier à l'autre : sans
            // elle, un refus resterait affiché sur le suivant.
            key={equipeDe.id}
            ouverte
            onFermer={() => setEquipeDeId(null)}
            nomChantier={equipeDe.nom}
            quand={libelleQuand(equipeDe, true)}
            equipes={equipesAffichees(lignesEquipes, nombreEquipes).map((e) => ({
              rang: e.rang,
              libelle: libelleEquipe(e, nombreEquipes) ?? `Équipe ${e.rang}`,
            }))}
            rangEquipe={equipeDe.rangEquipe ?? null}
            onChoisir={async (rang) => {
              const r = await changerEquipeChantierAction(equipeDe.id, rang);
              // La ligne porte le nom de l'équipe : sans cette écriture locale
              // elle garderait l'ancienne jusqu'au rechargement, et il croirait
              // que son appui n'a rien pris.
              if (r.succes) {
                setChantiers((cur) =>
                  cur.map((c) => (c.id === equipeDe.id ? { ...c, rangEquipe: rang } : c))
                );
              }
              return r;
            }}
          />
        )}

        {/* Un refus du serveur ramène la ligne : le dire, sinon elle
            réapparaît sans raison apparente. C'est ici qu'un chantier facturé
            se voit refuser — sa facture figure au relevé de TVA. */}
        {Object.entries(retraits.refuses).map(([id, motif]) => (
          <p key={id} role="alert" className="mt-4 px-[26px] text-[13px]" style={{ color: colors.alert }}>
            {motif}
          </p>
        ))}

        {/* Le tiroir, en fin de contenu et non par-dessus : il pousse la
            dernière ligne vers le haut au lieu de la masquer. */}
        <TiroirDesRetires
          dernier={retraits.dernier}
          nombre={retraits.nombre}
          onAnnuler={retraits.annuler}
          className="mt-6"
        />

        {/* Ses rendez-vous, avec leur intitulé — sa demande du 9 août : « si,
            il doit lire les intitulés aussi ! ». Ils ne se modifient pas depuis
            Atlas : deux endroits pour changer la même chose finissent par se
            contredire. */}
        {rendezVous.length > 0 && (
          <div className="mt-[30px] px-[26px] pt-[18px]" style={{ borderTop: `1px solid ${colors.line}` }}>
            <p className={`mb-2.5 ${libelleCaps}`} style={{ color: colors.muted }}>
              Dans mon agenda
            </p>
            {rendezVous.slice(0, 8).map((r, i) => (
              <div key={`${r.debut}-${i}`} className="flex items-baseline justify-between gap-3.5 py-[11px]">
                <span
                  className="min-w-0 flex-1 truncate"
                  style={{ fontFamily: font.display, fontSize: 16, lineHeight: 1.2 }}
                >
                  {r.intitule ?? "Rendez-vous sans titre"}
                </span>
                <span className="flex-shrink-0 whitespace-nowrap text-[12px]" style={{ color: colors.muted }}>
                  {libelleRendezVous(r)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** De quoi écrire « une troisième équipe » sans fabriquer « 3ᵉ ». */
const ORDINAUX: Record<number, string> = {
  2: "deuxième",
  3: "troisième",
  4: "quatrième",
  5: "cinquième",
  6: "sixième",
};

/** Le point de 5 px sous le chiffre — cinq marques, pas quatre. */
function Marque({ marque }: { marque: MarqueJour }) {
  const base = { width: 5, height: 5, borderRadius: 99, display: "block" } as const;
  if (marque === "libre") return <span aria-hidden="true" style={{ ...base, background: "transparent" }} />;
  if (marque === "reste")
    return <span aria-hidden="true" style={{ ...base, boxShadow: `inset 0 0 0 1px ${colors.or}` }} />;
  if (marque === "plein") return <span aria-hidden="true" style={{ ...base, background: colors.or }} />;
  return (
    <span
      aria-hidden="true"
      style={{
        ...base,
        background:
          marque === "matin"
            ? `linear-gradient(180deg, ${colors.or} 50%, transparent 50%)`
            : `linear-gradient(180deg, transparent 50%, ${colors.or} 50%)`,
        boxShadow: `inset 0 0 0 0.5px ${colors.or}`,
      }}
    />
  );
}

function legendeDeMarque(marque: MarqueJour): string {
  if (marque === "libre") return " — libre";
  if (marque === "reste") return " — il reste de la place";
  if (marque === "matin") return " — matin complet";
  if (marque === "apres_midi") return " — après-midi complet";
  return " — journée pleine";
}

/** Le contenu d'une journée ouvrable : matin, après-midi, et le bouton. */
function JourneeOuvrable({
  jour,
  aPoser,
  nombreEquipes,
  lignesEquipes,
  lignesDuMoment,
  choix,
  onChoisir,
  onPoser,
  enCours,
  refus,
}: {
  jour: JourIso;
  aPoser: { id: string; nom: string } | null;
  nombreEquipes: number;
  lignesEquipes: { rang: number; nom?: string | null }[];
  lignesDuMoment: (jour: JourIso, moment: Moment) => { rang: number; occupe: { id: string; nom: string } | null }[];
  choix: { moment: Moment; rang: number } | null;
  onChoisir: (c: { moment: Moment; rang: number }) => void;
  onPoser: () => void;
  enCours: boolean;
  refus: string | null;
}) {
  const parMoment = MOMENTS.map((m) => ({ moment: m, lignes: lignesDuMoment(jour, m) }));
  const toutPris = parMoment.every((p) => p.lignes.every((l) => l.occupe !== null));

  if (toutPris) {
    const noms = [...new Set(parMoment.flatMap((p) => p.lignes.map((l) => l.occupe?.nom).filter(Boolean)))];
    return (
      <p className="mt-3.5 text-[13px] leading-[1.6]" style={{ color: colors.muted }}>
        Journée pleine — <span style={{ color: colors.ink }}>{noms.join(" et ")}</span>.{" "}
        {/* **Seul, on ne conseille pas d'embaucher.** Le mot « équipe » ne
            s'écrit nulle part tant qu'il n'y en a qu'une : à ce compte-là,
            l'écran désignerait une organisation que le patron n'a pas. */}
        {nombreEquipes > 1
          ? `Il faudrait une ${ORDINAUX[nombreEquipes + 1] ?? `${nombreEquipes + 1}ᵉ`} équipe.`
          : "Rien ne peut s'y ajouter."}
      </p>
    );
  }

  const nomChoisie = choix
    ? libelleEquipe(lignesEquipes.find((e) => e.rang === choix.rang) ?? null, nombreEquipes)
    : null;

  return (
    <>
      {aPoser ? (
        <p className="mt-[7px] text-[12.5px]" style={{ color: colors.muted }}>
          Où poser «&nbsp;{aPoser.nom}&nbsp;» ?
        </p>
      ) : (
        <p className="mt-[7px] text-[12.5px]" style={{ color: colors.muted }}>
          Aucun chantier n&apos;attend de jour — cette journée se lit, elle ne se remplit pas.
        </p>
      )}

      {parMoment.map(({ moment, lignes }) => (
        <div key={moment} className="mt-[22px]">
          <p className={`mb-0.5 flex items-center gap-3 ${libelleCaps}`} style={{ color: colors.muted }}>
            {moment === "matin" ? "Matin" : "Après-midi"}
            <i className="h-px flex-1" style={{ backgroundColor: colors.line }} />
          </p>
          {lignes.map((l) => {
            const libre = l.occupe === null;
            // **Le rang est écrit en clair.** Un `nth-of-type` comptait dans son
            // propre bloc et allumait la ligne sur le matin ET l'après-midi à la
            // fois : la clé porte donc les deux, moment compris.
            const vise = choix?.moment === moment && choix.rang === l.rang;
            const nomEquipe = libelleEquipe(lignesEquipes.find((e) => e.rang === l.rang) ?? null, nombreEquipes);
            // **Deux colonnes quand il y a une équipe à nommer, UNE SEULE
            // sinon.** À une équipe, « Libre » — ou le nom du chantier — tient
            // la place du nom, et la colonne de droite n'existe pas : l'écrire
            // des deux côtés mettait « Libre » deux fois sur la même ligne, et
            // deux fois la même information sur un écran, c'est une de trop.
            const gauche = nomEquipe ?? (libre ? "Libre" : (l.occupe?.nom ?? ""));
            const droite = nomEquipe ? (libre ? "Libre" : (l.occupe?.nom ?? "")) : null;
            return (
              <button
                key={`${moment}-${l.rang}`}
                type="button"
                disabled={!libre || !aPoser}
                onClick={() => onChoisir({ moment, rang: l.rang })}
                aria-pressed={vise}
                data-atlas="creneau"
                data-moment={moment}
                data-rang={l.rang}
                data-libre={libre ? "oui" : "non"}
                className="flex w-full items-center justify-between gap-3.5 py-3.5 text-left"
                style={{
                  borderBottom: `1px solid ${vise ? colors.or : colors.line}`,
                  transition: "border-color .26s",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  {/* La perle bronze paraît devant le nom quand la ligne est
                      choisie. Elle occupe sa place en permanence : sinon le nom
                      saute de dix pixels au moment du choix. */}
                  <span
                    aria-hidden="true"
                    className="block flex-none"
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 99,
                      backgroundColor: colors.or,
                      opacity: vise ? 1 : 0,
                      transition: "opacity .26s",
                    }}
                  />
                  <span
                    className="truncate"
                    style={{
                      fontFamily: font.display,
                      fontSize: 17,
                      lineHeight: 1.15,
                      // Seul, une demi-journée libre n'a personne à nommer :
                      // c'est « Libre » qui tient la place du nom, en bronze.
                      color: libre && !nomEquipe ? colors.or : colors.ink,
                    }}
                  >
                    {gauche}
                  </span>
                </span>
                {droite && (
                  <span
                    className="flex-shrink-0 whitespace-nowrap text-[12.5px]"
                    style={{ color: vise ? colors.ink : libre ? colors.or : colors.muted }}
                  >
                    {droite}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}

      {refus && (
        <p role="alert" className="mt-4 text-[13px]" style={{ color: colors.alert }}>
          {refus}
        </p>
      )}

      {/* **Un seul bouton, jamais trois lignes.** Et il ne s'arme qu'une fois
          l'équipe choisie : poser, c'est dire à la fois quand et qui. */}
      {choix && aPoser && (
        <button
          type="button"
          onClick={onPoser}
          disabled={enCours}
          data-atlas="poser"
          className="mt-[22px] flex w-full items-center justify-center gap-3 rounded-full px-[22px] py-4 disabled:opacity-50"
          style={{
            backgroundColor: colors.rust,
            color: colors.cream,
            fontFamily: font.display,
            fontSize: 16,
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          {enCours
            ? "On pose…"
            : `Poser · ${LIBELLE_MOMENT[choix.moment]}${nomChoisie ? ` · ${nomChoisie}` : ""}`}
          <span style={{ color: colors.or }}>→</span>
        </button>
      )}

      {/* **Cette phrase n'existe qu'à partir de DEUX équipes.** Seul, il n'y a
          personne à changer, et l'écran promettrait un geste qui n'existe pas —
          en écrivant précisément le mot que le patron a interdit dans ce cas. */}
      {nombreEquipes > 1 && (
        <p className="mt-3.5 text-center text-[11.5px]" style={{ color: colors.muted }}>
          Touchez un chantier posé pour changer son équipe.
        </p>
      )}
    </>
  );
}

/** « lundi 14 septembre, 9 h – 11 h » — pour SON écran, jamais pour le client. */
function libelleRendezVous(r: RendezVousExterne): string {
  const debut = new Date(r.debut);
  const fin = new Date(r.fin);
  const jour = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const heure = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const memeJour = jour(debut) === jour(fin);
  if (r.journeeEntiere) return memeJour ? jour(debut) : `du ${jour(debut)} au ${jour(fin)}`;
  if (memeJour) return `${jour(debut)}, ${heure(debut)}`;
  return `du ${jour(debut)} au ${jour(fin)}`;
}
