"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import FeuilleSuppressionClients from "@/components/atlas/FeuilleSuppressionClients";
import { colors } from "@/lib/design-tokens";
import { supprimerClientAction } from "./actions";
import { oublierCetEcran } from "@/components/atlas/journal-navigateur";

/**
 * SUPPRIMER UN CLIENT — sa proposition C, tranchée le 27 août 2026.
 *
 * *« Je pense la C ; lorsqu'un client a des documents il faut mettre la phrase
 * de prévention, et une phrase disant également avez-vous sauvegardé ses
 * documents autre part — et si le client dit oui il peut supprimer quand
 * même. »*
 *
 * ─── LE GESTE EST EN BAS DE LA FICHE, ET C'EST DÉLIBÉRÉ ─────────────────────
 *
 * La planche proposait deux places : ici, ou en glissant la ligne dans la liste.
 * Il n'a pas tranché celle-là. Le bas de la fiche est retenu parce que c'est le
 * choix qu'on peut défaire : un geste qu'on trouve **en le cherchant** ne se
 * déclenche pas au pouce en faisant défiler une liste. L'autre reste ouvert.
 *
 * ─── LA FEUILLE EST PARTAGÉE AVEC LA LISTE ─────────────────────────────────
 *
 * Depuis le 23 octobre 2026, plusieurs clients se suppriment aussi depuis la
 * liste, avec la même prévention : elle vit dans `FeuilleSuppressionClients`,
 * et c'est elle qu'il faut lire pour ce qu'elle dit et pourquoi.
 */
export default function SupprimerCeClient({
  clientId,
  nom,
  documents,
  conserve,
}: {
  clientId: string;
  nom: string;
  /** Combien de documents ce client porte. Zéro : pas de prévention. */
  documents: number;
  /** Ce que la loi oblige à garder, déjà nommé — jamais deviné ici. */
  conserve: { numero: string; pourquoi: string }[];
}) {
  const router = useRouter();
  const [ouverte, setOuverte] = useState(false);
  const [sauvegarde, setSauvegarde] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function fermer() {
    setOuverte(false);
    setSauvegarde(false);
    setRefus(null);
  }

  function supprimer() {
    setRefus(null);
    demarrer(async () => {
      const issue = await supprimerClientAction(clientId);
      if (!issue.ok) {
        setRefus(issue.message);
        return;
      }
      // **La fiche disparaît DU JOURNAL avant qu'on la quitte — 9 septembre
      // 2026.** Depuis que la flèche de retour ramène à la page d'où l'on
      // vient (`src/lib/journal-de-navigation.ts`), une adresse laissée dans
      // le journal est une destination promise. Celle-ci ne mène plus à rien :
      // la flèche de l'écran suivant déposerait sur une fiche effacée.
      oublierCetEcran(window.location.pathname);
      // La fiche n'existe plus : y rester montrerait un écran vide.
      router.replace("/clients");
      router.refresh();
    });
  }

  return (
    <>
      {/* ── LE GESTE NE S'ANNONCE PLUS, IL SE TROUVE — 2 septembre 2026 ─────
          Retenu sur maquette : plus de capsule rouge, le seul objet dessiné de
          l'écran, qui appelait l'œil vers la sortie. Il reste en bas de la
          fiche, là où on le trouve en le cherchant.

          **En toutes lettres depuis le 25 octobre 2026**, sur sa planche :
          9,5 px en capitales espacées étaient le texte le plus petit de la
          fiche. Le mot passe à 15,5 px, en gras, précédé d'une croix ; il reste
          sans cadre, et c'est la feuille qui protège, pas le dessin. */}
      <div className="mt-[34px] px-[22px]">
        <button
          type="button"
          data-atlas="supprimer-client"
          onClick={() => setOuverte(true)}
          className="flex min-h-[52px] w-full cursor-pointer items-center justify-center gap-2 text-[15.5px] font-bold"
          style={{ background: "transparent", color: colors.alert, WebkitTapHighlightColor: "transparent" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
            <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
          </svg>
          Supprimer ce client
        </button>
      </div>

      <FeuilleSuppressionClients
        ouverte={ouverte}
        titre={nom}
        noms={null}
        documents={documents}
        conserve={conserve}
        sauvegarde={sauvegarde}
        basculerSauvegarde={() => setSauvegarde((v) => !v)}
        refus={refus}
        enCours={enCours}
        libelleConfirmer="Supprimer"
        confirmer={supprimer}
        fermer={fermer}
      />
    </>
  );
}
