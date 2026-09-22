"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { colors, font, surPlein, voile } from "@/lib/design-tokens";
import { adresseDeLaVisionneuse } from "@/lib/visionneuse-pdf";
import { gardeeJusquAu } from "@/lib/fiche-securite";
import type { FicheEnListe } from "@/server/repositories/fiches-securite";
import { marquerTransmiseAction } from "@/app/planning/fiche-securite-actions";
import { transmettreLePdf } from "@/components/atlas/transmettre-le-pdf";

/**
 * LES FICHES DE SÉCURITÉ, DANS PAYSAGE — sa décision du 21 septembre 2026 :
 * *« il faut créer une catégorie dans Paysage »*. Rangées par client, le mois
 * en tête ; on le touche, la roue mois/année du téléphone tourne. **Aucun
 * bouton de filtre** : *« enlève tous tes filtres boutons et garde que
 * celui-là »*, *« tout ça doit être la forme par défaut, pas besoin de mettre
 * le bouton »*.
 *
 * Sur chaque fiche : ouvrir, **enregistrer** (dans les fichiers du téléphone),
 * transmettre. Et la date jusqu'à laquelle elle est gardée : deux ans.
 */
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const dateLongue = (d: Date) => `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;

export default function ListeDesFiches({ fiches, mois }: { fiches: FicheEnListe[]; mois: string }) {
  const router = useRouter();
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [transmises, setTransmises] = useState<ReadonlySet<string>>(new Set(fiches.filter((f) => f.transmiseLe).map((f) => f.chantierId)));
  const [refus, setRefus] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [annee, numero] = mois.split("-").map(Number);
  const nomDuMois = `${MOIS[numero - 1]} ${annee}`;

  const groupes: { client: string; fiches: FicheEnListe[] }[] = [];
  for (const f of fiches) {
    let g = groupes.find((x) => x.client === f.client);
    if (!g) {
      g = { client: f.client, fiches: [] };
      groupes.push(g);
    }
    g.fiches.push(f);
  }

  async function transmettre(chantierId: string) {
    setOccupe(true);
    setRefus(null);
    try {
      const parti = await transmettreLePdf(`/planning/fiche-de-securite/${chantierId}/pdf`, "fiche-de-securite.pdf");
      if (parti) {
        const r = await marquerTransmiseAction(chantierId);
        if (r.ok) setTransmises((t) => new Set([...t, chantierId]));
        else setRefus(r.raison);
      }
    } catch (e) {
      setRefus(e instanceof Error ? e.message : "La transmission n’a pas abouti.");
    }
    setOccupe(false);
  }

  return (
    <div className="pb-10" data-atlas="liste-des-fiches-de-securite">
      {/* Le mois en tête, comme « Septembre 2026 » sur Terminés : la roue du
          téléphone s'ouvre au toucher — le champ couvre le titre, invisible. */}
      <label className="relative mx-[22px] mt-3 flex min-h-12 cursor-pointer items-center justify-center gap-2" data-atlas="mois-des-fiches">
        <span className="text-[20px] leading-[1.2]" style={{ fontFamily: font.display }}>{nomDuMois.charAt(0).toUpperCase() + nomDuMois.slice(1)}</span>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ color: colors.or }}><path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <input
          type="month"
          aria-label="Choisir un mois"
          value={mois}
          onChange={(e) => {
            if (e.target.value) router.push(`/paysage/fiches-securite?mois=${e.target.value}`);
          }}
          className="absolute inset-0 h-full w-full opacity-0"
          style={{ fontSize: 16 }}
        />
      </label>

      {groupes.length === 0 ? (
        <p className="mx-[22px] mt-7 text-center text-[13.5px] leading-[1.65]" style={{ color: colors.muted }}>
          Aucune fiche signée en {nomDuMois}.
        </p>
      ) : (
        groupes.map((g) => (
          <section key={g.client} className="mt-6" data-atlas="groupe-de-fiches">
            <p className="mx-[22px] mb-0 text-[19px] leading-[1.2]" style={{ fontFamily: font.display }}>{g.client}</p>
            {g.fiches.map((f) => {
              const estOuverte = ouverte === f.chantierId;
              const transmise = transmises.has(f.chantierId);
              const pdf = `/planning/fiche-de-securite/${f.chantierId}/pdf`;
              return (
                <div key={f.chantierId} className="mx-[22px] mt-2.5 rounded-[13px]" style={{ background: colors.card, boxShadow: `inset 0 0 0 1.5px ${colors.or}` }}>
                  <button type="button" data-atlas="carte-de-fiche" aria-expanded={estOuverte} onClick={() => setOuverte(estOuverte ? null : f.chantierId)} className="flex w-full items-start gap-3 px-3.5 py-3 text-left" style={{ color: colors.ink }}>
                    <span aria-hidden="true" className="grid h-[26px] w-[26px] flex-none place-items-center rounded-full" style={{ backgroundColor: voile(colors.or, 0.13), color: colors.orTexte }}>
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2.5 4 5v5c0 3.6 2.6 6.4 6 7.5 3.4-1.1 6-3.9 6-7.5V5z" /><path d="m7.3 10 1.9 1.9L12.8 8" /></svg>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold leading-[1.3]">{f.chantierNom}, {dateLongue(f.signeeLe)}</span>
                      <span className="mt-[3px] block text-[12.5px] leading-[1.45]" style={{ color: colors.muted }}>
                        {[f.signataire ? `Signée par ${f.signataire}` : "Signée", `gardée jusqu’au ${dateLongue(gardeeJusquAu(f.signeeLe))}`, transmise ? "transmise" : null].filter(Boolean).join(", ")}
                      </span>
                    </span>
                    <span aria-hidden="true" className="mt-1.5 flex-none" style={{ color: colors.muted, transform: estOuverte ? "rotate(90deg)" : "none", transition: "transform .18s cubic-bezier(.22,.9,.3,1)" }}>
                      <svg width="9" height="15" viewBox="0 0 9 15" fill="none"><path d="m1.5 1.5 6 6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </span>
                  </button>
                  {estOuverte && (
                    <div className="px-3.5 pb-3.5 pt-0.5">
                      <div className="flex flex-col gap-2">
                        <Link href={adresseDeLaVisionneuse(pdf, { surtitre: "Fiche de sécurité", titre: f.chantierNom })} className="flex min-h-[46px] w-full items-center justify-center rounded-full px-2.5 text-[14.5px] no-underline" style={{ fontFamily: font.display, color: colors.rust, boxShadow: `inset 0 0 0 1.5px ${colors.vertPale}` }}>
                          Ouvrir le PDF
                        </Link>
                        <a href={`${pdf}?telecharger=1`} data-atlas="enregistrer-le-pdf" className="flex min-h-[46px] w-full items-center justify-center rounded-full px-2.5 text-[14.5px] no-underline" style={{ fontFamily: font.display, color: colors.rust, boxShadow: `inset 0 0 0 1.5px ${colors.vertPale}` }}>
                          Enregistrer le PDF
                        </a>
                        {!transmise && (
                          <button type="button" disabled={occupe} onClick={() => transmettre(f.chantierId)} className="flex min-h-[46px] w-full items-center justify-center rounded-full px-2.5 text-[14.5px]" style={{ fontFamily: font.display, background: colors.plein, color: surPlein }}>
                            Transmettre le PDF
                          </button>
                        )}
                      </div>
                      <p className="m-0 mt-2.5 text-[12.5px] leading-[1.45]" style={{ color: colors.muted }}>
                        Gardée deux ans après la signature, même si le chantier est supprimé. « Enregistrer » la met dans vos fichiers, sur le téléphone.
                      </p>
                      {refus && <p className="m-0 mt-2 text-[13px]" style={{ color: colors.alert }}>{refus}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        ))
      )}
    </div>
  );
}
