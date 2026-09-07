"use client";

import { useMemo, useState, useTransition } from "react";
import { colors, libelleCaps, texteSituation } from "@/lib/design-tokens";
import {
  GENRES,
  MESSAGES_PAR_DEFAUT,
  clauseEcheance,
  motDuDocument,
  refusDuMessage,
  type GenreDocument,
} from "@/lib/message-client";
import { majMessagesAction } from "../actions";
import BarreEnregistrer from "@/components/atlas/BarreEnregistrer";
import EditeurMessage from "../EditeurMessage";

/**
 * « MON MESSAGE AU CLIENT » — trois messages, un par document.
 *
 * **Sa décision du 7 septembre 2026**, prise en deux temps devant la planche
 * `appli/couper-devis-et-factures.html` : *« en fait il faut faire deux messages
 * par défaut, un pour devis et un pour facture »*, puis — le compte rendu de
 * passage retrouvé — *« dans ce cas faut faire 3 messages par défaut et garder
 * le système un seul mot change »*.
 *
 * **CE QUI A ÉTÉ RETIRÉ LE MÊME JOUR, ET C'EST LA MOITIÉ DE L'ÉCRAN.** Sa
 * correction : *« pas besoin de répéter, il faut juste que l'utilisateur voie le
 * message final qu'il peut modifier entièrement »*. Chaque message était dessiné
 * deux fois — une fois avec les mots nommés (« le prénom »), une fois rempli
 * (« Mme Larousse ») —, soit six boîtes presque identiques où l'on cherche
 * laquelle se modifie. Il ne reste que celle qui part.
 *
 * **Les mots dorés ne sont PLUS encadrés**, sa remarque du même jour : *« laisse-
 * les normaux mais juste en doré »*. Un cadre n'apprenait rien que
 * l'avertissement du haut ne dise déjà, et il fabriquait deux sortes de doré à
 * comprendre au lieu d'une.
 *
 * **Deux mots ne se retirent pas**, et c'est `refusDuMessage` qui le tient — pas
 * un dessin : le lien, sans lequel le client n'ouvre rien et le planning ne
 * reçoit aucune date, et le mot du document, sans lequel il ne sait pas s'il
 * reçoit un devis à signer ou une facture à payer.
 */

/** Ce que porte chaque écran de message : son titre, et sa valeur d'exemple. */
const DOCUMENTS: { genre: GenreDocument; titre: string; numero: string; echeance: string | null }[] = [
  // **Un numéro et une échéance d'exemple, reconnaissables comme tels** : les
  // siens n'existent pas tant qu'aucun document n'est émis, et un chiffre
  // inventé qui aurait l'air vrai finirait recopié.
  { genre: "devis", titre: "Ce que j'envoie avec un devis", numero: "D2026-0012", echeance: null },
  { genre: "facture", titre: "Ce que j'envoie avec une facture", numero: "F2026-0008", echeance: "21 septembre" },
  { genre: "passage", titre: "Ce que j'envoie avec un compte rendu", numero: "", echeance: null },
];

export default function MessagesClient({
  initiaux,
  entrepriseNom,
}: {
  /** Ce que la base porte, par document. `null` : celui d'Atlas. */
  initiaux: Record<GenreDocument, string | null>;
  entrepriseNom: string;
}) {
  const [messages, setMessages] = useState<Record<GenreDocument, string>>(() => ({
    devis: initiaux.devis ?? MESSAGES_PAR_DEFAUT.devis,
    facture: initiaux.facture ?? MESSAGES_PAR_DEFAUT.facture,
    passage: initiaux.passage ?? MESSAGES_PAR_DEFAUT.passage,
  }));
  const [aEcrire, setAEcrire] = useState(false);
  const [refusServeur, setRefusServeur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  /**
   * **Le refus vient de la MÊME fonction que le serveur** (`refusDuMessage`) :
   * un écran qui laisserait enregistrer ce que le serveur rejette lui ferait
   * appuyer sur un bouton qui ne fait rien.
   */
  const refus = useMemo(
    () =>
      GENRES.map((g) => ({ genre: g, raison: refusDuMessage(messages[g]) })).filter(
        (r): r is { genre: GenreDocument; raison: string } => r.raison !== null
      ),
    [messages]
  );

  function enregistrer() {
    demarrer(async () => {
      const r = await majMessagesAction(messages);
      setRefusServeur(r.ok ? null : r.raison);
      if (r.ok) {
        // **On réaffiche ce que la base porte.** `null` veut dire « celui
        // d'Atlas » : le champ redevient alors son texte, et non un cadre vide
        // qu'il croirait avoir effacé.
        setMessages({
          devis: r.messages.devis ?? MESSAGES_PAR_DEFAUT.devis,
          facture: r.messages.facture ?? MESSAGES_PAR_DEFAUT.facture,
          passage: r.messages.passage ?? MESSAGES_PAR_DEFAUT.passage,
        });
        setAEcrire(false);
      }
    });
  }

  const barreVisible = aEcrire || enCours || refus.length > 0;

  return (
    <div className={barreVisible ? "pb-40" : "pb-10"}>
      {refusServeur && (
        <p
          role="alert"
          className={`mx-[26px] mt-4 rounded-[4px] px-[15px] py-3 ${texteSituation}`}
          style={{ backgroundColor: colors.card, borderLeft: `3px solid ${colors.alert}`, color: colors.alert }}
        >
          {refusServeur}
        </p>
      )}

      <section className="mx-[26px] mt-[26px]">
        {/* L'AVERTISSEMENT, EN TÊTE ET UNE SEULE FOIS pour les trois — sa
            demande du 7 septembre. Répété au-dessus de chaque message, il
            aurait fait trois fois la même phrase sur un écran qu'il veut
            court. */}
        <p className={`${texteSituation} mb-2`} style={{ color: colors.inkSoft }}>
          Les mots en doré se remplissent tout seuls.{" "}
          <b style={{ color: colors.ink, fontWeight: 400 }}>
            Le lien et le mot du document — devis, facture, compte rendu — ne peuvent pas être
            retirés.
          </b>{" "}
          Tout le reste se modifie.
        </p>
      </section>

      {DOCUMENTS.map(({ genre, titre, numero, echeance }) => {
        const raison = refusDuMessage(messages[genre]);
        return (
          <section
            key={genre}
            className="mx-[26px] mt-[30px] border-t pt-[18px]"
            style={{ borderColor: colors.line }}
          >
            <p className={`mb-2.5 ${libelleCaps}`} style={{ color: colors.inkSoft }}>
              {titre}
            </p>

            {/* **Une seule case, et c'est le message FINAL.** Les mots dorés y
                sont posés remplis : ce qu'il lit est ce que Mme Larousse
                recevra, à son nom près. */}
            <EditeurMessage
              valeur={messages[genre]}
              libelles={{
                "[client]": "Mme Larousse",
                "[document]": motDuDocument(genre),
                "[numero]": numero,
                // **La virgule reste DANS la pastille**, et ce n'est pas une
                // coquette : l'échéance emporte ses mots (`clauseEcheance`)
                // parce qu'une facture sans délai de paiement n'en a pas. La
                // retirer de l'affichage ferait lire « F2026-0008 à régler… »
                // là où le client lira « F2026-0008, à régler… ».
                "[echeance]": clauseEcheance(echeance),
                "[lien]": "https://…",
                "[entreprise]": entrepriseNom || "votre entreprise",
              }}
              invalide={raison !== null}
              onChange={(m) => {
                setMessages((v) => ({ ...v, [genre]: m }));
                setAEcrire(true);
              }}
            />

            {/* Le seul filet de sécurité qui reste : reprendre le message
                d'Atlas s'il l'a défait — par exemple en retirant le lien, que
                le serveur refuse. Montré seulement quand le sien en diffère. */}
            {messages[genre].trim() !== MESSAGES_PAR_DEFAUT[genre].trim() && (
              <button
                type="button"
                data-atlas={`message-defaut-${genre}`}
                onClick={() => {
                  setMessages((v) => ({ ...v, [genre]: MESSAGES_PAR_DEFAUT[genre] }));
                  setAEcrire(true);
                }}
                className="mt-2.5 min-h-[44px] rounded-full px-4 text-[13.5px]"
                style={{ color: colors.muted, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
              >
                Remettre le message d&apos;Atlas
              </button>
            )}

            {raison && (
              <p
                role="alert"
                data-atlas={`message-refus-${genre}`}
                className={`mt-2.5 ${texteSituation}`}
                style={{ color: colors.alert }}
              >
                {raison}
              </p>
            )}
          </section>
        );
      })}

      <BarreEnregistrer
        aEcrire={aEcrire}
        enCours={enCours}
        refus={refus.length > 0 ? "Message incomplet" : null}
        onEnregistrer={enregistrer}
      />
    </div>
  );
}
