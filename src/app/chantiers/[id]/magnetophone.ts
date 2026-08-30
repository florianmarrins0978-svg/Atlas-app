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
  const [suspendu, setSuspendu] = useState(false);
  const [secondes, setSecondes] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);

  // ─── Le volume réellement capté ─────────────────────────────────────────
  //
  // **Mesuré, jamais simulé.** La maquette faisait respirer son onde au hasard,
  // faute de micro ; ici le son existe. Une onde tirée au sort serait un décor,
  // et c'est exactement le reproche que le patron a déjà fait à un anneau qui
  // battait sans rien lire (`AnneauNoteVocale.tsx`).
  const analyseur = useRef<AnalyserNode | null>(null);
  const contexteRef = useRef<AudioContext | null>(null);
  // Le tampon est typé sur un `ArrayBuffer` NON partagé : depuis TypeScript 5.7,
  // `getByteTimeDomainData` refuse un `Uint8Array<ArrayBufferLike>`, qui pourrait
  // reposer sur un `SharedArrayBuffer`.
  const tamponRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  const brancherLEcoute = useCallback((stream: MediaStream) => {
    try {
      const Contexte =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Contexte) return;
      const contexte = new Contexte();
      const noeud = contexte.createAnalyser();
      noeud.fftSize = 256;
      // **On ne rebranche RIEN vers la sortie ici**, contrairement à la lecture :
      // renvoyer le micro vers les haut-parleurs ferait un larsen sur un
      // chantier. On écoute pour mesurer, pas pour entendre.
      contexte.createMediaStreamSource(stream).connect(noeud);
      analyseur.current = noeud;
      contexteRef.current = contexte;
      // `new Uint8Array(n)` rend un `Uint8Array<ArrayBufferLike>`, que la
      // signature de `getByteTimeDomainData` refuse depuis TypeScript 5.7 : elle
      // exige un tampon qui ne soit pas partagé. On le construit donc sur un
      // `ArrayBuffer` explicite.
      tamponRef.current = new Uint8Array(new ArrayBuffer(noeud.fftSize));
      void contexte.resume();
    } catch {
      analyseur.current = null;
      contexteRef.current = null;
    }
  }, []);

  const fermerLEcoute = useCallback(() => {
    void contexteRef.current?.close().catch(() => {});
    contexteRef.current = null;
    analyseur.current = null;
    tamponRef.current = null;
  }, []);

  /**
   * L'amplitude de l'instant, entre 0 et 1 — ou `null` si rien ne l'écoute.
   *
   * `null` et 0 ne disent PAS la même chose : le premier veut dire « on ne sait
   * pas », le second « c'est le silence ». Un appelant qui les confondrait
   * dessinerait une onde plate sur un navigateur sans Web Audio, au lieu de
   * garder un dessin vraisemblable.
   */
  const niveau = useCallback((): number | null => {
    const noeud = analyseur.current;
    const tampon = tamponRef.current;
    if (!noeud || !tampon) return null;
    noeud.getByteTimeDomainData(tampon);
    // L'écart quadratique moyen autour du zéro : c'est le volume perçu, et non
    // le pic, qui ferait sauter l'onde sur un simple claquement.
    let somme = 0;
    for (const v of tampon) {
      const ecart = (v - 128) / 128;
      somme += ecart * ecart;
    }
    return Math.min(1, Math.sqrt(somme / tampon.length) * 3.2);
  }, []);

  useEffect(() => {
    // **Le compteur s'arrête AUSSI en pause**, sinon il compterait un silence
    // que la note ne contient pas — et l'on croirait avoir dicté trois minutes
    // là où il y en a une.
    if (!enregistre || suspendu) return;
    const t = setInterval(() => setSecondes((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [enregistre, suspendu]);

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
      brancherLEcoute(stream);
      setSecondes(0);
      setSuspendu(false);
      setEnregistre(true);
      return true;
    } catch {
      setErreur("Impossible d'accéder au micro. Vérifiez les autorisations.");
      return false;
    }
  }, [brancherLEcoute]);

  /**
   * Suspend, ou reprend.
   *
   * **Ce n'est pas un arrêt.** `MediaRecorder.pause()` garde les morceaux déjà
   * captés et la session ouverte : la reprise poursuit LE MÊME fichier. Arrêter
   * puis redémarrer produirait deux enregistrements, et le second écraserait le
   * premier — le patron perdrait la moitié de ce qu'il a dit sans le savoir.
   */
  const basculerSuspension = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (recorder.state === "recording") {
      recorder.pause();
      setSuspendu(true);
    } else if (recorder.state === "paused") {
      recorder.resume();
      setSuspendu(false);
    }
  }, []);

  /**
   * Jette : on arrête tout, et **rien ne part**.
   *
   * **C'est le garde-fou du 30 août 2026.** Jusque-là, arrêter valait envoyer :
   * celui qui s'était trompé de mot, ou qui avait laissé courir le micro dans
   * sa voiture, envoyait quand même. La poubelle relâche le micro et oublie les
   * morceaux — il n'y a plus de `Blob` à envoyer, donc plus rien à envoyer par
   * mégarde.
   */
  const jeter = useCallback(() => {
    const recorder = recorderRef.current;
    try {
      if (recorder && recorder.state !== "inactive") {
        // Le `Blob` ne sera pas réclamé : on coupe l'écoute avant l'arrêt pour
        // qu'aucun morceau ne s'ajoute pendant qu'on range.
        recorder.ondataavailable = null;
        recorder.stop();
      }
    } catch {
      // Un magnétophone déjà arrêté n'a rien à jeter — ce n'est pas une panne.
    }
    morceauxRef.current = [];
    streamRef.current?.getTracks().forEach((piste) => piste.stop());
    streamRef.current = null;
    recorderRef.current = null;
    fermerLEcoute();
    setSecondes(0);
    setSuspendu(false);
    setEnregistre(false);
  }, [fermerLEcoute]);

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
    fermerLEcoute();
    setSuspendu(false);
    setEnregistre(false);
    return { blob, secondes: dureeFinale };
  }, [secondes, fermerLEcoute]);

  return {
    enregistre,
    suspendu,
    secondes,
    erreur,
    setErreur,
    demarrer,
    arreter,
    jeter,
    basculerSuspension,
    niveau,
  };
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
