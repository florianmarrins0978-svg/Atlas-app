"use client";

import BottomSheet from "@/components/atlas/BottomSheet";
import { colors, surPlein } from "@/lib/design-tokens";
import type { ChantierPlanning } from "./PlanningClient";

/**
 * LA QUESTION AVANT DE SUPPRIMER — la B de sa planche du 7 octobre 2026.
 *
 * **Sa demande :** *« avec une protection, ce n'est pas un clic qu'on supprime.
 * Il faut un clic, une mesure de sécurité, puis on supprime »*. Un client qui
 * accepte un devis par erreur se pose tout seul sur son planning, et rien ne
 * l'en sortait sans deux gestes sans question.
 *
 * **La question ne remplace pas les six secondes, elle les précède.** C'était
 * le choix entre A et B, et il a pris la B : la réversibilité après, retenue le
 * 10 août 2026 (`useRetraits`), reste entière. Cette feuille n'écrit donc rien
 * elle-même : « Supprimer » rend la main à l'écran, qui retire comme avant.
 *
 * **Le nom du client, pas seulement celui du chantier** : c'est le client qui
 * l'a appelé, et c'est son nom qu'il cherche des yeux avant de confirmer. Un
 * temps bloqué n'a pas de client ; la phrase le dit sans lui en inventer un.
 */
export default function QuestionDeSuppression({
  chantier,
  onConfirmer,
  onRenoncer,
}: {
  chantier: ChantierPlanning | null;
  onConfirmer: (c: ChantierPlanning) => void;
  onRenoncer: () => void;
}) {
  return (
    <BottomSheet open={chantier !== null} onBackdropClick={onRenoncer}>
      {chantier && (
        <div data-atlas="question-suppression">
          <p className="mb-2 text-center text-[17px]" style={{ color: colors.ink }}>
            Supprimer {chantier.nom} ?
          </p>
          <p className="mb-6 text-center text-[13px] leading-[1.5]" style={{ color: colors.muted }}>
            {chantier.clientNom
              ? `${chantier.clientNom} quitte le planning. Il reste dans vos clients.`
              : "Il quitte le planning."}
          </p>
          <button
            type="button"
            data-atlas="confirmer-suppression"
            onClick={() => onConfirmer(chantier)}
            className="h-[52px] w-full cursor-pointer rounded-full text-[15px] font-semibold"
            style={{ background: colors.alert, color: surPlein, WebkitTapHighlightColor: "transparent" }}
          >
            Supprimer
          </button>
          {/* **« Annuler » est la sortie, pas un second bouton** : la règle de
              `SupprimerCeClient`, pour que la plus grave des deux capsules garde
              son poids. */}
          <button
            type="button"
            onClick={onRenoncer}
            className="mt-4 block w-full cursor-pointer text-center text-[13px]"
            style={{ color: colors.muted }}
          >
            Annuler
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
