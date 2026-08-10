"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { colors, font } from "@/lib/design-tokens";
import LigneRetirable from "@/components/atlas/LigneRetirable";
import TiroirDesRetires from "@/components/atlas/TiroirDesRetires";
import { useRetraits } from "@/components/atlas/useRetraits";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { ACCEPT_AUDIO } from "@/server/upload-limits";
import {
  enregistrerNoteVocaleAction,
  lancerTranscriptionAction,
  supprimerNoteVocaleAction,
  completerNoteVocaleAction,
} from "./actions";
import DevisDepuisDictee from "../DevisDepuisDictee";

// « confirmation » ne sert plus qu'au REMPLACEMENT depuis le 10 août 2026 : le
// retrait, lui, passe par le glissement et le tiroir, sans rien demander avant.
// Le remplacement garde sa question parce qu'il ne détruit rien au moment du
// geste — il ouvre un nouvel enregistrement, l'ancienne note vivant jusqu'à ce
// que la nouvelle soit prise. Il n'y a donc rien qu'un tiroir puisse retenir.
type Etat = "vide" | "enregistrement" | "note" | "confirmation";

type StatutTranscription = "non_demandee" | "en_cours" | "reussie" | "echouee";

type NoteInitiale = {
  // Annulable : l'audio est purgé une fois la transcription obtenue
  // (docs/RGPD.md §4). La note vocale lui survit, avec son texte.
  storageKey: string | null;
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
  const [erreurLecture, setErreurLecture] = useState<string | null>(null);
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

  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement>(null);
  const fichierRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // Le magnétophone du complément, distinct du principal : une reprise ratée ne
  // doit rien coûter à la note déjà enregistrée.
  const complementRecorder = useRef<MediaRecorder | null>(null);
  const complementChunks = useRef<Blob[]>([]);
  const [complementEnCours, setComplementEnCours] = useState(false);
  const [messageComplement, setMessageComplement] = useState<string | null>(null);

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

  /**
   * Reprendre l'enregistrement, pour ajouter ce qui a été oublié.
   *
   * Un magnétophone séparé du principal : il ne touche ni à `etat`, ni au
   * lecteur, ni à la note existante tant que le complément n'a pas abouti. Une
   * reprise qui échouerait ne doit rien coûter à ce qui est déjà enregistré.
   */
  async function demarrerComplement() {
    setErreur(null);
    setMessageComplement(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      complementChunks.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) complementChunks.current.push(e.data);
      };
      recorder.onstop = async () => {
        // La piste est relâchée dès l'arrêt : sans cela, le voyant du micro
        // reste allumé et l'on se croit encore écouté.
        stream.getTracks().forEach((t) => t.stop());
        await envoyerComplement(new Blob(complementChunks.current, { type: recorder.mimeType || "audio/webm" }));
      };
      recorder.start();
      complementRecorder.current = recorder;
      setComplementEnCours(true);
    } catch {
      setErreur("Impossible d'accéder au micro. Vérifiez les autorisations.");
    }
  }

  function arreterComplement() {
    complementRecorder.current?.stop();
    complementRecorder.current = null;
    setComplementEnCours(false);
  }

  async function envoyerComplement(blob: Blob) {
    setEnCours(true);
    try {
      const fd = new FormData();
      const extension = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : "webm";
      fd.set("fichier", blob, `complement.${extension}`);
      const r = await completerNoteVocaleAction(chantierId, fd);
      if (!r.ok) {
        setMessageComplement(
          r.raison === "vide"
            ? "Rien n'a été entendu — votre note d'origine est intacte."
            : "Le complément n'a pas pu être transcrit. Votre note d'origine est intacte."
        );
        return;
      }
      setStatutTranscription("reussie");
      setErreurTranscription(null);
      setMessageComplement("Ajouté à la suite de votre note. Relisez la transcription avant de créer le devis.");
      router.refresh();
    } catch {
      setMessageComplement("Le complément n'a pas abouti. Votre note d'origine est intacte.");
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

  // **Le panneau « Supprimer cette note vocale ? » a disparu.** La sécurité
  // passe d'une confirmation avant à une réversibilité après — c'est le geste
  // retenu, et garder les deux ferait demander deux fois.
  //
  // L'audio a un fichier derrière lui, et `supprimerNoteVocale` le met en file
  // de purge dans la même transaction. L'appel attend donc la FERMETURE du
  // tiroir : tant qu'il est ouvert, « Annuler » rend la note ET son
  // enregistrement. Une annulation qui ne rendrait que le texte serait pire
  // que pas d'annulation du tout.
  const retraits = useRetraits({
    valider: async () => {
      await effacerVraiment();
    },
  });
  // La note n'a pas d'identifiant propre sur cet écran : il n'y en a qu'une
  // par chantier. Celui du chantier fait donc office de clé.
  const noteRetiree = retraits.estRetire(chantierId);
  // L'écran se lit comme s'il n'y avait plus de note, mais RIEN n'a été
  // détruit : ni `storageKey`, ni la durée, ni le statut de transcription.
  // C'est exactement ce qui permet à « Annuler » de tout rendre.
  const etatAffiche: Etat = noteRetiree ? "vide" : etat;

  async function effacerVraiment() {
    setErreur(null);
    try {
      await supprimerNoteVocaleAction(chantierId);
      setStorageKey(null);
      setDureeNote(0);
      setLecture(false);
      setProgression(0);
      setFraichementEnregistree(false);
      setStatutTranscription("non_demandee");
      setErreurTranscription(null);
      setEtat("vide");
    } catch {
      setErreur("La note n'a pas pu être supprimée. Réessayez.");
      setEtat("note");
    } finally {
      setEnCours(false);
    }
  }

  // Import d'un fichier déjà présent sur le téléphone. Le format est filtré ici
  // par confort, mais c'est le serveur qui décide (verifierTypeAudio).
  async function importerFichier(fichier: File) {
    setErreur(null);
    setEnCours(true);
    try {
      const fd = new FormData();
      fd.set("fichier", fichier);
      const note = await enregistrerNoteVocaleAction(chantierId, fd);
      setStorageKey(note.storageKey);
      setDureeNote(note.dureeSecondes ?? 0);
      setLecture(false);
      setProgression(0);
      setFraichementEnregistree(true);
      setStatutTranscription("non_demandee");
      setErreurTranscription(null);
      setEtat("note");
    } catch (err) {
      // Le message du serveur (taille, format) est plus précis que tout libellé
      // générique : on le montre tel quel quand il existe.
      setErreur(err instanceof Error && err.message ? err.message : "Ce fichier n'a pas pu être ajouté.");
    } finally {
      setEnCours(false);
      if (fichierRef.current) fichierRef.current.value = "";
    }
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

  /**
   * Lit l'enregistrement — et sait ne pas y arriver.
   *
   * Le 6 août 2026, le patron touche « écouter » sur son iPhone et reçoit une
   * page d'erreur en pleine figure : « Runtime NotSupportedError ». Deux fautes
   * cumulées :
   *
   * 1. `audio.play()` rend une promesse qui peut être **rejetée**. Non
   *    interceptée, elle remonte en erreur d'exécution — l'application entière
   *    paraît cassée alors qu'un seul fichier ne se lit pas ;
   * 2. la cause du rejet est presque toujours la même : Safari, sur iPhone, ne
   *    sait pas décoder le WebM. Un enregistrement fait sur un autre appareil,
   *    ou par un navigateur qui produit ce format, s'écoute partout **sauf**
   *    sur son téléphone.
   *
   * Ce qu'on peut faire ici : ne jamais planter, et dire ce qui se passe. Le
   * fichier reste intact, et la transcription — qui ne dépend pas du lecteur du
   * téléphone — continue de fonctionner.
   */
  async function togglerLecture() {
    const audio = audioRef.current;
    if (!audio) return;
    if (lecture) {
      audio.pause();
      setLecture(false);
      return;
    }
    setErreurLecture(null);
    try {
      await audio.play();
      setLecture(true);
    } catch {
      setLecture(false);
      setErreurLecture(
        "Votre téléphone ne sait pas lire ce format d'enregistrement. Le fichier est bien conservé, et la transcription fonctionne."
      );
    }
  }

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="px-[26px] pt-7">
      {etat === "vide" && (
        <>
          <PrimaryButton onClick={demarrer} disabled={enCours}>
            <MicIcon /> Enregistrer une note vocale
          </PrimaryButton>
          <input
            ref={fichierRef}
            type="file"
            accept={ACCEPT_AUDIO}
            aria-label="Ajouter un fichier audio"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importerFichier(f);
            }}
          />
          <button
            type="button"
            onClick={() => fichierRef.current?.click()}
            disabled={enCours}
            className="mt-4 block w-full text-center text-[9.5px] font-medium uppercase disabled:opacity-40"
            style={{ letterSpacing: "0.28em", color: colors.rust }}
          >
            {enCours ? "Ajout en cours…" : "Ajouter un fichier audio"}
          </button>
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

      {(etatAffiche === "note" || etatAffiche === "confirmation") && (
        <>
          {/* L'audio est purgé une fois la transcription obtenue
              (docs/RGPD.md §4). Seul le lecteur disparaît alors : la
              transcription et la suite du parcours restent accessibles, sans
              quoi l'artisan croirait avoir tout perdu. */}
          {!storageKey && (
            <div className="rounded-[4px] px-5 py-4" style={{ backgroundColor: colors.card }}>
              <p className="text-[19px] leading-[1.15]" style={{ color: colors.ink, fontFamily: font.display }}>
                Enregistrement effacé
              </p>
              <p
                className="mt-[7px] text-[9.5px] font-medium uppercase"
                style={{ color: colors.muted, letterSpacing: "0.28em" }}
              >
                L&apos;audio est supprimé une fois la transcription obtenue. Le texte,
                lui, est conservé.
              </p>
            </div>
          )}
          {storageKey && (
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
            // Le navigateur peut aussi refuser APRÈS avoir accepté de charger :
            // le bouton doit alors revenir à « écouter », jamais rester figé
            // sur pause devant un silence.
            onError={() => {
              setLecture(false);
              setErreurLecture(
                "Votre téléphone ne sait pas lire ce format d'enregistrement. Le fichier est bien conservé, et la transcription fonctionne."
              );
            }}
            hidden
          />
          {erreurLecture && (
            <p role="alert" className="mb-3 text-[13px]" style={{ color: colors.rust }}>
              {erreurLecture}
            </p>
          )}
          {/* Le même geste que partout : le bloc glisse, « Retirer » se
              découvre, la note tombe et le tiroir la retient. Il remplace le
              bouton « Supprimer la note » qui vivait au bas de l'écran. */}
          <LigneRetirable
            libelle="cette note vocale"
            retiree={false}
            onRetirer={() => retraits.retirer(chantierId, "cette note vocale")}
            hauteurMax={140}
            // La plage est portée par l'enveloppe, qui ne bouge pas : sinon
            // l'encart part de biais avec son fond, bordure tranchée net, et
            // « Retirer » se retrouve posé sur le fond de page.
            plage={{ fond: colors.card }}
            // Le bouton d'écoute NE GLISSE PAS : c'est un repère et une
            // commande, pas du texte. Il tient ici le rôle de la date sur la
            // liste des chantiers. Emporté par le glissement, il sortait de
            // l'écran par la gauche — on ne pouvait plus écouter la note qu'on
            // s'apprêtait à retirer.
            avant={
              <button
                onClick={togglerLecture}
                aria-label={lecture ? "Mettre en pause" : "Écouter la note"}
                className="ml-5 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: colors.rust }}
              >
                {lecture ? <PauseIcon /> : <PlayIcon />}
              </button>
            }
            className="flex w-full items-center gap-4 py-5 pr-5"
          >
          <div className="w-full">
            <div className="min-w-0 flex-1">
              <p className="text-[19px] leading-[1.15]" style={{ color: colors.ink, fontFamily: font.display }}>
                {fraichementEnregistree ? "Enregistrée à l'instant" : "Note enregistrée"}
              </p>
              <p
                className="mt-[7px] text-[9.5px] font-medium uppercase"
                style={{ color: colors.muted, letterSpacing: "0.28em" }}
              >
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
          </LigneRetirable>
          </>
          )}

          <div className="mt-4">
            {statutTranscription === "non_demandee" && (
              <button
                onClick={lancerTranscription}
                className="block w-full text-center text-[9.5px] font-medium uppercase"
                style={{ letterSpacing: "0.28em", color: colors.rust }}
              >
                Lancer la transcription
              </button>
            )}
            {statutTranscription === "en_cours" && (
              <p className="text-center text-[14px]" style={{ color: colors.muted }}>
                Transcription en cours…
              </p>
            )}
            {/* **La dictée mène au devis, directement.**
                Le patron, le 5 août 2026 : « une fois qu'on valide la note
                vocale, cette page s'ouvre — la page où il n'y a que le devis —
                et là je fais mes modifications s'il y a besoin. Je ne veux pas
                tous les autres trucs intermédiaires. »

                Ce bouton menait vers l'écran Informations, puis le prix, puis
                le devis. Il ouvre maintenant le devis lui-même, écrit à partir
                de ce qu'il vient de dire. */}
            {statutTranscription === "reussie" && (
              <>
                <DevisDepuisDictee chantierId={chantierId} transcriptionDisponible />
                <p className="mt-3 text-center text-[13px]" style={{ color: colors.muted }}>
                  Transcription disponible —{" "}
                  <a href={`/chantiers/${chantierId}/transcription`} className="font-medium" style={{ color: colors.rust }}>
                    voir le texte
                  </a>
                </p>
              </>
            )}

            {/* Et pour celui qui ne veut pas dicter du tout : l'accès direct au
                devis, sous l'enregistreur, quel que soit l'état de la dictée.
                « Si je n'ai pas envie de dicter mon devis, que je puisse le
                rédiger à la main. » */}
            <a
              href={`/chantiers/${chantierId}/devis-complet`}
              className="mt-4 block text-center text-[14px] font-medium"
              style={{ color: colors.rust }}
            >
              Ou rédiger le devis à la main →
            </a>
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

          {erreur && (
            <p className="mt-4 text-center text-[13px]" style={{ color: colors.alert }}>
              {erreur}
            </p>
          )}

          {/* **Reprendre, plutôt que tout refaire.**
              Le patron, le 7 août 2026 : « sans faire exprès j'ai mis fin à ma
              note vocale mais j'avais encore des choses à dire ». La seule
              issue était « Remplacer », c'est-à-dire recommencer trente-quatre
              secondes de description après les avoir déjà dites une fois.
              Placé AVANT « Remplacer » : c'est le geste qu'on cherche quand on
              s'est arrêté trop tôt, et le remplacement est celui qu'on regrette.
              Le complément s'ajoute à la suite du texte, et l'écran le dit —
              voir `complement-note-service.ts` pour pourquoi ce n'est pas
              l'audio qu'on recolle. */}
          <button
            onClick={complementEnCours ? arreterComplement : demarrerComplement}
            disabled={enCours}
            className="mt-4 block w-full rounded-[4px] py-3 text-center text-[15px] font-medium disabled:opacity-40"
            style={{
              backgroundColor: complementEnCours ? colors.alert : colors.rustTint,
              color: complementEnCours ? "#FFFFFF" : colors.rust,
            }}
          >
            {complementEnCours
              ? "J'écoute — touchez pour arrêter"
              : enCours
                ? "Un instant…"
                : "Reprendre — j'avais oublié quelque chose"}
          </button>
          {messageComplement && (
            <p className="mt-2 text-center text-[13px] leading-snug" style={{ color: colors.muted }}>
              {messageComplement}
            </p>
          )}

          <button
            onClick={() => {
              setEtat("confirmation");
            }}
            className="mt-4 block w-full text-center text-[14px] font-medium"
            style={{ color: colors.rust }}
          >
            Remplacer la note
          </button>
        </>
      )}

      {etatAffiche === "confirmation" && (
        <div className="fixed inset-0 z-40 flex items-end" style={{ backgroundColor: "rgba(0,0,0,0.35)" }}>
          <div className="w-full rounded-t-[26px] px-6 pb-9 pt-3" style={{ backgroundColor: colors.cream }}>
            <div className="mx-auto mb-5 h-1 w-10 rounded-full" style={{ backgroundColor: colors.line }} />
            {/* Il ne reste QUE le remplacement. Et il garde sa question, à
                dessein : contrairement au retrait, il ne détruit rien au moment
                du geste — il ouvre un nouvel enregistrement, et l'ancienne note
                vit jusqu'à ce que la nouvelle soit prise. Il n'y a donc rien à
                rattraper derrière, et donc rien qu'un tiroir puisse retenir. */}
            <p className="mb-1 text-center text-[16px]" style={{ color: colors.ink, fontFamily: font.display }}>
              Remplacer cette note vocale ?
            </p>
            <p className="mb-5 text-center text-[13px]" style={{ color: colors.muted }}>
              La note actuelle sera conservée jusqu&apos;à l&apos;enregistrement de la nouvelle.
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => setEtat("note")}
                className="rounded-[4px] py-3.5 text-[16px] font-medium"
                style={{ backgroundColor: colors.card, color: colors.ink }}
              >
                Annuler
              </button>
              <button
                onClick={confirmerRemplacement}
                disabled={enCours}
                className="rounded-[4px] py-3.5 text-[15px] font-medium disabled:opacity-40"
                style={{ color: colors.alert }}
              >
                Remplacer
              </button>
            </div>
          </div>
        </div>
      )}
      <TiroirDesRetires
        dernier={retraits.dernier}
        nombre={retraits.nombre}
        onAnnuler={retraits.annuler}
        className="mt-7 !mx-0"
      />
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
