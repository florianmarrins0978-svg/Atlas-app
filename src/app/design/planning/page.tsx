"use client";

import { useState } from "react";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import BottomSheet from "@/components/atlas/BottomSheet";

// Maquette isolée — n'affecte aucune route existante.
// Données simulées localement pour démontrer le passage "à planifier" → "planifié".

type ChantierDemo = {
  id: string;
  nom: string;
  client: string;
  date: string | null; // ISO, null = pas encore planifié
};

const CHANTIERS_DEMO: ChantierDemo[] = [
  { id: "3", nom: "Reprise de toiture", client: "M. Faucher", date: null },
  { id: "5", nom: "Extension garage", client: "Mme Renard", date: null },
];

function formatDateFr(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

export default function PlanningMockup() {
  const [chantiers, setChantiers] = useState(CHANTIERS_DEMO);
  const [ouvert, setOuvert] = useState<ChantierDemo | null>(null);
  const [dateChoisie, setDateChoisie] = useState("");

  const aPlanifier = chantiers.filter((c) => !c.date);
  const planifies = [...chantiers.filter((c) => c.date)].sort((a, b) => (a.date! < b.date! ? -1 : 1));

  function ouvrirSheet(c: ChantierDemo) {
    setDateChoisie(c.date ?? "");
    setOuvert(c);
  }

  function confirmer() {
    if (!ouvert || !dateChoisie) return;
    setChantiers((cur) => cur.map((c) => (c.id === ouvert.id ? { ...c, date: dateChoisie } : c)));
    setOuvert(null);
  }

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100dvh" }}>
      <div className="mx-auto max-w-md pb-16">
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
                  <span>
                    <span className="block text-[16px]" style={{ fontFamily: font.display, color: colors.ink }}>
                      {c.nom}
                    </span>
                    <span className="block text-[13px]" style={{ color: colors.muted }}>
                      {c.client}
                    </span>
                  </span>
                  <span className="text-[14px] font-medium" style={{ color: colors.rust }}>
                    Choisir une date
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

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
                      {new Date(c.date! + "T00:00:00").toLocaleDateString("fr-FR", { month: "short" })}
                    </span>
                    <span className="text-[15px] font-bold" style={{ color: colors.rust }}>
                      {new Date(c.date! + "T00:00:00").getDate()}
                    </span>
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px]" style={{ fontFamily: font.display, color: colors.ink }}>
                      {c.nom}
                    </span>
                    <span className="block text-[13px]" style={{ color: colors.muted }}>
                      {c.client}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Choix de date — sélecteur natif, confirmation d'action positive */}
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
            disabled={!dateChoisie}
            className="rounded-2xl py-3.5 text-[16px] font-medium text-white disabled:opacity-40"
            style={{ backgroundColor: colors.rust }}
          >
            Confirmer la planification
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
