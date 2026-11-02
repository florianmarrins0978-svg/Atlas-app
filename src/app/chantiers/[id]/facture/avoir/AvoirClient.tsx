"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import ActionBas from "@/components/atlas/reglages/ActionBas";
import { colors, font, voile } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import {
  calculerAvoir,
  motifDeLAvoir,
  ttcApresAvoirs,
  ttcRestantSurLaLigne,
  type AvoirDejaFait,
  type ChoixDuMotif as Choix,
  type FacturePourAvoir,
} from "@/lib/avoir";
import { faireUnAvoirAction } from "../actions";
import CarteAChoisir from "./CarteAChoisir";
import ChoixDuMotif from "./ChoixDuMotif";

/**
 * La saisie de l'avoir, dessinée sur la planche du 2 novembre 2026
 * (`appli/soignee/facture.html`, « Vous lui enlevez combien ? »).
 *
 * **L'écran calcule avec `calculerAvoir`, la fonction que le serveur appelle
 * pour enregistrer**, et le nouveau total avec `ttcApresAvoirs`, celle du
 * « Net à payer » de la facture : ce qu'il lit ici est ce qui partira, puis ce
 * qu'il retrouvera (`CLAUDE.md` §3). Le serveur recalcule quand même : l'écran
 * ne décide de rien.
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
  const [sur, setSur] = useState<"tout" | "ligne">("tout");
  const [ligneId, setLigneId] = useState<string | null>(null);
  const [montant, setMontant] = useState("");
  const [caseActive, setCaseActive] = useState(false);
  const [choixMotif, setChoixMotif] = useState<Choix>("geste");
  const [motifEcrit, setMotifEcrit] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const ttcActuel = ttcApresAvoirs(facture.totalTtc, dejaFaits);
  // « Une ligne » sans ligne touchée n'est pas encore une demande : une portée
  // nulle voudrait dire toute la facture, et l'avoir partirait sur ce qu'il
  // n'a pas choisi.
  const demande =
    sur === "ligne" && ligneId === null
      ? null
      : { portee: sur === "ligne" ? ligneId : null, montantTtc: montant, motif: motifDeLAvoir(choixMotif, motifEcrit) };
  const calcul = demande ? calculerAvoir(facture, dejaFaits, demande) : null;
  const nouveau = calcul?.ok ? ttcApresAvoirs(facture.totalTtc, [...dejaFaits, calcul.avoir]) : ttcActuel;
  // Le refus ne se montre qu'une fois qu'il a commencé à écrire : un écran qui
  // gronde avant le premier chiffre fait douter de lui.
  const refus =
    montant.trim() === "" ? null : demande === null ? "Touchez la ligne sur laquelle porte l'avoir." : calcul?.ok ? null : (calcul?.refus ?? null);

  async function valider() {
    if (!demande || !calcul?.ok || enCours) return;
    setEnCours(true);
    setErreur(null);
    const r = await faireUnAvoirAction(factureId, demande);
    if (!r.succes) {
      setErreur(r.erreur);
      setEnCours(false);
      return;
    }
    router.push(`/chantiers/${chantierId}/facture/avoir/${r.avoirId}`);
  }

  return (
    <div className="px-[22px] pb-6 pt-5" data-atlas="avoir-saisie">
      <Rubrique premiere>Sur</Rubrique>
      {/* Sa réponse « la B » du 24 septembre tient toujours : il choisit la
          ligne, Atlas ne répartit rien entre deux taux. Seule la façon de
          choisir change : deux cartes au lieu d'une liste qu'on déroule. */}
      <div className="grid grid-cols-2 gap-2.5" role="group" aria-label="Sur" data-atlas="avoir-portee">
        <CarteAChoisir
          pris={sur === "tout"}
          onChoix={() => setSur("tout")}
          icone="facture"
          titre="Toute la facture"
          detail={`${enEuros(ttcActuel)} TTC`}
          repere="avoir-sur-tout"
        />
        <CarteAChoisir pris={sur === "ligne"} onChoix={() => setSur("ligne")} icone="liste" titre="Une ligne" detail="Vous la choisissez" repere="avoir-sur-ligne" />
      </div>
      {sur === "ligne" && (
        <div className="mt-2 rounded-[6px] px-3.5 py-1" style={{ backgroundColor: colors.card }} role="group" aria-label="La ligne">
          {facture.lignes.map((l, i) => {
            const prise = l.id === ligneId;
            return (
              <button
                key={l.id}
                type="button"
                aria-pressed={prise}
                onClick={() => setLigneId(l.id)}
                data-atlas="avoir-ligne"
                className="flex min-h-[56px] w-full items-center gap-3 px-1 py-2 text-left text-[16px]"
                style={{ color: colors.ink, boxShadow: i > 0 ? `inset 0 1px 0 ${colors.lineSoft}` : undefined }}
              >
                <span
                  aria-hidden="true"
                  className="h-[22px] w-[22px] flex-none rounded-full"
                  style={{ boxShadow: prise ? `inset 0 0 0 7px ${colors.ink}` : `inset 0 0 0 1.5px ${colors.chevron}` }}
                />
                <span className="min-w-0 flex-1">{l.libelle}</span>
                <span className="whitespace-nowrap tabular-nums">{enEuros(ttcRestantSurLaLigne(facture, dejaFaits, l))} TTC</span>
              </button>
            );
          })}
        </div>
      )}

      <Rubrique>L&apos;avoir, TTC</Rubrique>
      <label
        className="flex h-[68px] items-baseline justify-end gap-2 rounded-[14px] px-[18px]"
        style={{ backgroundColor: colors.card, boxShadow: caseActive ? `inset 0 0 0 2px ${colors.rust}` : `inset 0 0 0 1.5px ${colors.line}` }}
      >
        <input
          id="montant-avoir"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          aria-label="Montant de l'avoir, TTC, en euros"
          value={montant}
          onChange={(e) => setMontant(e.target.value)}
          onFocus={() => setCaseActive(true)}
          onBlur={() => setCaseActive(false)}
          className="h-full min-w-0 flex-1 border-0 bg-transparent text-right outline-none"
          style={{ fontFamily: font.display, fontSize: 40, lineHeight: "68px", color: colors.ink, fontVariantNumeric: "tabular-nums lining-nums" }}
          data-atlas="avoir-montant"
        />
        <span style={{ fontFamily: font.display, fontSize: 26, color: colors.inkSoft }}>€</span>
      </label>

      <div className="mt-3.5 rounded-[10px] px-4 py-3.5" style={{ backgroundColor: voile(colors.or, 0.13) }}>
        <p className="text-[14.5px]" style={{ color: colors.inkSoft }}>
          Nouveau montant TTC
        </p>
        <p
          className="mt-1 text-[28px] leading-[1.1]"
          style={{ fontFamily: font.display, color: colors.ink, fontVariantNumeric: "tabular-nums lining-nums" }}
          data-atlas="avoir-nouveau"
        >
          {enEuros(nouveau)}
        </p>
      </div>
      {refus && (
        <p className="mt-2 text-[13.5px]" style={{ color: colors.alert }} role="alert">
          {refus}
        </p>
      )}

      <Rubrique>Pourquoi</Rubrique>
      <ChoixDuMotif choix={choixMotif} ecrit={motifEcrit} onChoix={setChoixMotif} onEcrit={setMotifEcrit} />

      <ActionBas>
        {erreur && (
          <p className="mb-2 text-center text-[13.5px]" style={{ color: colors.alert }} role="alert">
            {erreur}
          </p>
        )}
        <PrimaryButton onClick={valider} disabled={!calcul?.ok || enCours} repere="avoir-valider" pleineLargeur>
          {"Faire l'avoir"}
        </PrimaryButton>
      </ActionBas>
    </div>
  );
}

/** L'intitulé d'un paquet de la planche (`.rubrique` du kit soigné). */
function Rubrique({ children, premiere = false }: { children: React.ReactNode; premiere?: boolean }) {
  return (
    <p
      className={`${premiere ? "mt-1" : "mt-7"} mb-2.5 text-[13px] font-semibold uppercase tracking-[0.12em]`}
      style={{ color: colors.inkSoft }}
    >
      {children}
    </p>
  );
}
