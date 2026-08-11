"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Le magnétophone — écrit UNE fois, pour les deux endroits qui enregistrent.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Pourquoi ce fichier existe.** Le 11 août 2026, le patron a demandé que
 * l'anneau de la note vocale soit au centre de la fiche **dès l'arrivée**,
 * qu'on ait touché quoi que ce soit ou non — et qu'un appui suffise à dicter :
 *
 *   *« l'anneau qui est en plein milieu et dès qu'on arrive sur la page, il y
 *   est en fait, qu'on ait cliqué dessus ou non. C'est ça que je veux. »*
 *
 * L'écran de dictée savait déjà capter le son. Recopier ces trente lignes dans
 * l'anneau, c'était s'assurer qu'un jour l'un corrige un défaut que l'autre
 * garde — ce que `CLAUDE.md` §3 interdit. Le magnétophone vit donc ici, et les
 * deux écrans l'appellent.
 *
 * **Ce qu'il fait, et rien de plus** : il capte, il compte, il rend un `Blob`.
 * Ce qu'on en fait ensuite — l'envoyer, changer d'écran, rafraîchir — regarde
 * l'appelant. Un module qui déciderait aussi de la suite ne servirait qu'un
 * seul des deux.
 */
export function useMagnetophone() {
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const morceauxRef = useRef<Blob[]>([]);
  const [enregistre, setEnregistre] = useState(false);
  const [secondes, setSecondes] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!enregistre) return;
    const t = setInterval(() => setSecondes((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [enregistre]);

  /**
   * **Le micro se relâche même si l'écran disparaît.** Sans cela, le voyant
   * d'enregistrement du téléphone reste allumé après qu'on a quitté la fiche —
   * une application qui écoute encore alors qu'on croit l'avoir quittée.
   */
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((piste) => piste.stop());
    };
  }, []);

  const demarrer = useCallback(async () => {
    setErreur(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      morceauxRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) morceauxRef.current.push(e.data);
      };
      recorder.start();
      recorderRef.current = recorder;
      setSecondes(0);
      setEnregistre(true);
      return true;
    } catch {
      setErreur("Impossible d'accéder au micro. Vérifiez les autorisations.");
      return false;
    }
  }, []);

  /** Arrête et rend le son capté, ou `null` si rien ne tournait. */
  const arreter = useCallback(async (): Promise<{ blob: Blob; secondes: number } | null> => {
    const recorder = recorderRef.current;
    if (!recorder) return null;
    const dureeFinale = secondes;

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () =>
        resolve(new Blob(morceauxRef.current, { type: recorder.mimeType || "audio/webm" }));
      recorder.stop();
    });
    streamRef.current?.getTracks().forEach((piste) => piste.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setEnregistre(false);
    return { blob, secondes: dureeFinale };
  }, [secondes]);

  return { enregistre, secondes, erreur, setErreur, demarrer, arreter };
}

/**
 * Emballe le son capté pour l'action serveur.
 *
 * **L'extension suit le type réel, jamais une supposition.** Safari rend du
 * `mp4`, Firefox de l'`ogg`, Chrome du `webm` : un nom figé ferait refuser le
 * fichier par le contrôle de format, sur un son parfaitement valable.
 *
 * **`dureeSecondes` vaut `null` pour un complément**, et c'est voulu : celui-ci
 * s'ajoute à la TRANSCRIPTION, jamais au fichier audio
 * (`complement-note-service.ts`). La note garde donc l'enregistrement — et la
 * durée — de sa première dictée. Envoyer une durée ici laisserait croire que le
 * champ compte, alors que rien ne le lit.
 */
export function formulaireDeNote(blob: Blob, dureeSecondes: number | null, nom = "note"): FormData {
  const extension = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : "webm";
  const fd = new FormData();
  fd.set("fichier", blob, `${nom}.${extension}`);
  if (dureeSecondes !== null) fd.set("dureeSecondes", String(dureeSecondes));
  return fd;
}
