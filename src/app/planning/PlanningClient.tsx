"use client";

import { useState } from "react";
import { getPlanificationEtat, trierParDatePlanifiee } from "@/lib/chantier-etat";
import { jourIso } from "@/lib/jour";
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

export default function PlanningClient({ initialChantiers }: { initialChantiers: ChantierPlanning[] }) {
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
  // **Le planning ne montre que ce qui est à venir.** Un chantier dont la date
  // est passée a eu lieu : il encombrerait ici ce qui reste à faire, et le
  // patron le retrouve dans « Terminés », d'où il le clôture (règle unique,
  // `src/lib/onglet-chantier.ts`).
  const planifies = trierParDatePlanifiee(
    visibles.filter(
      (c) => getPlanificationEtat(c) === "planifie" && !(c.datePlanifiee && c.datePlanifiee < aujourdHui)
    )
  );
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
        <div className="px-6 pt-9">
          <h1 className="text-[36px] leading-none" style={{ fontFamily: font.display }}>
            Planning
          </h1>
        </div>

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
                <button
                  key={c.id}
                  onClick={() => ouvrirSheet(c)}
                  className="flex items-center justify-between rounded-2xl px-5 py-4 text-left"
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
                <div
                  key={c.id}
                  className="rounded-2xl px-5 py-4"
                  style={{ backgroundColor: colors.card }}
                >
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
                <button
                  onClick={() => ouvrirSheet(c)}
                  className="flex w-full items-center gap-3 rounded-2xl px-5 py-4 text-left"
                  style={{ backgroundColor: colors.card }}
                >
                  <div
                    className="flex h-11 w-11 flex-shrink-0 flex-col items-center justify-center rounded-xl"
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
                  </span>
                </button>
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
          className="mb-5 w-full rounded-2xl border-0 px-4 py-3.5 outline-none"
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
            className="rounded-2xl py-3.5 text-[16px] font-medium text-white disabled:opacity-40"
            style={{ backgroundColor: colors.rust }}
          >
            {enCours ? "Enregistrement…" : "Confirmer la planification"}
          </button>
          <button
            onClick={() => setOuvert(null)}
            className="rounded-2xl py-3.5 text-[15px] font-medium"
            style={{ color: colors.muted }}
          >
            Annuler
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
