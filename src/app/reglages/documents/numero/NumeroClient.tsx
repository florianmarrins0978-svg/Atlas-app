"use client";

import { useState, useTransition } from "react";
import { colors, font, voile } from "@/lib/design-tokens";
import {
  ecrireNumero,
  FORMATS_NUMERO,
  FORMAT_PAR_DEFAUT,
  repartChaqueAnnee,
} from "@/lib/numero-documents";
import { majFormatNumeroAction } from "../actions";
import Paquet from "@/components/atlas/reglages/Paquet";
import PlageTon from "@/components/atlas/reglages/PlageTon";
import CocheRonde from "@/components/atlas/reglages/CocheRonde";
import { Enregistre, EXEMPLE_NUMERO } from "../pieces";
import Picto from "@/components/atlas/reglages/Picto";

/**
 * « Le numéro de mes documents » — sa demande du 26 août 2026.
 *
 * *« Dans la catégorie facture il faut rajouter le format de numéro, c'est
 * obligatoire il me semble. »* **Le format ne l'est pas ; la SUITE l'est**,
 * chronologique, sans trou ni doublon, ce qu'Atlas tenait déjà. Ce qui était
 * cassé, en revanche, c'est que le millésime était écrit en dur : en janvier
 * 2027, ses factures auraient encore dit 2026.
 *
 * **Écran à part depuis le découpage du 7 septembre 2026**, quatrième des
 * quatre, et le plus court.
 *
 * **Les cinq formats en liste, ce que ça donne sur une bande dorée** (sa
 * planche des Réglages soignés, 26 octobre 2026). « Votre prochain devis »
 * montrait toujours le n° 12 : c'est un exemple, il s'appelle « Un devis ».
 */
export default function NumeroClient({ formatInitial }: { formatInitial: string | null }) {
  const [formatNumero, setFormatNumero] = useState(formatInitial ?? FORMAT_PAR_DEFAUT);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function poserFormat(clef: string) {
    setFormatNumero(clef);
    demarrer(async () => {
      const r = await majFormatNumeroAction(clef);
      // On réaffiche ce que la base porte : une clef refusée y est restée celle
      // d'avant, et l'écran doit montrer ce qui s'imprimera.
      if (r.ok) {
        setFormatNumero(r.format);
        setRefus(null);
      } else setRefus(r.raison);
    });
  }

  return (
    <div className="pb-10">
      {refus && (
        <div role="alert" className="mx-[22px] mt-4">
          <PlageTon ton="rouge">{refus}</PlageTon>
        </div>
      )}

      <p className="mx-6 mt-4 text-[14.5px] leading-[1.45]" style={{ color: colors.inkSoft }}>
        Vos documents déjà émis gardent leur numéro.
      </p>

      <Paquet>
        {FORMATS_NUMERO.map((f, i) => {
          const choisi = formatNumero === f.clef;
          return (
            <button
              key={f.clef}
              type="button"
              data-atlas={`format-${f.clef}`}
              aria-pressed={choisi}
              onClick={() => poserFormat(f.clef)}
              className="relative grid min-h-[64px] w-full grid-cols-[22px_minmax(0,1fr)_auto] items-baseline gap-x-2.5 py-[13px] text-left"
            >
              {i > 0 && (
                <span aria-hidden className="absolute left-[34px] right-0 top-0 h-px" style={{ backgroundColor: colors.line }} />
              )}
              <span className="row-span-2 self-start pt-px">
                <CocheRonde pris={choisi} />
              </span>
              <span className="text-[17px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
                {f.nom}
              </span>
              {/* **L'exemple vient de la MÊME fonction que le numéro réel**
                  (`ecrireNumero`). Un aperçu écrit à part finirait par montrer
                  autre chose que ce qui part chez le client (`CLAUDE.md` §3). */}
              <span
                data-atlas={`exemple-${f.clef}`}
                className="whitespace-nowrap text-[15px] font-semibold"
                style={{ color: colors.or, fontVariantNumeric: "tabular-nums lining-nums" }}
              >
                {ecrireNumero(f.clef, "facture", EXEMPLE_NUMERO)}
              </span>
              {/* **La mention « par défaut » vit dans `dit`, et nulle part
                  ailleurs.** L'ajouter ici la faisait lire deux fois sur le
                  format concerné, « Le format par défaut, par défaut ». Vu à la
                  capture, par aucun test (`CLAUDE.md` §5). */}
              <span className="col-span-2 mt-0.5 text-[14px] leading-[1.4]" style={{ color: colors.inkSoft }}>
                {f.dit}
              </span>
            </button>
          );
        })}
      </Paquet>

      <Paquet titre="Ce que ça donne" sansPlage>
        <PlageTon ton="or">
          {([
            ["Un devis", ecrireNumero(formatNumero, "devis", EXEMPLE_NUMERO)],
            ["Une facture", ecrireNumero(formatNumero, "facture", EXEMPLE_NUMERO)],
          ] as const).map(([quoi, valeur]) => (
            <p key={quoi} className="flex items-baseline justify-between gap-3 py-1 text-[15.5px]">
              <span>{quoi}</span>
              <b
                className="whitespace-nowrap text-[21px] leading-[1.2]"
                style={{ fontFamily: font.display, fontWeight: 600, fontVariantNumeric: "tabular-nums lining-nums" }}
              >
                {valeur}
              </b>
            </p>
          ))}
          {/* **Ce que le format IMPLIQUE se dit, et ne se règle pas à part.** Un
              second interrupteur « repartir chaque année » serait un piège : sur
              une suite sans année, le cocher ferait deux documents du même numéro
              à un an d'écart, un doublon, ce que la loi interdit. */}
          <p
            className="mt-2.5 flex items-start gap-[9px] pt-[11px]"
            style={{ boxShadow: `inset 0 1px 0 ${voile(colors.or, 0.35)}` }}
          >
            <span className="mt-px" style={{ color: colors.or }}>
              <Picto nom="calendrier" taille={19} />
            </span>
            <span data-atlas="consequence-format">
              {repartChaqueAnnee(formatNumero)
                ? "Le compteur repart à 1 le 1ᵉʳ janvier."
                : "Le compteur ne repart jamais : sans l'année, deux documents porteraient le même numéro."}
            </span>
          </p>
        </PlageTon>
      </Paquet>

      <Enregistre enCours={enCours} />
    </div>
  );
}
