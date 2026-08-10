"use client";

import { useState } from "react";
import Link from "next/link";
import { getPlanificationEtat, trierParDatePlanifiee } from "@/lib/chantier-etat";
import { estAuPlanning } from "@/lib/onglet-chantier";
import { jourIso } from "@/lib/jour";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import BottomSheet from "@/components/atlas/BottomSheet";
import { LIBELLE_MOMENT, libelleDuree } from "@/server/disponibilites";
import CarteGlissante from "@/components/atlas/CarteGlissante";
import { planifierChantierAction, supprimerChantierAction } from "./actions";

// Intégration réelle — connectée à la base (docs/ARCHITECTURE_DONNEES.md).
// Cet écran ne connaît toujours aucune règle métier : il affiche uniquement le
// résultat de getPlanificationEtat() (src/lib/chantier-etat.ts).
//
// La suppression d'une planification (deplanifierChantierAction) existe côté
// repository/action et est testée, mais n'est reliée à aucun contrôle visuel
// ici : la maquette validée ne prévoit pas de bouton dédié pour cela.

type ChantierPlanning = {
  id: string;
  nom: string;
  clientNom: string | null;
  devisEnvoyeAt: Date | string | null;
  datePlanifiee: string | null;
  creneauDebut: string | null;
  dureeDemiJournees: number | null;
  envoiEnvoyeAt: Date | string | null;
  envoiExpireAt: Date | string | null;
  envoiReponse: "acceptee" | "refusee" | null;
  /** Les jalons de fin : c'est ce qui sort un chantier du planning. */
  termineAt: Date | string | null;
  factureEnvoyeeAt: Date | string | null;
};

function formatDateFr(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/**
 * « après-midi », « matin — 2 jours »… — pour le patron, jamais pour le client.
 *
 * Muet quand le chantier n'a pas de créneau : ce sont ceux planifiés avant la
 * migration 0019, et écrire « matin » sur eux serait affirmer une chose que
 * personne n'a décidée.
 */
function creneauLisible(c: { creneauDebut: string | null; dureeDemiJournees: number | null }): string | null {
  if (c.creneauDebut !== "matin" && c.creneauDebut !== "apres_midi") return null;
  const moment = LIBELLE_MOMENT[c.creneauDebut];
  if (!c.dureeDemiJournees || c.dureeDemiJournees === 2) return moment;
  if (c.dureeDemiJournees === 1) return moment;
  return `${moment}, ${libelleDuree(c.dureeDemiJournees)}`;
}

/** Ce que l'agenda extérieur apporte à cet écran. Jamais un jeton, jamais un compte. */
export type EtatAgendaPlanning = {
  configure: boolean;
  relie: boolean;
  actif: boolean;
  enPanne: boolean;
};

/** Un rendez-vous lu dans son agenda — pour SON écran, jamais pour le client. */
export type RendezVousExterne = {
  debut: string;
  fin: string;
  intitule: string | null;
  journeeEntiere: boolean;
};

/**
 * « lundi 14 septembre, 9 h – 11 h », ou « du 14 au 17 septembre » sur plusieurs
 * jours.
 *
 * Les heures ne s'affichent PAS pour un événement « toute la journée » : Google
 * rend alors des dates civiles, et en tirer « 00 h – 23 h » afficherait une
 * précision que l'agenda ne donne pas.
 */
function libelleRendezVous(r: RendezVousExterne): string {
  const debut = new Date(r.debut);
  const fin = new Date(r.fin);
  const jour = (d: Date) =>
    d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const heure = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  const memeJour = jour(debut) === jour(fin);
  if (r.journeeEntiere) return memeJour ? jour(debut) : `du ${jour(debut)} au ${jour(fin)}`;
  if (memeJour) return `${jour(debut)}, ${heure(debut)} – ${heure(fin)}`;
  return `du ${jour(debut)} ${heure(debut)} au ${jour(fin)} ${heure(fin)}`;
}

export default function PlanningClient({
  initialChantiers,
  agenda = { configure: false, relie: false, actif: false, enPanne: false },
  rendezVous = [],
}: {
  initialChantiers: ChantierPlanning[];
  agenda?: EtatAgendaPlanning;
  rendezVous?: RendezVousExterne[];
}) {
  const [chantiers, setChantiers] = useState<ChantierPlanning[]>(initialChantiers);
  const [ouvert, setOuvert] = useState<ChantierPlanning | null>(null);
  const [dateChoisie, setDateChoisie] = useState("");
  const [enCours, setEnCours] = useState(false);

  const aujourdHui = jourIso(new Date());
  const [supprimes, setSupprimes] = useState<string[]>([]);
  const [erreurSuppression, setErreurSuppression] = useState<string | null>(null);

  /**
   * Le chantier disparaît de l'écran AVANT la réponse du serveur : sur un
   * téléphone, une carte qui reste une seconde après l'appui se lit comme un
   * bouton qui n'a pas marché, et l'on appuie une seconde fois. En cas de
   * refus — une facture émise —, elle revient, et la raison s'affiche.
   */
  async function supprimer(id: string) {
    setErreurSuppression(null);
    setSupprimes((s) => [...s, id]);
    const r = await supprimerChantierAction(id);
    if (!r.succes) {
      setSupprimes((s) => s.filter((x) => x !== id));
      setErreurSuppression(r.erreur);
    }
  }
  const visibles = chantiers.filter((c) => !supprimes.includes(c.id));
  const aPlanifier = visibles.filter((c) => getPlanificationEtat(c) === "a_planifier");
  // **Le planning ne montre que ce qui est à venir**, et c'est la règle
  // partagée qui le dit — plus une recopie locale. Cet écran comparait
  // `datePlanifiee < aujourd'hui` de son côté quand le dépôt des terminés
  // comparait `<=` du sien : un chantier prévu AUJOURD'HUI figurait dans les
  // deux onglets, et un chantier clôturé avant sa date restait ici comme si
  // rien ne s'était passé (`src/lib/onglet-chantier.ts`).
  const planifies = trierParDatePlanifiee(visibles.filter((c) => estAuPlanning(c, aujourdHui)));
  const attenteClient = visibles.filter((c) => getPlanificationEtat(c) === "attente_client");

  function ouvrirSheet(c: ChantierPlanning) {
    setDateChoisie(c.datePlanifiee ?? "");
    setOuvert(c);
  }

  async function confirmer() {
    if (!ouvert || !dateChoisie) return;
    setEnCours(true);
    try {
      await planifierChantierAction(ouvert.id, dateChoisie);
      setChantiers((cur) => cur.map((c) => (c.id === ouvert.id ? { ...c, datePlanifiee: dateChoisie } : c)));
      setOuvert(null);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-16">
        <EnTeteEcran surtitre="Vos journées" titre="Planning" />

        {/*
          **Le raccordement de l'agenda se propose ICI, et c'est sa demande du
          9 août 2026** : *« dans planning il faut un petit bouton connecter son
          agenda Google cliquable. »*

          Il est à sa place : le planning est l'écran où le manque se constate.
          Le laisser au fond des réglages, c'était demander à quelqu'un qui
          ignore le problème d'aller chercher sa solution.

          **Le lien disparaît quand tout va bien.** Un bandeau permanent sur
          l'écran le plus consulté devient du décor : on cesse de le lire, et le
          jour où il annonce une panne, personne ne le voit.
        */}
        {(!agenda.relie || !agenda.actif || agenda.enPanne) && (
          <div className="mt-5 px-6">
            <Link
              href="/reglages/agenda"
              className="flex items-center justify-between rounded-[4px] px-5 py-4"
              style={{
                backgroundColor: colors.rustTint,
                borderLeft: `3px solid ${agenda.enPanne ? colors.alert : colors.sage}`,
              }}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15px]" style={{ fontFamily: font.display }}>
                  {agenda.enPanne
                    ? "Votre agenda n'est plus lu"
                    : !agenda.relie
                      ? "Relier mon agenda Google"
                      : "Votre agenda est en pause"}
                </span>
                <span className="block text-[13px] leading-snug" style={{ color: colors.muted }}>
                  {agenda.enPanne
                    ? "Un client peut retenir un jour où vous êtes déjà pris."
                    : !agenda.relie
                      ? "Sans lui, Atlas ne voit pas les rendez-vous notés ailleurs — et peut les proposer."
                      : "Reprendre la lecture pour éviter les doublons."}
                </span>
              </span>
              <span
                className="ml-4 flex-shrink-0 whitespace-nowrap text-[14px] font-medium"
                style={{ color: colors.rust }}
              >
                {agenda.configure ? "Ouvrir" : "Connecter"}
              </span>
            </Link>
          </div>
        )}

        {/* Ses rendez-vous, avec leur intitulé — sa demande du 9 août : « si, il
            doit lire les intitulés aussi ! ». Ils ne se modifient pas depuis
            Atlas : ce sont ceux de son agenda, et deux endroits pour changer la
            même chose finissent par se contredire. */}
        {rendezVous.length > 0 && (
          <div className="mt-7 px-6">
            <p className={smallCaps} style={{ color: colors.rust, marginBottom: 10 }}>
              Dans mon agenda
            </p>
            <div className="flex flex-col gap-2">
              {rendezVous.slice(0, 12).map((r, i) => (
                <div
                  key={`${r.debut}-${i}`}
                  className="rounded-[4px] px-5 py-4"
                  style={{ backgroundColor: colors.card }}
                >
                  <span className="block truncate text-[16px]" style={{ fontFamily: font.display }}>
                    {r.intitule ?? "Rendez-vous sans titre"}
                  </span>
                  <span className="block text-[13px]" style={{ color: colors.muted }}>
                    {libelleRendezVous(r)}
                  </span>
                </div>
              ))}
              {rendezVous.length > 12 && (
                <p className="px-1 text-[13px]" style={{ color: colors.muted }}>
                  et {rendezVous.length - 12} autre(s) — l&apos;écran en montre douze, votre agenda les a tous.
                </p>
              )}
            </div>
          </div>
        )}

        {/* À planifier */}
        <div className="mt-7 px-6">
          <p className={smallCaps} style={{ color: colors.rust, marginBottom: 10 }}>
            À planifier
          </p>
          {aPlanifier.length === 0 ? (
            <p className="text-[14px]" style={{ color: colors.muted }}>
              Aucun chantier en attente de planification.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {aPlanifier.map((c) => (
                <CarteGlissante
                  key={c.id}
                  libelleSuppression={`Supprimer le chantier ${c.nom}`}
                  onSupprimer={() => supprimer(c.id)}
                >
                <button
                  onClick={() => ouvrirSheet(c)}
                  className="flex w-full items-center justify-between rounded-[4px] px-5 py-4 text-left"
                  style={{ backgroundColor: colors.card }}
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-[16px]"
                      style={{ fontFamily: font.display, color: colors.ink }}
                    >
                      {c.nom}
                    </span>
                    <span className="block truncate text-[13px]" style={{ color: colors.muted }}>
                      {c.clientNom ?? "Client non renseigné"}
                    </span>
                  </span>
                  {/* Ne se coupe jamais en deux lignes : un nom de chantier un
                      peu long faisait passer l'action à la ligne, et l'action
                      est ce que le patron vient chercher. */}
                  <span
                    className="ml-4 flex-shrink-0 whitespace-nowrap text-[14px] font-medium"
                    style={{ color: colors.rust }}
                  >
                    Choisir une date
                  </span>
                </button>
                </CarteGlissante>
              ))}
            </div>
          )}
        </div>

        {/* En attente du client — ni planifiables ni oubliables.
            Ces chantiers ne sont pas proposés à la planification : leur date se
            décide chez le client. Les taire les ferait disparaître entre deux
            listes, alors que ce sont précisément ceux dont le patron se demande
            où ils en sont. */}
        {attenteClient.length > 0 && (
          <div className="mt-8 px-6">
            <p className={smallCaps} style={{ color: colors.muted, marginBottom: 10 }}>
              En attente du client
            </p>
            <div className="flex flex-col gap-2">
              {attenteClient.map((c) => (
                <CarteGlissante
                  key={c.id}
                  libelleSuppression={`Supprimer le chantier ${c.nom}`}
                  onSupprimer={() => supprimer(c.id)}
                >
                  <div className="rounded-[4px] px-5 py-4" style={{ backgroundColor: colors.card }}>
                    <span
                      className="block truncate text-[16px]"
                      style={{ fontFamily: font.display, color: colors.ink }}
                    >
                      {c.nom}
                    </span>
                    <span className="block truncate text-[13px]" style={{ color: colors.muted }}>
                      {c.clientNom ?? "Client non renseigné"} — il choisit sa date
                    </span>
                  </div>
                </CarteGlissante>
              ))}
            </div>
          </div>
        )}

        {erreurSuppression && (
          <p role="alert" className="mt-6 px-6 text-[13px]" style={{ color: colors.alert }}>
            {erreurSuppression}
          </p>
        )}

        {/* Planifiés */}
        <div className="mt-8 px-6">
          <p className={smallCaps} style={{ color: colors.muted, marginBottom: 10 }}>
            Planifiés
          </p>
          {planifies.length === 0 ? (
            <p className="text-[14px]" style={{ color: colors.muted }}>
              Aucun chantier planifié pour l&apos;instant.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {planifies.map((c) => (
                <CarteGlissante
                  key={c.id}
                  libelleSuppression={`Supprimer le chantier ${c.nom}`}
                  onSupprimer={() => supprimer(c.id)}
                >
                {/* **Le planning était un cul-de-sac.** Le patron, le 8 août
                    2026 : « le client m'a retourné la date validée, il se range
                    dans les chantiers planifiés, mais comment je fais pour
                    avoir accès au devis ? Je dois pouvoir cliquer directement
                    sur le client planifié, avoir un bouton à côté fin de
                    chantier. »

                    Toucher la carte n'ouvrait que le sélecteur de date. Le
                    devis, la fiche et la clôture existaient — hors d'atteinte
                    depuis l'écran où il se trouvait. La chaîne complète était
                    donc construite et injoignable, ce qui revient au même que
                    de ne pas l'avoir écrite.

                    Trois destinations, une seule mise en avant : la carte mène
                    au chantier, « Fin de chantier » à la facture, et la date se
                    change par un lien discret — c'est le geste le plus rare des
                    trois une fois le client d'accord. */}
                <div className="rounded-[4px] px-5 py-4" style={{ backgroundColor: colors.card }}>
                  <Link href={`/chantiers/${c.id}`} className="flex items-center gap-3 text-left">
                    <div
                      className="flex h-11 w-11 flex-shrink-0 flex-col items-center justify-center rounded-[4px]"
                      style={{ backgroundColor: colors.rustTint }}
                    >
                      <span className="text-[10px] font-semibold uppercase" style={{ color: colors.rust }}>
                        {new Date(c.datePlanifiee! + "T00:00:00").toLocaleDateString("fr-FR", { month: "short" })}
                      </span>
                      <span className="text-[15px] font-bold" style={{ color: colors.rust }}>
                        {new Date(c.datePlanifiee! + "T00:00:00").getDate()}
                      </span>
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px]" style={{ fontFamily: font.display, color: colors.ink }}>
                        {c.nom}
                      </span>
                      <span className="block text-[13px]" style={{ color: colors.muted }}>
                        {c.clientNom ?? "Client non renseigné"}
                        {creneauLisible(c) && ` — ${creneauLisible(c)}`}
                      </span>
                      {/* Sans ce mot, rien ne dit que la carte s'ouvre. Le
                          patron cherchait son devis sur un écran qui n'avait
                          l'air de mener nulle part. */}
                      <span className="mt-0.5 block text-[12px]" style={{ color: colors.rust }}>
                        Voir le devis et le chantier →
                      </span>
                    </span>
                  </Link>

                  <div
                    className="mt-3 flex items-center justify-between gap-3 pt-3"
                    style={{ borderTop: `1px solid ${colors.line}` }}
                  >
                    {/* Le nom du chantier dans le libellé accessible : à
                        l'écran la colonne le porte déjà, mais une personne qui
                        n'utilise pas ses yeux entendrait « Changer la date »
                        cinq fois de suite sans savoir laquelle. */}
                    <button
                      onClick={() => ouvrirSheet(c)}
                      aria-label={`Changer la date du chantier ${c.nom}`}
                      className="whitespace-nowrap text-[13px]"
                      style={{ color: colors.muted }}
                    >
                      Changer la date
                    </button>
                    {/* Aucune barrière de date, comme sur la fiche depuis le
                        3 août : c'est le patron qui sait quand un chantier est
                        fait, pas le calendrier. Le geste reste sans danger —
                        il bâtit la facture qu'il vérifiera, il n'émet rien. */}
                    <Link
                      href={`/chantiers/${c.id}/facture`}
                      aria-label={`Fin de chantier — ${c.nom}`}
                      className="whitespace-nowrap rounded-full px-4 py-2 text-[14px] font-medium"
                      style={{ backgroundColor: colors.rustTint, color: colors.rust }}
                    >
                      Fin de chantier →
                    </Link>
                  </div>
                </div>
                </CarteGlissante>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Choix de date — sélecteur natif, confirmation d'action positive (patron n°2) */}
      <BottomSheet open={ouvert !== null} onBackdropClick={() => setOuvert(null)}>
        <p className="mb-1 text-center text-[16px]" style={{ color: colors.ink, fontFamily: font.display }}>
          {ouvert?.nom}
        </p>
        <p className="mb-5 text-center text-[13px]" style={{ color: colors.muted }}>
          Choisissez une date pour ce chantier.
        </p>
        <input
          type="date"
          value={dateChoisie}
          onChange={(e) => setDateChoisie(e.target.value)}
          className="mb-5 w-full rounded-[4px] border-0 px-4 py-3.5 outline-none"
          style={{ backgroundColor: colors.card, color: colors.ink, fontSize: "16px" }}
        />
        {dateChoisie && (
          <p className="mb-4 text-center text-[13px]" style={{ color: colors.muted }}>
            {formatDateFr(dateChoisie)}
          </p>
        )}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={confirmer}
            disabled={!dateChoisie || enCours}
            className="rounded-[4px] py-3.5 text-[16px] font-medium text-white disabled:opacity-40"
            style={{ backgroundColor: colors.rust }}
          >
            {enCours ? "Enregistrement…" : "Confirmer la planification"}
          </button>
          <button
            onClick={() => setOuvert(null)}
            className="rounded-[4px] py-3.5 text-[15px] font-medium"
            style={{ color: colors.muted }}
          >
            Annuler
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
