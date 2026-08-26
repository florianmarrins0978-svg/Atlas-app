"use client";

import { colors, font } from "@/lib/design-tokens";

/**
 * Le compteur des Réglages : deux ronds cerclés, le nombre en serif entre eux.
 *
 * *Arrêté sur maquette le 10 août 2026 (`maquettes/atlas-equipes.html`), puis
 * repris tel quel par la planche 97 du 26 août.*
 *
 * **Sorti en pièce commune le 26 août 2026, quand un SECOND compteur est
 * apparu** — les équipes d'un côté, les salariés de l'autre. Deux copies du
 * même bloc auraient divergé au premier ajustement de taille, et l'écran aurait
 * porté deux compteurs qui ne se ressemblent plus tout à fait (`CLAUDE.md` §3).
 *
 * **La borne se voit avant d'être rencontrée** : le − est inerte au plancher, le
 * + au plafond — grisés, et non absents, sinon le compteur se décentrerait en
 * atteignant sa borne.
 *
 * **Le plancher est un paramètre, pas une constante.** Il vaut 1 pour les
 * équipes — on mène toujours au moins un chantier — et 0 pour les salariés :
 * un artisan seul n'a personne, et ce n'est pas un défaut de saisie.
 */
export default function CompteurRond({
  valeur,
  plancher,
  plafond,
  libelleMoins,
  libellePlus,
  onChanger,
}: {
  valeur: number;
  plancher: number;
  plafond: number;
  libelleMoins: string;
  libellePlus: string;
  onChanger: (valeur: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-[30px] pb-1 pt-3.5">
      <BoutonPas
        signe="−"
        libelle={libelleMoins}
        inerte={valeur <= plancher}
        onAppui={() => onChanger(valeur - 1)}
      />
      <span
        className="min-w-[2ch] text-center"
        style={{
          fontFamily: font.display,
          fontSize: 52,
          lineHeight: 1,
          letterSpacing: "-0.03em",
          fontVariantNumeric: "tabular-nums",
          color: colors.ink,
        }}
        aria-live="polite"
      >
        {valeur}
      </span>
      <BoutonPas
        signe="+"
        libelle={libellePlus}
        inerte={valeur >= plafond}
        onAppui={() => onChanger(valeur + 1)}
      />
    </div>
  );
}

/** Un rond de 46 px cerclé d'un filet — pas de fond, comme la maquette. */
function BoutonPas({
  signe,
  libelle,
  inerte,
  onAppui,
}: {
  signe: string;
  libelle: string;
  inerte: boolean;
  onAppui: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={libelle}
      disabled={inerte}
      onClick={onAppui}
      className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-full"
      style={{
        boxShadow: `inset 0 0 0 1px ${colors.line}`,
        fontFamily: font.display,
        fontSize: 21,
        lineHeight: 1,
        color: inerte ? colors.muted : colors.ink,
        opacity: inerte ? 0.32 : 1,
        WebkitTapHighlightColor: "transparent",
        transition: "box-shadow .24s, color .24s, opacity .24s",
      }}
    >
      {signe}
    </button>
  );
}
