"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { colors, surPlein } from "@/lib/design-tokens";
import { accuserReceptionAction, noterOuvertureAction } from "./actions";

/**
 * « J'AI BIEN REÇU CETTE FACTURE » — sa demande du 9 septembre 2026.
 *
 * *« Sur le lien qu'on envoie au client avec sa facture, on peut pas mettre une
 * case à cocher qui stipule qu'il accuse bonne réception ? Ça évite les "ah
 * ouais mais j'ai pas vu votre facture". »*
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **ELLE NE CONDITIONNE RIEN, ET C'EST LUI QUI L'A TRANCHÉ.** Il avait d'abord
 * proposé d'obliger à cocher pour télécharger, puis l'a écarté le jour même :
 * *« mais ça ne l'empêche pas de télécharger la facture s'il ne coche pas ! »*.
 * Une facture se donne ; la retenir se retourne contre l'artisan — un client
 * qui ne coche pas ne télécharge pas non plus, et là il ne l'a vraiment pas
 * reçue. La case est donc TOUT EN BAS, après « Pour régler » : posée sous le
 * bouton de téléchargement, elle se lirait comme une condition à remplir.
 *
 * **ELLE NE SE DÉCOCHE PAS.** Une confirmation retirée ne veut rien dire, et
 * laisserait croire qu'une trace s'efface. Tenu en base par un garde `IS NULL`
 * (`envois-factures.ts`), pas seulement à l'écran.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE COMPOSANT PORTE AUSSI LA DATE D'OUVERTURE, et c'est le point important.**
 *
 * Elle part d'ICI, du navigateur, une fois la page affichée — jamais du rendu
 * serveur. Une messagerie qui déplie l'aperçu d'un lien, un antivirus qui le
 * vérifie, un robot d'indexation : tous demandent l'adresse, aucun n'exécute de
 * JavaScript. Une date née d'un rendu serait fausse le jour précis où elle sert
 * de preuve, et c'est la date la plus solide des deux — la seule qui ne dépende
 * pas de la bonne volonté du client.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUI DIFFÈRE DE LA PLANCHE VALIDÉE, et il faut le dire :** la maquette
 * dessinait un cadre à coins de douze pixels. Ici c'est `rounded-full`, parce
 * que sa règle du 12 août 2026 veut la même forme pour tout ce qui s'appuie, et
 * que `scripts/test-boutons-arrondis.ts` la tient. Une pastille qui se touche
 * est un bouton — c'est déjà ce qui est arrivé à `PastilleACopier`, juste
 * au-dessus, dont la maquette portait le même coin.
 */
export default function AccuseDeReception({
  jeton,
  dejaConfirmeLe,
}: {
  jeton: string;
  /** La date déjà en base, en ISO. Le client qui rouvre son lien la retrouve. */
  dejaConfirmeLe: string | null;
}) {
  const [confirmeLe, setConfirmeLe] = useState<string | null>(dejaConfirmeLe);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const ouvertureNotee = useRef(false);

  // **Une seule fois par page**, et le garde-fou est ici autant qu'en base :
  // React monte deux fois en développement, et l'action repartirait pour rien.
  useEffect(() => {
    if (ouvertureNotee.current) return;
    ouvertureNotee.current = true;
    void noterOuvertureAction(jeton);
  }, [jeton]);

  function confirmer() {
    if (confirmeLe || enCours) return;
    demarrer(async () => {
      const r = await accuserReceptionAction(jeton);
      if (!r) return;
      if ("erreur" in r) {
        setRefus(r.erreur);
        return;
      }
      setRefus(null);
      setConfirmeLe(r.confirmeLe);
    });
  }

  const fait = confirmeLe !== null;

  return (
    <div className="mt-5 border-t pt-4 text-left" style={{ borderColor: colors.line }}>
      <button
        type="button"
        onClick={confirmer}
        disabled={fait || enCours}
        // `aria-pressed` plutôt qu'une vraie case : le geste est irréversible,
        // et une case à cocher promet qu'on peut la décocher.
        aria-pressed={fait}
        className="flex w-full items-start gap-3 rounded-full px-4 py-3 text-left transition-transform active:scale-[0.995] disabled:active:scale-100"
        style={{
          backgroundColor: colors.rustTint,
          boxShadow: `inset 0 0 0 ${fait ? "1.5px" : "1px"} ${fait ? colors.plein : colors.line}`,
          minHeight: 52,
        }}
      >
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md text-[13px] leading-none"
          style={{
            backgroundColor: fait ? colors.plein : colors.card,
            boxShadow: fait ? "none" : `inset 0 0 0 1.5px ${colors.line}`,
            color: fait ? surPlein : "transparent",
          }}
        >
          ✓
        </span>
        <span className="min-w-0">
          <span className="block text-[14.5px] leading-[1.45]" style={{ color: colors.ink }}>
            J&apos;ai bien reçu cette facture
          </span>
          <span
            className="mt-0.5 block text-[13px] leading-[1.45]"
            style={{ color: fait ? colors.plein : colors.muted }}
          >
            {fait
              ? `Confirmé le ${enClair(confirmeLe)}. Merci.`
              : enCours
                ? "…"
                : "Votre artisan en sera informé."}
          </span>
        </span>
      </button>

      {/* Le refus se lit sous le geste qui l'a provoqué. Ailleurs, il se
          cherche ; absent, il se devine. */}
      {refus && (
        <p role="alert" className="mt-2 text-[13px] leading-[1.5]" style={{ color: colors.alert }}>
          {refus}
        </p>
      )}
    </div>
  );
}

/**
 * Le jour, en toutes lettres.
 *
 * Écrit ici parce que c'est un affichage, et non une règle : le mois en clair
 * est ce que le reste de la page emploie déjà (`jourLisible`), mais celui-ci
 * part d'un horodatage et non d'un jour, et il se lit dans le fuseau du client
 * — c'est SON accusé, il doit y reconnaître SON heure.
 */
function enClair(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}
