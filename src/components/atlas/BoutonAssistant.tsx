"use client";

import { colors, surPlein } from "@/lib/design-tokens";
import { useAssistant } from "./assistant-contexte";

/**
 * Le bouton qui ouvre l'assistant, dans l'en-tête de l'écran.
 *
 * **Proposition B, choisie par le patron le 13 août 2026** dans
 * `docs/maquettes/47-ou-mettre-l-assistant.html`, avec une précision de sa
 * part : *« la B mais de la même couleur qu'elle est déjà »*. La maquette le
 * montrait en beige teinté, comme le micro ; il garde donc le **vert pin plein
 * et l'icône blanche** de la bulle qu'il remplace. Rien d'autre ne change de
 * son apparence — seulement sa place et sa taille.
 *
 * **44 px et non 56.** C'est la mesure des ronds d'en-tête d'Atlas — le micro
 * de « Un chantier », la flèche de retour à 40. Garder 56 dans une ligne qui en
 * fait 40 aurait fait de lui la chose la plus grosse de l'écran, ce qu'il n'est
 * pas : ce n'est pas l'action principale d'un écran, c'est un recours.
 *
 * **Pourquoi il ne flotte plus**, et ce que ça règle : cinq fois cet été, la
 * bulle a recouvert quelque chose, et cinq fois c'est l'écran qu'on a déplacé
 * pour l'éviter (`ARCHITECTURE.md` §106). Un élément qui ne flotte pas ne peut
 * rien recouvrir — y compris sur les écrans qui n'existent pas encore.
 */
export default function BoutonAssistant() {
  const assistant = useAssistant();
  // Hors du fournisseur, il n'aurait rien à ouvrir : il se tait plutôt que de
  // faire tomber l'écran qui le porte.
  if (!assistant) return null;

  return (
    <button
      type="button"
      onClick={assistant.basculer}
      aria-label={assistant.ouvert ? "Fermer l'assistant" : "Ouvrir l'assistant"}
      aria-expanded={assistant.ouvert}
      className="atlas-plein flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full"
      style={{ backgroundColor: colors.plein }}
    >
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" style={{ stroke: surPlein }} strokeWidth="1.8">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    </button>
  );
}
