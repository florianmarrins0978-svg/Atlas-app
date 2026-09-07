"use client";

import { useState } from "react";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import BottomSheet from "@/components/atlas/BottomSheet";
import RythmeTva from "./RythmeTva";
import RegimeTva from "./RegimeTva";
import type { PeriodiciteTva } from "@/server/periode-tva";
import type { Exigibilite } from "@/lib/exigibilite-tva";

/**
 * D'où sort le chiffre du dessus — une ligne, et les deux réglages derrière.
 *
 * ─── POURQUOI ILS DESCENDENT SOUS LE TOTAL ──────────────────────────────────
 *
 * Ils ouvraient l'écran : « Votre rythme », puis « Je reverse ma TVA aux
 * impôts » avec ses deux lignes, son encart d'écart et sa phrase de prudence —
 * **avant le titre**, et avant le moindre chiffre. Mesuré sur son écran de
 * 390 × 664 : le « Reste à payer », c'est-à-dire la seule raison d'ouvrir cet
 * écran, tombait sous la ligne de flottaison. Il fallait faire défiler pour
 * voir le chiffre qu'on venait chercher.
 *
 * Ce ne sont pourtant pas des filtres d'affichage : ce sont **deux déclarations
 * faites aux impôts**, qu'on change une fois par entreprise. Leur place juste
 * est celle d'une provenance — sous le résultat, en une ligne qui dit comment
 * il a été calculé, et qui s'ouvre quand on veut la changer.
 *
 * **Rien n'est perdu** : la feuille porte les deux réglages entiers, y compris
 * la ligne qui dit ce que le choix change sur la période affichée — celle qui
 * répond à sa plainte du 26 août 2026, *« lorsque je change entre les deux,
 * rien ne se passe »*.
 *
 * ─── ET LA FACTURATION LA LIT, SANS POUVOIR Y TOUCHER ───────────────────────
 *
 * Le serveur refuse ces deux écritures à quiconque n'est pas le patron
 * (`exigerProprietaire`), et l'écran ne lui montrait donc **rien** depuis le
 * 30 août 2026. Elle ne pouvait pas savoir si « Août 2026 » était compté à
 * l'encaissement ou aux débits — alors que c'est elle qui relit le relevé.
 *
 * La phrase reste, le geste part : `modifiable` à faux rend un paragraphe, et
 * **la feuille n'est pas rendue du tout**. Ce n'est pas une précaution de
 * style : `test-roles-facturation-e2e.ts` lit le texte de la page et refuse
 * qu'elle y voie « Votre rythme » ou « Je reverse ma TVA aux impôts », deux
 * gestes qu'un appui laisserait muets.
 */
export default function DeclarationsTva({
  periodicite,
  regime,
  periode,
  tvaRetenue,
  tvaAutre,
  modifiable,
}: {
  periodicite: PeriodiciteTva;
  regime: Exigibilite;
  /** Le mois ou le trimestre affiché, tel qu'il est écrit dans le titre. */
  periode: string;
  /** La TVA collectée de cette période sous le régime ENREGISTRÉ. */
  tvaRetenue: string;
  /** La même, sous l'autre régime. */
  tvaAutre: string;
  modifiable: boolean;
}) {
  const [ouverte, setOuverte] = useState(false);

  const rythme = periodicite === "mensuelle" ? "tous les mois" : "tous les trois mois";
  const quand = regime === "encaissements" ? "quand votre client vous paie" : "quand vous envoyez la facture";

  const phrase = (
    <>
      Calculé{" "}
      <span style={souligne(modifiable)}>{rythme}</span>,{" "}
      <span style={souligne(modifiable)}>{quand}</span>.
    </>
  );

  if (!modifiable) {
    return (
      <p data-atlas="declarations" className="mt-[18px] px-6 text-[12.5px] leading-[1.55]" style={{ color: colors.muted }}>
        {phrase}
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        data-atlas="declarations"
        aria-haspopup="dialog"
        aria-expanded={ouverte}
        onClick={() => setOuverte(true)}
        className="mt-[18px] block w-full px-6 py-2 text-left text-[12.5px] leading-[1.55]"
        style={{ color: colors.inkSoft, minHeight: 44 }}
      >
        {phrase}
      </button>

      <BottomSheet open={ouverte} onBackdropClick={() => setOuverte(false)}>
        <p className={`text-center ${libelleCaps}`} style={{ color: colors.or }}>
          Ce que vous avez déclaré
        </p>
        <p className="mb-4 mt-2 text-center text-[20px]" style={{ fontFamily: font.display }}>
          Aux impôts
        </p>

        <RythmeTva actuelle={periodicite} />
        <RegimeTva actuelle={regime} periode={periode} tvaRetenue={tvaRetenue} tvaAutre={tvaAutre} />

        <button
          type="button"
          onClick={() => setOuverte(false)}
          className="mt-1 w-full py-3 text-[15px]"
          style={{ color: colors.muted }}
        >
          Fermer
        </button>
      </BottomSheet>
    </>
  );
}

/** Le soulignement d'or : ce qui se touche. Sans geste, il n'a rien à annoncer. */
function souligne(modifiable: boolean) {
  return modifiable
    ? {
        color: colors.ink,
        textDecoration: "underline",
        textDecorationColor: colors.or,
        textDecorationThickness: 1.5,
        textUnderlineOffset: 4,
      }
    : { color: colors.inkSoft };
}
