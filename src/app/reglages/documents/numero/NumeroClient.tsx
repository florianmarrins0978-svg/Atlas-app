"use client";

import { useState, useTransition } from "react";
import { colors, libelleCaps, texteSituation } from "@/lib/design-tokens";
import {
  ecrireNumero,
  FORMATS_NUMERO,
  FORMAT_PAR_DEFAUT,
  repartChaqueAnnee,
} from "@/lib/numero-documents";
import { majFormatNumeroAction } from "../actions";

/**
 * « Le numéro de mes documents » — sa demande du 26 août 2026.
 *
 * *« Dans la catégorie facture il faut rajouter le format de numéro, c'est
 * obligatoire il me semble. »* **Le format ne l'est pas ; la SUITE l'est** —
 * chronologique, sans trou ni doublon, ce qu'Atlas tenait déjà. Ce qui était
 * cassé, en revanche, c'est que le millésime était écrit en dur : en janvier
 * 2027, ses factures auraient encore dit 2026.
 *
 * **Écran à part depuis le découpage du 7 septembre 2026** — quatrième des
 * quatre, et le plus court.
 */

/**
 * Le document d'exemple montré à côté de chaque format.
 *
 * **L'année vient de l'HORLOGE, jamais d'un millésime écrit à la main** —
 * c'est exactement le défaut que ce réglage corrige.
 */
const EXEMPLE = {
  annee: new Date().getFullYear(),
  mois: new Date().getMonth() + 1,
  numero: 12,
};

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
        <p
          role="alert"
          className={`mx-[26px] mt-4 rounded-[4px] px-[15px] py-3 ${texteSituation}`}
          style={{ backgroundColor: colors.card, borderLeft: `3px solid ${colors.alert}`, color: colors.alert }}
        >
          {refus}
        </p>
      )}

      <section className="mx-[26px] mt-[26px]">
        <p className={`mb-3 ${texteSituation}`} style={{ color: colors.inkSoft }}>
          Vos documents déjà émis gardent leur numéro.
        </p>

        <div className="mb-4 flex flex-col gap-2">
          {FORMATS_NUMERO.map((f) => {
            const choisi = formatNumero === f.clef;
            return (
              <button
                key={f.clef}
                type="button"
                data-atlas={`format-${f.clef}`}
                aria-pressed={choisi}
                onClick={() => poserFormat(f.clef)}
                // `rounded-full`, comme tous ses boutons depuis le 12 août 2026.
                className="flex min-h-[62px] items-baseline justify-between gap-3 rounded-full px-5 py-2.5 text-left"
                style={{
                  backgroundColor: choisi ? colors.card : "transparent",
                  boxShadow: `inset 0 0 0 1px ${choisi ? colors.or : colors.line}`,
                }}
              >
                <span className="min-w-0">
                  <span className="block text-[15px]" style={{ color: colors.ink }}>
                    {f.nom}
                  </span>
                  {/* **La mention « par défaut » vit dans `dit`, et nulle part
                      ailleurs.** L'ajouter ici la faisait lire deux fois sur le
                      format concerné — « Le format par défaut · par défaut ».
                      Vu à la capture, par aucun test (`CLAUDE.md` §5). */}
                  <span className={`mt-0.5 block ${texteSituation}`} style={{ color: colors.inkSoft }}>
                    {f.dit}
                  </span>
                </span>
                {/* **L'exemple vient de la MÊME fonction que le numéro réel**
                    (`ecrireNumero`). Un aperçu écrit à part finirait par montrer
                    autre chose que ce qui part chez le client (`CLAUDE.md` §3). */}
                <span
                  data-atlas={`exemple-${f.clef}`}
                  className="flex-none text-[15px]"
                  style={{ color: colors.or, fontVariantNumeric: "tabular-nums" }}
                >
                  {ecrireNumero(f.clef, "facture", EXEMPLE)}
                </span>
              </button>
            );
          })}
        </div>

        <p className={`mb-2 ${libelleCaps}`} style={{ color: colors.inkSoft }}>
          Ce que ça donne
        </p>
        <div className="rounded-[6px] px-[15px] py-3" style={{ backgroundColor: colors.card }}>
          {([
            ["Votre prochain devis", ecrireNumero(formatNumero, "devis", EXEMPLE)],
            ["Votre prochaine facture", ecrireNumero(formatNumero, "facture", EXEMPLE)],
          ] as const).map(([quoi, valeur]) => (
            <p key={quoi} className="flex justify-between gap-3 py-1 text-[14px]">
              <span style={{ color: colors.ink }}>{quoi}</span>
              <span style={{ color: colors.inkSoft, fontVariantNumeric: "tabular-nums" }}>
                {valeur}
              </span>
            </p>
          ))}
        </div>

        {/* **Ce que le format IMPLIQUE se dit, et ne se règle pas à part.** Un
            second interrupteur « repartir chaque année » serait un piège : sur
            une suite sans année, le cocher ferait deux documents du même numéro
            à un an d'écart — un doublon, ce que la loi interdit. */}
        <p
          data-atlas="consequence-format"
          className={`mt-3 ${texteSituation}`}
          style={{ color: colors.inkSoft }}
        >
          {repartChaqueAnnee(formatNumero)
            ? "Le compteur repart à 1 le 1ᵉʳ janvier."
            : "Le compteur ne repart jamais : sans l'année, deux documents porteraient le même numéro."}
        </p>

        <p className={`mt-3 ${texteSituation}`} style={{ color: colors.inkSoft }}>
          {enCours ? "Enregistrement…" : "Enregistré au fur et à mesure."}
        </p>
      </section>
    </div>
  );
}
