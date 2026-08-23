"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { colors, libelleCaps } from "@/lib/design-tokens";
import { useRetraits } from "@/components/atlas/useRetraits";
import { supprimerNoteVocaleAction } from "./note-vocale/actions";
import { useMagnetophone, formulaireDeNote } from "./magnetophone";
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
export default function AnneauNoteVocale({
  chantierId,
  assurerChantier,
  onDicte,
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
   * Un appui commence, un second arrête et enregistre.
   *
   * **On ne quitte pas l'écran.** La fiche se rafraîchit sur place : l'anneau
   * qui était un micro devient le lecteur de ce qu'on vient de dire, au même
   * endroit. Renvoyer vers un autre écran ferait perdre le fil de ce qu'on
   * était en train de faire.
   */
  async function basculerDictee() {
    if (envoi) return;
    if (!magnetophone.enregistre) {
      await magnetophone.demarrer();
      return;
    }
    const capte = await magnetophone.arreter();
    if (!capte) return;
    setEnvoi(true);
    try {
      // **Une URL, pas une action serveur** — c'est le correctif du 12 août
      // 2026, après trois signalements du patron. Une action est adressée par
      // un identifiant fabriqué à la construction ; son banc se reconstruit
      // tout seul, et cette fiche est justement l'écran où l'on STATIONNE avant
      // de dicter. La page appelait donc un identifiant disparu, et l'envoi
      // échouait sans jamais atteindre le serveur. Voir `envoi-note-vocale.ts`.
      //
      // `envoyerNoteVocale` ne lève jamais : tout échec revient en `raison`,
      // déjà traduit et nommant le maillon.
      const cible = chantierId ?? (await assurerChantier?.());
      if (!cible) {
        magnetophone.setErreur("Impossible d'enregistrer ce chantier pour l'instant. Réessayez.");
        return;
      }
      const resultat = await envoyerNoteVocale(
        cible,
        formulaireDeNote(capte.blob, capte.secondes)
      );
      if (!resultat.ok) {
        magnetophone.setErreur(resultat.raison);
        return;
      }
      // Sur la fiche client, celui qui nous a posés décide de la suite : un
      // rafraîchissement effacerait la saisie en cours.
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

  return (
    <div
      ref={lecteurRef}
      className="atlas-lecteur"
      // `data-lit` pilote l'onde : elle bat quand on écoute ET quand on dicte.
      // Un micro immobile pendant qu'on parle se lit comme un micro en panne.
      data-lit={lit || magnetophone.enregistre ? "oui" : "non"}
      data-enregistre={magnetophone.enregistre ? "oui" : "non"}
      data-vide={enregistreur ? "oui" : "non"}
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
            onClick={enregistreur ? basculerDictee : basculerLecture}
            disabled={envoi}
            // Le seul texte de tout l'anneau, et il ne s'affiche pas. Il dit le
            // geste RÉEL, qui n'est pas le même selon qu'il y a ou non une note.
            aria-label={
              enregistreur
                ? magnetophone.enregistre
                  ? "Arrêter la dictée et enregistrer"
                  : "Dicter une note vocale"
                : lit
                  ? "Mettre en pause la note vocale"
                  : "Écouter la note vocale"
            }
            aria-pressed={enregistreur ? magnetophone.enregistre : lit}
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
            {magnetophone.enregistre ? (
              <span
                aria-hidden="true"
                style={{
                  backgroundColor: colors.or,
                  width: 17,
                  height: 17,
                  borderRadius: 3,
                  transition: "border-radius 180ms ease, width 180ms ease, height 180ms ease",
                }}
              />
            ) : (
              <span className="atlas-traits" aria-hidden="true">
                <i style={{ backgroundColor: colors.or }} />
                <i style={{ backgroundColor: colors.or }} />
                <i style={{ backgroundColor: colors.or }} />
              </span>
            )}
          </button>
        </div>
        {!enregistreur && (
          <button type="button" onClick={retirer} className={`atlas-fosse ${libelleCaps}`} style={{ color: colors.or, letterSpacing: "0.24em" }}>
            Retirer
          </button>
        )}
      </div>

      {/* **La consigne dit le geste RÉEL, et celui de CET état.** Une première
          version annonçait « faites descendre » alors que le doigt fait monter :
          une consigne fausse coûte plus cher qu'aucune consigne. De même,
          proposer « poussez vers le haut » sans note à retirer enverrait
          chercher un geste sans effet — et un anneau muet sur un chantier neuf
          ne dirait pas qu'il attend la voix. */}
      <p className="atlas-indice mt-2 text-[11px]" style={{ color: colors.muted }}>
        {enregistreur
          ? magnetophone.enregistre
            ? "Appuyez pour arrêter"
            : envoi
              ? "Enregistrement…"
              : "Appuyez et décrivez le chantier"
          : "Poussez l'anneau vers le haut"}
      </p>

      {magnetophone.erreur && (
        <p className="mt-2 text-center text-[12px]" style={{ color: colors.rust }}>
          {magnetophone.erreur}
        </p>
      )}

      {/* Pendant la dictée, le compteur ne compte QUE ce qui a été dit : il n'y
          a pas encore de durée totale, et en inventer une serait mentir. */}
      <p className="atlas-chrono" style={{ color: colors.or }} aria-hidden={!lit && !magnetophone.enregistre}>
        {mmss(magnetophone.enregistre ? magnetophone.secondes : seconde)}
        {!enregistreur && (
          <span className="ml-[7px]" style={{ color: colors.muted }}>
            / {mmss(duree)}
          </span>
        )}
      </p>

      {/* **Absent du document, pas seulement invisible.** Depuis que l'anneau
          est rendu même sans note (11 août 2026), ce tiroir « Note vocale
          retirée » traînait dans la page de tout chantier neuf — avec son
          bouton « Annuler ». Une suite de l'assistant a alors trouvé DEUX
          « Annuler » et cliqué sur le mauvais : celui-ci, invisible et hors du
          parcours au clavier. Un bouton qu'on ne peut ni voir ni atteindre ne
          doit pas non plus exister pour qui cherche par le texte. */}
      {!enregistreur && (
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
      )}
    </div>
  );
}
