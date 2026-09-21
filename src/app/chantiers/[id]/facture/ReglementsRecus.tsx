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
  tamponAcquittee,
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
// La carte fait 310 px sur un téléphone de 390 : cinq colonnes n'y tiennent
// qu'en débordant de 8 px sur chaque marge de la carte (`-mx-2`) et en
// mesurant chaque cellule au plus long qu'elle porte — « Acompte 30 % »,
// « Virement », sept chiffres de chèque, « 1 337,28 ». L'en-tête suit la
// même grille.
const COLONNES = "22px 92px 1.3fr 1fr 74px";

export default function ReglementsRecus({
  factureId,
  totalTtc,
  acomptesDuDevis,
  initiaux,
  fige,
  carte = true,
}: {
  factureId: string;
  totalTtc: string;
  acomptesDuDevis: readonly AcompteDevis[];
  initiaux: ReglementEnregistre[];
  fige: boolean;
  /**
   * Le bloc porte-t-il sa propre carte ?
   *
   * Sur la page de la facture, oui : il y est une carte parmi d'autres. Sur la
   * feuille où il remplit, non — il vient **sous le Total TTC, dans la même
   * feuille**, comme sa planche le montre. Une seconde carte posée sur la
   * première se lirait comme un autre document.
   */
  carte?: boolean;
}) {
  const [reglements, setReglements] = useState(initiaux);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const net = netAPayer(totalTtc, reglements);
  const acquittee = estAcquittee(totalTtc, reglements);
  /** Le mot du papier, mot pour mot : « Acquittée le 21/09/2026 ». */
  const tampon = tamponAcquittee(totalTtc, reglements);

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
        libelle: saisie.libelle === undefined ? g.libelle : saisie.libelle,
      })
    );
  }

  const entete = { ...styleEntete, color: colors.muted };

  return (
    <div
      className={carte ? "rounded-[4px] px-5 py-5" : ""}
      style={carte ? { backgroundColor: colors.card } : undefined}
      data-atlas="reglements-recus"
    >
      <p className={smallCaps} style={{ color: colors.muted, marginBottom: 10 }}>
        Règlements reçus
      </p>

      {reglements.length > 0 && (
        <div className="-mx-2 grid items-center gap-x-1 text-center" style={{ gridTemplateColumns: COLONNES }}>
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
          className="-mx-2 grid items-center gap-x-1 py-2 text-center text-[14px]"
          style={{ gridTemplateColumns: COLONNES, borderBottom: `1px solid ${colors.lineSoft}`, color: colors.ink }}
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
              className="flex h-[22px] w-[22px] items-center justify-center rounded-full text-[14px] leading-none"
              style={{ border: `1px solid ${colors.inkSoft}`, color: colors.inkSoft }}
            >
              −
            </button>
          )}
          {/* **Le mot qu'il écrit peut être long** — « Arrhes à la signature »
              ne tient pas dans les 92 px de la colonne. Vu sur la capture du
              21 septembre 2026 : sans report à la ligne, il passait par-dessus
              la colonne du moyen. Le `nowrap` d'avant valait pour « Acompte
              30 % », qui tenait ; il n'était juste que tant que le nom était
              déduit. */}
          <span className="break-words leading-tight">
            {/* **CE QUE C'EST, ÉCRIT PAR LUI — 21 septembre 2026.** « Acompte
                30 % » reste proposé d'office (`nomAcompte`, la même règle que
                le papier), mais des arrhes ou un avoir ne sont pas des
                acomptes : *« faut que je puisse écrire ce que c'est »*. Vidé,
                le champ rend la proposition plutôt qu'un blanc. */}
            {fige ? (
              <span data-atlas="nom-acompte">{nomAcompte(reglements, i, acomptesDuDevis)}</span>
            ) : (
              <input
                key={g.libelle ?? ""}
                defaultValue={nomAcompte(reglements, i, acomptesDuDevis)}
                aria-label="Ce que ce règlement est"
                data-atlas="nom-acompte"
                onFocus={(e) => e.currentTarget.select()}
                onBlur={(e) => {
                  const ecrit = e.currentTarget.value.trim();
                  const propose = nomAcompte(reglements, i, acomptesDuDevis);
                  if (ecrit !== propose) corriger(g, { libelle: ecrit || null });
                }}
                className="w-full border-0 bg-transparent p-0 text-center text-[14px] outline-none focus:bg-[var(--voile-champ)]"
                style={{ color: colors.ink }}
              />
            )}
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
              // La flèche native du navigateur mange « Virement » sur un téléphone
              // (390 px) : la planche dessine la sienne, 4 px, comme ici.
              className="w-full appearance-none border-0 bg-transparent p-0 pr-[12px] text-center text-[13px] outline-none"
              style={{
                color: colors.ink,
                fontFamily: font.body,
                textAlignLast: "center",
                backgroundImage: `linear-gradient(45deg, transparent 50%, ${colors.muted} 50%), linear-gradient(135deg, ${colors.muted} 50%, transparent 50%)`,
                backgroundPosition: "right 4px top 55%, right 0 top 55%",
                backgroundSize: "4px 4px, 4px 4px",
                backgroundRepeat: "no-repeat",
              }}
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
                className="w-full border-0 bg-transparent p-0 text-center text-[13px] outline-none focus:bg-[var(--voile-champ)]"
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
                  className="w-[58px] border-0 bg-transparent p-0 text-right text-[15px] outline-none focus:bg-[var(--voile-champ)]"
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
      {/* ─── « ACQUITTÉE LE 21/09/2026 », EN OR ET DANS UN CADRE ─────────────
          **Sa correction du 21 septembre 2026, planche en main :** *« mets
          facture acquittée en doré, comme sur la facture »*, puis, devant le
          papier : *« il faut que les deux pages soient identiques »*.

          Deux choses s'alignent ici. L'OR : l'écran l'écrivait à l'encre
          pendant que le PDF en fait un tampon d'or, si bien que le même fait
          se lisait de deux façons. Et le MOT : le papier porte la date depuis
          toujours — c'est ce qu'on vient chercher trois mois plus tard —, et
          c'est `tamponAcquittee` qui l'écrit, pour le PDF comme pour ici. Une
          seconde rédaction aurait divergé au premier ajustement. */}
      {tampon && (
        <div className="mt-3 rounded-[4px] px-4 py-3" style={{ border: `1px solid ${colors.or}` }}>
          <p className={`${smallCaps} text-center`} style={{ color: colors.or }} data-atlas="acquittee">
            {tampon}
          </p>
        </div>
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
