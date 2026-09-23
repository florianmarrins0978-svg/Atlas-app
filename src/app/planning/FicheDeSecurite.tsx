"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { colors, font, voile } from "@/lib/design-tokens";
import { adresseDeLaVisionneuse } from "@/lib/visionneuse-pdf";
import { ETAPES, compteDuBandeau } from "@/lib/fiche-securite";
import { etatDeLaFicheAction, marquerTransmiseAction, rouvrirLaFicheAction } from "./fiche-securite-actions";
import type { FicheEnregistree } from "@/server/repositories/fiches-securite";
import { transmettreLePdf } from "@/components/atlas/transmettre-le-pdf";

/**
 * LE BANDEAU « FICHE DE SÉCURITÉ » — sur la fiche du jour, au-dessus de
 * « Travaux à faire », sur TOUS les chantiers.
 *
 * Sa décision du 21 septembre 2026 : *« si c'est en arrivant sur le chantier,
 * tu la mets sur la page de la fiche du jour »*, *« au bon vouloir de
 * l'utilisateur »*, *« disponible partout, sur tous les chantiers — des fois
 * c'est un entretien avec juste un peu d'élagage »*. Rien d'imposé, rien
 * d'automatique : un bandeau, fermé, qui dit où en est la fiche.
 *
 * La même forme que « Travaux à faire » (`TravauxAFaire.tsx`), en or : c'est
 * ce qui se lit et se signe, pas ce qu'on fait (`ARCHITECTURE.md` §160).
 */
export default function FicheDeSecurite({ chantierId }: { chantierId: string }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [fiche, setFiche] = useState<FicheEnregistree | null | undefined>(undefined);
  const [refus, setRefus] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [paysageOuvert, setPaysageOuvert] = useState(false);

  useEffect(() => {
    let vivant = true;
    etatDeLaFicheAction(chantierId)
      .then((etat) => {
        if (!vivant) return;
        setFiche(etat.fiche);
        setPaysageOuvert(etat.paysageOuvert);
      })
      .catch(() => {
        if (vivant) setFiche(null);
      });
    return () => {
      vivant = false;
    };
  }, [chantierId]);

  const compte = fiche === undefined ? "" : compteDuBandeau(fiche);
  const adresseDuFormulaire = `/planning/fiche-de-securite/${chantierId}`;
  const adresseDuPdf = `${adresseDuFormulaire}/pdf`;

  async function transmettre() {
    setOccupe(true);
    setRefus(null);
    const parti = await transmettreLePdf(adresseDuPdf, "fiche-de-securite.pdf");
    if (parti) {
      const r = await marquerTransmiseAction(chantierId);
      if (r.ok) setFiche((f) => (f ? { ...f, transmiseLe: new Date() } : f));
      else setRefus(r.raison);
    }
    setOccupe(false);
  }

  async function modifier() {
    setOccupe(true);
    const r = await rouvrirLaFicheAction(chantierId);
    setOccupe(false);
    if (!r.ok) {
      setRefus(r.raison);
      return;
    }
    router.push(adresseDuFormulaire);
  }

  return (
    <div data-atlas="fiche-de-securite" className="mt-3.5">
      <div className="overflow-hidden rounded-[12px]" style={{ background: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }}>
        <button
          type="button"
          data-atlas="ouvrir-fiche-de-securite"
          aria-expanded={ouvert}
          onClick={() => setOuvert((o) => !o)}
          className="flex min-h-[54px] w-full items-center gap-2.5 pl-4 pr-3.5 text-left"
          style={{ background: voile(colors.or, 0.13) }}
        >
          <span className="min-w-0 flex-1 text-[16px] leading-[1.2]" style={{ fontFamily: font.display, color: colors.orTexte }}>
            Fiche de sécurité
          </span>
          <span data-atlas="compte-de-la-fiche" className="flex-none text-[12.5px] font-semibold" style={{ color: colors.orTexte }}>
            {compte}
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
            className="flex-none transition-transform duration-300"
            style={{ color: colors.orTexte, transform: ouvert ? "rotate(180deg)" : "none" }}
          >
            <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="grid transition-[grid-template-rows] duration-300" style={{ gridTemplateRows: ouvert ? "1fr" : "0fr" }}>
          <div className="min-h-0 overflow-hidden px-3.5">
            {fiche === undefined ? (
              <p className="m-0 py-3 text-[13.5px]" style={{ color: colors.muted }}>
                Un instant…
              </p>
            ) : fiche?.signeeLe ? (
              <div className="pb-3.5 pt-3">
                <p className="m-0 text-[14px] leading-[1.45]" style={{ color: colors.inkSoft }}>
                  Signée le <b style={{ color: colors.ink, fontWeight: 600 }}>{jourEtHeure(fiche.signeeLe)}</b>.
                </p>
                {!fiche.transmiseLe && (
                  <p className="m-0 mt-1 text-[14px] leading-[1.45]" style={{ color: colors.inkSoft }}>
                    Pas encore transmise.
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <Link
                    href={adresseDeLaVisionneuse(adresseDuPdf, { surtitre: "Fiche de sécurité", titre: "PDF" })}
                    data-atlas="ouvrir-le-pdf-de-la-fiche"
                    className="flex min-h-[46px] flex-1 items-center justify-center rounded-full px-2.5 text-[14.5px] no-underline"
                    style={{ fontFamily: font.display, color: colors.rust, boxShadow: `inset 0 0 0 1.5px ${colors.vertPale}` }}
                  >
                    Ouvrir le PDF
                  </Link>
                  {!fiche.transmiseLe && (
                    <button
                      type="button"
                      data-atlas="transmettre-la-fiche"
                      disabled={occupe}
                      onClick={transmettre}
                      className="flex min-h-[46px] flex-1 items-center justify-center rounded-full px-2.5 text-[14.5px]"
                      style={{ fontFamily: font.display, background: colors.plein, color: colors.card }}
                    >
                      Transmettre le PDF
                    </button>
                  )}
                </div>
                {fiche.transmiseLe && (
                  <p className="m-0 mt-2.5 text-[13.5px]" style={{ color: colors.rust }}>
                    Transmise le {jourEtHeure(fiche.transmiseLe)}.
                  </p>
                )}
                <div className="mt-1 flex justify-center gap-4">
                  {paysageOuvert && (
                    <Link href="/paysage/fiches-securite" className="px-2 py-2 text-[14px] font-bold no-underline" style={{ color: colors.ink }}>
                      Voir où elle est gardée
                    </Link>
                  )}
                  <button type="button" data-atlas="modifier-la-fiche" disabled={occupe} onClick={modifier} className="px-2 py-2 text-[14px] font-bold" style={{ color: colors.ink }}>
                    Modifier
                  </button>
                </div>
              </div>
            ) : (
              <div className="pb-3.5 pt-3">
                {fiche && fiche.etapeVue > 0 && (
                  <p className="m-0 mb-3 text-[14px] leading-[1.45]" style={{ color: colors.inkSoft }}>
                    Reprise à <b style={{ color: colors.ink, fontWeight: 600 }}>{ETAPES[Math.min(fiche.etapeVue, ETAPES.length - 1)]}</b>
                  </p>
                )}
                <Link
                  href={adresseDuFormulaire}
                  data-atlas="remplir-la-fiche"
                  className="mx-auto flex min-h-[46px] w-max max-w-full items-center justify-center rounded-full px-[26px] text-[15.5px] no-underline"
                  style={{ fontFamily: font.display, background: colors.plein, color: colors.card }}
                >
                  {fiche && fiche.etapeVue > 0 ? "Continuer" : "Remplir la fiche"}
                </Link>
              </div>
            )}
            {refus && (
              <p className="m-0 pb-3 text-[13px]" style={{ color: colors.alert }}>
                {refus}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function jourEtHeure(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "Europe/Paris" }).replace(":", " h ");
}
