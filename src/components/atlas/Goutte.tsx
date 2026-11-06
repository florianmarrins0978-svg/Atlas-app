import { colors } from "@/lib/design-tokens";

/**
 * LA GOUTTE : un arrosage à hiverner — sa planche du 5 novembre 2026
 * (`appli/soignee/hiverner-l-arrosage.html`, « la B »).
 *
 * **Dessinée une fois, posée en quatre endroits** : à côté du nom dans Vos
 * clients, en tête de la ligne « Arrosage à hiverner » de sa fiche, à côté du
 * jour dans la semaine du planning, et à côté du numéro du jour dans le mois.
 * Quatre dessins auraient fini par ne plus se ressembler, et c'est à leur
 * ressemblance qu'il la reconnaît d'un écran à l'autre.
 *
 * **Le bleu des cartes**, jeton et non couleur écrite : Vos clients n'emploie
 * pas le bleu (l'or y dit ce qui mène ailleurs, le rouge le dû), et les deux
 * chartes sombres le renversent d'elles-mêmes (`CLAUDE.md` §3).
 */
export default function Goutte({ taille = 22, libelle }: { taille?: number; libelle?: string }) {
  const trait = Math.round(taille * 0.64);
  return (
    <span
      role={libelle ? "img" : undefined}
      aria-label={libelle}
      aria-hidden={libelle ? undefined : true}
      data-atlas="goutte-hivernage"
      className="inline-grid flex-none place-items-center rounded-full"
      style={{ width: taille, height: taille, backgroundColor: colors.carteBleuFond, color: colors.carteBleuTexte }}
    >
      <svg
        width={trait}
        height={trait}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.1}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3.5s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z" />
      </svg>
    </span>
  );
}
