"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { colors, libelleCaps, surPlein } from "@/lib/design-tokens";
import { useRetraits } from "@/components/atlas/useRetraits";
import { supprimerNoteVocaleAction } from "./note-vocale/actions";
import { useMagnetophone, formulaireDeNote } from "./magnetophone";
import PointsQuiSoufflent from "@/components/atlas/PointsQuiSoufflent";
import { envoyerNoteVocale } from "@/lib/envoi-note-vocale";

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
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **L'anneau est là DÈS L'ARRIVÉE, même sans rien à écouter** — demandé par le
 * patron le 11 août 2026, sur sa fiche d'un chantier neuf :
 *
 *   *« l'anneau qui est en plein milieu et dès qu'on arrive sur la page, il y
 *   est en fait, qu'on ait cliqué dessus ou non. C'est ça que je veux. »*
 *
 * Avant, il n'apparaissait qu'une fois la note enregistrée, et la dictée
 * arrivait en DEUXIÈME action, derrière les photos. Sur un chantier neuf —
 * c'est-à-dire au moment précis où l'on veut parler — le cœur du produit était
 * donc caché derrière autre chose.
 *
 * Sans enregistrement, l'anneau devient un micro : un appui commence à dicter,
 * un second arrête et enregistre. Avec un enregistrement, il redevient le
 * lecteur. Même objet, deux états — jamais deux boutons.
 */
/**
 * Les deux souffles de part et d'autre du micro — sa demande du 30 août 2026 :
 * *« le micro, mais avec des petites ondes de chaque côté, 1,5 cm max de chaque
 * côté »*.
 *
 * **Le dessin est fixe, et il ne bat pas.** Au repos rien ne se passe : une onde
 * qui remue avant qu'on ait parlé fait croire que le téléphone écoute déjà.
 * Les hauteurs décroissent vers l'extérieur — le souffle s'éteint en
 * s'éloignant, comme le son.
 */
const SOUFFLE = [22, 10, 17, 7, 20, 12, 15, 6, 13, 9, 11, 5, 8, 4];

/**
 * Combien de barreaux l'onde de la dictée porte à la fois.
 *
 * Un nombre fixe plutôt qu'une mesure de la largeur : le conteneur masque ce
 * qui déborde, et une onde qui se recompterait à chaque redimensionnement
 * sauterait sous le doigt pour rien.
 */
const BARREAUX_ONDE = 64;

function IconeMicro() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" strokeLinecap="round" />
      <path d="M12 18v3" strokeLinecap="round" />
    </svg>
  );
}

function IconePoubelle() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16" />
      <path d="M10 4h4a1 1 0 0 1 1 1v2H9V5a1 1 0 0 1 1-1z" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

/**
 * L'avion en papier — le geste d'envoi, et **pas une flèche décorative** : il
 * EST le bouton, il ne suit aucun libellé (`CLAUDE.md` §3).
 */
function IconeAvion() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.5 3.5 10.6 13.4" />
      <path d="M20.5 3.5 14.2 21a.6.6 0 0 1-1.1.05l-3-6.6-6.6-3a.6.6 0 0 1 .05-1.1z" />
    </svg>
  );
}

export default function AnneauNoteVocale({
  chantierId,
  assurerChantier,
  onDicte,
  onDictee,
  storageKey,
  dureeSecondes,
}: {
  /**
   * Le chantier, s'il existe déjà. **`null` sur la fiche client** : il n'est
   * créé qu'au moment où l'on arrête de dicter — voir `assurerChantier`.
   */
  chantierId: string | null;
  /**
   * Fait exister le chantier, et rend son identifiant.
   *
   * **Sa demande du 21 août 2026 :** *« dès que je rappuie sur la note vocale
   * pour stopper l'enregistrement, il faut IMPÉRATIVEMENT que les infos aillent
   * s'enregistrer »* — parce qu'il est en rendez-vous et qu'il va fermer
   * l'application. Le chantier naît donc de ce geste-là, sans qu'il ait à
   * toucher autre chose.
   */
  assurerChantier?: () => Promise<string>;
  /**
   * Appelé une fois la note enregistrée, avec le chantier qui la porte.
   *
   * **Sur la fiche du chantier, il n'y a rien à faire de plus** : la page se
   * rafraîchit et l'anneau devient le lecteur. Sur la fiche CLIENT, c'est ce
   * signal qui fait apparaître « Mon devis → » sous l'anneau — et un
   * rafraîchissement y effacerait ce qu'il vient de taper.
   */
  onDicte?: (chantierId: string) => void;
  /**
   * Signale que la dictée est EN COURS — pour que l'écran qui nous héberge
   * puisse retirer ce qui gênerait.
   *
   * **Sa demande du 30 août 2026 :** *« lorsque l'utilisateur clique sur le
   * bouton de la note vocale, le bouton "Je rédige à la main" disparaît pour ne
   * plus avoir de confusion possible. L'utilisateur ne pourra donc plus se
   * tromper. »* C'est l'écran du dessus qui porte ce bouton : il doit savoir.
   */
  onDictee?: (enCours: boolean) => void;
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

  // **Rien à écouter : l'anneau devient un micro.** Le même objet, jamais un
  // second bouton — la fiche n'a qu'un centre.
  const router = useRouter();
  const magnetophone = useMagnetophone();
  const [envoi, setEnvoi] = useState(false);
  const enregistreur = !storageKey;

  // Le retrait obéit au vocabulaire commun (`ARCHITECTURE.md` §48) : la note
  // n'est que masquée, et **rien n'est effacé tant qu'« Annuler » est à
  // l'écran**. Le fichier ne part en file de purge qu'à la fermeture — une
  // annulation qui ne rendrait que le texte serait pire que pas d'annulation.
  const retraits = useRetraits({
    valider: async () => {
      // Sans chantier, il n'y a pas de note à retirer : le tiroir de retrait
      // n'apparaît pas non plus (`enregistreur` plus bas).
      if (chantierId) await supprimerNoteVocaleAction(chantierId);
    },
  });
  const retiree = chantierId !== null && retraits.estRetire(chantierId);

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

  /**
   * **CE QUI VIVAIT ICI JUSQU'AU 30 AOÛT 2026 : `basculerDictee`.**
   *
   * Un appui commençait, un second arrêtait ET ENVOYAIT — les deux d'un seul
   * geste. C'est précisément ce que sa demande a défait : *« possibilité de
   * supprimer, ou appuyer sur la flèche pour envoyer de suite »*. Celui qui
   * s'était trompé de mot, ou qui avait laissé courir le micro dans sa voiture,
   * envoyait quand même et le découvrait sur le devis.
   *
   * Les trois gestes qui suivent la remplacent : `toucherLObjet` commence et
   * suspend, `jeterLaNote` jette sans rien envoyer, `envoyerLaNote` envoie.
   * Rien n'en est gardé « au cas où » — un dessin que plus rien n'emploie finit
   * repris au hasard par un écran futur.
   */

  /**
   * L'objet central : il commence, puis il suspend.
   *
   * **La pause vit DANS l'objet, elle n'a pas de bouton à elle.** Sa
   * proposition 2 n'en portait pas : le carré d'arrêt EST le troisième geste,
   * et un bouton de plus entre la poubelle et l'avion serait un choix de plus
   * à faire pendant qu'on parle.
   */
  async function toucherLObjet() {
    if (envoi) return;
    if (!magnetophone.enregistre) {
      const parti = await magnetophone.demarrer();
      // **On ne prévient QUE si le micro a répondu.** Refusé — autorisation non
      // accordée —, le bouton disparaîtrait pour une dictée qui n'a pas
      // commencé, et l'écran n'aurait plus aucune issue.
      if (parti) onDictee?.(true);
      return;
    }
    magnetophone.basculerSuspension();
  }

  /**
   * **Jeter ne mène nulle part, et n'envoie rien.**
   *
   * Le chantier, lui, n'est pas touché : une photo prise avant a pu le créer
   * (`assurerChantier`), et jeter une note ne doit pas emporter le reste.
   */
  function jeterLaNote() {
    if (envoi) return;
    magnetophone.jeter();
    magnetophone.setErreur(null);
    remettreLOnde();
    onDictee?.(false);
  }

  /**
   * L'avion : on arrête, on envoie, et l'on part au devis.
   *
   * **C'est ici que tout part**, et plus à l'arrêt. Sa demande du 30 août
   * 2026 : *« appuyer sur la flèche pour envoyer de suite la transcription et
   * arriver sur la page du devis comme c'est déjà le cas »*.
   */
  async function envoyerLaNote() {
    if (envoi) return;
    if (!magnetophone.enregistre) return;
    const capte = await magnetophone.arreter();
    remettreLOnde();
    if (!capte) {
      // Rien n'a été capté : l'écran retrouve son bouton, sinon il resterait
      // amputé de sa seule autre issue.
      onDictee?.(false);
      return;
    }
    setEnvoi(true);
    try {
      const cible = chantierId ?? (await assurerChantier?.());
      if (!cible) {
        magnetophone.setErreur("Impossible d'enregistrer ce chantier pour l'instant. Réessayez.");
        onDictee?.(false);
        return;
      }
      const resultat = await envoyerNoteVocale(cible, formulaireDeNote(capte.blob, capte.secondes));
      if (!resultat.ok) {
        magnetophone.setErreur(resultat.raison);
        onDictee?.(false);
        return;
      }
      if (onDicte) onDicte(cible);
      else router.refresh();
    } finally {
      setEnvoi(false);
    }
  }

  function retirer() {
    audioRef.current?.pause();
    setLit(false);
    if (!chantierId) return;
    retraits.retirer(chantierId, "cette note vocale");
    // Le glisseur revient à sa place : rouvert par « Annuler », l'anneau doit
    // se retrouver là où on l'a laissé, pas déjà poussé vers le haut.
    glisseurRef.current?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  // ─── L'onde de la dictée : elle se déroule au volume réel ───────────────
  //
  // **Elle part PLEINE, à plat.** Sans cela les deux premières secondes montrent
  // un trait qui pousse dans le vide, et la barre paraît mal cadrée — mesuré sur
  // capture. Un barreau naît toutes les 95 ms à droite, les plus vieux tombent.
  const [onde, setOnde] = useState<number[]>(() => Array(BARREAUX_ONDE).fill(2));
  useEffect(() => {
    if (!magnetophone.enregistre || magnetophone.suspendu) return;
    const t = setInterval(() => {
      const mesure = magnetophone.niveau();
      // `null` veut dire « on ne sait pas » — pas « silence ». Sans Web Audio on
      // garde un dessin vraisemblable plutôt qu'une ligne plate qui ferait
      // croire à un micro muet.
      const hauteur = mesure === null ? 5 + Math.random() * 18 : 4 + mesure * 22;
      setOnde((precedente) => [...precedente.slice(1), Math.round(hauteur)]);
    }, 95);
    return () => clearInterval(t);
  }, [magnetophone.enregistre, magnetophone.suspendu, magnetophone]);

  // **L'onde se rend à son repos DANS LE GESTE, pas dans un effet.** Poser
  // l'état depuis un effet déclenche un second rendu en cascade — le lint le
  // refuse, et il a raison : ici, jeter et envoyer savent tous deux qu'ils
  // terminent. `remettreLOnde` est donc appelée par eux.
  const remettreLOnde = () => setOnde(Array(BARREAUX_ONDE).fill(2));

  // ═══════════════════════════════════════════════════════════════════════
  // LA DICTÉE — le dessin qu'il a choisi le 30 août 2026.
  //
  // Rien n'est partagé avec le lecteur ci-dessous, et c'est voulu : ce sont
  // deux moments, pas deux états d'un même objet. Le lecteur garde son anneau
  // creux et son glisseur « Retirer » ; la dictée a le sien.
  // ═══════════════════════════════════════════════════════════════════════
  if (enregistreur) {
    // **Pendant l'envoi, l'objet s'efface.** Sa planche le fait — le trio part,
    // « Transcription… » prend sa place. Laisser un micro à l'écran, fût-il
    // éteint, c'est laisser une cible : on l'appuie, rien ne répond, et l'on
    // croit l'écran cassé. C'est sa règle du bouton qui disparaît, appliquée à
    // l'objet lui-même.
    if (envoi) {
      return (
        <div className="atlas-dictee" data-etat="envoi" data-atlas="anneau-note-vocale">
          <p className="flex items-center gap-2 text-[13px]" style={{ color: colors.muted }}>
            Transcription
            <PointsQuiSoufflent />
          </p>
        </div>
      );
    }

    const etat = magnetophone.enregistre ? (magnetophone.suspendu ? "pause" : "dicte") : "repos";

    return (
      <div className="atlas-dictee" data-etat={etat} data-atlas="anneau-note-vocale">
        <div className="atlas-trio">
          {/* **La poubelle n'existe qu'en dictant.** Au repos il n'y a rien à
              jeter, et un bouton offert d'avance est une question posée à
              quelqu'un qui n'a rien dit. */}
          {magnetophone.enregistre && (
            <button
              type="button"
              onClick={jeterLaNote}
              aria-label="Supprimer la note"
              className="atlas-cote atlas-jeter"
              style={{ color: colors.muted }}
              data-atlas="dictee-jeter"
            >
              <IconePoubelle />
            </button>
          )}

          <span className="atlas-objet">
            {(["g", "d"] as const).map((cote) => (
              <span key={cote} className={`atlas-frange atlas-frange-${cote}`} aria-hidden="true">
                {SOUFFLE.map((hauteur, i) => (
                  <i
                    key={i}
                    style={{
                      height: hauteur,
                      backgroundColor: colors.or,
                      // Le souffle s'éteint en s'éloignant, comme le son : à
                      // gauche l'ordre s'inverse pour que le creux soit dehors.
                      order: cote === "g" ? SOUFFLE.length - i : i,
                    }}
                  />
                ))}
              </span>
            ))}

            <button
              type="button"
              onClick={toucherLObjet}
              disabled={envoi}
              // Le seul texte de tout l'objet, et il ne s'affiche pas. Il dit le
              // geste RÉEL de cet instant — pas celui d'un autre état.
              aria-label={
                !magnetophone.enregistre
                  ? "Dicter une note vocale"
                  : magnetophone.suspendu
                    ? "Reprendre la dictée"
                    : "Mettre la dictée en pause"
              }
              aria-pressed={magnetophone.enregistre}
              className="atlas-plein atlas-micro"
              style={{ backgroundColor: colors.rust, color: surPlein }}
            >
              {magnetophone.enregistre ? (
                <span className="atlas-carre-stop" aria-hidden="true" style={{ backgroundColor: surPlein }} />
              ) : (
                <IconeMicro />
              )}
            </button>
          </span>

          {magnetophone.enregistre && (
            <button
              type="button"
              onClick={envoyerLaNote}
              disabled={envoi}
              aria-label="Envoyer la note et préparer le devis"
              className="atlas-plein atlas-cote atlas-envoyer"
              style={{ backgroundColor: colors.rust, color: surPlein }}
              data-atlas="dictee-envoyer"
            >
              <IconeAvion />
            </button>
          )}
        </div>

        {magnetophone.enregistre && (
          <div className="atlas-sous-trio">
            <span className="atlas-compteur" style={{ color: colors.or }}>
              <span className="atlas-pastille" style={{ backgroundColor: colors.alert }} />
              {mmss(magnetophone.secondes)}
            </span>
            {/* L'onde suit le volume RÉELLEMENT capté (`magnetophone.niveau`) :
                une onde tirée au sort serait un décor, et c'est le reproche
                qu'il a déjà fait à un anneau qui battait sans rien lire. */}
            <span className="atlas-onde" aria-hidden="true">
              {onde.map((hauteur, i) => (
                <i key={i} style={{ height: hauteur, backgroundColor: colors.or }} />
              ))}
            </span>
          </div>
        )}

        {/* **Rien à dire pendant qu'on parle** : sa planche efface l'indice dès
            la dictée (`[data-etat="dicte"] .atlas-indice{display:none}`). Un
            écran n'explique pas ce qui est en train de se faire sous les yeux. */}
        {!magnetophone.enregistre && (
          <p className="atlas-indice mt-1 text-[11px]" style={{ color: colors.muted }}>
            Appuyez et décrivez le chantier
          </p>
        )}

        {magnetophone.erreur && (
          <p className="mt-2 text-center text-[12px]" style={{ color: colors.rust }}>
            {magnetophone.erreur}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      ref={lecteurRef}
      className="atlas-lecteur"
      // `data-lit` pilote l'onde : elle bat quand on écoute ET quand on dicte.
      // Un micro immobile pendant qu'on parle se lit comme un micro en panne.
      data-lit={lit ? "oui" : "non"}
      data-vide="non"
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
            // Le seul texte de tout l'anneau, et il ne s'affiche pas. **Il ne
            // parle plus que de LECTURE** : depuis le 30 août 2026, la dictée a
            // son propre dessin (plus haut), et ce rendu-ci n'est atteint qu'avec
            // une note à écouter.
            aria-label={lit ? "Mettre en pause la note vocale" : "Écouter la note vocale"}
            aria-pressed={lit}
            className="atlas-anneaux"
          >
            <span data-cercle style={{ width: 74, height: 74, border: `1.5px solid ${colors.rust}` }} />
            <span data-cercle style={{ width: 56, height: 56, border: `1px solid ${colors.or}` }} />
            {/* **Les trois traits, dans TOUS les états au repos.**
                Une première version posait un point plein quand il n'y avait
                rien à écouter — le symbole des magnétophones. Le patron l'a
                rejeté en une phrase : « ça ressemble toujours pas à la
                maquette ». Il avait raison, et c'est plus qu'un détail de
                dessin : l'anneau est UN objet, il ne doit pas changer de visage
                selon ce qu'il contient. Seule la dictée EN COURS mérite un
                signe distinct — le carré, qui ne veut dire qu'une chose :
                arrêter. */}
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

      {/* **La consigne dit le geste RÉEL, et celui de CET état.** Une première
          version annonçait « faites descendre » alors que le doigt fait monter :
          une consigne fausse coûte plus cher qu'aucune consigne. De même,
          proposer « poussez vers le haut » sans note à retirer enverrait
          chercher un geste sans effet — et un anneau muet sur un chantier neuf
          ne dirait pas qu'il attend la voix. */}
      <p className="atlas-indice mt-2 text-[11px]" style={{ color: colors.muted }}>
        Poussez l&apos;anneau vers le haut
      </p>

      <p className="atlas-chrono" style={{ color: colors.or }} aria-hidden={!lit}>
        {mmss(seconde)}
        <span className="ml-[7px]" style={{ color: colors.muted }}>
          / {mmss(duree)}
        </span>
      </p>

      {/* **Absent du document, pas seulement invisible.** Depuis que l'anneau
          est rendu même sans note (11 août 2026), ce tiroir « Note vocale
          retirée » traînait dans la page de tout chantier neuf — avec son
          bouton « Annuler ». Une suite de l'assistant a alors trouvé DEUX
          « Annuler » et cliqué sur le mauvais : celui-ci, invisible et hors du
          parcours au clavier. Un bouton qu'on ne peut ni voir ni atteindre ne
          doit pas non plus exister pour qui cherche par le texte. */}
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
