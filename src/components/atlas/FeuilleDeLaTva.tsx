"use client";

import FeuilleDuTaux from "./FeuilleDuTaux";
import { lireUneTva, type PieceDeLaTva } from "@/lib/feuilles-du-taux";
import { tauxLisible, tauxTvaPropose } from "@/lib/reduction-devis";

/**
 * ─── LA FEUILLE D'UNE TVA — le devis ET la facture ──────────────────────────
 *
 * Sur le devis depuis le 1er novembre 2026, sur la facture depuis le
 * 4 novembre (sa planche `appli/soignee/facture.html`, page « ts ») : la
 * pastille « Ajouter une TVA » ouvre cette feuille, le taux se tape, 10, 5,5
 * et 0 % en raccourcis. Avant, sur la facture, « + Ajouter une TVA » posait
 * d'office le premier taux libre, et il fallait le corriger dans le titre.
 *
 * **La case s'ouvre sur ce que l'ancien geste posait** (`tauxTvaPropose`) :
 * 10 %, l'exemple qu'il a donné deux fois, puis le suivant qui n'est pas pris.
 * `dejaOuverts` porte les taux des catégories de la pièce ; un taux déjà
 * ouvert se refuse (`lireUneTva`), avec le nom de la pièce dans la phrase.
 */
export default function FeuilleDeLaTva({
  ouverte,
  dejaOuverts,
  piece,
  onAjouter,
  onFermer,
}: {
  ouverte: boolean;
  dejaOuverts: readonly string[];
  piece: PieceDeLaTva;
  /** Le taux relu (`tauxTvaValide`, deux décimales), tel que le serveur le relira. */
  onAjouter: (taux: string) => void;
  onFermer: () => void;
}) {
  return (
    <FeuilleDuTaux
      ouverte={ouverte}
      titre="Une TVA"
      nomDeLaCase="Taux de la TVA à ajouter, en pourcentage"
      valeurInitiale={tauxTvaPropose(dejaOuverts)}
      raccourcis={["10", "5.5", "0"]}
      lire={(saisie) => lireUneTva(saisie, dejaOuverts, piece)}
      bouton={(taux) => `Ajouter la TVA à ${tauxLisible(taux)} %`}
      repere="feuille-tva"
      onValider={onAjouter}
      onFermer={onFermer}
    />
  );
}
