"use client";

import { useState } from "react";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { jourIso, jourNumerique } from "@/lib/jour";
import {
  LIBELLES_MOYEN,
  MOYENS_PROPOSES,
  estAcquittee,
  montantAcompteDuDevis,
  netAPayer,
  nomAcompte,
  type MoyenDePaiement,
} from "@/lib/acomptes-facture";
import type { AcompteDevis } from "@/lib/acomptes-devis";
import type { ReglementEnregistre, SaisieReglement } from "@/server/repositories/paiements-facture";
import {
  basculerAcquitteeAction,
  majReglementRecuAction,
  poserReglementRecuAction,
  retirerReglementRecuAction,
  type ResultatReglements,
} from "./actions";

/**
 * ─── LES RÈGLEMENTS REÇUS, SUR LA FACTURE — sa planche du 14 septembre 2026 ─
 *
 * Quatre colonnes centrées : l'acompte et sa date, le moyen, le numéro du
 * chèque, le montant. *« Chaque montant perçu avant la fin du chantier est un
 * acompte »* : le rang dit le taux du devis — « Acompte 30 % », « Acompte
 * 50 % » proposé d'office avec ce qui tombe ce jour-là —, puis « Acompte »
 * tout court. « Chèque » est déjà écrit ; on le touche pour choisir virement,
 * espèces, carte ; seul un chèque a sa case pour le numéro.
 *
 * Sous la liste, « Facture acquittée » : allumé, le solde est compté reçu à la
 * date du jour ; il s'allume seul quand les règlements couvrent tout. Puis le
 * net à payer — ce que le papier écrit, par les mêmes fonctions
 * (`src/lib/acomptes-facture.ts`).
 *
 * **Un chiffre touché est sélectionné en entier** : on tape, l'ancien part.
 */
export default function ReglementsRecus({
  factureId,
  totalTtc,
  acomptesDuDevis,
  initiaux,
  fige,
}: {
  factureId: string;
  totalTtc: string;
  acomptesDuDevis: readonly AcompteDevis[];
  initiaux: ReglementEnregistre[];
  fige: boolean;
}) {
  const [reglements, setReglements] = useState(initiaux);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const net = netAPayer(totalTtc, reglements);
  const acquittee = estAcquittee(totalTtc, reglements);

  async function appliquer(promesse: Promise<ResultatReglements>) {
    setEnCours(true);
    setErreur(null);
    const r = await promesse;
    setEnCours(false);
    if (r.succes) setReglements(r.reglements);
    else setErreur(r.erreur);
  }

  function ajouter() {
    // Le rang suivant du devis, avec son montant d'office ; au-delà, rien
    // n'est proposé — le chiffre est à lui.
    const dOffice = montantAcompteDuDevis(reglements.length, acomptesDuDevis, totalTtc);
    const reste = netAPayer(totalTtc, reglements);
    const montant = dOffice && Number(dOffice) <= Number(reste) ? dOffice : reste;
    void appliquer(
      poserReglementRecuAction(factureId, { date: jourIso(new Date()), montant, moyen: "cheque", numero: null })
    );
  }

  function corriger(g: ReglementEnregistre, saisie: Partial<SaisieReglement>) {
    void appliquer(
      majReglementRecuAction(g.id, {
        date: saisie.date ?? g.date,
        montant: saisie.montant ?? g.montant,
        moyen: saisie.moyen === undefined ? g.moyen : saisie.moyen,
        numero: saisie.numero === undefined ? g.numero : saisie.numero,
      })
    );
  }

  const entete = { ...styleEntete, color: colors.muted };

  return (
    <div className="rounded-[4px] px-5 py-5" style={{ backgroundColor: colors.card }} data-atlas="reglements-recus">
      <p className={smallCaps} style={{ color: colors.muted, marginBottom: 10 }}>
        Règlements reçus
      </p>

      {reglements.length > 0 && (
        <div className="grid items-center gap-x-1 text-center" style={{ gridTemplateColumns: "26px 96px 1fr 1fr 72px" }}>
          <span />
          <span />
          <span style={entete}>Moyen</span>
          <span style={entete}>N°</span>
          <span style={entete}>Montant</span>
        </div>
      )}

      {reglements.map((g, i) => (
        <div
          key={g.id}
          data-atlas="reglement-recu"
          className="grid items-center gap-x-1 py-2 text-center text-[14px]"
          style={{ gridTemplateColumns: "26px 96px 1fr 1fr 72px", borderBottom: `1px solid ${colors.lineSoft}`, color: colors.ink }}
        >
          {fige ? (
            <span />
          ) : (
            <button
              type="button"
              aria-label="Retirer ce règlement"
              data-atlas="retirer-reglement"
              disabled={enCours}
              onClick={() => void appliquer(retirerReglementRecuAction(g.id))}
              className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-[15px] leading-none"
              style={{ border: `1px solid ${colors.inkSoft}`, color: colors.inkSoft }}
            >
              −
            </button>
          )}
          <span className="whitespace-nowrap leading-tight">
            <span data-atlas="nom-acompte">{nomAcompte(reglements, i, acomptesDuDevis)}</span>
            {fige ? (
              <small className="block text-[12px]" style={{ color: colors.muted }}>{jourNumerique(g.date)}</small>
            ) : (
              <input
                type="date"
                value={g.date}
                aria-label="Date du règlement"
                data-atlas="date-reglement"
                onChange={(e) => e.target.value && corriger(g, { date: e.target.value })}
                className="mt-0.5 block w-full border-0 bg-transparent p-0 text-center text-[12px] outline-none"
                style={{ color: colors.muted }}
              />
            )}
          </span>
          {fige ? (
            <span>{LIBELLES_MOYEN[g.moyen ?? "autre"]}</span>
          ) : (
            <select
              value={g.moyen ?? "autre"}
              aria-label="Moyen de paiement"
              data-atlas="moyen-reglement"
              onChange={(e) => {
                const moyen = e.target.value as MoyenDePaiement;
                corriger(g, { moyen, numero: moyen === "cheque" ? g.numero : null });
              }}
              className="w-full border-0 bg-transparent p-0 text-center text-[14px] outline-none"
              style={{ color: colors.ink, fontFamily: font.body }}
            >
              {MOYENS_PROPOSES.map((m) => (
                <option key={m} value={m}>
                  {LIBELLES_MOYEN[m].charAt(0).toUpperCase() + LIBELLES_MOYEN[m].slice(1)}
                </option>
              ))}
            </select>
          )}
          {g.moyen === "cheque" ? (
            fige ? (
              <span>{g.numero ?? ""}</span>
            ) : (
              <input
                defaultValue={g.numero ?? ""}
                placeholder="n°"
                inputMode="numeric"
                aria-label="Numéro du chèque"
                data-atlas="numero-cheque"
                onBlur={(e) => {
                  if ((e.currentTarget.value.trim() || null) !== (g.numero ?? null)) corriger(g, { numero: e.currentTarget.value });
                }}
                className="w-full border-0 bg-transparent p-0 text-center text-[15px] outline-none focus:bg-[var(--voile-champ)]"
                style={{ color: colors.ink }}
              />
            )
          ) : (
            <span />
          )}
          <span className="whitespace-nowrap text-right">
            {fige ? (
              enEuros(g.montant)
            ) : (
              <>
                <input
                  key={g.montant}
                  defaultValue={sansZeros(g.montant)}
                  inputMode="decimal"
                  aria-label="Montant reçu"
                  data-atlas="montant-reglement"
                  onFocus={(e) => e.currentTarget.select()}
                  onBlur={(e) => {
                    const v = e.currentTarget.value.trim();
                    if (v !== "" && v !== sansZeros(g.montant)) corriger(g, { montant: v });
                  }}
                  className="w-[52px] border-0 bg-transparent p-0 text-right text-[16px] outline-none focus:bg-[var(--voile-champ)]"
                  style={{ color: colors.ink }}
                />{" "}
                €
              </>
            )}
          </span>
        </div>
      ))}

      {!fige && (
        <button
          type="button"
          data-atlas="poser-reglement"
          disabled={enCours || Number(net) <= 0}
          onClick={ajouter}
          className="mt-3 block text-[14px] font-medium"
          style={{ color: colors.or }}
        >
          + Règlement reçu
        </button>
      )}

      {!fige && (
        <div
          className="mt-3 flex items-center justify-between gap-3 pt-3 text-[15px]"
          style={{ borderTop: `1px solid ${colors.lineSoft}`, color: colors.ink }}
        >
          <span>
            Facture acquittée
            <small className="block text-[12.5px]" style={{ color: colors.muted }}>
              Tout est réglé avant l’envoi
            </small>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={acquittee}
            aria-label="Facture acquittée"
            data-atlas="facture-acquittee"
            disabled={enCours}
            onClick={() => void appliquer(basculerAcquitteeAction(factureId, !acquittee))}
            className="relative h-7 w-[46px] flex-none rounded-full"
            style={{ backgroundColor: acquittee ? colors.rust : colors.line }}
          >
            <span
              className="absolute top-[3px] h-[22px] w-[22px] rounded-full transition-[left]"
              style={{ left: acquittee ? 21 : 3, backgroundColor: colors.card }}
            />
          </button>
        </div>
      )}

      {erreur && (
        <p role="alert" data-atlas="refus-reglement" className="mt-2 text-[13px]" style={{ color: colors.alert }}>
          {erreur}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between pt-3" style={{ borderTop: `2px solid ${colors.ink}` }}>
        <span className="text-[17px] font-semibold" style={{ color: colors.ink }}>
          Net à payer
        </span>
        <span className="text-[20px] font-semibold" style={{ fontFamily: font.display, color: colors.ink }} data-atlas="net-a-payer">
          {enEuros(net)}
        </span>
      </div>
      {acquittee && (
        <p className={`${smallCaps} mt-3 text-center`} style={{ color: colors.rust }} data-atlas="acquittee">
          Facture acquittée
        </p>
      )}
    </div>
  );
}

const styleEntete = { fontSize: 9.5, letterSpacing: "0.2em", textTransform: "uppercase" as const, fontWeight: 500 };

/** « 522.23 » → « 522,23 », « 500.00 » → « 500 » : la valeur comme il l'aurait tapée. */
function sansZeros(montant: string): string {
  const n = Number(montant);
  if (!Number.isFinite(n)) return montant;
  return String(n).replace(".", ",");
}
