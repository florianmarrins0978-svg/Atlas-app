import { colors, font } from "@/lib/design-tokens";
import { VARIABLE_TEXTE_DU_FERIE, variableDeLEtat } from "@/lib/couleurs-planning";

/**
 * Le fond et le chiffre d'un férié : la couleur réglée dans « Couleurs » (sa
 * réponse du 6 novembre 2026, « réglable »), sinon le bleu de l'apparence.
 * Écrit une fois : la case du mois, sa légende et cette pastille le lisent.
 */
export const COULEURS_DU_FERIE = {
  fond: `var(${variableDeLEtat("ferie")}, ${colors.carteBleuFond})`,
  texte: `var(${VARIABLE_TEXTE_DU_FERIE}, ${colors.carteBleuTexte})`,
} as const;

/**
 * « Férié, Armistice 1918 », à côté de la date d'un jour.
 *
 * Sa planche du 5 novembre 2026 (`appli/soignee/jours-feries.html`), le bleu
 * choisi : le même que la case du mois (`MoisCharge.tsx`), pour qu'on relie la
 * pastille à la case sans réfléchir. Écrite une fois : la liste de la semaine
 * et la fiche du jour la posent toutes les deux.
 */
export default function PastilleFerie({ nom }: { nom: string }) {
  return (
    <span
      data-atlas="pastille-ferie"
      className="inline-flex min-h-[28px] items-center whitespace-nowrap rounded-full px-[11px] text-[13.5px] font-semibold leading-none"
      style={{ background: COULEURS_DU_FERIE.fond, color: COULEURS_DU_FERIE.texte, fontFamily: font.body }}
    >
      Férié, {nom}
    </span>
  );
}
