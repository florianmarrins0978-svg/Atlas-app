"use client";

import { useEffect, useState } from "react";
import { colors } from "@/lib/design-tokens";
import { annonceTransmission, CLE_TRANSMISSION, type Transmission } from "@/lib/annonce-transmission";

/**
 * Le bandeau qui accueille le patron au retour de sa messagerie.
 *
 * *« Lorsque j'envoie le SMS et que je reviens sur la page, il faut que la page
 * se remette sur la première page automatiquement, avec un petit message. »*
 * — le 7 août 2026.
 *
 * **Lu puis effacé aussitôt.** Sans cela, le bandeau reviendrait à chaque
 * passage sur l'accueil, et finirait par ne plus rien vouloir dire — un message
 * qu'on voit dix fois est un message qu'on ne lit plus.
 *
 * **Il s'efface tout seul au bout de six secondes.** Assez pour être lu en
 * remontant du fond d'une camionnette, trop peu pour rester en travers de la
 * liste. Aucune croix à viser : un geste de plus pour une information qui n'en
 * demande aucun.
 */
export default function AnnonceTransmission() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // **Lu après le premier rendu, jamais pendant.** Deux raisons, et la
    // seconde n'est pas un détail de style :
    //
    //   - `sessionStorage` n'existe pas côté serveur. Lire au rendu ferait
    //     afficher le bandeau au client et pas au serveur : React signalerait
    //     l'écart, et le bandeau clignoterait ;
    //   - React interdit de poser un état directement dans un effet
    //     (`react-hooks/set-state-in-effect`), et il a raison : c'est un rendu
    //     de plus, décidé sans que rien ne l'ait demandé.
    const lecture = setTimeout(() => {
      let brut: string | null = null;
      try {
        brut = sessionStorage.getItem(CLE_TRANSMISSION);
        // Effacé aussitôt lu : sans cela, le bandeau reviendrait à chaque
        // passage sur l'accueil, et un message vu dix fois ne se lit plus.
        if (brut) sessionStorage.removeItem(CLE_TRANSMISSION);
      } catch {
        // Navigation privée, stockage refusé : pas de bandeau, et rien d'autre.
        return;
      }
      if (!brut) return;

      try {
        const t = JSON.parse(brut) as Transmission;
        if (t?.quoi !== "devis" && t?.quoi !== "facture") return;
        setMessage(annonceTransmission(t));
      } catch {
        // Contenu illisible : on n'affiche rien plutôt qu'une phrase fabriquée.
      }
    }, 0);
    return () => clearTimeout(lecture);
  }, []);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 6000);
    return () => clearTimeout(t);
  }, [message]);

  if (!message) return null;

  return (
    <div className="px-6 pt-4">
      <p
        role="status"
        className="rounded-[4px] px-4 py-3 text-[14px] leading-snug"
        style={{ backgroundColor: colors.rustTint, color: colors.rust }}
      >
        {message}
      </p>
    </div>
  );
}
