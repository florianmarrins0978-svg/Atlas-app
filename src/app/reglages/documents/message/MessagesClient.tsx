"use client";

import { useMemo, useState, useTransition } from "react";
import { colors, font } from "@/lib/design-tokens";
import {
  GENRES,
  MESSAGES_PAR_DEFAUT,
  clauseEcheance,
  motDuDocument,
  refusDuMessage,
  clauseAutreDate,
  clauseValidite,
  type GenreDocument,
} from "@/lib/message-client";
import { VALIDITE_LIEN_JOURS } from "@/lib/etat-envoi";
import { jourIso, jourLisible } from "@/lib/jour";
import { ecrireNumero } from "@/lib/numero-documents";
import { majMessagesAction } from "../actions";
import BarreEnregistrer from "@/components/atlas/BarreEnregistrer";
import Paquet from "@/components/atlas/reglages/Paquet";
import PlageTon, { type Ton } from "@/components/atlas/reglages/PlageTon";
import PastilleIcone from "@/components/atlas/reglages/PastilleIcone";
import EditeurMessage from "../EditeurMessage";
import { EXEMPLE_NUMERO, Etat } from "../pieces";
import Picto, { type NomPicto } from "@/components/atlas/reglages/Picto";

/**
 * « MON MESSAGE AU CLIENT » — trois messages, un par document.
 *
 * **Sa décision du 7 septembre 2026**, prise en deux temps devant la planche
 * `appli/couper-devis-et-factures.html` : *« en fait il faut faire deux messages
 * par défaut, un pour devis et un pour facture »*, puis, le compte rendu de
 * passage retrouvé, *« dans ce cas faut faire 3 messages par défaut et garder
 * le système un seul mot change »*.
 *
 * **CE QUI A ÉTÉ RETIRÉ LE MÊME JOUR, ET C'EST LA MOITIÉ DE L'ÉCRAN.** Sa
 * correction : *« pas besoin de répéter, il faut juste que l'utilisateur voie le
 * message final qu'il peut modifier entièrement »*. Chaque message était dessiné
 * deux fois, une fois avec les mots nommés (« le prénom »), une fois rempli
 * (« Mme Larousse »), soit six boîtes presque identiques où l'on cherche
 * laquelle se modifie. Il ne reste que celle qui part.
 *
 * **Les mots dorés ne sont PLUS encadrés**, sa remarque du même jour : *« laisse-
 * les normaux mais juste en doré »*. Un cadre n'apprenait rien que
 * l'avertissement du haut ne dise déjà, et il fabriquait deux sortes de doré à
 * comprendre au lieu d'une.
 *
 * **Les trois s'ouvrent un par un depuis le 26 octobre 2026** (sa planche des
 * Réglages soignés) : trois messages entiers à la suite faisaient un long écran
 * de texte. Chaque ligne dit d'un mot où en est son message, celui d'Atlas, le
 * sien, ou incomplet, et un seul se déplie. Les trois cases restent montées :
 * on enregistre les trois d'un appui, refermées comprises.
 *
 * **Deux mots ne se retirent pas**, et c'est `refusDuMessage` qui le tient, pas
 * un dessin : le lien, sans lequel le client n'ouvre rien et le planning ne
 * reçoit aucune date, et le mot du document, sans lequel il ne sait pas s'il
 * reçoit un devis à signer ou une facture à payer.
 */

/**
 * Ce que porte chaque message : son titre, ce que le lecteur d'écran annonce,
 * son dessin, et le ton de sa pastille.
 */
const DOCUMENTS: {
  genre: GenreDocument;
  titre: string;
  nom: string;
  picto: NomPicto;
  ton?: Exclude<Ton, "or">;
}[] = [
  { genre: "devis", titre: "Ce que j'envoie avec un devis", nom: "Votre message avec un devis", picto: "document" },
  // Le vert : l'argent qui rentre. Le bleu : une information, le passage fait.
  {
    genre: "facture",
    titre: "Ce que j'envoie avec une facture",
    nom: "Votre message avec une facture",
    picto: "facture",
    ton: "vert",
  },
  {
    genre: "passage",
    titre: "Ce que j'envoie avec un retour d'intervention",
    nom: "Votre message avec un retour d'intervention",
    picto: "coche",
    ton: "bleu",
  },
];

/**
 * L'échéance de la facture d'exemple, comptée depuis aujourd'hui.
 *
 * **Elle était écrite « 21 septembre », une date passée** dès le 22 (sa
 * planche du 26 octobre 2026). Trente jours : le délai d'une facture quand
 * rien n'est réglé. Ce n'est qu'un exemple, comme « Mme Larousse ».
 */
const ECHEANCE_D_EXEMPLE_JOURS = 30;

export default function MessagesClient({
  initiaux,
  entrepriseNom,
  formatNumero,
}: {
  /** Ce que la base porte, par document. `null` : celui d'Atlas. */
  initiaux: Record<GenreDocument, string | null>;
  entrepriseNom: string;
  /** Le format de ses numéros : l'exemple de la facture le suit. */
  formatNumero: string | null;
}) {
  const [messages, setMessages] = useState<Record<GenreDocument, string>>(() => ({
    devis: initiaux.devis ?? MESSAGES_PAR_DEFAUT.devis,
    facture: initiaux.facture ?? MESSAGES_PAR_DEFAUT.facture,
    passage: initiaux.passage ?? MESSAGES_PAR_DEFAUT.passage,
  }));
  const [aEcrire, setAEcrire] = useState(false);
  const [ouvert, setOuvert] = useState<GenreDocument | null>("devis");
  // Les jours où mourraient un lien et une facture envoyés aujourd'hui :
  // l'exemple dit de vraies dates.
  const [expireLeDExemple] = useState(() => jourIso(new Date(Date.now() + VALIDITE_LIEN_JOURS * 86_400_000)));
  const [echeanceDExemple] = useState(() =>
    jourLisible(jourIso(new Date(Date.now() + ECHEANCE_D_EXEMPLE_JOURS * 86_400_000)))
  );
  const [refusServeur, setRefusServeur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  /**
   * **Le refus vient de la MÊME fonction que le serveur** (`refusDuMessage`) :
   * un écran qui laisserait enregistrer ce que le serveur rejette lui ferait
   * appuyer sur un bouton qui ne fait rien.
   */
  const refus = useMemo(
    () =>
      GENRES.map((g) => ({ genre: g, raison: refusDuMessage(messages[g], g) })).filter(
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
  const signature = entrepriseNom || "votre entreprise";

  return (
    <div className={barreVisible ? "pb-40" : "pb-10"}>
      {refusServeur && (
        <div role="alert" className="mx-[22px] mt-4">
          <PlageTon ton="rouge">{refusServeur}</PlageTon>
        </div>
      )}

      {/* L'AVERTISSEMENT, EN TÊTE ET UNE SEULE FOIS pour les trois, sa
          demande du 7 septembre. Répété au-dessus de chaque message, il
          aurait fait trois fois la même phrase sur un écran qu'il veut
          court. */}
      <p className="mx-6 mt-4 text-[14.5px] leading-[1.45]" style={{ color: colors.inkSoft }}>
        Les mots <span style={{ color: colors.or, fontWeight: 600 }}>en doré</span> se remplissent tout seuls.{" "}
        <b style={{ color: colors.ink, fontWeight: 600 }}>
          Le lien, sa durée et le mot du document (devis, facture, retour d&apos;intervention) ne peuvent pas
          être retirés.
        </b>{" "}
        Tout le reste se modifie.
      </p>

      <Paquet>
        {DOCUMENTS.map(({ genre, titre, nom, picto, ton }) => {
          const raison = refusDuMessage(messages[genre], genre);
          const sien = messages[genre].trim() !== MESSAGES_PAR_DEFAUT[genre].trim();
          const deplie = ouvert === genre;
          return (
            <div key={genre} className="relative">
              <span aria-hidden className="absolute inset-x-0 -top-px h-px" style={{ backgroundColor: colors.line }} />
              <button
                type="button"
                data-atlas={`message-ligne-${genre}`}
                aria-expanded={deplie}
                aria-controls={`message-${genre}`}
                onClick={() => setOuvert(deplie ? null : genre)}
                className="flex min-h-[72px] w-full items-center gap-[14px] py-3 text-left"
              >
                <PastilleIcone ton={ton}>
                  <Picto nom={picto} taille={22} />
                </PastilleIcone>
                <span className="min-w-0 flex-1">
                  <span className="block text-[18px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
                    {titre}
                  </span>
                  <span className="mt-[3px] block text-[14.5px] leading-[1.4]" style={{ color: colors.inkSoft }}>
                    {raison ? <Etat ton="rouge">Incomplet</Etat> : sien ? <Etat>Le vôtre</Etat> : "Celui d'Atlas"}
                  </span>
                </span>
                <span
                  className="transition-transform duration-200"
                  style={{ color: colors.or, transform: deplie ? "rotate(180deg)" : undefined }}
                >
                  <Picto nom="bas" taille={20} epaisseur={2} />
                </span>
              </button>

              {/* **Refermé, le message reste monté** : l'appui sur Enregistrer
                  part avec les trois, et un refus sur un message refermé se
                  lit sur sa ligne (« Incomplet »). */}
              <div id={`message-${genre}`} hidden={!deplie} className="pb-[18px] pt-0.5">
                {/* **Une seule case, et c'est le message FINAL.** Les mots dorés y
                    sont posés remplis : ce qu'il lit est ce que Mme Larousse
                    recevra, à son nom près. */}
                <EditeurMessage
                  valeur={messages[genre]}
                  nom={nom}
                  libelles={{
                    "[client]": "Mme Larousse",
                    "[document]": motDuDocument(genre),
                    // Le numéro d'exemple au format qu'il a choisi, pris à la
                    // MÊME fonction que le vrai (`ecrireNumero`).
                    "[numero]":
                      genre === "passage"
                        ? ""
                        : ecrireNumero(formatNumero, genre, {
                            ...EXEMPLE_NUMERO,
                            numero: genre === "facture" ? 8 : EXEMPLE_NUMERO.numero,
                          }),
                    // **La virgule reste DANS la pastille**, et ce n'est pas une
                    // coquette : l'échéance emporte ses mots (`clauseEcheance`)
                    // parce qu'une facture sans délai de paiement n'en a pas. La
                    // retirer de l'affichage ferait lire « F2026-0008 à régler… »
                    // là où le client lira « F2026-0008, à régler… ».
                    "[echeance]": clauseEcheance(genre === "facture" ? echeanceDExemple : null),
                    // **Les deux morceaux du devis s'écrivent en entier**, comme le
                    // client les lira : la phrase « autre date » case cochée, et la
                    // durée du lien comptée depuis aujourd'hui (29 septembre 2026).
                    "[autre-date]": clauseAutreDate(true),
                    "[lien]": "https://…",
                    "[validite]": clauseValidite(expireLeDExemple, signature),
                    "[entreprise]": signature,
                  }}
                  invalide={raison !== null}
                  onChange={(m) => {
                    setMessages((v) => ({ ...v, [genre]: m }));
                    setAEcrire(true);
                  }}
                />

                {raison && (
                  <p
                    role="alert"
                    data-atlas={`message-refus-${genre}`}
                    className="mx-0.5 mt-2.5 flex items-start gap-2 text-[14.5px] leading-[1.4]"
                    style={{ color: colors.alert }}
                  >
                    <Picto nom="alerte" taille={20} />
                    <span>{raison}</span>
                  </p>
                )}

                {/* Le seul filet de sécurité qui reste : reprendre le message
                    d'Atlas s'il l'a défait, par exemple en retirant le lien, que
                    le serveur refuse. Montré seulement quand le sien en diffère. */}
                {sien && (
                  <button
                    type="button"
                    data-atlas={`message-defaut-${genre}`}
                    onClick={() => {
                      setMessages((v) => ({ ...v, [genre]: MESSAGES_PAR_DEFAUT[genre] }));
                      setAEcrire(true);
                    }}
                    className="mt-1 inline-flex min-h-[48px] items-center gap-1.5 rounded-full px-1 text-[16px] font-semibold"
                    style={{ color: colors.or }}
                  >
                    <Picto nom="annuler" taille={18} />
                    Remettre le message d&apos;Atlas
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </Paquet>

      <BarreEnregistrer
        aEcrire={aEcrire}
        enCours={enCours}
        refus={refus.length > 0 ? "Message incomplet" : null}
        onEnregistrer={enregistrer}
      />
    </div>
  );
}
