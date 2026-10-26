"use client";

import { colors, font } from "@/lib/design-tokens";
import Picto from "@/components/atlas/reglages/Picto";

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
 *
 * **Plus grand depuis les Réglages soignés** (planche du 26 octobre 2026) : des
 * ronds de 52 px, le chiffre à 46 px, posés dans la plage de leur question.
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
    <div className="flex items-center justify-center gap-[22px]">
      <BoutonPas
        signe="moins"
        libelle={libelleMoins}
        inerte={valeur <= plancher}
        onAppui={() => onChanger(valeur - 1)}
      />
      <span
        className="min-w-[56px] text-center"
        style={{
          fontFamily: font.display,
          fontSize: 46,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums lining-nums",
          color: colors.ink,
        }}
        aria-live="polite"
      >
        {valeur}
      </span>
      <BoutonPas
        signe="plus"
        libelle={libellePlus}
        inerte={valeur >= plafond}
        onAppui={() => onChanger(valeur + 1)}
      />
    </div>
  );
}

/** Un rond de 52 px cerclé d'un filet, sans fond : la borne le grise. */
function BoutonPas({
  signe,
  libelle,
  inerte,
  onAppui,
}: {
  signe: "moins" | "plus";
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
      className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full"
      style={{
        boxShadow: `inset 0 0 0 1.5px ${colors.line}`,
        color: inerte ? colors.chevron : colors.ink,
        WebkitTapHighlightColor: "transparent",
        transition: "color .24s",
      }}
    >
      <Picto nom={signe} />
    </button>
  );
}
