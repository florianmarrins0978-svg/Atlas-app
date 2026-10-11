"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Decimal from "decimal.js";
import { colors, font, surPlein } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { calculerAvoir, type AvoirDejaFait, type FacturePourAvoir } from "@/lib/avoir";
import { faireUnAvoirAction } from "../actions";

/**
 * La saisie de l'avoir. **L'écran calcule avec `calculerAvoir`, la fonction que
 * le serveur appelle pour enregistrer** : ce qu'il lit ici est ce qui partira
 * (`CLAUDE.md` §3). Le serveur recalcule quand même : l'écran ne décide de rien.
 */
export default function AvoirClient({
  chantierId,
  factureId,
  facture,
  dejaFaits,
}: {
  chantierId: string;
  factureId: string;
  facture: FacturePourAvoir;
  dejaFaits: AvoirDejaFait[];
}) {
  const router = useRouter();
  const [portee, setPortee] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [montant, setMontant] = useState("");
  const [motif, setMotif] = useState("Geste commercial");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const calcul = calculerAvoir(facture, dejaFaits, { portee, montantTtc: montant, motif });
  const dejaTtc = dejaFaits.reduce((acc, a) => acc.plus(new Decimal(a.totalTtc)), new Decimal(0));
  const factureTtc = new Decimal(facture.totalTtc).minus(dejaTtc);
  const nouveau = calcul.ok ? factureTtc.minus(new Decimal(calcul.avoir.totalTtc)) : factureTtc;
  const nomPortee = portee === null ? "Toute la facture" : facture.lignes.find((l) => l.id === portee)?.libelle ?? "";
  // Le refus ne se montre qu'une fois qu'il a commencé à écrire : un écran qui
  // gronde avant le premier chiffre fait douter de lui.
  const refus = !calcul.ok && montant.trim() !== "" ? calcul.refus : null;

  async function valider() {
    if (!calcul.ok || enCours) return;
    setEnCours(true);
    setErreur(null);
    const r = await faireUnAvoirAction(factureId, { portee, montantTtc: montant, motif });
    if (!r.succes) {
      setErreur(r.erreur);
      setEnCours(false);
      return;
    }
    router.push(`/chantiers/${chantierId}/facture/avoir/${r.avoirId}`);
  }

  const ligne = "flex items-center justify-between gap-3 py-3.5";
  const filet = { borderBottom: `1px solid ${colors.lineSoft}` };

  return (
    <div className="px-3 pb-10">
      <section className="mt-5 rounded-[10px] px-5 py-3" style={{ backgroundColor: colors.card }} data-atlas="avoir-saisie">
        <div className={ligne} style={filet}>
          <span>Facture TTC</span>
          <span style={{ fontFamily: font.display, fontSize: 19 }}>{enEuros(factureTtc.toFixed(2))}</span>
        </div>

        {/* Sa réponse « la B » : il choisit la ligne ; un chevron doré ouvre la liste. */}
        <button
          type="button"
          className={`${ligne} w-full text-left`}
          style={filet}
          onClick={() => setOuvert((o) => !o)}
          aria-expanded={ouvert}
          data-atlas="avoir-portee"
        >
          <span>Sur</span>
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="truncate" style={{ fontFamily: font.display, fontSize: 18, maxWidth: 190 }}>
              {nomPortee}
            </span>
            <svg viewBox="0 0 16 10" width="16" height="10" aria-hidden="true" style={{ color: colors.or, flex: "none", transform: ouvert ? "rotate(180deg)" : undefined }}>
              <path d="M2 2l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
        {ouvert && (
          <div className="my-1.5 overflow-hidden rounded-[8px]" style={{ boxShadow: `inset 0 0 0 1px ${colors.line}`, backgroundColor: colors.cream }}>
            {[{ id: null as string | null, libelle: "Toute la facture" }, ...facture.lignes].map((l) => (
              <button
                key={l.id ?? "toute"}
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left"
                style={{ fontFamily: font.display, fontSize: 16, color: l.id === portee ? colors.or : colors.ink, borderBottom: `1px solid ${colors.lineSoft}` }}
                onClick={() => {
                  setPortee(l.id);
                  setOuvert(false);
                }}
              >
                {l.libelle}
                {l.id === portee && <span aria-hidden="true">✓</span>}
              </button>
            ))}
          </div>
        )}

        <label className={ligne} style={filet} htmlFor="montant-avoir">
          <span>Avoir TTC</span>
          <span className="flex items-baseline gap-1.5">
            <input
              id="montant-avoir"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              className="w-[130px] rounded-t-[6px] px-2.5 py-2 text-right outline-none"
              style={{ fontFamily: font.display, fontSize: 20, fontWeight: 600, backgroundColor: colors.rustTint, borderBottom: `1.5px solid ${colors.or}`, color: colors.ink }}
              data-atlas="avoir-montant"
            />
            <span style={{ fontFamily: font.display, fontSize: 19 }}>€</span>
          </span>
        </label>

        <div className="mt-3 flex items-center justify-between pt-3" style={{ borderTop: `2px solid ${colors.ink}` }}>
          <b className="text-[17px]">Nouveau montant TTC</b>
          <span style={{ fontFamily: font.display, fontSize: 21, fontWeight: 600 }} data-atlas="avoir-nouveau">
            {enEuros(nouveau.toFixed(2))}
          </span>
        </div>
        {refus && (
          <p className="mt-2 text-[13.5px]" style={{ color: colors.alert }} role="alert">
            {refus}
          </p>
        )}

        <label className="mt-5 block" htmlFor="motif-avoir">
          <span className="text-[11px] font-semibold uppercase" style={{ letterSpacing: "0.18em", color: colors.muted }}>
            Motif
          </span>
          <input
            id="motif-avoir"
            autoComplete="off"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            className="mt-2 block w-full rounded-t-[6px] px-3 py-2.5 outline-none"
            style={{ backgroundColor: colors.rustTint, borderBottom: `1.5px solid ${colors.or}`, color: colors.ink, fontSize: 16 }}
            data-atlas="avoir-motif"
          />
        </label>
      </section>

      {erreur && (
        <p className="mt-3 text-center text-[13.5px]" style={{ color: colors.alert }} role="alert">
          {erreur}
        </p>
      )}
      <button
        type="button"
        onClick={valider}
        disabled={!calcul.ok || enCours}
        className="atlas-plein mx-auto mt-6 flex min-h-[56px] w-[78%] items-center justify-center rounded-full disabled:opacity-40"
        style={{ backgroundColor: colors.plein, color: surPlein, fontFamily: font.display, fontSize: 22 }}
        data-atlas="avoir-valider"
      >
        C&apos;est bon
      </button>
    </div>
  );
}
