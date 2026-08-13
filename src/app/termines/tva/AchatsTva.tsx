"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import BottomSheet from "@/components/atlas/BottomSheet";
import { montantSaisi, tvaDepuisTtc } from "@/lib/achat-tva";
import { ajouterAchatAction, rangerTicketAction } from "./actions";

/**
 * Les achats de la période, et les deux façons d'en ajouter un.
 *
 * *Sa demande du 12 août 2026 : « il faut pouvoir scanner un ticket, mais
 * également l'écrire ».* Retenu sur maquette (`docs/maquettes/37`).
 *
 * **Écrire n'est pas la roue de secours du scanner** : c'est l'autre moitié du
 * geste. Trois cas où l'objectif ne peut rien — le ticket perdu dont il se
 * souvient, la facture reçue par e-mail qui n'existe pas sur papier, l'achat
 * noté sur un coin de table. D'où deux entrées côte à côte, et non un bouton
 * principal avec un repli discret.
 *
 * **La lecture automatique n'est pas branchée, et l'écran le DIT.** Elle
 * demande un service d'IA, et le fournisseur n'est pas choisi (`docs/A-FAIRE.md`
 * point 1). Le ticket est donc photographié et rangé — la preuve est gardée —
 * puis les montants se saisissent. Faire semblant d'avoir lu serait pire que
 * de ne rien lire : un chiffre faux entré tout seul coûte plus cher que pas de
 * chiffre du tout.
 */

export type LigneAchat = {
  id: string;
  dateAchat: string;
  fournisseur: string;
  totalTtc: string | null;
  tvaDeductible: string;
  saisie: "scan" | "main";
};

const EUROS = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function jourCourt(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export default function AchatsTva({ achats, aujourdHui }: { achats: LigneAchat[]; aujourdHui: string }) {
  const router = useRouter();
  const objectif = useRef<HTMLInputElement>(null);

  const [ouverte, setOuverte] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [photoCle, setPhotoCle] = useState<string | null>(null);

  const [fournisseur, setFournisseur] = useState("");
  const [date, setDate] = useState(aujourdHui);
  const [ttc, setTtc] = useState("");
  const [taux, setTaux] = useState("20");
  const [tva, setTva] = useState("");
  // Une fois qu'il a écrit la TVA lui-même, on ne l'écrase plus : son ticket
  // fait foi, pas notre calcul.
  const [tvaEcrite, setTvaEcrite] = useState(false);

  function ouvrir(cle: string | null) {
    setFournisseur("");
    setDate(aujourdHui);
    setTtc("");
    setTaux("20");
    setTva("");
    setTvaEcrite(false);
    setRefus(null);
    setPhotoCle(cle);
    setOuverte(true);
  }

  /** La TVA se calcule pendant la frappe — la faire calculer de tête sur un
   *  coin de camionnette, c'est la faire écrire fausse. */
  function recalculer(nouveauTtc: string, nouveauTaux: string) {
    if (tvaEcrite) return;
    const calcul = tvaDepuisTtc(montantSaisi(nouveauTtc), montantSaisi(nouveauTaux));
    setTva(calcul === null ? "" : calcul.toFixed(2).replace(".", ","));
  }

  async function photographier(fichier: File) {
    setEnCours(true);
    setRefus(null);
    const fd = new FormData();
    fd.set("ticket", fichier);
    const r = await rangerTicketAction(fd);
    setEnCours(false);
    if (!r.ok) {
      setRefus(r.raison);
      setOuverte(true);
      return;
    }
    ouvrir(r.cle);
  }

  async function enregistrer() {
    setEnCours(true);
    setRefus(null);
    const fd = new FormData();
    fd.set("fournisseur", fournisseur);
    fd.set("dateAchat", date);
    fd.set("totalTtc", ttc);
    fd.set("tauxTva", taux);
    fd.set("tvaDeductible", tva);
    fd.set("saisie", photoCle ? "scan" : "main");
    if (photoCle) fd.set("photoCle", photoCle);
    const r = await ajouterAchatAction(fd);
    setEnCours(false);
    if (!r.ok) {
      setRefus(r.raison);
      return;
    }
    setOuverte(false);
    router.refresh();
  }

  const armé = fournisseur.trim() !== "" && montantSaisi(tva) !== null && !enCours;

  return (
    <div className="mt-5 px-6">
      <p className={`mb-2.5 ${libelleCaps}`} style={{ color: colors.muted }}>
        Vos achats
      </p>

      {/* **Sans `capture`.** L'attribut forcerait l'appareil photo et retirerait
          l'accès à la photothèque : un ticket déjà photographié la veille
          deviendrait inatteignable. Sans lui, le téléphone propose les deux —
          même arbitrage que la pellicule des chantiers (`ARCHITECTURE.md` §60). */}
      <input
        ref={objectif}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void photographier(f);
        }}
      />

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={() => objectif.current?.click()}
          disabled={enCours}
          className="flex flex-1 flex-col items-center gap-[7px] rounded-full px-2 py-[15px] text-[12.5px]"
          style={{ backgroundColor: colors.card, border: `1px solid ${colors.line}`, color: colors.ink }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.rust} strokeWidth="1.6" aria-hidden="true">
            <path d="M4 8.4V6.2A2.2 2.2 0 0 1 6.2 4h2.2M15.6 4h2.2A2.2 2.2 0 0 1 20 6.2v2.2M20 15.6v2.2a2.2 2.2 0 0 1-2.2 2.2h-2.2M8.4 20H6.2A2.2 2.2 0 0 1 4 17.8v-2.2" strokeLinecap="round" />
            <path d="M4 12h16" strokeLinecap="round" />
          </svg>
          {enCours && !ouverte ? "Envoi…" : "Scanner un ticket"}
        </button>
        <button
          type="button"
          onClick={() => ouvrir(null)}
          className="flex flex-1 flex-col items-center gap-[7px] rounded-full px-2 py-[15px] text-[12.5px]"
          style={{ backgroundColor: colors.card, border: `1px solid ${colors.line}`, color: colors.ink }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.rust} strokeWidth="1.6" aria-hidden="true">
            <path d="M4 20h4.2L19 9.2a2 2 0 0 0 0-2.8l-1.4-1.4a2 2 0 0 0-2.8 0L4 15.8V20z" strokeLinejoin="round" />
            <path d="M13.6 6.6l3.8 3.8" strokeLinecap="round" />
          </svg>
          Écrire à la main
        </button>
      </div>

      {achats.length === 0 ? (
        <p className="py-4 text-center text-[13px] leading-[1.6]" style={{ color: colors.muted }}>
          Rien encore. Scannez un ticket, ou écrivez-le.
        </p>
      ) : (
        <div className="mt-1.5">
          {achats.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3.5 py-3"
              style={{ borderTop: `1px solid ${colors.lineSoft}` }}
            >
              <span
                className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full text-[13px]"
                style={{ backgroundColor: colors.rustTint }}
                aria-hidden="true"
              >
                {a.saisie === "scan" ? "🧾" : "✎"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px]">{a.fournisseur}</span>
                <span className="mt-0.5 block text-[11.5px]" style={{ color: colors.muted }}>
                  {jourCourt(a.dateAchat)}
                  {a.totalTtc ? ` · ${EUROS.format(Number(a.totalTtc))}` : ""}
                </span>
              </span>
              <span
                className="flex-shrink-0 text-[14.5px] font-semibold"
                style={{ color: colors.rust, fontVariantNumeric: "tabular-nums" }}
              >
                {EUROS.format(Number(a.tvaDeductible))}
              </span>
            </div>
          ))}
        </div>
      )}

      <BottomSheet open={ouverte} onBackdropClick={() => setOuverte(false)}>
        <p className={`text-center ${libelleCaps}`} style={{ color: colors.or }}>
          {photoCle ? "Ticket photographié" : "Écrire un achat"}
        </p>
        <p
          className="mb-3.5 mt-2 text-center text-[20px]"
          style={{ fontFamily: font.display }}
        >
          {photoCle ? "Ses montants" : "À la main"}
        </p>

        <div className="flex flex-col gap-px overflow-hidden rounded-xl" style={{ backgroundColor: colors.lineSoft }}>
          <Ligne libelle="Où">
            <input
              value={fournisseur}
              onChange={(e) => setFournisseur(e.target.value)}
              placeholder="Station, magasin…"
              className="w-full bg-transparent text-right text-[15.5px] outline-none"
            />
          </Ligne>
          <Ligne libelle="Date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-transparent text-right text-[15.5px] outline-none"
            />
          </Ligne>
          <Ligne libelle="Total payé">
            <input
              inputMode="decimal"
              value={ttc}
              onChange={(e) => {
                setTtc(e.target.value);
                recalculer(e.target.value, taux);
              }}
              placeholder="0,00 €"
              className="w-full bg-transparent text-right text-[15.5px] tabular-nums outline-none"
            />
          </Ligne>
          <Ligne libelle="Taux">
            <input
              inputMode="decimal"
              value={taux}
              onChange={(e) => {
                setTaux(e.target.value);
                recalculer(ttc, e.target.value);
              }}
              placeholder="20"
              className="w-full bg-transparent text-right text-[15.5px] tabular-nums outline-none"
            />
          </Ligne>
          <Ligne libelle="TVA déductible" accent>
            <input
              inputMode="decimal"
              value={tva}
              onChange={(e) => {
                setTva(e.target.value);
                setTvaEcrite(true);
              }}
              placeholder="calculée"
              className="w-full bg-transparent text-right text-[15.5px] tabular-nums outline-none"
            />
          </Ligne>
        </div>

        <p
          className="mt-2.5 rounded-xl px-3.5 py-3 text-[12.5px] leading-[1.5]"
          style={{ backgroundColor: "rgba(185,139,71,0.10)", color: "#7d6234" }}
        >
          {photoCle
            ? "Le ticket est rangé. La lecture automatique n’est pas encore branchée : recopiez ses montants. Gardez le papier — la photo ne le remplace pas."
            : "La TVA se calcule depuis le total et le taux. Si votre ticket en affiche une autre, écrivez la sienne : c’est elle qui fait foi."}
        </p>

        {refus && (
          <p role="alert" className="mt-2.5 text-center text-[13px]" style={{ color: colors.alert }}>
            {refus}
          </p>
        )}

        <button
          type="button"
          onClick={enregistrer}
          disabled={!armé}
          className="mt-3 w-full rounded-full py-[15px] text-[15px]"
          style={{
            backgroundColor: colors.rust,
            color: colors.cream,
            fontFamily: font.display,
            opacity: armé ? 1 : 0.35,
          }}
        >
          {enCours ? "Enregistrement…" : "Ajouter aux achats"}
        </button>
        <button
          type="button"
          onClick={() => setOuverte(false)}
          className="mt-1.5 w-full rounded-full py-3 text-[14.5px]"
          style={{ color: colors.muted }}
        >
          Annuler
        </button>
      </BottomSheet>
    </div>
  );
}

function Ligne({
  libelle,
  accent,
  children,
}: {
  libelle: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      className="flex items-center justify-between gap-3 px-[15px] py-[13px]"
      style={{ backgroundColor: accent ? "#f2efe8" : colors.card }}
    >
      <span className="flex-shrink-0 text-[13px]" style={{ color: accent ? colors.or : colors.muted }}>
        {libelle}
      </span>
      {children}
    </label>
  );
}
