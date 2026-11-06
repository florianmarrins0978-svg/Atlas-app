import { colors, font } from "@/lib/design-tokens";

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
      style={{ background: colors.carteBleuFond, color: colors.carteBleuTexte, fontFamily: font.body }}
    >
      Férié, {nom}
    </span>
  );
}
