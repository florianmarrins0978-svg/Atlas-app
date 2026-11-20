"use client";

import { colors } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { prixAchatsProposes, type PrixAchatCandidat } from "@/lib/prix-achat";

/** Au-delà, la liste couvrirait la ligne suivante : les moins chers suffisent. */
const PROPOSES_AU_PLUS = 4;

/**
 * Sous la ligne qu'il tape, ses prix d'achat — sa planche du 20 novembre 2026
 * (`appli/le-prix-d-une-piece.html`) : *« s'il tape sac de terreau, que sur le
 * devis, seulement pour lui, il y ait le prix des sacs de terreau enregistrés
 * chez tel ou tel fournisseur, et qu'il puisse choisir »*.
 *
 * | | |
 * |---|---|
 * | la liste | les prix que la règle du devis dicté trouve (`prixAchatsProposes`), le moins cher d'abord ; seulement sur une ligne sans prix |
 * | le choix | le prix × sa marge se pose, et le fournisseur reste écrit sous la ligne |
 * | la mention | touchée, elle rouvre la liste pour changer de fournisseur ; elle tombe dès qu'il retape le prix |
 *
 * **Pour qui rédige le devis, jamais pour le client** : la page ne passe ses
 * prix d'achat qu'aux comptes qui rédigent (`peutGererDevis` ; sa réponse du
 * 20 novembre 2026 pour le commercial), et la mention ne descend jamais sur
 * le devis du client (`devis.ts` recopie ses champs un à un).
 */
export default function PrixDAchatDeLaLigne({
  libelle,
  sansPrix,
  achatRetenu,
  candidats,
  ouvert,
  fige,
  refus,
  onOuvrir,
  onChoisir,
}: {
  libelle: string;
  sansPrix: boolean;
  achatRetenu: string | null;
  candidats: readonly PrixAchatCandidat[];
  ouvert: boolean;
  fige: boolean;
  refus: string | null;
  onOuvrir: () => void;
  onChoisir: (c: PrixAchatCandidat) => void;
}) {
  if (fige) {
    return achatRetenu ? (
      <p className="mt-1 text-[13.5px] leading-[1.35]" style={{ color: colors.muted }} data-atlas="achat-retenu">
        {achatRetenu}
      </p>
    ) : null;
  }
  const montrer = ouvert || (!achatRetenu && sansPrix);
  const proposes = montrer ? prixAchatsProposes(libelle, candidats).slice(0, PROPOSES_AU_PLUS) : [];
  return (
    <>
      {achatRetenu && !ouvert && (
        <button
          type="button"
          onClick={onOuvrir}
          className="mt-1 block text-left text-[13.5px] leading-[1.35]"
          style={{ color: colors.muted }}
          data-atlas="achat-retenu"
        >
          {achatRetenu}
        </button>
      )}
      {proposes.length > 0 && (
        <div
          className="mt-2 overflow-hidden rounded-[10px]"
          style={{ backgroundColor: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
          data-atlas="prix-d-achat-proposes"
        >
          {proposes.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onChoisir(c)}
              className="flex min-h-[56px] w-full items-center gap-3 px-3.5 py-2 text-left"
              style={i > 0 ? { borderTop: `1px solid ${colors.lineSoft}` } : undefined}
              data-atlas="prix-d-achat-propose"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-[1.3]" style={{ color: colors.ink }}>
                  {c.societeNom}
                </span>
                <span className="mt-0.5 block text-[13.5px] leading-[1.35]" style={{ color: colors.inkSoft }}>
                  {c.nom}
                </span>
              </span>
              <span
                className="flex-none whitespace-nowrap text-right text-[15px] font-bold"
                style={{ color: colors.ink, fontVariantNumeric: "tabular-nums lining-nums" }}
              >
                {enEuros(c.prixHt)} HT
              </span>
            </button>
          ))}
        </div>
      )}
      {refus && (
        <p role="alert" className="mt-1.5 text-[14px] font-semibold leading-[1.4]" style={{ color: colors.alert }}>
          {refus}
        </p>
      )}
    </>
  );
}
