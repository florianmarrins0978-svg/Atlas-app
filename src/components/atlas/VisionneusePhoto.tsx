"use client";

import { createPortal } from "react-dom";
import { colors, surPlein, voile } from "@/lib/design-tokens";

/**
 * LA PHOTO EN GRAND — une seule visionneuse pour toute l'application.
 *
 * **Elle vivait dans la pellicule du chantier, et elle y était seule.** Le
 * 11 septembre 2026, le patron a demandé la même chose sur les retours
 * d'intervention : *« ce qui serait bien, c'est qu'on puisse cliquer dessus
 * pour qu'elle apparaisse en grand »*. La recopier aurait fait deux
 * visionneuses — donc deux façons de fermer, et un jour deux couleurs de fond
 * (`CLAUDE.md` §3). Elle a donc été sortie de `Pellicule` plutôt que
 * dupliquée, et la pellicule s'en sert désormais comme tout le monde.
 *
 * **Ce qui change d'un appelant à l'autre tient dans `children`** : la
 * pellicule y met « Retirer », les retours n'y mettent rien — on ne retire pas
 * depuis le compte rendu d'un salarié.
 *
 * ─── ELLE SORT PAR UN PORTAIL, ET IL LE FAUT ────────────────────────────────
 * Un tiroir ou une carte qui porte un `z-index` ouvre son propre contexte
 * d'empilement : rendue à l'intérieur, une visionneuse « plein écran » reste
 * plafonnée à ce niveau, et la barre de navigation — posée plus loin dans le
 * document — se peint par-dessus. On verrait « Chantiers / Planning » en
 * travers de la photo.
 *
 * ─── ELLE RETOURNE LES PÔLES, ET C'EST TOUT LE PIÈGE ────────────────────────
 * Le fond est `ink`, pour qu'on ne voie que la photo. Sur les six chartes
 * claires l'encre est presque noire ; sur Nuit et Sylve elle est CLAIRE. Rien
 * de ce qu'on pose dessus ne peut donc être écrit en clair — la croix était
 * `#F6F1E6` et les pastilles `rgba(255,255,255,0.12)`, soit un crème sur un
 * crème : 1,09 sur Nuit. On ne voyait plus comment sortir de la photo. D'où
 * `surPlein` et `voile(surPlein, …)`, et jamais une couleur écrite en clair.
 */
export default function VisionneusePhoto({
  storageKey,
  onFermer,
  children,
}: {
  storageKey: string;
  onFermer: () => void;
  /** Ce qui s'ajoute à droite de la croix. Rien, le plus souvent. */
  children?: React.ReactNode;
}) {
  // `document` n'existe pas au rendu serveur. Le garde ne masque aucun écart
  // d'hydratation : au premier rendu, aucune photo n'est ouverte — des deux
  // côtés.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      data-atlas="photo-en-grand"
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: colors.ink }}
    >
      <div className="flex items-center justify-between px-[26px] pt-8">
        <button
          onClick={onFermer}
          aria-label="Fermer"
          className="flex h-11 w-11 items-center justify-center rounded-full"
          style={{ backgroundColor: voile(surPlein, 0.12) }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={surPlein} strokeWidth="2.2">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
        {children}
      </div>
      <div className="flex flex-1 items-center justify-center">
        {/* Conservé en <img> : dimensions intrinsèques inconnues à l'avance
            (photos de tailles arbitraires) dans un conteneur flexible non
            dimensionné. Et `next/image` réécrirait le `src` via `/_next/image`,
            or ces fichiers sortent d'une route gardée qui vérifie à qui ils
            appartiennent : ce serait un second chemin vers des photos de
            chantier. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/fichiers/${storageKey}`} alt="" className="max-h-full max-w-full object-contain" />
      </div>
    </div>,
    document.body
  );
}
