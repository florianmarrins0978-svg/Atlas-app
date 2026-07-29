"use client";

import { useEffect, useRef, useState } from "react";
import { colors, font } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { enregistrerNoteVocaleAction, lancerTranscriptionAction } from "./actions";

type Etat = "vide" | "enregistrement" | "note" | "confirmation";

type StatutTranscription = "non_demandee" | "en_cours" | "reussie" | "echouee";

type NoteInitiale = {
  storageKey: string;
  dureeSecondes: number | null;
  transcriptionStatut: StatutTranscription;
  transcriptionErreur: string | null;
} | null;

export default function NoteVocaleClient({
  chantierId,
  noteInitiale,
}: {
  chantierId: string;
  noteInitiale: NoteInitiale;
}) {
  const [etat, setEtat] = useState<Etat>(noteInitiale ? "note" : "vide");
  const [secondes, setSecondes] = useState(0);
  const [storageKey, setStorageKey] = useState<string | null>(noteInitiale?.storageKey ?? null);
  const [dureeNote, setDureeNote] = useState(noteInitiale?.dureeSecondes ?? 0);
  const [lecture, setLecture] = useState(false);
  const [progression, setProgression] = useState(0);
  const [fraichementEnregistree, setFraichementEnregistree] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [statutTranscription, setStatutTranscription] = useState<StatutTranscription>(
    noteInitiale?.transcriptionStatut ?? "non_demandee"
  );
  const [erreurTranscription, setErreurTranscription] = useState<string | null>(
    noteInitiale?.transcriptionErreur ?? null
  );

  const audioRef = useRef<HTMLAudioElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (etat !== "enregistrement") return;
    const t = setInterval(() => setSecondes((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [etat]);

  async function demarrer() {
    setErreur(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      recorderRef.current = recorder;
      setSecondes(0);
      setEtat("enregistrement");
    } catch {
      setErreur("Impossible d'accéder au micro. Vérifiez les autorisations.");
    }
  }

  async function arreter() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    const dureeFinale = secondes;

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }));
      recorder.stop();
    });
    streamRef.current?.getTracks().forEach((t) => t.stop());

    setEnCours(true);
    try {
      const fd = new FormData();
      const extension = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : "webm";
      fd.set("fichier", blob, `note.${extension}`);
      fd.set("dureeSecondes", String(dureeFinale));
      const note = await enregistrerNoteVocaleAction(chantierId, fd);
      setStorageKey(note.storageKey);
      setDureeNote(note.dureeSecondes ?? dureeFinale);
      setLecture(false);
      setProgression(0);
      setFraichementEnregistree(true);
      setStatutTranscription("non_demandee");
      setErreurTranscription(null);
      setEtat("note");
    } catch {
      setErreur("Impossible d'enregistrer la note pour l'instant. Réessayez.");
      setEtat("vide");
    } finally {
      setEnCours(false);
    }
  }

  function confirmerRemplacement() {
    // Ne touche pas encore au fichier existant : le remplacement réel (et la
    // purge sécurisée de l'ancien) n'a lieu qu'à la fin du nouvel enregistrement.
    setEtat("vide");
    setFraichementEnregistree(false);
  }

  async function lancerTranscription() {
    setStatutTranscription("en_cours");
    setErreurTranscription(null);
    try {
      const note = await lancerTranscriptionAction(chantierId);
      setStatutTranscription(note.transcriptionStatut as StatutTranscription);
      setErreurTranscription(note.transcriptionErreur ?? null);
    } catch {
      setStatutTranscription("echouee");
      setErreurTranscription("Impossible de lancer la transcription pour l'instant.");
    }
  }

  function togglerLecture() {
    const audio = audioRef.current;
    if (!audio) return;
    if (lecture) {
      audio.pause();
      setLecture(false);
    } else {
      audio.play();
      setLecture(true);
    }
  }

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="px-6 pt-7">
      {etat === "vide" && (
        <>
          <PrimaryButton onClick={demarrer} disabled={enCours}>
            <MicIcon /> Enregistrer une note vocale
          </PrimaryButton>
          <p className="mt-4 text-center text-[14px]" style={{ color: erreur ? colors.alert : colors.muted }}>
            {erreur ?? "Décrivez les prestations, la durée, l'équipe et le matériel nécessaire."}
          </p>
        </>
      )}

      {etat === "enregistrement" && (
        <>
          <PrimaryButton onClick={arreter}>
            <StopIcon /> Arrêter l&apos;enregistrement
          </PrimaryButton>
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: colors.rust }} />
            <span className="text-[14px]" style={{ color: colors.muted }}>
              Enregistrement en cours — {mmss(secondes)}
            </span>
          </div>
          <p className="mt-2 text-center text-[13px]" style={{ color: colors.muted }}>
            Parlez naturellement. Vous pourrez modifier les informations ensuite.
          </p>
        </>
      )}

      {(etat === "note" || etat === "confirmation") && storageKey && (
        <>
          <audio
            ref={audioRef}
            src={`/api/fichiers/${storageKey}`}
            onTimeUpdate={(e) => {
              const a = e.currentTarget;
              if (a.duration) setProgression((a.currentTime / a.duration) * 100);
            }}
            onEnded={() => {
              setLecture(false);
              setProgression(0);
            }}
            hidden
          />
          <div className="flex items-center gap-4 rounded-2xl px-5 py-5" style={{ backgroundColor: colors.card }}>
            <button
              onClick={togglerLecture}
              aria-label={lecture ? "Mettre en pause" : "Écouter la note"}
              className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: colors.rust }}
            >
              {lecture ? <PauseIcon /> : <PlayIcon />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium" style={{ color: colors.ink }}>
                {fraichementEnregistree ? "Enregistrée à l'instant" : "Note enregistrée"}
              </p>
              <p className="mt-0.5 text-[13px]" style={{ color: colors.muted }}>
                {mmss(dureeNote)}
              </p>
              <div className="mt-2 h-1 w-full rounded-full" style={{ backgroundColor: colors.line }}>
                <div
                  className="h-1 rounded-full"
                  style={{ width: `${progression}%`, backgroundColor: colors.rust }}
                />
              </div>
            </div>
          </div>

          <div className="mt-4">
            {statutTranscription === "non_demandee" && (
              <button
                onClick={lancerTranscription}
                className="block w-full text-center text-[14px] font-medium"
                style={{ color: colors.rust }}
              >
                Lancer la transcription
              </button>
            )}
            {statutTranscription === "en_cours" && (
              <p className="text-center text-[14px]" style={{ color: colors.muted }}>
                Transcription en cours…
              </p>
            )}
            {statutTranscription === "reussie" && (
              <p className="text-center text-[13px]" style={{ color: colors.muted }}>
                Transcription disponible —{" "}
                <a href={`/chantiers/${chantierId}/transcription`} className="font-medium" style={{ color: colors.rust }}>
                  voir le texte
                </a>
              </p>
            )}
            {statutTranscription === "echouee" && (
              <div className="text-center">
                <p className="text-[13px]" style={{ color: colors.alert }}>
                  {erreurTranscription ?? "La transcription a échoué."}
                </p>
                <button
                  onClick={lancerTranscription}
                  className="mt-1 text-[14px] font-medium"
                  style={{ color: colors.rust }}
                >
                  Réessayer
                </button>
              </div>
            )}
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
