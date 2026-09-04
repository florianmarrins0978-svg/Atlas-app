"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { colors, font, smallCaps, texteSituation } from "@/lib/design-tokens";
import { DUREES } from "@/lib/durees-chantier";
import BottomSheet from "@/components/atlas/BottomSheet";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import ChoixCanal from "@/components/atlas/ChoixCanal";
import { jourIso, jourLisible } from "@/lib/jour";
import MoisCharge from "@/components/atlas/MoisCharge";
import { useOccupation } from "@/components/atlas/useOccupation";
import { ditCeQuiResteCeJour, equipesLibresCeJour } from "@/lib/planning-jour";
import JourneeRegardee from "./JourneeRegardee";
import { basculerJour } from "@/lib/calendrier";
import { MOTIF_DEVIS_VIDE } from "@/lib/devis-envoyable";
import {
  preparerEnvoiAction,
  envoyerAuClientAction,
  verifierJourProposeAction,
  enregistrerCoordonneeClientAction,
} from "./actions";
import type { VerdictJour } from "@/server/repositories/preparation-envoi";
import BandeDuree from "../BandeDuree";

// L'unique arrêt avant l'envoi (docs/AGENT.md §2.2). Le patron vient de valider
// son devis : on ne lui redemande pas s'il est sûr — un arrêt qui ne peut mener
// qu'à « oui » n'est pas un contrôle, c'est une formalité.
//
// La seule question posée est un RÉGLAGE de l'envoi : une date, ou deux ? Sa
// réponse déclenche tout le reste.

// **Ce qui s'arrête ici, et ce qui se répare ici.**
//
// Le patron, le 11 août 2026, capture à l'appui : *« l'encart qui permet
// d'envoyer aux clients par SMS, par e-mail, a disparu. »* Il ne voyait plus
// que « Indiquez d'abord comment joindre ce client — sur sa fiche », et un
// bouton grisé.
//
// **C'était un cul-de-sac, et il s'est refermé le soir même.** L'écran
// « Informations » — le seul endroit où saisir le téléphone ou l'e-mail d'un
// client — a quitté le tiroir de la fiche quelques heures plus tôt, à sa
// demande. La phrase renvoyait donc vers une porte qui n'existe plus, et un
// chantier né d'une dictée (client « non renseigné ») ne pouvait plus jamais
// partir.
//
// Le dépôt avait pourtant déjà tranché ce point exact le 4 août, pour l'écran
// d'après : *« si la coordonnée manque, elle se saisit sur place — il n'existe
// aucun autre écran pour la renseigner, et renvoyer le patron sur la fiche du
// client l'enverrait vers une porte qui n'existe pas »* (`TransmettreAuClient`).
// La règle valait ici aussi. Elle y est.
//
// Reste `devis_absent`, qui n'est pas du même ordre : rien à saisir ne le
// résout, et il ne se produit pas depuis ce chemin.
const MESSAGES_BLOCAGE: Record<string, string> = {
  canal_absent: "Comment joindre ce client ?",
  coordonnee_absente: "Il manque la coordonnée pour ce canal.",
  devis_absent: "Aucun devis à envoyer pour ce chantier.",
  // **Son défaut du 23 août 2026**, et il était sans garde-fou : *« le devis
  // part à zéro euro chez la cliente, alors qu'il y a un arbre à tailler et un
  // à démonter »*. Le texte vient de `src/lib/devis-envoyable.ts` — la même
  // phrase qu'emploie le refus du serveur, jamais une recopie qui divergerait.
  devis_vide: MOTIF_DEVIS_VIDE,
};

/**
 * Une date, ou deux — jamais trois (`docs/AGENT.md` §2.2).
 *
 * Le nombre vit ici et la RÈGLE dans `src/lib/calendrier.ts` : au-delà du
 * maximum, c'est le plus ancien choix qui cède la place, plutôt qu'un bouton
 * qui ne répond pas — ce qui se lit comme une panne.
 */
const DATES_AU_MAXIMUM = 2;

/**
 * Le retrait bas de la feuille de la maison — `pb-9` dans `BottomSheet`.
 *
 * Il est recopié ici parce que le pied collé doit l'annuler pour venir au ras
 * du bas : c'est une valeur de `BottomSheet`, pas de cet écran. Si elle change
 * là-bas, `scripts/test-feuille-envoi-lisible-e2e.ts` rougit — c'est ce qui empêche les
 * deux de diverger en silence (`CLAUDE.md` §3).
 */
const RETRAIT_BAS_FEUILLE = 36;

const LIBELLE_CANAL = {
  sms: { titre: "Par SMS", champ: "Numéro de téléphone", exemple: "06 12 34 56 78" },
  email: { titre: "Par e-mail", champ: "Adresse e-mail", exemple: "client@exemple.fr" },
} as const;

/**
 * « 1 journée », « ½ journée » — le mot de la molette, pas une seconde
 * rédaction.
 *
 * La ligne repliée doit dire EXACTEMENT ce que la molette dirait une fois
 * ouverte : deux formulations de la même durée, et il croirait avoir changé
 * quelque chose en dépliant. La liste est celle de `durees-chantier.ts`, la
 * seule (`CLAUDE.md` §3).
 *
 * Le repli n'est proposé que sur une durée connue ; une valeur hors liste
 * retombe sur les demi-journées plutôt que sur du vide.
 */
function libelleDuree(demiJournees: number): string {
  return (
    DUREES.find((d) => d.demiJournees === demiJournees)?.libelle ??
    `${demiJournees} demi-journées`
  );
}

type Props = {
  chantierId: string;
  devisId: string;
  clientNom: string;
  ouvert: boolean;
  onFermer: () => void;
  /**
   * Rend **ce que le serveur vient de valider**, pas seulement le lien.
   *
   * Le canal et le destinataire sont relus en base au moment de l'envoi
   * (`preparerEnvoi`). Les transmettre ici évite que l'écran d'appel ne
   * retombe sur une valeur chargée avec la page — c'est le défaut du 20 août
   * 2026 : le patron avait choisi l'e-mail sur la fiche de son client, et
   * c'est le SMS qui s'ouvrait.
   */
  onEnvoye: (envoi: { lien: string; canal: "sms" | "email"; destinataire: string | null }) => void;
};

// La feuille ne fait que monter et démonter son contenu. C'est ce qui garantit
// que les jours libres sont relus À CHAQUE ouverture : un état conservé entre
// deux ouvertures afficherait des disponibilités déjà périmées.
export default function EnvoiAuClient({ ouvert, onFermer, ...reste }: Props) {
  return (
    <BottomSheet open={ouvert} onBackdropClick={onFermer}>
      <Contenu {...reste} onFermer={onFermer} />
    </BottomSheet>
  );
}

function Contenu({
  chantierId,
  devisId,
  clientNom,
  onFermer,
  onEnvoye,
}: Omit<Props, "ouvert">) {
  // Ce que l'action rend : la préparation, ET le planning qui va avec — c'est
  // lui qui peint les journées (`preparerEnvoiAction`).
  const [preparation, setPreparation] =
    useState<Awaited<ReturnType<typeof preparerEnvoiAction>> | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  /**
   * Le client peut-il proposer une AUTRE date ? Sa demande du 17 août 2026.
   *
   * **Ouvert par défaut**, parce que c'est ce que l'application faisait depuis
   * toujours : un défaut fermé changerait sans un mot ce qu'il croit envoyer.
   * Le choix est figé dans l'envoi — l'écran du client dira demain ce qu'il dit
   * aujourd'hui.
   */
  const [autreDateAutorisee, setAutreDateAutorisee] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // `undefined` tant que le patron n'a rien corrigé : le serveur déduit alors
  // la durée de la dictée. Une valeur ici veut dire « c'est lui qui a tranché ».
  const [dureeChoisie, setDureeChoisie] = useState<number | undefined>(undefined);
  // La molette de durée est repliée à l'ouverture (sa réponse « la B » du
  // 4 septembre 2026) et ne se referme plus une fois ouverte.
  const [dureeDepliee, setDureeDepliee] = useState(false);
  // **Le dernier jour INTERROGÉ au calendrier, et ce que le serveur en a dit.**
  //
  // Il ne porte plus la sélection — c'était le défaut du 12 août 2026, signalé
  // par le patron : *« dès que je choisis à même le planning, je ne peux
  // choisir qu'un seul jour. Or je dois pouvoir proposer deux jours au
  // client. »* Cet état était une chaîne unique, et le calendrier n'en
  // recevait qu'un seul jour à marquer : choisir un second effaçait le premier
  // sous ses yeux. Il n'avait aucune raison de croire que les deux étaient
  // retenus — et rappuyer sur le premier pour le retirer le remettait au lieu
  // de l'enlever.
  //
  // **`selection` fait foi, et elle seule.** Ce qui reste ici ne sert qu'à
  // afficher la phrase du serveur sous le calendrier.
  const [jourInterroge, setJourInterroge] = useState("");
  const [verdict, setVerdict] = useState<VerdictJour | null>(null);
  const [verification, setVerification] = useState(false);
  /**
   * Le dernier jour touché, hors du cycle de rendu.
   *
   * Il ne s'affiche nulle part : il sert à jeter le verdict d'une case qu'il a
   * déjà quittée. Un `useState` ne conviendrait pas — la fonction qui attend le
   * serveur lirait la valeur figée au moment de son appel.
   */
  const dernierTouche = useRef("");
  /**
   * Le mois affiché.
   *
   * **`null` tant que la préparation n'est pas là**, pour partir sur le mois
   * d'aujourd'hui sans qu'un premier rendu montre janvier 1970.
   */
  const [curseur, setCurseur] = useState<{ annee: number; mois: number } | null>(null);

  /**
   * La charge des journées, calculée comme au planning — jamais une seconde
   * fois (`useOccupation`). Le planning descend avec la préparation
   * (`preparerEnvoiAction`) : sans lui, l'écran peindrait un mois vide et
   * annoncerait libre ce que l'envoi refuse.
   */
  // Lu une fois : la liste des dates retenues l'interroge pour chaque ligne, et
  // le relire dans la boucle n'aurait pas la même valeur si la préparation
  // changeait entre deux lignes.
  const nombreEquipes = preparation?.planning.nombreEquipes ?? 1;
  // **Les deux compteurs, depuis le 26 août 2026** : celui des équipes plafonne
  // la charge, celui des salariés décide des noms écrits sur une journée.
  const nombreSalaries = preparation?.planning.nombreSalaries ?? 0;
  const { occupationDe, nomEquipe } = useOccupation({
    chantiers: preparation?.planning.chantiers ?? [],
    nombreEquipes,
    nombreSalaries,
    absences: preparation?.planning.absences ?? [],
    equipesNommees: preparation?.planning.equipesNommees ?? [],
  });
  // Le canal et la coordonnée saisis ici même, quand ils manquent. `rejouer`
  // relance la préparation après l'enregistrement : sans lui, l'écran garderait
  // le blocage qu'on vient de lever.
  const [canalChoisi, setCanalChoisi] = useState<"sms" | "email">("sms");
  const [coordonnee, setCoordonnee] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);
  const [rejouer, setRejouer] = useState(0);

  useEffect(() => {
    let annule = false;
    preparerEnvoiAction(chantierId, dureeChoisie)
      .then((p) => {
        if (annule) return;
        setPreparation(p);
        // Le mois d'aujourd'hui, posé une seule fois : le rappel de la
        // préparation à chaque changement de durée ne doit pas ramener le
        // patron de mars à août pendant qu'il cherche une date.
        setCurseur((c) => {
          if (c) return c;
          const d = new Date(`${jourIso(new Date())}T12:00:00Z`);
          return { annee: d.getUTCFullYear(), mois: d.getUTCMonth() };
        });
        // Pré-sélection du premier jour libre : dans la majorité des cas c'est
        // celui que le patron retiendra, et il reste libre de le décocher.
        // Recalculée à chaque changement de durée : garder une date qui ne tient
        // plus l'aurait fait refuser à l'envoi, sans qu'il comprenne pourquoi.
        setSelection(p.joursLibres.slice(0, 1));
      })
      .catch(() => {
        if (!annule) setErreur("Impossible de préparer l'envoi pour l'instant.");
      });
    return () => {
      annule = true;
    };
  }, [chantierId, dureeChoisie, rejouer]);

  /**
   * Enregistre le canal et la coordonnée, puis relance la préparation.
   *
   * Le client est mis à jour pour de bon — pas seulement pour cet envoi : c'est
   * la même information que la fiche porterait, et la saisir deux fois serait
   * la saisir une fois de trop.
   */
  async function enregistrerContact() {
    const valeur = coordonnee.trim();
    if (!valeur || !preparation?.clientId) return;
    setEnregistrement(true);
    setErreur(null);
    try {
      const r = await enregistrerCoordonneeClientAction(preparation.clientId, canalChoisi, valeur);
      if (!r.succes) {
        setErreur("Cette coordonnée n'a pas pu être enregistrée. Vérifiez-la et réessayez.");
        return;
      }
      setPreparation(null);
      setRejouer((n) => n + 1);
    } catch {
      setErreur("L'enregistrement n'a pas abouti — vérifiez votre réseau et réessayez.");
    } finally {
      setEnregistrement(false);
    }
  }

  /**
   * Ajoute ou retire un jour de la sélection.
   *
   * La règle « une ou deux, jamais plus » n'est PAS écrite ici : elle vit dans
   * `src/lib/calendrier.ts`, où elle est éprouvée sans navigateur et où le
   * serveur la retrouvera. Elle l'était en double jusqu'au 12 août 2026 — deux
   * copies d'une même règle finissent toujours par diverger, et l'écart se voit
   * chez le client.
   */
  function basculer(jour: string) {
    setSelection((actuelle) => basculerJour(actuelle, jour, DATES_AU_MAXIMUM));
  }

  /**
   * Un jour TOUCHÉ au calendrier : il s'ouvre, et il se propose du même geste.
   *
   * **Sa demande du 25 août 2026 :** *« je dois pouvoir sélectionner les jours
   * juste en les touchant, pas besoin de cliquer sur proposer »*.
   *
   * Les deux gestes avaient été séparés le 22 août, pour qu'il puisse
   * CONSULTER une journée chargée sans l'engager (planche 91). La consultation
   * demeure — la fiche s'ouvre dessous et dit qui est déjà là —, mais elle
   * n'engage plus rien : c'est la case qui engage, et un jour touché par
   * erreur se retire du même doigt, sa case s'éteignant sous ses yeux. Le
   * bouton, lui, coûtait un second geste par date et sur chaque devis.
   *
   * Trois partis pris, et aucun n'est indifférent :
   *
   * 1. **le retrait ne se fait pas attendre.** Le jour est déjà passé par le
   *    serveur pour entrer ; le redemander pour sortir serait attendre pour
   *    rien, et une case qui met une seconde à s'éteindre se retouche.
   * 2. **l'ajout, si.** Le calendrier ne connaît que la fenêtre proche ;
   *    au-delà, seul `verifierJourPropose` sait si la journée tient. Proposer
   *    un jour que l'envoi refuserait ensuite coûte un aller-retour au client.
   * 3. **un verdict en retard ne retient plus rien.** Deux cases touchées coup
   *    sur coup — ce qui est le geste ordinaire quand on cherche deux dates —,
   *    et la réponse de la première reviendrait cocher un jour qu'il a quitté.
   */
  async function toucherLeJour(jour: string) {
    const retirer = selection.includes(jour);
    dernierTouche.current = jour;
    setJourInterroge(jour);
    setVerdict(null);
    setVerification(true);
    if (retirer) basculer(jour);
    try {
      const rendu = await verifierJourProposeAction(chantierId, jour, preparation?.dureeDemiJournees);
      if (dernierTouche.current !== jour) return;
      setVerdict(rendu);
      // Un jour refusé se REGARDE quand même : la fiche dit pourquoi, la case
      // reste éteinte. C'est ce qui reste du geste en deux temps.
      if (!retirer && rendu.retenable) basculer(jour);
    } catch {
      if (dernierTouche.current !== jour) return;
      setVerdict({
        jour,
        retenable: false,
        raison: "Impossible de vérifier cette date pour l'instant. Réessayez.",
        alternative: null,
      });
    } finally {
      if (dernierTouche.current === jour) setVerification(false);
    }
  }

  async function confirmer() {
    if (selection.length === 0) {
      setErreur("Proposez au moins une date d'intervention.");
      return;
    }
    setEnCours(true);
    setErreur(null);
    try {
      const r = await envoyerAuClientAction(
        chantierId,
        devisId,
        [...selection].sort(),
        preparation?.dureeDemiJournees,
        autreDateAutorisee
      );
      if (!r.succes) {
        setErreur(r.erreur);
        return;
      }
      onEnvoye({ lien: r.lien, canal: r.canal, destinataire: r.destinataire });
    } catch (e) {
      // **La phrase de secours, et seulement elle.** L'action rend désormais sa
      // raison plutôt que de lancer (`actions.ts`) : arriver ici signifie que
      // la requête elle-même n'a pas abouti — réseau coupé, serveur en train de
      // se recompiler. On le dit, plutôt que d'accuser l'envoi.
      setErreur(
        e instanceof Error && e.message
          ? `L'envoi n'a pas abouti : ${e.message.slice(0, 160)}`
          : "L'envoi n'a pas abouti — la réponse n'est pas revenue. Vérifiez votre réseau et réessayez."
      );
    } finally {
      setEnCours(false);
    }
  }

  /**
   * **Le seul cas où l'écran apprend quelque chose sur la durée.**
   *
   * Les deux phrases qui l'entouraient sont parties le 26 août 2026, à sa
   * demande : « Repris de votre dictée. Corrigez-le si besoin… » et « Votre
   * client ne verra que la date… ». Une molette qu'on peut tourner n'a pas
   * besoin qu'on écrive dessous qu'elle se tourne.
   *
   * Celle-ci reste, et elle se montre **repliée comme dépliée** : elle parle du
   * chantier, pas de la molette. Sans elle, il s'étonnerait de ne plus rien
   * pouvoir proposer pendant un mois.
   */
  const aideDuree =
    preparation && preparation.dureeDemiJournees > 6
      ? `${preparation.dureeDemiJournees / 2} jours ouvrés d'affilée seront réservés à partir de la date retenue.`
      : "";

  const blocage = preparation?.blocage ? MESSAGES_BLOCAGE[preparation.blocage] : null;
  // Deux des trois blocages se lèvent d'une saisie ici même. `devis_absent`,
  // non : rien à écrire ne le résout.
  const reparable =
    preparation?.blocage === "canal_absent" || preparation?.blocage === "coordonnee_absente";

  return (
    <>
      <p className="mb-1 text-center text-[16px]" style={{ color: colors.ink, fontFamily: font.display }}>
        Envoyer à {clientNom}
      </p>

      {/* **Le gris des méta a cédé la place à l'encre douce — 4 septembre 2026.**
          `colors.muted` tient 2,85 à 3,59 de contraste sur les six chartes
          claires, pour un seuil de 4,5 : c'était la seule chose écrite à
          l'écran pendant l'attente, et la première à disparaître au soleil.
          `inkSoft` en tient 6,6 à 10,4 partout. Le jeton lui-même n'est pas
          touché — il sert dans trois cents endroits, et le changer serait un
          changement d'identité, pas un correctif d'écran (`TODO.md`). */}
      {!preparation && !erreur && (
        <p className="my-6 text-center text-[13px]" style={{ color: colors.inkSoft }}>
          Préparation…
        </p>
      )}

      {preparation && blocage && (
        <p className="mb-3 mt-4 text-center text-[13px]" style={{ color: colors.ink }}>
          {blocage}
        </p>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          **LE DEVIS VIDE AVAIT SA RAISON, PAS SON GESTE — 4 septembre 2026.**

          Le garde-fou du 23 août fait son travail : un devis sans ligne ne part
          pas. Mais l'écran disait *« Posez d'abord vos prix sur ce chantier »*
          et n'offrait **aucune porte** — un bouton éteint et « Annuler ». Il
          fallait refermer la feuille, sortir du devis, retrouver l'écran des
          prix.

          **C'est exactement le cul-de-sac qu'il a fait fermer le 11 août** pour
          la coordonnée manquante (commentaire en tête de ce fichier). Le
          raisonnement d'alors visait `devis_absent` — « rien à saisir ne le
          résout, et il ne se produit pas depuis ce chemin » — et il est juste
          pour celui-là. Il ne l'était pas pour `devis_vide`, qui s'atteint en
          TROIS GESTES depuis le chemin ordinaire : créer un chantier, « Écrire
          le devis », « Choisir la date ».

          **La phrase ne bouge pas d'un mot**, et c'est délibéré : elle vient de
          `MOTIF_DEVIS_VIDE`, celle-là même que le serveur oppose au refus. En
          écrire une version courte pour l'écran donnerait deux rédactions du
          même refus, qui divergeraient au premier ajustement (`CLAUDE.md` §3).
          Elle nomme le geste ; ce bouton le fait.
          ═══════════════════════════════════════════════════════════════════ */}
      {preparation?.blocage === "devis_vide" && (
        <div className="mb-4 flex justify-center">
          <Link
            href={`/chantiers/${chantierId}/prix`}
            data-atlas="aller-aux-prix"
            className="rounded-full px-6 py-3 text-[15px] font-medium"
            style={{ backgroundColor: colors.rustTint, color: colors.rust }}
          >
            Poser mes prix
          </Link>
        </div>
      )}

      {/* **On répare, on ne renvoie pas ailleurs.** Les deux voies sont offertes
          et la coordonnée se saisit ici : c'est le seul endroit atteignable
          depuis un chantier dicté, dont le client reste « non renseigné ». */}
      {preparation && reparable && (
        <div className="mb-5">
          {/* ═══════════════════════════════════════════════════════════════
              **LA CAPSULE DE LA MAISON, ET PLUS UNE COPIE — 4 septembre 2026.**

              Les deux capsules étaient redessinées ici, alors que `ChoixCanal`
              existe depuis le 22 août et sert au nouveau chantier comme à la
              facture. La copie ne marquait l'actif que par la COULEUR DU TEXTE
              — `rust` contre `ink`.

              **Or `rust` ET `ink` valent EXACTEMENT la même couleur sur cinq
              chartes — pierre, beurre, moka, sylve, nuit —, et les deux fonds
              tiennent 1,04 à 1,29 de contraste.** Les deux capsules étaient
              donc rigoureusement INDISCERNABLES sur cinq écrans sur huit : le
              patron ne pouvait pas savoir par où son devis allait partir.
              *(Le premier diagnostic n'avait vu que les deux sombres ; c'est le
              contrôle qui les a comptées.)* C'est la famille de sa
              capture du 22 août — *« le mode nuit est illisible »* —, et elle a
              survécu ici précisément parce que la pièce avait été recopiée au
              lieu d'être employée (`CLAUDE.md` §3).

              La pièce de la maison marque l'actif d'un **liseré d'or**, qui ne
              dépend d'aucune clarté et tient donc sur les huit chartes.

              `disponible` vaut toujours vrai : ailleurs il dit « ce canal n'a
              pas de coordonnée » ; ICI c'est justement la coordonnée qu'on
              saisit, et éteindre les deux capsules fermerait la seule porte.
              ═══════════════════════════════════════════════════════════════ */}
          <div className="mb-2.5 flex gap-2">
            {(["sms", "email"] as const).map((c) => (
              <ChoixCanal
                key={c}
                libelle={LIBELLE_CANAL[c].titre}
                actif={canalChoisi === c}
                disponible
                onClick={() => setCanalChoisi(c)}
              />
            ))}
          </div>

          <input
            value={coordonnee}
            onChange={(e) => setCoordonnee(e.target.value)}
            // Le clavier du téléphone suit le canal : composer un numéro sur un
            // clavier de texte est une corvée qu'on peut simplement éviter.
            type={canalChoisi === "sms" ? "tel" : "email"}
            inputMode={canalChoisi === "sms" ? "tel" : "email"}
            autoComplete={canalChoisi === "sms" ? "tel" : "email"}
            aria-label={LIBELLE_CANAL[canalChoisi].champ}
            placeholder={LIBELLE_CANAL[canalChoisi].exemple}
            // L'exemple se lisait dans le gris du navigateur, qui n'est d'aucune
            // charte. Le repère sert à `globals.css`, seul endroit d'où l'on
            // puisse viser `::placeholder` — jamais lu par le produit.
            data-atlas="coordonnee-client"
            className="w-full rounded-[4px] px-3.5 py-3 text-[16px] outline-none"
            style={{ backgroundColor: colors.card, color: colors.ink }}
          />

          <button
            type="button"
            onClick={enregistrerContact}
            disabled={enregistrement || !coordonnee.trim() || !preparation.clientId}
            className="mt-2.5 w-full rounded-full py-3 text-[15px] font-medium disabled:opacity-50"
            style={{ backgroundColor: colors.card, color: colors.rust }}
          >
            {enregistrement ? "Enregistrement…" : "Enregistrer et continuer"}
          </button>

          {/* Sans client rattaché, il n'y a rien à mettre à jour : le dire, au
              lieu d'offrir un champ qui ne mènerait nulle part. */}
          {!preparation.clientId && (
            <p className="mt-2 text-center text-[12px]" style={{ color: colors.inkSoft }}>
              Ce chantier n&apos;a pas encore de client. Ouvrez le devis pour lui donner un nom,
              puis revenez ici.
            </p>
          )}
        </div>
      )}

      {preparation && !blocage && (
        <>
          {/* **« Par SMS au 06… » est parti — sa demande du 26 août 2026.**

              Ce qu'on perd, et qu'il faut savoir avant de le rétablir : il ne
              voit plus par quel canal ni à quel numéro le devis part, avant
              d'ouvrir sa messagerie. Elle le lui montre juste après, et il peut
              encore reculer — rien n'est envoyé par Atlas. C'est le MÊME
              arbitrage qu'il a rendu le 24 août sur l'écran de la facture
              (`TransmettreLaFacture`), et pour la même raison. */}

          {/* La durée n'est pas une seconde question — c'est le réglage qui
              décide quels jours sont proposables. Une demi-journée tient là où
              une journée entière ne tient plus, et le patron le sait mieux que
              sa dictée. Elle reste chez lui : son client ne verra qu'une date.

              L'arrêt reste unique (`docs/AGENT.md` §2.2) : la question posée est
              toujours « une date, ou deux ? ». Ceci en est le préalable. */}
          {/* ═══════════════════════════════════════════════════════════════
              **LA DURÉE SE REPLIE — 4 septembre 2026, sa réponse « la B ».**

              Neuf fois sur dix elle est déjà juste et il ne la touche pas ; elle
              prenait pourtant 96 px tout en haut, avant le calendrier — sur une
              feuille de 882 px pour 584 px d'écran.

              **Elle ne DESCEND pas pour autant, et c'est un refus assumé :**
              c'est elle qui décide quels jours sont proposables. Posée après le
              calendrier, elle arriverait trop tard. Repliée, elle reste au même
              endroit et dit la même chose en une ligne.

              **Ce qui reste visible même repliée** : la valeur, parce que c'est
              elle qu'il vérifie du coin de l'œil ; et la phrase du chantier
              long, parce qu'elle parle du CHANTIER et non de la molette — sans
              elle il s'étonnerait de ne plus rien pouvoir proposer pendant un
              mois.

              Une fois ouverte, elle le reste : refermer sous son doigt après
              qu'il a corrigé serait lui reprendre ce qu'il vient de régler.
              ═══════════════════════════════════════════════════════════════ */}
          <div className="mb-4">
            {!dureeDepliee && (
              <div
                className="flex items-baseline justify-between pb-2.5"
                style={{ borderBottom: `1px solid ${colors.lineSoft}` }}
              >
                <span className="text-[15px]" style={{ color: colors.ink }}>
                  {libelleDuree(preparation.dureeDemiJournees)}
                </span>
                <button
                  type="button"
                  data-atlas="changer-duree"
                  onClick={() => setDureeDepliee(true)}
                  className="py-1 text-[13px] font-medium"
                  style={{ color: colors.rust }}
                >
                  changer
                </button>
              </div>
            )}
            {!dureeDepliee && aideDuree && (
              <p className={`mt-2 ${texteSituation}`} style={{ color: colors.inkSoft }}>
                {aideDuree}
              </p>
            )}
            {dureeDepliee && (
            <BandeDuree
              label="Ce chantier prend"
              valeur={preparation.dureeDemiJournees}
              onChange={setDureeChoisie}
              /* **Les deux phrases d'explication sont parties le 26 août 2026**,
                 à sa demande : « Repris de votre dictée. Corrigez-le si
                 besoin… » et sa sœur « Votre client ne verra que la date… ».
                 Une molette qu'on peut tourner n'a pas besoin qu'on écrive
                 dessous qu'elle se tourne.

                 **Ce qui RESTE est le seul cas où l'écran apprend quelque
                 chose** : un chantier long réserve beaucoup de jours d'affilée.
                 C'est juste, et invisible — sans cette phrase, il s'étonnerait
                 de ne plus rien pouvoir proposer pendant un mois. */
              aide={aideDuree}
            />
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════
              **LA LISTE DES SIX JOURS SUGGÉRÉS A ÉTÉ RETIRÉE.**

              *Sa demande du 23 août 2026 :* « mets le calendrier directement
              sous le nombre de jours que prend le chantier ; les quelques jours
              qu'on peut sélectionner au tout début ne servent plus à rien,
              maintenant qu'on a le mois complet ».

              Elle date du 8 août, quand l'écran ne montrait QUE six jours ouvrés
              et qu'aucun autre choix n'existait — *« comment je fais si je dois
              lui proposer une date dans six mois ? »*. Le calendrier complet est
              arrivé le 9 ; depuis, la liste ne faisait que redire ses six
              premières cases, deux gestes plus haut.

              **Ce qu'elle portait et qui ne se perd pas :** la phrase « aucun
              jour ne peut accueillir cette durée dans les trois prochains mois »
              devenait muette dès qu'un seul jour tenait. Le calendrier, lui,
              grise ce qui ne tient pas, sur dix-huit mois — et
              `verifierJourPropose` prévient à l'appui, en nommant le premier
              jour possible.
              ═══════════════════════════════════════════════════════════ */}

          {/* **Une date à soi, jusqu'à dix-huit mois.**

              Le patron, le 8 août 2026 : « la proposition des dates au client,
              on a une visibilité que sur une semaine. Comment je fais si je dois
              lui proposer une date dans six mois ? » La liste ci-dessus reste
              le geste ordinaire — un appui — et ceci est la sortie de secours,
              pour une haie « à l'automne prochain » ou un chantier calé après
              la saison.

              **Un vrai calendrier depuis le 9 août 2026**, à sa demande :
              « passe au calendrier pour le choix des dates à proposer au
              client ». Le champ natif ouvrait bien la molette du téléphone,
              mais il ne savait pas GRISER les jours pris — le patron y voyait
              un mois de cases identiques, dont certaines impossibles.

              Le même composant que chez le client, et c'est délibéré : deux
              calendriers écrits séparément finiraient par ne pas griser les
              mêmes jours, et l'écart se verrait chez le client.

              **Ce que le calendrier ne peut pas savoir, le serveur le dit.**
              Les jours occupés ne sont chargés que sur la fenêtre proche ; au
              delà, seul `verifierJourPropose` sait si la journée tient. Le
              calendrier propose donc, et le serveur tranche — c'est déjà ce
              qu'il faisait, et le retirer rendrait le geste plus joli et moins
              sûr. */}
          <div className="mb-4">
            {/* **La phrase DIT CE QU'IL PEUT FAIRE, elle ne le demande pas.**

                *Sa demande du 23 août 2026 :* « au lieu de marquer "ou une
                autre date", marque quelque chose qui stipule que l'utilisateur
                peut choisir, peut proposer deux jours ».

                « Ou une autre date » n'avait plus d'« autre » que quoi, la liste
                des six jours retirée. Et « Une date, ou deux au choix du
                client ? » restait une question posée à lui — on lui demandait ce
                qu'on devait justement lui apprendre : qu'il a droit à deux.

                **Le repère `data-atlas` est là pour les suites**, qui visaient
                ce libellé mot pour mot : trois d'entre elles se seraient cassées
                sur un changement de formulation qu'il a demandé
                (`CLAUDE.md` §5 bis). */}
            <p
              data-atlas="invite-dates"
              className={smallCaps}
              style={{ color: colors.muted, marginBottom: 6 }}
            >
              Proposez une ou deux dates
            </p>
            {/* **LE CALENDRIER DU PLANNING, et plus un calendrier nu** — sa
                demande du 22 août 2026, validée sur planche 91 : *« on devrait
                avoir le visuel du calendrier qui se trouve dans la catégorie
                planning, avec la possibilité de cliquer sur les jours pour voir
                quels chantiers y sont déjà affectés — comme ça on peut savoir
                si oui ou non on peut rajouter des clients sur les jours »*,
                puis *« cette maquette est parfaite, tu peux coder ça trait pour
                trait, ne change rien »*.

                Le calendrier d'avant montrait des ronds et éteignait les jours
                impossibles **sans jamais dire pourquoi ni ce qu'ils
                portaient** : impossible de juger si l'on pouvait quand même s'y
                glisser.

                **C'est le MÊME composant que le planning** (`MoisCharge`), et
                la MÊME charge (`useOccupation`) : deux dessins ou deux calculs
                écrits séparément ne peindraient plus la même journée à deux
                écrans d'écart (`CLAUDE.md` §3).

                **Ce que le calendrier ne peut pas savoir, le serveur le dit.**
                Il peint la charge des douze mois chargés ; c'est
                `verifierJourPropose` qui tranche, y compris au-delà. Le
                calendrier montre donc, et le serveur décide — le retirer
                rendrait le geste plus joli et moins sûr. */}
            <div className="rounded-[10px] px-3 py-3" style={{ backgroundColor: colors.card }}>
              {curseur && (
                <MoisCharge
                  curseur={curseur}
                  setCurseur={(maj) => setCurseur((c) => (c ? maj(c) : c))}
                  aujourdHui={jourIso(new Date())}
                  jourTouche={jourInterroge || null}
                  onToucherJour={toucherLeJour}
                  occupationDe={occupationDe}
                  jourRetenus={selection}
                  reperePrefixe="envoi-"
                />
              )}
            </div>

            {/* **La fiche du jour, directement sous le calendrier** — le cœur
                de sa demande : qui est déjà là, à quelle demi-journée, avec
                quelle équipe, et s'il reste de la place pour CE client-ci. */}
            {jourInterroge && (
              <JourneeRegardee
                jour={jourInterroge}
                occupationDe={occupationDe}
                nomEquipe={nomEquipe}
                verdict={verification || !verdict ? null : verdict}
                dejaRetenu={selection.includes(jourInterroge)}
                nombreEquipes={nombreEquipes}
              />
            )}

            {/* Un jour refusé sans un mot renvoie au téléphone. On propose le
                jour libre le plus proche — chercher à l'aveugle dans dix-huit
                mois de calendrier n'est pas un travail. */}
            {!verification && verdict?.alternative && (
              <p className="mt-1.5 text-center text-[13px]" style={{ color: colors.muted }}>
                <button
                  type="button"
                  onClick={() => toucherLeJour(verdict.alternative!)}
                  className="font-medium underline"
                  style={{ color: colors.rust }}
                >
                  {/* **« Voir » serait devenu un mensonge le 25 août 2026** :
                      ce lien fait exactement ce que fait la case du calendrier,
                      et la case propose maintenant. Un bouton qui engage une
                      date sous un mot qui promet de regarder, c'est le défaut
                      que le geste en deux temps prétendait éviter. */}
                  Proposer le {jourLisible(verdict.alternative)}
                </button>
              </p>
            )}
          </div>

          {/* **CE QU'IL PROPOSE, ÉCRIT EN TOUTES LETTRES.**

              Ce rappel ne montrait que les dates prises HORS de la liste des six
              — les seules qui, sinon, ne se voyaient nulle part. La liste
              retirée le 23 août, ce sont TOUTES les dates retenues qui ne se
              lisent plus qu'à la marque d'une case de calendrier. Envoyer un
              devis en ayant compté des cases n'est pas la même chose que
              l'envoyer en ayant lu « vendredi 28 août ».

              Chaque ligne se retouche : c'est aussi le moyen de retirer une date
              sans repartir chercher sa case dans le mois. */}
          {selection.length > 0 && (
            <div className="mb-4 flex flex-col gap-1.5">
              {[...selection]
                .sort()
                .map((jour) => (
                  <button
                    key={jour}
                    type="button"
                    onClick={() => basculer(jour)}
                    aria-pressed
                    className="flex items-center justify-between rounded-full px-4 py-3 text-[15px]"
                    style={{ backgroundColor: colors.rustTint, color: colors.ink }}
                  >
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block">{jourLisible(jour)}</span>
                      {/* **CE QUI RESTE D'ÉQUIPES CE JOUR-LÀ — sa réponse B du
                          25 août 2026** (planche 88).

                          Sa colère du 22 août : *« je peux proposer le 24 alors
                          qu'un client a validé le 24 »*. Le défaut de code a été
                          réparé le jour même ; ce qui restait n'en était pas un
                          — avec deux équipes, un jour à moitié pris reste
                          proposable, et c'est voulu. Mais rien ne le disait.

                          **Et le libellé n'est pas celui de la planche.** Elle
                          proposait « 1 chantier sur 2 équipes » ; il a répondu
                          *« on ne comprend pas très bien »*, et il a raison :
                          cela compte ce qui est PRIS quand ce qu'il décide
                          dépend de ce qui RESTE. La règle vit dans
                          `planning-jour.ts` — une phrase écrite ici serait une
                          seconde rédaction, invérifiable sans navigateur
                          (`CLAUDE.md` §3).

                          **Ici, et pas sur la case du calendrier.** C'est la
                          liste de ce qu'il s'apprête à ENVOYER : c'est le
                          dernier endroit où il peut retirer une date, et le seul
                          qu'il relit avant de partir. */}
                      {(() => {
                        const reste = ditCeQuiResteCeJour(
                          equipesLibresCeJour(
                            occupationDe(jour, "matin").charge,
                            occupationDe(jour, "apres_midi").charge,
                            nombreEquipes
                          ),
                          nombreEquipes
                        );
                        return reste ? (
                          <span
                            data-atlas="reste-equipes"
                            className="mt-0.5 block text-[12px]"
                            style={{ color: colors.inkSoft }}
                          >
                            {reste}
                          </span>
                        ) : null;
                      })()}
                    </span>
                    <span className="ml-3 shrink-0 text-[13px] font-medium" style={{ color: colors.rust }}>
                      proposée
                    </span>
                  </button>
                ))}
            </div>
          )}

          {/* **Sa demande du 17 août 2026 :** *« il faut que l'utilisateur
              puisse choisir avant d'envoyer s'il autorise ou non le client à
              choisir une date si celles proposées ne lui conviennent pas »*.

              Posé ICI, sous les dates et avant le bouton : c'est le dernier
              regard avant l'envoi, et la phrase en dessous change avec lui —
              sans quoi il enverrait sans savoir ce que son client va voir. */}
          {/* **La ligne n'est pas un bouton, l'interrupteur en est un** — c'est
              la forme des réglages (`NotificationsClient`), et c'est aussi ce
              que le dépôt exige : toute action ronde, jamais un rectangle. */}
          <div
            className="mb-3 flex items-start gap-3 rounded-2xl px-4 py-3"
            style={{ backgroundColor: colors.card, border: `1px solid ${colors.lineSoft}` }}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[15px]" style={{ color: colors.ink }}>
                Il peut proposer une autre date
              </span>
              <span className="mt-0.5 block text-[12px] leading-[1.45]" style={{ color: colors.inkSoft }}>
                {autreDateAutorisee
                  ? "Un calendrier de vos jours libres s'ouvrira sous vos dates."
                  : "Il choisira uniquement parmi vos dates, ou demandera une correction."}
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={autreDateAutorisee}
              aria-label="Il peut proposer une autre date"
              onClick={() => setAutreDateAutorisee((ouvert) => !ouvert)}
              // 28 × 48, comme partout ailleurs : la pièce se reconnaît d'un
              // écran à l'autre, et le pouce la trouve sans regarder.
              className="relative mt-0.5 h-[28px] w-[48px] flex-none rounded-full transition-colors"
              style={{
                backgroundColor: autreDateAutorisee ? colors.rust : colors.line,
                boxShadow: autreDateAutorisee ? "none" : `inset 0 0 0 1px ${colors.line}`,
              }}
            >
              <span
                aria-hidden="true"
                className="absolute top-[3px] h-[22px] w-[22px] rounded-full transition-all"
                style={{ backgroundColor: colors.card, left: autreDateAutorisee ? 23 : 3 }}
              />
            </button>
          </div>

          {/* **La phrase qui vivait ici est partie — sa demande du 26 août
              2026.** Elle disait pour la TROISIÈME fois ce que l'écran montre
              déjà : les dates retenues sont listées juste au-dessus, et
              l'interrupteur porte son propre sous-titre, qui change avec lui.
              Une phrase qui décrit le bouton d'à côté est du bruit
              (`CLAUDE.md` §3).

              **Les trois autres formulations partent avec elle**, et c'est
              délibéré : elles ne se montraient que dans d'autres états — il les
              aurait rencontrées demain, et redemandé la même chose. */}
        </>
      )}

      {/* **UN REFUS N'EST PAS UNE ACTION — 4 septembre 2026.**

          Cette phrase était écrite en `colors.rust`, l'accent de ce qu'on FAIT.
          Sur Nuit et Sylve, cet accent EST l'encre du texte courant : le refus
          y devenait un paragraphe ordinaire. Et dans la même feuille, quarante
          pixels plus haut, l'avertissement du jour complet est en bordeaux —
          deux couleurs pour « attention » dans un seul écran.

          `colors.alert` n'est pas une lecture de commentaire mais l'usage
          mesuré du dépôt : sur les blocs portant `role="alert"` dans `src/`,
          trente-six emploient `alert` et cinq `rust`. Il porte en plus sa
          correction de clarté sur les deux chartes sombres (`chartes.ts`,
          `detacher`) — ce que `rust` ne pouvait pas faire ici. */}
      {/* **Ce bouton était écrit à la main, et le patron l'a vu le 12 août 2026 :**
          *« déjà le bouton, ce n'est pas le même »*. Il avait raison — la
          capsule avait été posée sur `PrimaryButton`, et cet écran-ci ne s'en
          servait pas. Une action principale dessinée sur place échappe à toute
          décision d'ensemble : elle ne change que si quelqu'un pense à elle.
          C'est le composant qui porte la forme, jamais l'écran. */}

      {/* ═══════════════════════════════════════════════════════════════════
          **LE PIED RESTE EN BAS — 4 septembre 2026, sa réponse « la B ».**

          Mesuré sur son écran (390 × 664, soit 584 px de feuille utile) :
          la feuille fait **882 px** sur une journée ordinaire et **1 407 px**
          sur une journée chargée. « Envoyer le devis » n'était donc JAMAIS
          visible en arrivant — un écran et demi plus bas.

          Pire pendant la préparation : la feuille fait 292 px, le bouton est
          sous ses yeux, puis le planning arrive et il **descend de six cents
          pixels d'un coup**. Le pouce tombe sur le calendrier.

          Le pied collé règle les deux d'un seul geste, sans toucher au
          calendrier, ni à la fiche du jour, ni à une règle.

          **Trois mesures, et aucune n'est décorative.** `-mx-6 px-6` annule les
          marges de `BottomSheet` pour que l'aplat barre toute la largeur — sans
          quoi le contenu défilerait dans les six pixels laissés de chaque côté.
          `-mb-9 pb-9` avale le retrait bas de la feuille : sans lui, le pied
          remonterait de 36 px en fin de course, un sursaut au dernier
          défilement. Et l'aplat de `cream` est obligatoire — un pied
          transparent laisse voir le calendrier passer dessous.

          **L'erreur voyage AVEC le bouton**, et c'est le point : posée
          au-dessus du pied, elle défilait hors de l'écran pendant que le bouton
          restait — un refus qu'on ne lit plus n'a pas refusé.
          ═══════════════════════════════════════════════════════════════════ */}
      <div
        data-atlas="pied-envoi"
        className="sticky -mx-6 -mb-9 flex flex-col gap-2.5 px-6 pb-9 pt-3"
        style={{
          backgroundColor: colors.cream,
          borderTop: `1px solid ${colors.lineSoft}`,
          // **Le décalage vaut le retrait bas de `BottomSheet` (`pb-9`), et il
          // se MESURE.** `bottom: 0` colle la boîte de marge au bas de la zone
          // qui défile : avec la marge négative qui avale ce retrait, le pied
          // s'arrêtait 36 px trop haut et la liste des dates se voyait passer
          // dessous — trouvé à la capture, pas au raisonnement. Le décalage
          // remet le bord bas du pied au ras de la feuille, et sa place de
          // repos ne bouge pas d'un pixel : aucun sursaut en fin de défilement.
          bottom: -RETRAIT_BAS_FEUILLE,
        }}
      >
        {erreur && (
          <p role="alert" className="text-center text-[13px]" style={{ color: colors.alert }}>
            {erreur}
          </p>
        )}
        {/* ═══════════════════════════════════════════════════════════════
            **IL RÉPOND, IL NE S'ÉTEINT PLUS FAUTE DE DATE — 3 septembre 2026.**

            Sa règle : un refus nomme sa raison ET le geste qui le débloque ;
            un bouton grisé sans phrase est un défaut, pas une protection.

            Elle était déjà tenue sur l'écran de son CLIENT — « il n'est plus
            éteint, et il ne porte plus sa phrase grise » (`devis/[jeton]/
            formulaire.tsx`) — et pas ici. Pire : la phrase existait,
            « Proposez au moins une date d'intervention », et elle était
            INATTEIGNABLE. Un bouton désactivé n'appelle jamais la fonction qui
            la pose. Elle n'a donc jamais pu s'afficher depuis qu'elle a été
            écrite.

            Cela arrive pour de bon : agenda plein ou chantier long — aucun jour
            n'est présélectionné —, ou quand il décoche sa seule date.

            `blocage` reste éteignant, et lui porte déjà sa phrase au-dessus
            (`MESSAGES_BLOCAGE`) : il n'y a alors rien à envoyer, et le dire
            deux fois serait du bruit.
            ═══════════════════════════════════════════════════════════════ */}
        <PrimaryButton
          onClick={confirmer}
          disabled={enCours || !preparation || !!blocage}
        >
          {/* ═══════════════════════════════════════════════════════════
              **LA CAPSULE NE RÉTRÉCIT PLUS À L'ENVOI — 4 septembre 2026.**

              Mesuré : « Envoyer le devis » fait 246 px, « Envoi… » en faisait
              118. Au moment précis du geste irréversible, le bouton perdait la
              MOITIÉ de sa largeur en même temps qu'il passait au gris — cela
              se lit « ça a raté », pas « ça part ». La capsule tient à son
              texte, c'est tout son dessin : le coupable n'était pas le bouton,
              c'était le mot.

              **Une première version réservait la largeur** avec un libellé
              en creux posé sous le vrai. Elle a été jetée après l'avoir
              essayée : le texte se retrouvait DEUX FOIS dans la page, et
              `text=Envoyer le devis` — qu'emploient trois suites — ne
              désignait plus un élément mais deux. Un correctif d'apparence qui
              casse les contrôles du geste coûte plus qu'il ne rapporte.

              Le libellé d'attente fait donc la même largeur, à huit pixels
              près, et rien n'est ajouté à la page. */}
          {enCours ? "Envoi du devis…" : "Envoyer le devis"}
        </PrimaryButton>
        {/* **Un nom qui le distingue, depuis que la feuille vit sur le devis**
            (20 août 2026). L'écran du devis porte déjà un « Annuler » — celui
            qui reprend le retrait d'une ligne. Deux boutons du même nom sur le
            même écran, c'est un lecteur d'écran qui annonce deux fois la même
            chose sans dire quoi, et une suite qui vise le mauvais des deux.
            Le mot affiché ne bouge pas : il est clair sous les yeux, il ne
            l'était plus à l'oreille. */}
        <button
          type="button"
          aria-label="Annuler l’envoi"
          onClick={onFermer}
          className="rounded-full py-3.5 text-[15px] font-medium"
          style={{ color: colors.inkSoft }}
        >
          Annuler
        </button>
      </div>
    </>
  );
}
