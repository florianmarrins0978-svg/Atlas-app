"use client";

import { useState } from "react";
import { colors } from "@/lib/design-tokens";
import { composerMessageClient, lienTransmission, type CanalClient } from "@/lib/message-client";

// Ouvre l'application de messagerie du patron, message prêt à partir.
//
// Pourquoi ce bouton existe : aucun prestataire d'e-mail ni de SMS n'est
// raccordé (docs/A-FAIRE.md §5), et le brancher suppose un abonnement ET un nom
// de domaine — deux achats que le patron n'a pas encore faits. En attendant, le
// dernier mètre du parcours n'existait pas : le lien était affiché, à recopier
// à la main dans un SMS. Sur dix chantiers par semaine, vingt gestes.
//
// C'est exactement ce que faisait le site Arborea, et ce qui donnait au patron
// l'impression que « ça marchait sans rien » : le site n'envoyait pas, il
// ouvrait sa boîte mail. Atlas prépare, le patron expédie.
//
// Ce que cela ne donne PAS, et qui reste au point 5 : Atlas ne sait pas que le
// message est parti, donc pas de relance automatique à sept jours. La réponse
// du client, elle, revient normalement — il répond sur la page web, pas par
// retour de courrier. Tout l'aval du parcours (acceptation, planification, fin
// de chantier, facture) fonctionne donc dès aujourd'hui.

type Props = {
  clientNom: string;
  entrepriseNom: string;
  canal: CanalClient;
  destinataire: string | null;
  lien: string;
};

export default function TransmettreAuClient({
  clientNom,
  entrepriseNom,
  canal,
  destinataire,
  lien,
}: Props) {
  const [erreur, setErreur] = useState<string | null>(null);

  const message = composerMessageClient({ clientNom, entrepriseNom, lien });

  async function transmettre() {
    setErreur(null);

    // Sur téléphone, le menu de partage laisse choisir SMS, e-mail, WhatsApp —
    // c'est le client qui décide où il lit, pas nous. Absent sur ordinateur :
    // on retombe alors sur l'application par défaut.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: message.objet, text: message.corps });
        return;
      } catch (e) {
        // Un partage annulé n'est pas une panne : le patron a changé d'avis.
        if (e instanceof Error && e.name === "AbortError") return;
        // Tout autre échec bascule sur le chemin ci-dessous plutôt que de
        // laisser le bouton sans effet.
      }
    }

    try {
      window.location.href = lienTransmission({ canal, destinataire, message });
    } catch {
      setErreur(
        "Aucune application de messagerie n'a pu être ouverte. Le lien reste copiable ci-dessus."
      );
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={transmettre}
        className="mt-3 block w-full rounded-2xl py-3 text-[15px] font-medium text-white"
        style={{ backgroundColor: colors.rust }}
      >
        {canal === "sms" ? "Ouvrir le SMS tout prêt" : "Ouvrir le message tout prêt"}
      </button>
      <p className="mt-2 text-center text-[12px]" style={{ color: colors.muted }}>
        Le message s&apos;ouvre dans votre messagerie — c&apos;est vous qui l&apos;envoyez.
      </p>
      {erreur && (
        <p role="alert" className="mt-2 text-center text-[13px]" style={{ color: colors.rust }}>
          {erreur}
        </p>
      )}
    </>
  );
}
