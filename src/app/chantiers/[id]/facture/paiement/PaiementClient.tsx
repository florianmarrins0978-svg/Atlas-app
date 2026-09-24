"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors, font, surPlein } from "@/lib/design-tokens";
import { LIBELLES_MOYEN, MOYENS_PROPOSES, type MoyenDePaiement } from "@/lib/acomptes-facture";
import { recuLePaiementAction } from "../actions";

const majuscule = (m: string) => m.charAt(0).toUpperCase() + m.slice(1);

export default function PaiementClient({
  chantierId,
  factureId,
  reste,
  aujourdHui,
}: {
  chantierId: string;
  factureId: string;
  reste: string;
  aujourdHui: string;
}) {
  const router = useRouter();
  const [moyen, setMoyen] = useState<MoyenDePaiement>("cheque");
  const [ouvert, setOuvert] = useState(false);
  const [numero, setNumero] = useState("");
  const [date, setDate] = useState(aujourdHui);
  const [montant, setMontant] = useState(reste.replace(".", ","));
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function noter() {
    setEnCours(true);
    setErreur(null);
    // Le refus (montant qui dépasse, date d'avant la facture) vient de la règle
    // du serveur, `refusDuPaiement` : l'écran ne la recopie pas.
    const r = await recuLePaiementAction(factureId, {
      date,
      montant: montant.replace(/\s/g, "").replace(",", "."),
      moyen,
      numero: moyen === "cheque" ? numero : null,
    });
    if (!r.succes) {
      setErreur(r.erreur);
      setEnCours(false);
      return;
    }
    router.push(`/chantiers/${chantierId}/facture`);
  }

  const ligne = "flex items-center justify-between gap-3 py-3.5";
  const filet = { borderBottom: `1px solid ${colors.lineSoft}` };
  const champ = { backgroundColor: colors.rustTint, borderBottom: `1.5px solid ${colors.or}`, color: colors.ink } as const;

  return (
    <div className="px-3 pb-10">
      <section className="mt-5 rounded-[10px] px-5 py-3" style={{ backgroundColor: colors.card }} data-atlas="paiement-saisie">
        <button type="button" className={`${ligne} w-full text-left`} style={filet} onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert} data-atlas="paiement-moyen">
          <span>Moyen</span>
          <span className="flex items-center gap-2.5">
            <span style={{ fontFamily: font.display, fontSize: 18 }}>{majuscule(LIBELLES_MOYEN[moyen])}</span>
            <svg viewBox="0 0 16 10" width="16" height="10" aria-hidden="true" style={{ color: colors.or, transform: ouvert ? "rotate(180deg)" : undefined }}>
              <path d="M2 2l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
        {ouvert && (
          <div className="my-1.5 overflow-hidden rounded-[8px]" style={{ boxShadow: `inset 0 0 0 1px ${colors.line}`, backgroundColor: colors.cream }}>
            {MOYENS_PROPOSES.map((m) => (
              <button
                key={m}
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left"
                style={{ fontFamily: font.display, fontSize: 17, color: m === moyen ? colors.or : colors.ink, borderBottom: `1px solid ${colors.lineSoft}` }}
                onClick={() => {
                  setMoyen(m);
                  setOuvert(false);
                }}
              >
                {majuscule(LIBELLES_MOYEN[m])}
                {m === moyen && <span aria-hidden="true">✓</span>}
              </button>
            ))}
          </div>
        )}
        {moyen === "cheque" && (
          <label className={ligne} style={filet} htmlFor="numero-cheque">
            <span>N° de chèque</span>
            <input id="numero-cheque" inputMode="numeric" autoComplete="off" value={numero} onChange={(e) => setNumero(e.target.value)} className="w-[140px] rounded-t-[6px] px-2.5 py-2 text-right outline-none" style={{ ...champ, fontFamily: font.display, fontSize: 18 }} data-atlas="paiement-numero" />
          </label>
        )}
        <label className={ligne} style={filet} htmlFor="date-paiement">
          <span>Le</span>
          <input id="date-paiement" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-t-[6px] px-2.5 py-2 text-right outline-none" style={{ ...champ, fontSize: 16 }} />
        </label>
        <label className={ligne} htmlFor="montant-paiement">
          <span>Montant</span>
          <span className="flex items-baseline gap-1.5">
            <input id="montant-paiement" inputMode="decimal" autoComplete="off" value={montant} onChange={(e) => setMontant(e.target.value)} className="w-[130px] rounded-t-[6px] px-2.5 py-2 text-right outline-none" style={{ ...champ, fontFamily: font.display, fontSize: 18 }} data-atlas="paiement-montant" />
            <span style={{ fontFamily: font.display, fontSize: 18 }}>€</span>
          </span>
        </label>
      </section>
      {erreur && (
        <p className="mt-3 text-center text-[13.5px]" style={{ color: colors.alert }} role="alert">
          {erreur}
        </p>
      )}
      <button type="button" onClick={noter} disabled={enCours} className="atlas-plein mx-auto mt-6 flex min-h-[56px] w-[78%] items-center justify-center rounded-full disabled:opacity-40" style={{ backgroundColor: colors.plein, color: surPlein, fontFamily: font.display, fontSize: 22 }} data-atlas="paiement-noter">
        C&apos;est noté
      </button>
    </div>
  );
}
