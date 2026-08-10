"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { colors, libelleCaps } from "@/lib/design-tokens";
import { useRetraits } from "@/components/atlas/useRetraits";
import { supprimerNoteVocaleAction } from "./note-vocale/actions";

/**
 * L'anneau muet — l'accès direct à la note vocale, sur la fiche du chantier.
 *
 * *Choisi par le patron le 10 août 2026 sur maquette
 * (`maquettes/atlas-note-vocale.html`, `docs/INTEGRER-ORIGINE.md` §6 bis).*
 *
 * Il remplace la ligne « Note vocale » comme **accès direct** : on touche, la
 * note se lit ; on retouche, elle s'arrête ; on pousse l'anneau vers le haut,
 * « Retirer » se découvre dessous.
 *
 * **Aucun libellé visible, mais un nom accessible.** Une icône muette pour
 * l'œil ne doit pas l'être pour qui n'a pas l'usage de ses yeux.
 *
 * **Ce que la maquette ne pouvait pas rendre, et qui est vrai ici.** Elle
 * n'avait qu'une horloge CSS et une onde vraisemblable ; recopier l'une ou
 * l'autre aurait donné un décor. Le compteur suit la **lecture réelle**
 * (`currentTime` / `duration`), et la hauteur des barreaux le **volume
 * réellement enregistré**, mesuré à la volée sur le son qui sort.
 *
 * **Et le glissement suit le doigt.** La maquette s'accrochait d'un cran ; ici
 * c'est un défilement natif, avec l'inertie et le rebond de la plateforme.
 */
export default function AnneauNoteVocale({
  chantierId,
  storageKey,
  dureeSecondes,
}: {
  chantierId: string;
  /** Absent, l'audio a été purgé après transcription : il n'y a rien à écouter. */
  storageKey: string | null;
  dureeSecondes: number | null;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const lecteurRef = useRef<HTMLDivElement>(null);
  const glisseurRef = useRef<HTMLDivElement>(null);
  const [lit, setLit] = useState(false);
  const [seconde, setSeconde] = useState(0);
  const [duree, setDuree] = useState(dureeSecondes ?? 0);

  // Le retrait obéit au vocabulaire commun (`ARCHITECTURE.md` §48) : la note
  // n'est que masquée, et **rien n'est effacé tant qu'« Annuler » est à
  // l'écran**. Le fichier ne part en file de purge qu'à la fermeture — une
  // annulation qui ne rendrait que le texte serait pire que pas d'annulation.
  const retraits = useRetraits({
    valider: async () => {
      await supprimerNoteVocaleAction(chantierId);
    },
  });
  const retiree = retraits.estRetire(chantierId);

  // ─── Le volume réellement enregistré ──────────────────────────────────
  //
  // Un `AnalyserNode` posé sur l'élément audio : on lit l'amplitude du signal
  // qui sort, et elle pilote la hauteur des barreaux par une variable CSS.
  // Sur le conteneur, jamais barreau par barreau : soixante remises en page
  // par seconde pour seize éléments coûteraient plus que tout le reste de
  // l'écran.
  //
  // Si le navigateur refuse — pas de Web Audio, source déjà branchée —, on
  // garde une ampleur de 1 : l'onde bat sans suivre le volume, ce qui vaut
  // mieux qu'un écran mort.
  const analyseur = useRef<AnalyserNode | null>(null);
  const contexteRef = useRef<AudioContext | null>(null);
  const image = useRef<number | null>(null);

  const brancherAnalyse = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    // **Réveiller le contexte à CHAQUE appui, pas seulement au premier.** Un
    // contexte audio naît suspendu, et il se rendort quand l'onglet passe en
    // arrière-plan. Suspendu, il ne laisse rien passer : la lecture avançait,
    // le compteur courait, et l'onde mesurait un silence — que nous avions
    // nous-mêmes créé en intercalant l'analyseur. Mesuré, pas supposé :
    // l'ampleur restait collée à son plancher.
    if (contexteRef.current) {
      void contexteRef.current.resume();
      return;
    }
    try {
      const Contexte = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Contexte) return;
      const contexte = new Contexte();
      const source = contexte.createMediaElementSource(audio);
      const noeud = contexte.createAnalyser();
      noeud.fftSize = 256;
      source.connect(noeud);
      // **Rebrancher vers la sortie, sinon le son se tait.** Un analyseur
      // intercale un nœud dans le graphe : sans cette ligne, on mesurerait un
      // silence qu'on aurait soi-même créé.
      noeud.connect(contexte.destination);
      analyseur.current = noeud;
      contexteRef.current = contexte;
      void contexte.resume();
    } catch {
      analyseur.current = null;
      contexteRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!lit) {
      if (image.current !== null) cancelAnimationFrame(image.current);
      image.current = null;
      lecteurRef.current?.style.setProperty("--atlas-ampleur", "1");
      return;
    }
    const noeud = analyseur.current;
    const tampon = noeud ? new Uint8Array(noeud.fftSize) : null;
    const mesurer = () => {
      const audio = audioRef.current;
      if (audio) {
        setSeconde(audio.currentTime);
        if (Number.isFinite(audio.duration) && audio.duration > 0) setDuree(audio.duration);
      }
      if (noeud && tampon) {
        noeud.getByteTimeDomainData(tampon);
        // L'écart quadratique moyen autour du zéro : c'est le volume perçu,
        // et non le pic, qui ferait sauter l'onde sur un simple claquement.
        let somme = 0;
        for (const v of tampon) {
          const ecart = (v - 128) / 128;
          somme += ecart * ecart;
        }
        const moyenne = Math.sqrt(somme / tampon.length);
        // Un plancher de 0,38 : sans lui, un blanc dans la dictée écrase l'onde
        // à quelques pixels, et l'écran a l'air arrêté alors qu'il lit. Le
        // plafond, lui, empêche un éclat de voix de faire sortir les barreaux
        // de leur fenêtre.
        const ampleur = Math.min(1.5, 0.38 + moyenne * 3.2);
        lecteurRef.current?.style.setProperty("--atlas-ampleur", ampleur.toFixed(3));
      }
      image.current = requestAnimationFrame(mesurer);
    };
    image.current = requestAnimationFrame(mesurer);
    return () => {
      if (image.current !== null) cancelAnimationFrame(image.current);
      image.current = null;
    };
  }, [lit]);

  async function basculerLecture() {
    const audio = audioRef.current;
    if (!audio) return;
    if (lit) {
      audio.pause();
      setLit(false);
      return;
    }
    brancherAnalyse();
    try {
      await audio.play();
      setLit(true);
    } catch {
      // Le navigateur a refusé la lecture : ne pas prétendre qu'elle a lieu.
      setLit(false);
    }
  }

  function retirer() {
    audioRef.current?.pause();
    setLit(false);
    retraits.retirer(chantierId, "cette note vocale");
    // Le glisseur revient à sa place : rouvert par « Annuler », l'anneau doit
    // se retrouver là où on l'a laissé, pas déjà poussé vers le haut.
    glisseurRef.current?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div
      ref={lecteurRef}
      className="atlas-lecteur"
      data-lit={lit ? "oui" : "non"}
      data-retiree={retiree ? "oui" : "non"}
      data-atlas="anneau-note-vocale"
    >
      {storageKey && (
        <audio
          ref={audioRef}
          src={`/api/fichiers/${storageKey}`}
          preload="metadata"
          onEnded={() => setLit(false)}
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) setDuree(d);
          }}
        />
      )}

      {/* Les ailes : huit barreaux de chaque côté, qui partent du centre et
          s'effacent au bout. Elles ne prennent jamais le doigt. */}
      {(["g", "d"] as const).map((cote) => (
        <span key={cote} className={`atlas-aile atlas-aile-${cote}`} aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <i key={i} style={{ backgroundColor: colors.or }} />
          ))}
        </span>
      ))}

      <div ref={glisseurRef} className="atlas-glisseur">
        <div className="atlas-volet-anneau">
          <button
            type="button"
            onClick={basculerLecture}
            // Le seul texte de tout l'anneau, et il ne s'affiche pas.
            aria-label={lit ? "Mettre en pause la note vocale" : "Écouter la note vocale"}
            aria-pressed={lit}
            className="atlas-anneaux"
          >
            <span data-cercle style={{ width: 74, height: 74, border: `1.5px solid ${colors.rust}` }} />
            <span data-cercle style={{ width: 56, height: 56, border: `1px solid ${colors.or}` }} />
            <span className="atlas-traits" aria-hidden="true">
              <i style={{ backgroundColor: colors.or }} />
              <i style={{ backgroundColor: colors.or }} />
              <i style={{ backgroundColor: colors.or }} />
            </span>
          </button>
        </div>
        <button type="button" onClick={retirer} className={`atlas-fosse ${libelleCaps}`} style={{ color: colors.or, letterSpacing: "0.24em" }}>
          Retirer
        </button>
      </div>

      {/* **La consigne dit le geste RÉEL.** Une première version annonçait
          « faites descendre » alors que le doigt fait monter : une consigne
          fausse coûte plus cher qu'aucune consigne. */}
      <p className="atlas-indice mt-2 text-[11px]" style={{ color: colors.muted }}>
        Poussez l&apos;anneau vers le haut
      </p>

      <p className="atlas-chrono" style={{ color: colors.or }} aria-hidden={!lit}>
        {mmss(seconde)}
        <span className="ml-[7px]" style={{ color: colors.muted }}>
          / {mmss(duree)}
        </span>
      </p>

      <div className="atlas-note-retiree">
        <span className="text-[13px]" style={{ color: colors.muted }}>
          Note vocale retirée
        </span>
        <button
          type="button"
          onClick={retraits.annuler}
          aria-label="Annuler le retrait de la note vocale"
          tabIndex={retiree ? 0 : -1}
          className={`px-1 py-2 ${libelleCaps}`}
          style={{ color: colors.or, letterSpacing: "0.24em" }}
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
