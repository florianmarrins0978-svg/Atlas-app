"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { colors, font, voile } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { avecCivilite, type CiviliteChoisie } from "@/lib/civilite";
import BottomSheet from "@/components/atlas/BottomSheet";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import Picto from "@/components/atlas/reglages/Picto";
import { teintesDuTon } from "@/components/atlas/reglages/PlageTon";
import { additionDeLAvanceImmediate, suiviDeLaDemande } from "@/lib/urssaf/branchement";
import type { DemandeLue } from "@/server/repositories/avance-immediate";
import type { Manque } from "@/lib/urssaf/avance-immediate";
import { envoyerALUrssafAction } from "./actions";

/**
 * L'AVANCE IMMÉDIATE SUR LA FACTURE (sa planche du 8 novembre 2026, écran « La
 * facture », lot 3) : l'addition, l'envoi à l'Urssaf, et le suivi.
 *
 * **L'addition, jamais deux cartes côte à côte** (sa remarque du 8 novembre :
 * « il n'y a pas un problème dans le calcul ? ») : la moitié payée par le
 * client et son crédit d'impôt au-dessus du trait, ce que l'Urssaf verse
 * dessous, c'est-à-dire toute la facture (`additionDeLAvanceImmediate`).
 *
 * **L'envoi est l'arrêt d'aujourd'hui** : « Envoyer » appelle l'émission de la
 * facture, la même porte que « Envoyer la facture », avec la demande de
 * paiement dans sa transaction. Un refus de l'Urssaf laisse le brouillon, et
 * la phrase dit pourquoi.
 */

/** « Payé par Mr. Lambert, Son crédit d'impôt, L'Urssaf vous verse ». */
export function AdditionDeLAvanceImmediate({ totalTtc, qui }: { totalTtc: string; qui: string }) {
  const a = additionDeLAvanceImmediate(totalTtc);
  const vert = teintesDuTon("vert");
  const ligne = "flex items-center justify-between gap-3 py-2.5 text-[15.5px]";
  return (
    <div className="mt-3.5 rounded-[12px] px-4 pb-1.5 pt-1" style={{ backgroundColor: vert.fond }} data-atlas="addition-avance-immediate">
      <div className={ligne} style={{ color: colors.ink }}>
        <span>Payé par {qui}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{enEuros(a.payeParLeClient)}</span>
      </div>
      <div className={ligne} style={{ color: colors.ink, boxShadow: `inset 0 1px 0 ${voile(colors.carteVertTexte, 0.18)}` }}>
        <span>Son crédit d&apos;impôt</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{enEuros(a.creditDImpot)}</span>
      </div>
      <div className={ligne} style={{ boxShadow: `inset 0 1.5px 0 ${vert.texte}` }}>
        <span className="font-bold" style={{ color: vert.texte }}>
          L&apos;Urssaf vous verse
        </span>
        <span className="text-[24px] leading-none" style={{ fontFamily: font.display, color: colors.ink, fontVariantNumeric: "tabular-nums" }}>
          {enEuros(a.verse)}
        </span>
      </div>
    </div>
  );
}

/**
 * « Envoyer à l'Urssaf », sa feuille de confirmation, et « Il paie autrement
 * cette fois », qui rend l'envoi ordinaire. **Ce que la règle refuse se dit
 * avant le bouton** (« Une facture par mois du calendrier », « Facture déjà en
 * partie réglée ») : le serveur le rejoue dans la transaction de l'envoi.
 */
export function EnvoyerALUrssaf({
  factureId,
  totalTtc,
  qui,
  manques,
  verdictPossible,
  onAutrement,
}: {
  factureId: string;
  totalTtc: string;
  qui: string;
  manques: readonly Pick<Manque, "libelle">[];
  /** La pièce elle-même peut-elle partir (des lignes, un total, rien à chiffrer) ? La règle de l'envoi ordinaire. */
  verdictPossible: boolean;
  onAutrement: () => void;
}) {
  const router = useRouter();
  const [ouverte, setOuverte] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const possible = manques.length === 0 && verdictPossible;

  function envoyer() {
    setRefus(null);
    demarrer(async () => {
      const r = await envoyerALUrssafAction(factureId);
      if (!r.succes) {
        setRefus(r.erreur);
        return;
      }
      setOuverte(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2.5" data-atlas="envoi-urssaf">
      {manques.length > 0 && (
        <div className="py-1 pl-[13px]" style={{ borderLeft: `1px solid ${colors.or}` }} data-atlas="urssaf-refuse">
          {manques.map((m) => (
            <p key={m.libelle} className="text-[13.5px] leading-[1.45]" style={{ color: colors.ink }}>
              {m.libelle}.
            </p>
          ))}
        </div>
      )}
      <PrimaryButton pleineLargeur repere="envoyer-a-l-urssaf" disabled={!possible} onClick={() => setOuverte(true)}>
        Envoyer à l&apos;Urssaf
      </PrimaryButton>
      <button
        type="button"
        data-atlas="il-paie-autrement"
        onClick={onAutrement}
        className="mx-auto min-h-[44px] px-1 text-[15px] font-semibold"
        style={{ color: colors.inkSoft }}
      >
        Il paie autrement cette fois
      </button>

      <BottomSheet open={ouverte} onBackdropClick={enCours ? undefined : () => setOuverte(false)}>
        <h2 className="text-[24px] leading-[1.2]" style={{ fontFamily: font.display, color: colors.ink }}>
          Envoyer à l&apos;Urssaf
        </h2>
        <AdditionDeLAvanceImmediate totalTtc={totalTtc} qui={qui} />
        <p
          className="mt-4 rounded-[6px] px-4 py-3 text-[14px] leading-[1.45]"
          style={{ backgroundColor: voile(colors.or, 0.12), color: colors.ink }}
        >
          Envoyée, elle ne se modifie plus. Une correction passerait par un avoir.
        </p>
        {refus && (
          <p role="alert" data-atlas="refus-envoi-urssaf" className="mt-3 text-[14px] font-semibold leading-[1.4]" style={{ color: colors.carteRougeTexte }}>
            {refus}
          </p>
        )}
        <div className="mt-4">
          <PrimaryButton pleineLargeur repere="envoyer-a-l-urssaf-confirmer" disabled={enCours} onClick={envoyer}>
            {enCours ? "Envoi…" : "Envoyer"}
          </PrimaryButton>
        </div>
        <button
          type="button"
          disabled={enCours}
          onClick={() => setOuverte(false)}
          className="mx-auto mt-2 flex min-h-[44px] items-center px-1 text-[15px] font-semibold"
          style={{ color: colors.inkSoft }}
        >
          Pas encore
        </button>
      </BottomSheet>
    </div>
  );
}

/**
 * Le suivi de la demande, comme la planche : envoyée, validée par le client,
 * versée ; ou refusée. Les pas viennent de `suiviDeLaDemande`, qui ne devine
 * rien d'une étape que l'Urssaf nomme autrement.
 */
export function SuiviDeLUrssaf({
  demande,
  totalTtc,
  clientNom,
  clientCivilite,
}: {
  demande: DemandeLue;
  totalTtc: string;
  clientNom: string | null;
  clientCivilite: CiviliteChoisie;
}) {
  const pas = suiviDeLaDemande({ ...demande, totalTtc, clientNom, clientCivilite });
  return (
    <section className="w-full rounded-[6px] px-[18px] py-4 text-left" style={{ backgroundColor: colors.card }} data-atlas="suivi-urssaf">
      <h3
        className="mb-3 text-[13px] font-semibold uppercase"
        style={{ color: colors.or, letterSpacing: "0.12em", fontFamily: font.body, fontWeight: 600 }}
      >
        Avance immédiate
      </h3>
      <ol className="m-0 list-none p-0">
        {pas.map((p, rang) => {
          const teintes = p.ton === "gris" ? null : teintesDuTon(p.ton);
          const dernier = rang === pas.length - 1;
          return (
            <li key={`${p.titre}-${rang}`} className="relative flex gap-3.5" style={{ paddingBottom: dernier ? 0 : 18 }} data-atlas={`suivi-${p.ton}`}>
              {!dernier && (
                <span aria-hidden className="absolute bottom-0.5 left-[15px] top-[34px] w-0.5 rounded-[1px]" style={{ backgroundColor: colors.line }} />
              )}
              <span
                aria-hidden
                className="relative z-[1] grid h-8 w-8 flex-none place-items-center rounded-full"
                style={
                  teintes
                    ? { backgroundColor: teintes.fond, color: teintes.texte }
                    : { backgroundColor: colors.card, color: colors.muted, boxShadow: `inset 0 0 0 1.5px ${colors.line}` }
                }
              >
                <Picto nom={p.icone} taille={17} epaisseur={2.2} />
              </span>
              <span className="pt-1">
                <span className="block text-[16px]" style={{ color: p.ton === "gris" ? colors.inkSoft : colors.ink, fontWeight: p.ton === "gris" ? 500 : 600 }}>
                  {p.titre}
                </span>
                {p.sous && (
                  <span className="mt-0.5 block text-[14px]" style={{ color: colors.inkSoft, fontVariantNumeric: "tabular-nums" }}>
                    {p.sous}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** « Mr. Lambert », ou « votre client » sans nom : la même lecture partout dans ces trois pièces. */
export function quiPaie(clientNom: string | null, clientCivilite: CiviliteChoisie): string {
  return avecCivilite(clientNom, clientCivilite) || "votre client";
}
