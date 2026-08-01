"use client";

import { useState } from "react";
import { getPlanificationEtat, trierParDatePlanifiee } from "@/lib/chantier-etat";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import BottomSheet from "@/components/atlas/BottomSheet";
import { planifierChantierAction } from "./actions";

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
  envoiEnvoyeAt: Date | string | null;
  envoiExpireAt: Date | string | null;
  envoiReponse: "acceptee" | "refusee" | null;
};

function formatDateFr(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default function PlanningClient({ initialChantiers }: { initialChantiers: ChantierPlanning[] }) {
  const [chantiers, setChantiers] = useState<ChantierPlanning[]>(initialChantiers);
  const [ouvert, setOuvert] = useState<ChantierPlanning | null>(null);
  const [dateChoisie, setDateChoisie] = useState("");
  const [enCours, setEnCours] = useState(false);

  const aPlanifier = chantiers.filter((c) => getPlanificationEtat(c) === "a_planifier");
  const planifies = trierParDatePlanifiee(chantiers.filter((c) => getPlanificationEtat(c) === "planifie"));
  const attenteClient = chantiers.filter((c) => getPlanificationEtat(c) === "attente_client");

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
                <button
                  key={c.id}
                  onClick={() => ouvrirSheet(c)}
                  className="flex items-center gap-3 rounded-2xl px-5 py-4 text-left"
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
                    </span>
                  </span>
                </button>
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
