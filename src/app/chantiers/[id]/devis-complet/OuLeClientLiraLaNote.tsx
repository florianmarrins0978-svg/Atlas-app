"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { colors } from "@/lib/design-tokens";

/** La page du client, la note entourée d'or : une image de `public/`, la même pour tous. */
export const IMAGE_NOTE_CHEZ_LE_CLIENT = "/images/devis-note-chez-le-client.jpg";

/** Huit secondes : sa demande du 3 novembre 2026, devant la planche qui en tenait quatre. */
export const DUREE_FENETRE_NOTE_MS = 8000;

/**
 * « TA NOTE : TON CLIENT LA LIRA ICI » — sa planche du 3 novembre 2026
 * (`appli/soignee/devis-note-avant-envoi.html`), tranchée le 4 : au toucher de
 * « Notes / conditions », huit secondes, et UNE SEULE FOIS par compte
 * (`aideNoteDevisAMontrer`, migration 0163).
 *
 * **Une vraie image de la page du client**, la note entourée d'or : sa
 * retouche, *« il faut mettre la vraie photo, là on comprend rien sur le petit
 * dessin »*. Elle vient de la planche, qui recopie la vraie page avec la note
 * à sa place (A, juste avant « J'accepte ce devis »).
 *
 * **Sur l'encre, en haut de l'écran** : le clavier s'ouvre en bas au même
 * moment. Elle ne demande aucun geste, donc la manquer ne coûte rien ; un
 * appui la ferme avant la fin, et le trait d'or qui se vide dit qu'elle part.
 */
export default function OuLeClientLiraLaNote({ ouverte, onFermer }: { ouverte: boolean; onFermer: () => void }) {
  // Démontée fermée : rouverte, elle repart de son premier état sans rien
  // remettre à zéro à la main.
  return ouverte ? <Fenetre onFermer={onFermer} /> : null;
}

function Fenetre({ onFermer }: { onFermer: () => void }) {
  // Posée d'abord en haut et pleine, puis, une image plus tard, descendue et
  // vidée : la transition part de là. Sans feuille de style à elle, pour ne
  // pas toucher au gabarit commun (`globals.css`) pour une seule fenêtre.
  const [partie, setPartie] = useState(false);
  useEffect(() => {
    const image = requestAnimationFrame(() => requestAnimationFrame(() => setPartie(true)));
    const minuteur = setTimeout(onFermer, DUREE_FENETRE_NOTE_MS);
    return () => {
      cancelAnimationFrame(image);
      clearTimeout(minuteur);
    };
  }, [onFermer]);

  return (
    <button
      type="button"
      data-atlas="ou-le-client-lira-la-note"
      onClick={onFermer}
      aria-label="Fermer"
      className="atlas-colonne-fixe z-50 block px-[10px] pt-3 text-left motion-reduce:transition-none"
      style={{
        top: 0,
        opacity: partie ? 1 : 0,
        transform: partie ? "none" : "translateY(-18px)",
        transition: "opacity 260ms cubic-bezier(0.22, 0.61, 0.36, 1), transform 380ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <span
        className="relative block overflow-hidden rounded-[18px] px-3 pb-4 pt-3"
        style={{ backgroundColor: colors.ink, color: colors.cream, boxShadow: "0 12px 30px -10px rgba(13,14,12,0.6)" }}
      >
        <span role="status" className="mx-1 mb-2.5 block text-[15.5px] leading-[1.38]">
          <strong className="font-bold" style={{ color: colors.orSurEncre }}>
            Ta note :
          </strong>{" "}
          ton client la lira ici, juste avant « J&apos;accepte ce devis ».
        </span>
        {/* Une image et non un composant : c'est une illustration, la même
            pour tous, et elle ne doit pas attendre les données du devis. */}
        <Image
          src={IMAGE_NOTE_CHEZ_LE_CLIENT}
          alt="La page du devis chez le client, la note entourée d'or juste avant « J'accepte ce devis »"
          width={390}
          height={199}
          className="block h-auto w-full rounded-[10px]"
          // Le fichier tel quel, déjà chargé (`IMAGE_NOTE_CHEZ_LE_CLIENT`,
          // préchargée par l'écran du devis) : passée par l'optimiseur, elle
          // arrivait APRÈS la fenêtre, qui restait noire ses premières
          // secondes (vu sur l'écran le 4 novembre 2026).
          unoptimized
        />
        <span aria-hidden className="absolute inset-x-4 bottom-[7px] block h-[3px] overflow-hidden rounded-full" style={{ backgroundColor: "rgba(250,249,245,0.16)" }}>
          <span
            className="block h-full origin-left"
            style={{
              backgroundColor: colors.orSurEncre,
              transform: partie ? "scaleX(0)" : "scaleX(1)",
              transition: `transform ${DUREE_FENETRE_NOTE_MS}ms linear`,
            }}
          />
        </span>
      </span>
    </button>
  );
}
