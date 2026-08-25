"use client";

import { createContext, useContext, useMemo, useState } from "react";

/**
 * L'état de l'assistant, partagé entre son bouton et son panneau.
 *
 * **Pourquoi ce contexte existe.** Le patron, le 13 août 2026 : *« l'onglet de
 * l'assistant est hyper mal placé »*. Il a choisi la proposition B de
 * `docs/maquettes/47-ou-mettre-l-assistant.html` : le bouton quitte le coin
 * flottant et rejoint l'en-tête de l'écran.
 *
 * Or le PANNEAU, lui, doit rester au-dessus de tout — il vit donc encore dans
 * le gabarit racine. Bouton et panneau ne sont plus voisins dans l'arbre : il
 * leur faut un état commun, et c'est tout ce que fait ce fichier.
 *
 * **Ce qu'on gagne à les séparer**, au-delà de la demande : le bouton peut
 * désormais se poser là où chaque écran a de la place, sans que le panneau
 * bouge d'un pixel. C'est ce qui a manqué cinq fois cet été — la bulle
 * recouvrait « ou rédiger le devis à la main », « Préparer le devis », un
 * bouton de reprise, une capsule qu'il a fallu centrer, une phrase qu'il a
 * fallu caler à gauche (`ARCHITECTURE.md` §106).
 */
type Assistant = {
  ouvert: boolean;
  basculer: () => void;
  fermer: () => void;
};

const Contexte = createContext<Assistant | null>(null);

/**
 * **`disponible: false` éteint l'assistant pour de bon**, bouton compris.
 *
 * Un salarié n'y a pas droit : l'assistant reconstitue au serveur les chantiers,
 * les clients, les prestations et les PRIX de l'entreprise (`assistant-service`).
 * Le lui laisser rouvrirait par une conversation tout ce que les rôles viennent
 * de fermer — et par la porte la plus difficile à surveiller, puisqu'il suffit
 * de demander.
 *
 * **Ce n'est pas ce qui protège.** `poserQuestionAction` refuse au SERVEUR ; ceci
 * évite seulement de lui montrer un bouton qui ne répondrait pas.
 *
 * Rendre le fournisseur inerte plutôt que d'ajouter un test dans le bouton :
 * `useAssistant()` rend déjà `null` hors fournisseur, et le bouton sait déjà se
 * taire dans ce cas. Un seul chemin, celui qui existe.
 */
export function FournisseurAssistant({
  children,
  disponible = true,
}: {
  children: React.ReactNode;
  disponible?: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const valeur = useMemo<Assistant>(
    () => ({
      ouvert,
      basculer: () => setOuvert((o) => !o),
      fermer: () => setOuvert(false),
    }),
    [ouvert],
  );
  return <Contexte.Provider value={disponible ? valeur : null}>{children}</Contexte.Provider>;
}

/**
 * **Rend `null` hors du fournisseur, au lieu de lever.**
 *
 * Le bouton vit dans `EnTeteEcran`, une pièce que onze écrans emploient — et
 * qu'une page hors du gabarit (un écran public par jeton, une page d'erreur)
 * pourrait employer demain. Y lever une exception ferait tomber la page entière
 * pour un bouton d'agrément ; et une action serveur qui plante rend au patron un
 * identifiant opaque, jamais la cause (`HANDOVER.md`, piège 0 ter). Le bouton se
 * tait donc et disparaît, ce qui est le comportement juste : sans panneau pour
 * l'entendre, il n'aurait rien ouvert.
 */
export function useAssistant(): Assistant | null {
  return useContext(Contexte);
}
