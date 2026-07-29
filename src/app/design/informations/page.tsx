"use client";

import { useState } from "react";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";

// Maquette isolée — n'affecte aucune route existante.
// Extraction entièrement simulée (données fixes), conformément à la demande :
// expérience d'abord, IA réelle ensuite.

export default function InformationsMockup() {
  const [prestations, setPrestations] = useState([
    "Dépose ancien carrelage",
    "Pose faïence murale",
    "Remplacement robinetterie",
  ]);
  const [duree, setDuree] = useState("2 jours");
  const [equipe, setEquipe] = useState("2 hommes");
  const [materiel, setMateriel] = useState([
    "Carrelage 60x60 (fourni client)",
    "Colle flex",
    "Joint gris anthracite",
  ]);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100dvh" }}>
      <div className="mx-auto max-w-md pb-16">
        <div className="flex items-center justify-between px-6 pt-8">
          <a
            href="/design/hub"
            aria-label="Retour"
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.rustTint }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.rust} strokeWidth="2.4">
              <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
          <a href="/design/transcription" className="text-[14px] font-medium" style={{ color: colors.rust }}>
            Voir la transcription
          </a>
        </div>

        <div className="px-6 pt-5">
          <p className={smallCaps} style={{ color: colors.rust, marginBottom: 8 }}>
            Rénovation salle de bain
          </p>
          <h1 className="text-[32px] leading-tight" style={{ fontFamily: font.display }}>
            Informations
          </h1>
        </div>

        <div className="mx-6 mt-5 rounded-2xl px-4 py-3" style={{ backgroundColor: colors.rustTint }}>
          <p className="text-[13px]" style={{ color: colors.rust }}>
            Proposé à partir de la dictée — à vérifier avant de continuer.
          </p>
        </div>

        <div className="mt-7 flex flex-col gap-7 px-6">
          <EditableList
            label="Prestations"
            items={prestations}
            onChange={setPrestations}
            emptyMessage="Aucune prestation pour l'instant."
          />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Durée" value={duree} onChange={setDuree} />
            <Field label="Équipe" value={equipe} onChange={setEquipe} />
          </div>

          <EditableList
            label="Matériel"
            items={materiel}
            onChange={setMateriel}
            emptyMessage="Aucun matériel pour l'instant."
          />

          <PrimaryButton>Valider et calculer le prix →</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={smallCaps} style={{ color: colors.muted }}>
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-2xl border-0 px-4 py-3 outline-none"
        style={{ backgroundColor: colors.card, color: colors.ink, fontSize: "16px" }}
      />
    </label>
  );
}

function EditableList({
  label,
  items,
  onChange,
  emptyMessage,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  emptyMessage: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className={smallCaps} style={{ color: colors.muted }}>
        {label}
      </span>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={item}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
            className="flex-1 rounded-2xl border-0 px-4 py-3 outline-none"
            style={{ backgroundColor: colors.card, color: colors.ink, fontSize: "16px" }}
          />
          <button
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            aria-label="Retirer cette ligne"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
            style={{ color: colors.muted }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...items, ""])}
        className="self-start text-[14px] font-medium"
        style={{ color: colors.rust }}
      >
        + Ajouter{" "}
        {label === "Prestations" ? "une prestation" : "un matériel"}
      </button>
      {items.length === 0 && (
        <p className="text-[13px]" style={{ color: colors.muted }}>
          {emptyMessage}
        </p>
      )}
    </div>
  );
}
