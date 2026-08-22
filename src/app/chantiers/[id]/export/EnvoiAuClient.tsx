"use client";

import { useEffect, useState } from "react";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import BottomSheet from "@/components/atlas/BottomSheet";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { jourIso, jourLisible } from "@/lib/jour";
import MoisCharge from "@/components/atlas/MoisCharge";
import { useOccupation } from "@/components/atlas/useOccupation";
import JourneeRegardee from "./JourneeRegardee";
import { basculerJour } from "@/lib/calendrier";
import { libelleDuree } from "@/server/disponibilites";
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
};

/**
 * Une date, ou deux — jamais trois (`docs/AGENT.md` §2.2).
 *
 * Le nombre vit ici et la RÈGLE dans `src/lib/calendrier.ts` : au-delà du
 * maximum, c'est le plus ancien choix qui cède la place, plutôt qu'un bouton
 * qui ne répond pas — ce qui se lit comme une panne.
 */
const DATES_AU_MAXIMUM = 2;

const LIBELLE_CANAL = {
  sms: { titre: "Par SMS", champ: "Numéro de téléphone", exemple: "06 12 34 56 78" },
  email: { titre: "Par e-mail", champ: "Adresse e-mail", exemple: "client@exemple.fr" },
} as const;

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
  const { occupationDe, nomEquipe } = useOccupation({
    chantiers: preparation?.planning.chantiers ?? [],
    nombreEquipes: preparation?.planning.nombreEquipes ?? 1,
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
   * Un jour touché AU CALENDRIER.
   *
   * Déjà retenu → on le retire tout de suite : il est passé par le serveur, et
   * le redemander pour l'enlever serait attendre pour rien.
   *
   * Sinon → on demande d'abord au serveur, et on ne le retient que s'il tient.
   * Le calendrier ne connaît que la fenêtre proche : au-delà, lui seul sait si
   * la journée est libre (`verifierJourPropose`). Proposer un jour que l'envoi
   * refuserait ensuite coûte un aller-retour avec le client.
   */
  /**
   * **REGARDER un jour n'est plus le RETENIR** — sa demande du 22 août 2026,
   * validée sur planche 91 : *« la possibilité de cliquer sur les jours pour
   * voir quels chantiers y sont déjà affectés, comme ça on peut savoir si oui
   * ou non on peut rajouter des clients »*.
   *
   * Jusque-là, toucher un jour au calendrier le proposait au client dans la
   * foulée. Or ce qu'il veut d'abord, c'est CONSULTER une journée chargée pour
   * juger s'il peut s'y glisser — et un jour consulté par erreur partait chez
   * quelqu'un. Le second geste, « Proposer ce jour », vit sur la fiche du jour.
   *
   * Le serveur est interrogé dès le regard : le calendrier ne connaît que la
   * fenêtre proche, et lui seul sait si la journée tient au-delà.
   */
  async function regarderLeJour(jour: string) {
    // Retoucher le jour déjà ouvert le referme — le même geste qu'au planning.
    if (jourInterroge === jour) {
      setJourInterroge("");
      setVerdict(null);
      return;
    }
    setJourInterroge(jour);
    setVerdict(null);
    setVerification(true);
    try {
      setVerdict(await verifierJourProposeAction(chantierId, jour, preparation?.dureeDemiJournees));
    } catch {
      setVerdict({
        jour,
        retenable: false,
        raison: "Impossible de vérifier cette date pour l'instant. Réessayez.",
        alternative: null,
      });
    } finally {
      setVerification(false);
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

      {!preparation && !erreur && (
        <p className="my-6 text-center text-[13px]" style={{ color: colors.muted }}>
          Préparation…
        </p>
      )}

      {preparation && blocage && (
        <p className="mb-3 mt-4 text-center text-[13px]" style={{ color: colors.ink }}>
          {blocage}
        </p>
      )}

      {/* **On répare, on ne renvoie pas ailleurs.** Les deux voies sont offertes
          et la coordonnée se saisit ici : c'est le seul endroit atteignable
          depuis un chantier dicté, dont le client reste « non renseigné ». */}
      {preparation && reparable && (
        <div className="mb-5">
          <div className="mb-2.5 flex gap-2">
            {(["sms", "email"] as const).map((c) => {
              const actif = canalChoisi === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCanalChoisi(c)}
                  aria-pressed={actif}
                  className="flex-1 rounded-full py-3 text-[15px] font-medium"
                  style={{
                    backgroundColor: actif ? colors.rustTint : colors.card,
                    color: actif ? colors.rust : colors.ink,
                  }}
                >
                  {LIBELLE_CANAL[c].titre}
                </button>
              );
            })}
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
            <p className="mt-2 text-center text-[12px]" style={{ color: colors.muted }}>
              Ce chantier n&apos;a pas encore de client. Ouvrez le devis pour lui donner un nom,
              puis revenez ici.
            </p>
          )}
        </div>
      )}

      {preparation && !blocage && (
        <>
          <p className="mb-4 text-center text-[13px]" style={{ color: colors.muted }}>
            Par {preparation.canal === "sms" ? "SMS" : "e-mail"}
            {preparation.destinataire ? ` au ${preparation.destinataire}` : ""}
          </p>

          {/* La durée n'est pas une seconde question — c'est le réglage qui
              décide quels jours sont proposables. Une demi-journée tient là où
              une journée entière ne tient plus, et le patron le sait mieux que
              sa dictée. Elle reste chez lui : son client ne verra qu'une date.

              L'arrêt reste unique (`docs/AGENT.md` §2.2) : la question posée est
              toujours « une date, ou deux ? ». Ceci en est le préalable. */}
          <div className="mb-4">
            <BandeDuree
              label="Ce chantier prend"
              valeur={preparation.dureeDemiJournees}
              onChange={setDureeChoisie}
              aide={
                (preparation.dureeDeduiteDeLaDictee
                  ? "Repris de votre dictée. Corrigez-le si besoin — cela change les jours proposables."
                  : "Votre client ne verra que la date, jamais la demi-journée.") +
                /* Un chantier long réserve beaucoup de jours d'affilée. C'est
                   juste, mais invisible : sans cette phrase, le patron
                   s'étonnerait de ne plus rien pouvoir proposer pendant un mois. */
                (preparation.dureeDemiJournees > 6
                  ? ` ${preparation.dureeDemiJournees / 2} jours ouvrés d'affilée seront réservés à partir de la date retenue.`
                  : "")
              }
            />
          </div>

          <p className={smallCaps} style={{ color: colors.muted, marginBottom: 8 }}>
            Une date, ou deux au choix du client ?
          </p>

          <div className="mb-4 flex flex-col gap-1.5">
            {preparation.joursLibres.map((jour) => {
              const choisi = selection.includes(jour);
              return (
                <button
                  key={jour}
                  type="button"
                  onClick={() => basculer(jour)}
                  aria-pressed={choisi}
                  className="flex items-center justify-between rounded-full px-4 py-3 text-[15px]"
                  style={{
                    backgroundColor: choisi ? colors.rustTint : colors.card,
                    color: colors.ink,
                  }}
                >
                  <span>{jourLisible(jour)}</span>
                  {choisi && (
                    <span className="text-[13px] font-medium" style={{ color: colors.rust }}>
                      proposée
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {preparation.joursLibres.length === 0 && (
            <p className="mb-4 text-center text-[13px]" style={{ color: colors.rust }}>
              Aucun jour ne peut accueillir {libelleDuree(preparation.dureeDemiJournees)} dans les trois prochains
              mois. Choisissez une date plus loin ci-dessous, raccourcissez la durée, ou ajoutez une équipe dans
              vos réglages.
            </p>
          )}

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
            <p className={smallCaps} style={{ color: colors.muted, marginBottom: 6 }}>
              Ou une autre date
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
                  onToucherJour={regarderLeJour}
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
                onRetenir={() => basculer(jourInterroge)}
              />
            )}

            {/* Un jour refusé sans un mot renvoie au téléphone. On propose le
                jour libre le plus proche — chercher à l'aveugle dans dix-huit
                mois de calendrier n'est pas un travail. */}
            {!verification && verdict?.alternative && (
              <p className="mt-1.5 text-center text-[13px]" style={{ color: colors.muted }}>
                <button
                  type="button"
                  onClick={() => regarderLeJour(verdict.alternative!)}
                  className="font-medium underline"
                  style={{ color: colors.rust }}
                >
                  Voir le {jourLisible(verdict.alternative)}
                </button>
              </p>
            )}
          </div>

          {/* Les dates retenues hors de la liste des six ne se voient nulle
              part ailleurs : sans ce rappel, le patron enverrait sans savoir ce
              qu'il propose. */}
          {selection.some((j) => !preparation.joursLibres.includes(j)) && (
            <div className="mb-4 flex flex-col gap-1.5">
              {selection
                .filter((j) => !preparation.joursLibres.includes(j))
                .map((jour) => (
                  <button
                    key={jour}
                    type="button"
                    onClick={() => basculer(jour)}
                    aria-pressed
                    className="flex items-center justify-between rounded-full px-4 py-3 text-[15px]"
                    style={{ backgroundColor: colors.rustTint, color: colors.ink }}
                  >
                    <span>{jourLisible(jour)}</span>
                    <span className="text-[13px] font-medium" style={{ color: colors.rust }}>
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
              <span className="mt-0.5 block text-[12px] leading-[1.45]" style={{ color: colors.muted }}>
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

          <p className="mb-4 text-center text-[12px]" style={{ color: colors.muted }}>
            {selection.length === 2
              ? autreDateAutorisee
                ? "Le client choisira entre ces deux dates, ou en proposera une autre."
                : "Le client choisira entre ces deux dates, et rien d'autre."
              : autreDateAutorisee
                ? "Le client pourra aussi en proposer une autre, parmi vos jours libres."
                : "Le client ne pourra pas en proposer une autre."}
          </p>
        </>
      )}

      {erreur && (
        <p role="alert" className="mb-3 text-center text-[13px]" style={{ color: colors.rust }}>
          {erreur}
        </p>
      )}

      {/* **Ce bouton était écrit à la main, et le patron l'a vu le 12 août 2026 :**
          *« déjà le bouton, ce n'est pas le même »*. Il avait raison — la
          capsule avait été posée sur `PrimaryButton`, et cet écran-ci ne s'en
          servait pas. Une action principale dessinée sur place échappe à toute
          décision d'ensemble : elle ne change que si quelqu'un pense à elle.
          C'est le composant qui porte la forme, jamais l'écran. */}
      <div className="flex flex-col gap-2.5">
        <PrimaryButton
          onClick={confirmer}
          disabled={enCours || !preparation || !!blocage || selection.length === 0}
        >
          {enCours ? "Envoi…" : "Envoyer le devis"}
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
          style={{ color: colors.muted }}
        >
          Annuler
        </button>
      </div>
    </>
  );
}
