"use client";

import { useEffect, useState } from "react";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";

// Maquette isolée — n'affecte aucune route existante.
// L'enregistrement et la lecture sont entièrement simulés (aucun accès micro réel
// à ce stade, conformément à la demande : interface d'abord, dictée réelle ensuite).

type Etat = "vide" | "enregistrement" | "note" | "confirmation";

export default function NoteVocaleMockup() {
  const [etat, setEtat] = useState<Etat>("vide");
  const [secondes, setSecondes] = useState(0);
  const [dureeNote, setDureeNote] = useState(0);
  const [lecture, setLecture] = useState(false);

  useEffect(() => {
    if (etat !== "enregistrement") return;
    const t = setInterval(() => setSecondes((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [etat]);

  function demarrer() {
    setSecondes(0);
    setEtat("enregistrement");
  }
  function arreter() {
    setDureeNote(secondes);
    setLecture(false);
    setEtat("note");
  }
  function confirmerRemplacement() {
    setEtat("vide");
    setDureeNote(0);
  }

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100dvh" }}>
      <div className="mx-auto max-w-md pb-16">
        <div className="px-6 pt-8">
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
        </div>

        <div className="px-6 pt-5">
          <p className={smallCaps} style={{ color: colors.rust, marginBottom: 8 }}>
            Rénovation salle de bain
          </p>
          <h1 className="text-[32px] leading-tight" style={{ fontFamily: font.display }}>
            Note vocale
          </h1>
        </div>

        <div className="px-6 pt-7">
          {etat === "vide" && (
            <>
              <PrimaryButton onClick={demarrer}>
                <MicIcon /> Enregistrer une note vocale
              </PrimaryButton>
              <p className="mt-4 text-center text-[14px]" style={{ color: colors.muted }}>
                Décrivez les prestations, la durée, l&apos;équipe et le matériel nécessaire.
              </p>
            </>
          )}

          {etat === "enregistrement" && (
            <>
              <PrimaryButton onClick={arreter}>
                <StopIcon /> Arrêter l&apos;enregistrement
              </PrimaryButton>
              <div className="mt-4 flex items-center justify-center gap-2">
                <span
                  className="h-2 w-2 animate-pulse rounded-full"
                  style={{ backgroundColor: colors.rust }}
                />
                <span className="text-[14px]" style={{ color: colors.muted }}>
                  Enregistrement en cours — {mmss(secondes)}
                </span>
              </div>
            </>
          )}

          {(etat === "note" || etat === "confirmation") && (
            <>
              <div className="flex items-center gap-4 rounded-2xl px-5 py-5" style={{ backgroundColor: colors.card }}>
                <button
                  onClick={() => setLecture((l) => !l)}
                  aria-label={lecture ? "Mettre en pause" : "Écouter la note"}
                  className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: colors.rust }}
                >
                  {lecture ? <PauseIcon /> : <PlayIcon />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium" style={{ color: colors.ink }}>
                    Note enregistrée
                  </p>
                  <p className="mt-0.5 text-[13px]" style={{ color: colors.muted }}>
                    {mmss(dureeNote || 134)}
                  </p>
                  <div className="mt-2 h-1 w-full rounded-full" style={{ backgroundColor: colors.line }}>
                    <div className="h-1 rounded-full" style={{ width: lecture ? "38%" : "0%", backgroundColor: colors.rust }} />
                  </div>
                </div>
              </div>

              <button
                onClick={() => setEtat("confirmation")}
                className="mt-4 block w-full text-center text-[14px] font-medium"
                style={{ color: colors.rust }}
              >
                Remplacer la note
              </button>
            </>
          )}
        </div>
      </div>

      {/* Confirmation de remplacement — même patron que la suppression de photo */}
      {etat === "confirmation" && (
        <div className="fixed inset-0 z-40 flex items-end" style={{ backgroundColor: "rgba(0,0,0,0.35)" }}>
          <div className="w-full rounded-t-[26px] px-6 pb-9 pt-3" style={{ backgroundColor: colors.cream }}>
            <div className="mx-auto mb-5 h-1 w-10 rounded-full" style={{ backgroundColor: colors.line }} />
            <p className="mb-1 text-center text-[16px]" style={{ color: colors.ink, fontFamily: font.display }}>
              Remplacer cette note vocale ?
            </p>
            <p className="mb-5 text-center text-[13px]" style={{ color: colors.muted }}>
              La note actuelle sera définitivement supprimée.
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => setEtat("note")}
                className="rounded-2xl py-3.5 text-[16px] font-medium"
                style={{ backgroundColor: colors.card, color: colors.ink }}
              >
                Annuler
              </button>
              <button
                onClick={confirmerRemplacement}
                className="rounded-2xl py-3.5 text-[15px] font-medium"
                style={{ color: colors.alert }}
              >
                Remplacer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" strokeLinecap="round" />
      <path d="M12 18v3" strokeLinecap="round" />
    </svg>
  );
}
function StopIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}
