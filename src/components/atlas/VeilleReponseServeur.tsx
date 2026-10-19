"use client";

import { useEffect, useState } from "react";
import { colors, font } from "@/lib/design-tokens";
import { estReponseIllisible, PHRASE_REPONSE_ILLISIBLE } from "@/lib/reponse-illisible";
import { estPageVieillie } from "@/lib/reprise-erreur";

/**
 * Quand la réponse du serveur n'a pas pu être lue, le dire — en français.
 *
 * **La capture du patron, le 12 août 2026 à 14 h 04 :** un panneau rouge,
 * « An unexpected response was received from the server. », une pile d'appel
 * dans `node_modules`. Rien sur ce qui s'est passé, rien sur ce qu'il doit
 * faire, et pas un mot de français.
 *
 * Ce panneau est celui du mode développement. **Sur la version rapide, il
 * n'existe pas du tout** : l'échec y est simplement silencieux — le bouton
 * pressé ne fait rien, et le patron reste devant un écran qui ne bouge pas.
 * Des deux, c'est le silence le pire.
 *
 * Ce veilleur écoute donc les promesses rejetées que personne n'a rattrapées,
 * reconnaît cette famille d'échec, et pose une phrase avec le seul geste qui
 * marche : recharger.
 *
 * **Il reconnaît aussi la page vieillie — 17 octobre 2026.** Un geste lancé
 * sans attendre sa réponse (le titre du devis, enregistré en quittant le
 * champ) refusé par un serveur qui a changé de version ne rejetait vers
 * personne : le titre semblait écrit, il ne l'était pas. La même phrase
 * dirait à tort que le serveur tarde ; celle-ci dit ce qui s'est passé.
 *
 * **Ce qu'il ne fait pas, et c'est délibéré.** Il ne masque aucune autre
 * erreur : tout ce qu'il ne reconnaît pas continue son chemin vers le panneau
 * habituel. Habiller en « le serveur se prépare » un défaut du code enverrait
 * chercher au mauvais endroit — la faute que ce dépôt paie le plus cher.
 */
const PHRASE_PAGE_VIEILLIE =
  "Atlas a été mis à jour depuis l'ouverture de cette page : ce que vous venez de faire n'est pas parti. Rechargez la page.";

export default function VeilleReponseServeur() {
  const [phrase, setPhrase] = useState<string | null>(null);

  useEffect(() => {
    function surRejet(e: PromiseRejectionEvent) {
      const raison = e.reason;
      const message =
        raison instanceof Error ? raison.message : typeof raison === "string" ? raison : "";
      if (estPageVieillie(raison)) setPhrase(PHRASE_PAGE_VIEILLIE);
      else if (estReponseIllisible(message)) setPhrase(PHRASE_REPONSE_ILLISIBLE);
    }
    // `error` aussi : selon le chemin, l'échec remonte en événement d'erreur
    // plutôt qu'en promesse rejetée, et n'en attraper qu'un laisserait la
    // moitié des cas muets — ce qu'on est précisément en train de corriger.
    function surErreur(e: ErrorEvent) {
      if (estPageVieillie(e.error)) setPhrase(PHRASE_PAGE_VIEILLIE);
      else if (estReponseIllisible(e.message)) setPhrase(PHRASE_REPONSE_ILLISIBLE);
    }
    window.addEventListener("unhandledrejection", surRejet);
    window.addEventListener("error", surErreur);
    return () => {
      window.removeEventListener("unhandledrejection", surRejet);
      window.removeEventListener("error", surErreur);
    };
  }, []);

  if (!phrase) return null;

  return (
    <div
      role="alert"
      data-atlas="reponse-illisible"
      // Au-dessus de la barre du bas, sous le panneau du mode développement :
      // quand les deux s'affichent, celui-ci doit rester lisible sans recouvrir
      // ce que le patron pourrait vouloir nous montrer.
      className="atlas-colonne-fixe bottom-0 z-[60] px-4 pb-24 pt-3"
    >
      <div
        className="rounded-[4px] px-4 py-4"
        style={{
          backgroundColor: colors.cream,
          border: `1px solid ${colors.line}`,
          boxShadow: "0 -10px 30px rgba(20,18,14,0.16)",
        }}
      >
        <p className="text-[14px] leading-snug" style={{ color: colors.ink }}>
          {phrase}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="atlas-plein rounded-full px-4 py-2.5 text-[14px] font-medium text-white"
            style={{ backgroundColor: colors.plein, fontFamily: font.display }}
          >
            Recharger
          </button>
          <button
            type="button"
            onClick={() => setPhrase(null)}
            className="text-[13px]"
            style={{ color: colors.muted }}
          >
            Masquer
          </button>
        </div>
      </div>
    </div>
  );
}
