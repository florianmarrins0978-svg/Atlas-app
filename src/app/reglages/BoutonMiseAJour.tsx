"use client";

import { useState } from "react";
import { colors } from "@/lib/design-tokens";
import { mettreAJourApplicationAction } from "./actions";

/**
 * « Chercher les dernières corrections », depuis l'application elle-même.
 *
 * Trois soirées ont été perdues sur le même malentendu : le patron essaie des
 * correctifs livrés une heure plus tôt, ne voit rien changer, et conclut —
 * légitimement — que rien n'a été corrigé. L'espace de travail ne récupère le
 * code neuf qu'au démarrage ; recharger la page ne le redémarre pas, et rien
 * ne le disait.
 *
 * Ce bouton n'est pas un confort : c'est la fin d'une classe entière de
 * malentendus, où le produit paraît cassé alors qu'il est simplement vieux.
 */
export default function BoutonMiseAJour() {
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function chercher() {
    setEnCours(true);
    setMessage(null);
    setErreur(null);
    try {
      const r = await mettreAJourApplicationAction();
      if (r.succes) setMessage(r.message);
      else setErreur(r.erreur);
    } catch {
      setErreur("La mise à jour n'a pas abouti. Redémarrez l'espace de travail.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={chercher}
        disabled={enCours}
        className="rounded-xl px-4 py-2.5 text-[14px] font-medium"
        style={{ backgroundColor: colors.rustTint, color: colors.rust }}
      >
        {enCours ? "Recherche en cours…" : "Chercher les dernières corrections"}
      </button>

      {message && (
        <p className="mt-2 text-[13px]" style={{ color: colors.ink }}>
          {message}
        </p>
      )}
      {erreur && (
        <p role="alert" className="mt-2 text-[13px]" style={{ color: colors.alert }}>
          {erreur}
        </p>
      )}
    </div>
  );
}
