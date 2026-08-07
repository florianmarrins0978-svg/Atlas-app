"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
export default function BoutonMiseAJour({ derniereIssue }: { derniereIssue: string | null }) {
  const router = useRouter();
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
      // **Ce message accusait le mauvais coupable, et le patron l'a lu.**
      //
      // Il disait « La mise à jour n'a pas abouti. Redémarrez l'espace de
      // travail. » — alors que la cause la plus fréquente, de loin, est que la
      // mise à jour a RÉUSSI : elle remplace des centaines de fichiers sous le
      // serveur en train de tourner, celui-ci se recompile aussitôt, et la
      // réponse en cours de route est coupée. Envoyer redémarrer quelqu'un dont
      // le travail vient d'aboutir coûte deux minutes et une confiance.
      //
      // On ne prétend donc plus savoir : on désigne l'endroit qui, lui, ne peut
      // pas se tromper — la ligne Version juste au-dessus, lue dans le dépôt
      // réellement servi (`src/server/version-executee.ts`).
      setErreur(
        "La réponse n'est pas revenue — c'est presque toujours parce que l'application " +
          "se recompile avec le code neuf, ce qui coupe la réponse en route. Regardez la " +
          "ligne Version juste au-dessus : si elle a changé, la mise à jour a bien eu lieu. " +
          "Sinon, arrêtez puis rouvrez l'espace de travail."
      );
    } finally {
      setEnCours(false);
      // La ligne Version est relue à chaque affichage, dans le dépôt servi :
      // la rafraîchir ICI fait que l'écran répond de lui-même, sans demander
      // au patron de recharger. C'est exactement la question qu'il pose —
      // « je vois toujours pas la nouvelle version » — et il n'a plus à la
      // poser. Vaut aussi après un échec : la mise à jour a pu aboutir.
      router.refresh();
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
        <p role="alert" className="mt-2 text-[13px] leading-snug" style={{ color: colors.alert }}>
          {erreur}
        </p>
      )}

      {/* L'issue du dernier essai, écrite côté serveur avant que la réponse
          puisse être coupée. C'est elle qui donne la RAISON quand la mise à
          jour a refusé — « des modifications non enregistrées sont présentes »
          n'appelle pas le même geste qu'« historique divergent », et le patron
          ne peut pas la deviner. Elle survit à un rechargement, contrairement
          aux deux lignes ci-dessus. */}
      {derniereIssue && !message && !erreur && (
        <p className="mt-2 text-[12px] leading-snug" style={{ color: colors.muted }}>
          Dernier essai : {derniereIssue}
        </p>
      )}
    </div>
  );
}
