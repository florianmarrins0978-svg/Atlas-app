"use client";

import { useEffect, useState } from "react";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import BottomSheet from "@/components/atlas/BottomSheet";
import { jourLisible } from "@/lib/jour";
import { libelleDuree } from "@/server/disponibilites";
import { preparerEnvoiAction, envoyerAuClientAction, verifierJourProposeAction } from "./actions";
import type { PreparationEnvoi, VerdictJour } from "@/server/repositories/preparation-envoi";
import BandeDuree from "../BandeDuree";

// L'unique arrêt avant l'envoi (docs/AGENT.md §2.2). Le patron vient de valider
// son devis : on ne lui redemande pas s'il est sûr — un arrêt qui ne peut mener
// qu'à « oui » n'est pas un contrôle, c'est une formalité.
//
// La seule question posée est un RÉGLAGE de l'envoi : une date, ou deux ? Sa
// réponse déclenche tout le reste.

const MESSAGES_BLOCAGE: Record<string, string> = {
  canal_absent:
    "Indiquez d'abord comment joindre ce client — par SMS ou par e-mail — sur sa fiche.",
  coordonnee_absente: "Ce client n'a pas de coordonnée enregistrée pour le canal choisi.",
  devis_absent: "Aucun devis à envoyer pour ce chantier.",
};

type Props = {
  chantierId: string;
  devisId: string;
  clientNom: string;
  ouvert: boolean;
  onFermer: () => void;
  onEnvoye: (lien: string) => void;
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
  const [preparation, setPreparation] = useState<PreparationEnvoi | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // `undefined` tant que le patron n'a rien corrigé : le serveur déduit alors
  // la durée de la dictée. Une valeur ici veut dire « c'est lui qui a tranché ».
  const [dureeChoisie, setDureeChoisie] = useState<number | undefined>(undefined);
  // La date que le patron choisit lui-même, et ce que le serveur en dit.
  // Séparée de `selection` tant qu'elle n'est pas retenable : proposer un jour
  // que l'envoi refusera ensuite coûte un aller-retour avec son client.
  const [autreDate, setAutreDate] = useState("");
  const [verdict, setVerdict] = useState<VerdictJour | null>(null);
  const [verification, setVerification] = useState(false);

  useEffect(() => {
    let annule = false;
    preparerEnvoiAction(chantierId, dureeChoisie)
      .then((p) => {
        if (annule) return;
        setPreparation(p);
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
  }, [chantierId, dureeChoisie]);

  function basculerJour(jour: string) {
    setSelection((actuelle) => {
      if (actuelle.includes(jour)) return actuelle.filter((j) => j !== jour);
      // Jamais plus de deux : au-delà, le client ne choisit plus, il hésite.
      if (actuelle.length >= 2) return [actuelle[1], jour];
      return [...actuelle, jour];
    });
  }

  async function verifierAutreDate(jour: string) {
    setAutreDate(jour);
    setVerdict(null);
    if (!jour) return;
    setVerification(true);
    try {
      const v = await verifierJourProposeAction(chantierId, jour, preparation?.dureeDemiJournees);
      setVerdict(v);
      // Retenue tout de suite quand elle tient : un second geste pour confirmer
      // ce qu'on vient de choisir n'apprend rien à personne.
      if (v.retenable) basculerJour(jour);
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
        preparation?.dureeDemiJournees
      );
      if (!r.succes) {
        setErreur(r.erreur);
        return;
      }
      onEnvoye(r.lien);
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
        <p className="my-5 text-center text-[13px]" style={{ color: colors.rust }}>
          {blocage}
        </p>
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
                  onClick={() => basculerJour(jour)}
                  aria-pressed={choisi}
                  className="flex items-center justify-between rounded-xl px-4 py-3 text-[15px]"
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

              Un champ de date natif : sur son téléphone, c'est la molette qu'il
              connaît déjà, avec son calendrier. Rien à réapprendre. */}
          <div className="mb-4">
            <label htmlFor="autre-date" className={smallCaps} style={{ color: colors.muted }}>
              Ou une autre date
            </label>
            <input
              id="autre-date"
              type="date"
              value={autreDate}
              min={preparation.horizon.debut}
              max={preparation.horizon.fin}
              onChange={(e) => verifierAutreDate(e.target.value)}
              className="mt-1.5 w-full rounded-xl px-4 py-3 text-[15px]"
              style={{ backgroundColor: colors.card, color: colors.ink, border: "none" }}
            />
            {verification && (
              <p className="mt-1.5 text-[13px]" style={{ color: colors.muted }}>
                Vérification de votre planning…
              </p>
            )}
            {/* Un jour refusé sans un mot renvoie au téléphone. On dit
                pourquoi, et on propose le jour libre le plus proche — chercher
                à l'aveugle dans dix-huit mois de calendrier n'est pas un
                travail. */}
            {!verification && verdict?.raison && (
              <p className="mt-1.5 text-[13px]" style={{ color: verdict.retenable ? colors.muted : colors.rust }}>
                {verdict.raison}
                {verdict.alternative && (
                  <>
                    {" "}
                    <button
                      type="button"
                      onClick={() => verifierAutreDate(verdict.alternative!)}
                      className="font-medium underline"
                      style={{ color: colors.rust }}
                    >
                      Prendre le {jourLisible(verdict.alternative)}
                    </button>
                  </>
                )}
              </p>
            )}
            {!verification && verdict?.retenable && !verdict.raison && (
              <p className="mt-1.5 text-[13px]" style={{ color: colors.rust }}>
                {jourLisible(verdict.jour)} — retenue.
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
                    onClick={() => basculerJour(jour)}
                    aria-pressed
                    className="flex items-center justify-between rounded-xl px-4 py-3 text-[15px]"
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

          <p className="mb-4 text-center text-[12px]" style={{ color: colors.muted }}>
            {selection.length === 2
              ? "Le client choisira entre ces deux dates."
              : "Le client pourra aussi en proposer une autre, parmi vos jours libres."}
          </p>
        </>
      )}

      {erreur && (
        <p role="alert" className="mb-3 text-center text-[13px]" style={{ color: colors.rust }}>
          {erreur}
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        <button
          onClick={confirmer}
          disabled={enCours || !preparation || !!blocage || selection.length === 0}
          className="rounded-2xl py-3.5 text-[16px] font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: colors.rust }}
        >
          {enCours ? "Envoi…" : "Envoyer le devis"}
        </button>
        <button
          onClick={onFermer}
          className="rounded-2xl py-3.5 text-[15px] font-medium"
          style={{ color: colors.muted }}
        >
          Annuler
        </button>
      </div>
    </>
  );
}
