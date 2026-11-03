import IconeTrait, { type NomIcone } from "@/components/atlas/IconeTrait";
import { colors, font, voile } from "@/lib/design-tokens";

/**
 * Un choix d'un appui, posé en carte à côté de son voisin (`.carte-a-choisir`
 * de `appli/soignee/facture.html`, 2 novembre 2026). Sa remarque sur le
 * règlement, *« fais quelque chose de plus joli pour choisir »*, puis
 * « pareil » pour l'avoir : « Sur » et « Pourquoi » ne sont plus une liste
 * qu'on déroule ni une case préremplie, mais deux cartes qu'on voit d'un coup.
 *
 * La carte prise se borde d'or et porte sa coche : c'est le dessin de la
 * planche de la facture, pas celui des Réglages (`CarteChoix`, cernée de
 * l'encre d'action), et il ne se mélange pas avec lui.
 */
export default function CarteAChoisir({
  pris,
  onChoix,
  icone,
  titre,
  detail,
  repere,
}: {
  pris: boolean;
  onChoix: () => void;
  icone: NomIcone;
  titre: string;
  detail?: string;
  repere: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pris}
      onClick={onChoix}
      data-atlas={repere}
      className="relative flex min-h-[96px] flex-col items-start gap-2.5 rounded-[16px] p-3.5 text-left"
      style={{
        background: pris ? `color-mix(in srgb, ${colors.or} 7%, ${colors.card})` : colors.card,
        boxShadow: pris ? `inset 0 0 0 2px ${colors.or}` : `inset 0 0 0 1.5px ${colors.line}`,
      }}
    >
      <span className="grid h-10 w-10 place-items-center rounded-full" style={{ color: colors.or, backgroundColor: voile(colors.or, 0.13) }}>
        <IconeTrait nom={icone} taille={21} />
      </span>
      <span>
        <span className="block text-[17px] leading-[1.2]" style={{ fontFamily: font.display, color: colors.ink }}>
          {titre}
        </span>
        {detail && (
          <span className="mt-0.5 block text-[13.5px] tabular-nums" style={{ color: colors.inkSoft }}>
            {detail}
          </span>
        )}
      </span>
      {pris && (
        <span
          aria-hidden="true"
          className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full"
          style={{ color: colors.card, backgroundColor: colors.or }}
        >
          <IconeTrait nom="coche" taille={15} />
        </span>
      )}
    </button>
  );
}
