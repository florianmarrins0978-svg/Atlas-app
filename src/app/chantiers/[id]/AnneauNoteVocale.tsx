"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { colors, font } from "@/lib/design-tokens";
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
 * Sans enregistrement, l'anneau est un micro : un appui commence à dicter.
 * Pendant la dictée, le même disque porte l'avion (la dictée B, 1er novembre
 * 2026) : un appui envoie, la poubelle à gauche jette. Même objet, deux états —
 * jamais deux boutons.
 */
/**
 * Les trois cercles d'or qui écoutent — la dictée B, son choix du 1er novembre
 * 2026 (`appli/soignee/chantier.html`, « Dictée B, l'anneau qui écoute »).
 *
 * Ils entourent le disque de 80 px (rayon 40) qui a pris la place du micro, et
 * s'ouvrent avec la voix RÉELLEMENT captée (`magnetophone.niveau`) : un dessin
 * tiré au sort serait un décor, le reproche qu'il a déjà fait à un anneau qui
 * battait sans rien lire.
 *
 * **Bornés pour ne rien toucher** : au plus 54 px de rayon, 14 px au-dessus du
 * disque, l'écart qui le sépare de « Devis à la voix ». **Au silence, ils se
 * resserrent sans disparaître** : un dessin qui s'éteint ferait croire à un
 * micro muet.
 *
 * Fonction PURE, hors du composant : elle s'éprouve sans navigateur
 * (`CLAUDE.md` §3), et c'est elle qui porte la règle du dessin.
 */
export function cerclesDeLaVoix(niveau: number): { rayon: number; opacite: number }[] {
  const n = Number.isFinite(niveau) ? Math.max(0, Math.min(1, niveau)) : 0;
  return [1, 2, 3].map((k) => ({
    rayon: Number((41 + k * 2.5 + n * (1 + 1.3 * k)).toFixed(1)),
    opacite: Number(((0.8 - k * 0.2) * (0.5 + n * 0.5)).toFixed(2)),
  }));
}

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
function IconeAvion({ taille = 21 }: { taille?: number }) {
  return (
    <svg
      width={taille}
      height={taille}
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
  preparationEnCours = false,
  refusAvantDeDicter = null,
  atlasTravaille = false,
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
  /**
   * Le devis se prépare : l'invite à dicter se tait.
   *
   * **Sa remarque du 1ᵉʳ septembre 2026** : *« la phrase "appuyez et décrivez
   * le chantier" doit disparaître, sinon ça incite à appuyer »*. Il l'avait
   * sous les yeux pendant que l'écran annonçait « Atlas prépare toujours votre
   * devis… (96 s) » — l'écran l'invitait à recommencer ce qu'il faisait déjà.
   */
  preparationEnCours?: boolean;
  /**
   * Une saisie fausse au-dessus — un téléphone incomplet, un n° TVA trop court
   * (sa capture du 7 octobre 2026). **Refusée AVANT de dicter, jamais après** :
   * l'arrêt de la dictée enregistre impérativement (sa demande du 21 août), et
   * une note refusée à l'arrivée serait une note perdue.
   */
  refusAvantDeDicter?: string | null;
  /**
   * Atlas écrit le devis à partir de la dictée : le micro laisse sa place aux
   * points qui soufflent, et ne se presse plus. Sa planche du 21 octobre
   * 2026, réponse C : le même souffle que le micro des coordonnées.
   */
  atlasTravaille?: boolean;
}) {

  // **Rien à écouter : l'anneau devient un micro.** Le même objet, jamais un
  // second bouton — la fiche n'a qu'un centre.
  const router = useRouter();
  const magnetophone = useMagnetophone();
  const [envoi, setEnvoi] = useState(false);


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

  /**
   * **CE QUI VIVAIT ICI JUSQU'AU 30 AOÛT 2026 : `basculerDictee`.**
   *
   * Un appui commençait, un second arrêtait ET ENVOYAIT — les deux d'un seul
   * geste. C'est précisément ce que sa demande a défait : *« possibilité de
   * supprimer, ou appuyer sur la flèche pour envoyer de suite »*. Celui qui
   * s'était trompé de mot, ou qui avait laissé courir le micro dans sa voiture,
   * envoyait quand même et le découvrait sur le devis.
   *
   * Les trois gestes qui suivent la remplacent : `commencerLaDictee` commence,
   * `jeterLaNote` jette sans rien envoyer, `envoyerLaNote` envoie.
   * Rien n'en est gardé « au cas où » — un dessin que plus rien n'emploie finit
   * repris au hasard par un écran futur.
   */

  /**
   * Le micro : il commence la dictée, et c'est son seul rôle.
   *
   * **LA PAUSE A ÉTÉ RETIRÉE LE 31 AOÛT 2026, à sa demande** — *« supprime le
   * rond avec le carré dedans pour me mettre pause »*. Elle vivait dans
   * l'objet : un second appui suspendait. L'objet lui-même disparaît désormais
   * pendant qu'on parle, et il ne reste que deux gestes, jeter et envoyer.
   *
   * **Ce que cela coûte, et ce n'est pas un oubli :** on ne peut plus suspendre
   * pour répondre à quelqu'un sur le chantier. Cela lui a été dit avant d'être
   * codé. Ne pas la remettre sans lui.
   */
  async function commencerLaDictee() {
    if (envoi) return;
    if (magnetophone.enregistre) return;
    if (refusAvantDeDicter) {
      magnetophone.setErreur(refusAvantDeDicter);
      return;
    }
    const parti = await magnetophone.demarrer();
    // **On ne prévient QUE si le micro a répondu.** Refusé — autorisation non
    // accordée —, le bouton disparaîtrait pour une dictée qui n'a pas
    // commencé, et l'écran n'aurait plus aucune issue.
    if (parti) onDictee?.(true);
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
    remettreLeNiveau();
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
    // **Un appui dans la première seconde ne part pas — la dictée B, 1er
    // novembre 2026.** L'avion tombe EXACTEMENT sous le doigt qui vient de
    // lancer la dictée : un double appui enverrait une note d'une
    // demi-seconde, et la chaîne écrirait un devis à partir de rien.
    // `test-anneau-dictee-e2e` l'éprouve.
    if (magnetophone.secondes < 1) return;
    const capte = await magnetophone.arreter();
    remettreLeNiveau();
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


  /** Le chrono de la dictée : « 1:07 ». */
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  // ─── La voix de la dictée : un niveau, lissé ─────────────────────────────
  //
  // **Lissé, pour que les cercles respirent sans trembler** : chaque mesure ne
  // fait que la moitié du chemin vers elle. Une mesure toutes les 95 ms.
  const [niveau, setNiveau] = useState(0);
  useEffect(() => {
    if (!magnetophone.enregistre) return;
    const t = setInterval(() => {
      const mesure = magnetophone.niveau();
      // `null` veut dire « on ne sait pas » — pas « silence ». Sans Web Audio on
      // garde un dessin vraisemblable plutôt que des cercles figés qui feraient
      // croire à un micro muet.
      const force = mesure === null ? 0.15 + Math.random() * 0.6 : mesure;
      setNiveau((precedent) => precedent + (force - precedent) * 0.45);
    }, 95);
    return () => clearInterval(t);
  }, [magnetophone.enregistre, magnetophone]);

  // **La voix se rend à son repos DANS LE GESTE, pas dans un effet.** Poser
  // l'état depuis un effet déclenche un second rendu en cascade — le lint le
  // refuse, et il a raison : ici, jeter et envoyer savent tous deux qu'ils
  // terminent. `remettreLeNiveau` est donc appelée par eux.
  const remettreLeNiveau = () => setNiveau(0);

  // ═══════════════════════════════════════════════════════════════════════
  // LA DICTÉE — le dessin qu'il a choisi le 30 août 2026.
  //
  // Rien n'est partagé avec le lecteur ci-dessous, et c'est voulu : ce sont
  // deux moments, pas deux états d'un même objet. Le lecteur garde son anneau
  // creux et son glisseur « Retirer » ; la dictée a le sien.
  // ═══════════════════════════════════════════════════════════════════════
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

    const etat = magnetophone.enregistre ? "dicte" : "repos";

    return (
      <div className="atlas-dictee" data-etat={etat} data-atlas="anneau-note-vocale">
        {/* ─── LE REPOS : le micro, SEUL ─────────────────────────────────────
            **Sa demande du 5 septembre 2026 :** *« supprime-moi les traits
            jaunes de chaque côté de la note vocale. »*

            Ce sont les deux « souffles » qu'il avait demandés le 30 août
            (*« le micro, mais avec des petites ondes de chaque côté »*) : une
            décision prise, puis défaite — les deux sont écrites, ici et dans
            `CHANGELOG.md`, pour que personne ne les remette de mémoire.

            **Ce qui part avec eux :** ils élargissaient l'objet et le posaient
            au centre de l'écran. Le micro tient tout seul et reste centré (son
            conteneur l'était déjà) ; les 1,5 cm de chaque côté sont rendus à
            la page. Rien d'autre ne bouge — l'onde qui BAT pendant qu'on parle
            est un autre dessin, et elle reste. */}
        {!magnetophone.enregistre && (
          <span className="atlas-objet">
            <button
              type="button"
              onClick={commencerLaDictee}
              disabled={envoi || atlasTravaille}
              // Le seul texte de tout l'objet, et il ne s'affiche pas. Il ne
              // parle plus que de commencer : la pause a été retirée le 31 août
              // 2026, et l'objet lui-même s'efface dès qu'on parle.
              aria-label="Dicter une note vocale"
              // **À plat, du vert des boutons, le signe blanc, un cercle d'or
              // clair — son choix du 16 septembre 2026**
              // (`appli/note-vocale-cercle-dore.html`). Le fond, le signe et le
              // cercle vivent dans `.atlas-micro` (`globals.css`) : posés ici
              // en style en ligne, ce seraient des couleurs en clair dans un
              // `.tsx`. Pas d'`atlas-plein` non plus : cette classe est faite
              // pour un bouton à texte, et l'appui du micro vit avec lui.
              className="atlas-micro"
            >
              {atlasTravaille ? <PointsQuiSoufflent /> : <IconeMicro />}
            </button>
          </span>
        )}

        {/* ─── LA DICTÉE B : l'anneau qui écoute — son choix du 1er novembre 2026 ───
            Planche `appli/soignee/chantier.html`, « Dictée B ». Le disque du
            micro reste à SA place et l'avion y remplace le micro : même objet,
            deux états, sa règle du 11 août. Trois cercles d'or s'ouvrent autour
            avec la voix ; Jeter à gauche, le temps à droite, et un mot sous
            chaque geste.

            Ses règles du 31 août tiennent : pas de pause (« supprime le rond
            avec le carré dedans »), et jamais deux disques verts à la fois (« ça
            dénature l'appli ») — le seul aplat est celui du micro, qu'il avait
            déjà sous le doigt. Le trait du 2 septembre part avec la ligne : la
            voix se lit désormais dans les cercles. */}
        {magnetophone.enregistre && (
          <div className="atlas-ecoute">
            <button
              type="button"
              onClick={jeterLaNote}
              aria-label="Supprimer la note"
              className="atlas-jeter"
              style={{ color: colors.inkSoft }}
              data-atlas="dictee-jeter"
            >
              <span className="atlas-jeter-rond">
                <IconePoubelle />
              </span>
              Jeter
            </button>

            <button
              type="button"
              onClick={envoyerLaNote}
              disabled={envoi}
              aria-label="Envoyer la note et préparer le devis"
              // Le fond, le cercle d'or clair et le signe blanc vivent dans
              // `.atlas-disque-envoi` (`globals.css`), comme ceux du micro :
              // posés ici, ce seraient des couleurs en clair dans un `.tsx`.
              className="atlas-envoyer"
              style={{ color: colors.ink }}
              data-atlas="dictee-envoyer"
            >
              <svg className="atlas-cercles" viewBox="0 0 120 120" aria-hidden="true">
                {cerclesDeLaVoix(niveau).map((c, k) => (
                  <circle key={k} cx="60" cy="60" r={c.rayon} opacity={c.opacite} />
                ))}
              </svg>
              <span className="atlas-disque-envoi">
                <IconeAvion taille={28} />
              </span>
              Envoyer
            </button>

            <span className="atlas-compteur" style={{ color: colors.ink, fontFamily: font.display }}>
              <span className="atlas-pastille" style={{ backgroundColor: colors.alert }} />
              {mmss(magnetophone.secondes)}
            </span>
          </div>
        )}
        {/* **Rien à dire pendant qu'on parle** : sa planche efface l'indice dès
            la dictée (`[data-etat="dicte"] .atlas-indice{display:none}`). Un
            écran n'explique pas ce qui est en train de se faire sous les yeux.

            **ET RIEN NON PLUS PENDANT QUE LE DEVIS SE PRÉPARE** — sa remarque
            du 1ᵉʳ septembre 2026, capture à l'appui : *« lorsqu'on dicte notre
            devis et qu'on envoie la note vocale, la phrase "appuyez et décrivez
            le chantier" doit disparaître, sinon ça incite à appuyer »*.

            Il avait sous les yeux « Atlas prépare toujours votre devis… (96 s) »
            SOUS une invitation à appuyer : l'écran demandait de recommencer ce
            qu'il était en train de faire. Une seconde dictée par-dessus la
            première, c'est la note qui écrase celle qui travaille. */}
        {!magnetophone.enregistre && !preparationEnCours && (
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
