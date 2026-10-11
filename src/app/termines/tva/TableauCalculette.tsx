import Link from "next/link";
import Decimal from "decimal.js";
import { colors, font } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { recapParTaux, tauxLisible } from "@/lib/tva-par-taux";
import CopierLeChiffre from "./CopierLeChiffre";

/**
 * Une pièce de la page de vérification : qui, quand, et ses parts par taux.
 *
 * `montant` nul : un achat écrit à la main sans son total. `taux` nul : la
 * pièce ne le dit pas. Les deux s'écrivent « non noté », jamais zéro.
 */
export type PieceCalculette = {
  cle: string;
  nom: string;
  sous: string[];
  /** La facture s'ouvre depuis le nom, comme sur la preuve de Ma TVA. */
  href?: string;
  parts: { taux: string | null; montant: string | null; tva: string }[];
};

/**
 * Le tableau à la calculette, pour la TVA collectée comme pour la déductible.
 *
 * **Sa planche du 25 septembre 2026** (`appli/tva-collectee-a-la-calculette.html`),
 * variante A : le montant, le taux, la TVA, chaque colonne finie par son total,
 * puis le récapitulatif par taux. **Chiffres centrés dans leur colonne** : sa
 * retouche du même jour, « centre tous les chiffres dans leur colonne ».
 *
 * **Une seule pièce pour les deux pages** : si l'une gagnait une règle que
 * l'autre n'a pas, elles ne s'additionneraient plus de la même façon.
 *
 * **Le total de TVA est celui de Ma TVA, pas une seconde addition** : il arrive
 * de l'appelant, lu là où Ma TVA le lit. La somme des lignes y retombe par
 * construction (`src/lib/tva-par-taux.ts`).
 */
export default function TableauCalculette({
  qui,
  montant,
  pieces,
  totalTva,
}: {
  qui: string;
  montant: string;
  pieces: PieceCalculette[];
  totalTva: string;
}) {
  const parts = pieces.flatMap((p) => p.parts);
  const totalMontant = parts
    .reduce((acc, p) => (p.montant === null ? acc : acc.plus(new Decimal(p.montant))), new Decimal(0))
    .toFixed(2);
  const recap = recapParTaux(parts.map((p) => ({ taux: p.taux, tva: p.tva, ttc: p.montant })));

  const chiffre = (valeur: string | null, tva = false) =>
    valeur === null ? (
      <td className="px-1 py-[11px] text-center align-top text-[12px] italic" style={{ color: colors.muted }}>
        non noté
      </td>
    ) : (
      <td
        className="whitespace-nowrap px-1 py-[11px] text-center align-top text-[15.5px]"
        style={{ color: tva ? colors.or : colors.ink, fontFamily: font.display, fontVariantNumeric: "tabular-nums" }}
      >
        {enEuros(valeur)}
      </td>
    );
  const taux = (t: string | null) =>
    t === null ? (
      <td className="whitespace-nowrap px-0 py-[11px] text-center align-top text-[11px] italic" style={{ color: colors.muted }}>
        non noté
      </td>
    ) : (
      <td
        className="whitespace-nowrap px-1 py-[11px] text-center align-top text-[15px]"
        style={{ color: colors.inkSoft, fontFamily: font.display, fontVariantNumeric: "tabular-nums" }}
      >
        {tauxLisible(t)}
      </td>
    );
  // L'espacement des surtitres (`libelleCaps`, 0,28 em) écartait « À 20 % »
  // en « À  2 0  % » : un taux se lit, il ne s'épelle pas.
  const capsDuTableau = "text-[11px] font-bold uppercase tracking-[0.14em] whitespace-nowrap";
  const entete = "px-1 pb-2 text-center align-bottom text-[10.5px] font-semibold uppercase tracking-[0.12em]";

  return (
    <table className="mt-[18px] w-full border-collapse" style={{ tableLayout: "fixed" }} data-atlas="tableau-calculette">
      <colgroup>
        <col style={{ width: "33%" }} />
        <col style={{ width: "26%" }} />
        <col style={{ width: "15%" }} />
        <col style={{ width: "26%" }} />
      </colgroup>
      <thead>
        <tr>
          <th className={`${entete} pl-0 text-left`} style={{ color: colors.muted }}>{qui}</th>
          <th className={entete} style={{ color: colors.muted }}>{montant}</th>
          <th className={entete} style={{ color: colors.muted }}>Taux</th>
          <th className={entete} style={{ color: colors.or }}>TVA</th>
        </tr>
      </thead>
      <tbody>
        {pieces.map((p) =>
          p.parts.map((x, k) => (
            <tr
              key={`${p.cle}|${k}`}
              data-atlas="ligne-calculette"
              // La seconde part d'une même pièce se lit sous la première : un
              // trait entre les deux ferait croire à deux factures.
              style={{ borderTop: k === 0 ? `1px solid ${colors.lineSoft}` : undefined }}
            >
              <td className="py-[11px] pr-1 align-top" style={{ paddingTop: k === 0 ? undefined : 0 }}>
                {k === 0 &&
                  (() => {
                    const qui = (
                      <>
                        <p className="text-[15px] leading-[1.25]" style={{ color: colors.ink }}>{p.nom}</p>
                        {p.sous.map((s) => (
                          <p key={s} className="mt-0.5 whitespace-nowrap text-[11px] leading-[1.3]" style={{ color: colors.muted }}>{s}</p>
                        ))}
                      </>
                    );
                    return p.href ? <Link href={p.href} data-atlas="ouvrir-la-facture" className="block">{qui}</Link> : qui;
                  })()}
              </td>
              {chiffre(x.montant)}
              {taux(x.taux)}
              {chiffre(x.tva, true)}
            </tr>
          ))
        )}
        <tr data-atlas="total-calculette" style={{ borderTop: `1.5px solid ${colors.ink}` }}>
          <td className={`pt-3 align-top ${capsDuTableau}`} style={{ color: colors.ink }}>Total</td>
          <td className="px-1 pt-3 text-center align-top"><CopierLeChiffre montant={enEuros(totalMontant)} /></td>
          <td />
          <td className="px-1 pt-3 text-center align-top"><CopierLeChiffre montant={enEuros(totalTva)} tva /></td>
        </tr>
        <tr>
          <td colSpan={4} className="pb-1.5 pt-[30px] text-[10.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: colors.muted }}>
            Par taux
          </td>
        </tr>
        {recap.map((r) => (
          <tr key={r.taux ?? "sans"} data-atlas="recap-taux" style={{ borderTop: `1px solid ${colors.lineSoft}` }}>
            <td className={`py-[11px] align-top ${capsDuTableau}`} style={{ color: colors.ink }}>
              {r.taux === null ? "Sans taux" : `À ${tauxLisible(r.taux)}`}
            </td>
            {chiffre(r.montantManquant && new Decimal(r.ttc).isZero() ? null : r.ttc)}
            {r.taux === null ? <td /> : taux(r.taux)}
            {chiffre(r.tva, true)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
