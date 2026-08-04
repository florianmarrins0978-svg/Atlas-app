"use client";

import { useEffect, useState } from "react";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import BottomSheet from "@/components/atlas/BottomSheet";
import { jourLisible } from "@/lib/jour";
import { libelleDuree } from "@/server/disponibilites";
import { preparerEnvoiAction, envoyerAuClientAction } from "./actions";
import type { PreparationEnvoi } from "@/server/repositories/preparation-envoi";

// L'unique arrêt avant l'envoi (docs/AGENT.md §2.2). Le patron vient de valider
// son devis : on ne lui redemande pas s'il est sûr — un arrêt qui ne peut mener
// qu'à « oui » n'est pas un contrôle, c'est une formalité.
//
// La seule question posée est un RÉGLAGE de l'envoi : une date, ou deux ? Sa
// réponse déclenche tout le reste.

/**
 * Les durées proposées : la demi-journée, puis 1 à 100 jours.
 *
 * **Pourquoi une liste déroulante et non des boutons.** Quatre boutons
 * couvraient jusqu'à trois jours ; au-delà il aurait fallu en ajouter, et un
 * chantier de vingt jours en aurait demandé vingt. Le patron l'a dit : « une
 * bande déroulante qui fait défiler le nombre de jours, 100 max — ça prendra
 * moins de place ».
 *
 * **Et pourquoi un `<select>` natif plutôt qu'une bande faite maison.** Sur son
 * téléphone, c'est exactement la molette qu'il décrit : elle s'ouvre au bas de
 * l'écran, se fait défiler au pouce, et occupe une seule ligne au repos. Une
 * bande écrite à la main aurait le même aspect en moins fiable — et ne
 * répondrait pas au lecteur d'écran.
 *
 * La demi-journée reste la première entrée : c'est le cas qui lui a manqué.
 */
const DUREE_MAX_JOURS = 100;

const DUREES: { demiJournees: number; libelle: string }[] = [
  { demiJournees: 1, libelle: "½ journée" },
  ...Array.from({ length: DUREE_MAX_JOURS }, (_, i) => ({
    demiJournees: (i + 1) * 2,
    // « 1 journée », pas « 1 jour » : c'est ainsi qu'on dit la durée d'un
    // chantier — « ça prend une journée », jamais « ça prend un jour ».
    // Correction demandée par le patron le 2026-08-04, sur capture.
    libelle: i === 0 ? "1 journée" : `${i + 1} jours`,
  })),
];

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
    } catch {
      setErreur("L'envoi n'a pas pu être préparé.");
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
          <p className={smallCaps} style={{ color: colors.muted, marginBottom: 6 }}>
            Ce chantier prend
          </p>
          <select
            aria-label="Durée du chantier"
            value={preparation.dureeDemiJournees}
            onChange={(e) => setDureeChoisie(Number(e.target.value))}
            className="mb-1 w-full rounded-xl px-4 py-3 outline-none"
            style={{ backgroundColor: colors.card, color: colors.ink, fontSize: "16px" }}
          >
            {DUREES.map((d) => (
              <option key={d.demiJournees} value={d.demiJournees}>
                {d.libelle}
              </option>
            ))}
          </select>
          <p className="mb-4 text-[12px] leading-relaxed" style={{ color: colors.muted }}>
            {preparation.dureeDeduiteDeLaDictee
              ? "Repris de votre dictée. Corrigez-le si besoin — cela change les jours proposables."
              : "Votre client ne verra que la date, jamais la demi-journée."}
            {/* Un chantier long réserve beaucoup de jours d'affilée. C'est
                juste, mais invisible : sans cette phrase, le patron
                s'étonnerait de ne plus rien pouvoir proposer pendant un mois. */}
            {preparation.dureeDemiJournees > 6 &&
              ` ${preparation.dureeDemiJournees / 2} jours ouvrés d'affilée seront réservés à partir de la date retenue.`}
          </p>

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
              mois. Essayez une durée plus courte, ou ajoutez une équipe dans vos réglages.
            </p>
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
