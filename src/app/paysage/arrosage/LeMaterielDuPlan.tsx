"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { colors, font, libelleCaps, surPlein } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { photoDe } from "@/lib/arrosage/photos";
import { quantiteDeLigne, referenceFournisseur, sommeDesGroupes, type Groupe } from "@/lib/arrosage/postes";
import type { LigneCalcul } from "@/lib/arrosage/pieces";
import { phraseDesDates, phraseDuManque, prixDesFournisseurs, totalDuPlan, type VueDesPrix } from "@/lib/arrosage/prix-du-plan";
import { prixDesFournisseursAction } from "./actions-fournisseurs";

/** La photo d'une pièce dans son petit cadre blanc, ou un cadre en pointillé quand elle n'en a pas. */
export function VignetteDeLigne({ cle }: { cle: string }) {
  const photo = photoDe(cle);
  return (
    <span
      className="flex h-10 w-10 flex-none items-center justify-center rounded-[8px]"
      style={photo ? { backgroundColor: "#ffffff", boxShadow: `0 0 0 1px ${colors.lineSoft}` } : { border: `1.5px dashed ${colors.line}` }}
    >
      {photo && <Image src={photo} alt="" width={36} height={36} unoptimized className="max-h-9 max-w-9 object-contain" style={{ mixBlendMode: "multiply" }} />}
    </span>
  );
}

/**
 * « LE MATÉRIEL DU PLAN » — sa planche du 18 octobre 2026, au mot et à la
 * place près (`appli/arrosage-prix-fournisseurs.html`) : à côté de chaque pièce
 * le prix d'achat de ses fournisseurs, et un total indicatif, « la C » (sa
 * carte du total, la même dans toute l'application, 19 octobre 2026).
 *
 * Les prix viennent de « Fournisseurs et partenaires » (Réglages) : c'est là
 * que ses devis se lisent. La règle est pure (`prix-du-plan.ts`).
 *
 * **Rien pour un autre rôle que le patron** : l'action ne rend rien, la partie
 * ne s'affiche pas.
 */
export default function LeMaterielDuPlan({ groupes, materiel }: { groupes: Groupe[]; materiel: LigneCalcul[] }) {
  const [donnees, setDonnees] = useState<Awaited<ReturnType<typeof prixDesFournisseursAction>> | undefined>(undefined);
  const [vue, setVue] = useState<VueDesPrix>("moins");
  useEffect(() => {
    let vivant = true;
    prixDesFournisseursAction().then(
      (d) => vivant && setDonnees(d),
      () => vivant && setDonnees(null)
    );
    return () => {
      vivant = false;
    };
  }, []);

  const pieces = useMemo(
    () => sommeDesGroupes(groupes).map((l) => ({ ref: l.ref, nom: l.nom, q: l.inconnu ? 0 : l.q, u: l.u, reference: referenceFournisseur(l.ref, materiel) })),
    [groupes, materiel]
  );
  if (!donnees) return null;
  const fournisseurs = prixDesFournisseurs(pieces, donnees.achats, donnees.fournisseurs);
  const t = totalDuPlan(pieces, fournisseurs, vue);
  const manque = phraseDuManque(t);
  const chips: [VueDesPrix, string][] = [["moins", "Le moins cher"], ...fournisseurs.map((f) => [f.id, f.nom] as [string, string])];

  return (
    <section className="mx-[22px] mt-[26px]" data-atlas="materiel-du-plan">
      <span className={`block ${libelleCaps}`} style={{ color: colors.or }}>
        Plan d’arrosage
      </span>
      <h2 className="mt-[6px] text-[21px] leading-[1.2]" style={{ fontFamily: font.display, fontWeight: 400, color: colors.ink }}>
        Le matériel du plan
      </h2>
      <div className="mt-3 flex flex-wrap gap-[6px]" role="group" aria-label="Prix de">
        {chips.map(([id, nom]) => {
          const appuye = id === vue;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={appuye}
              onClick={() => setVue(id)}
              data-atlas="prix-de"
              className={`rounded-full border px-3 py-2 text-[13.5px] ${appuye ? "atlas-plein" : ""}`}
              style={appuye ? { backgroundColor: colors.plein, borderColor: colors.plein, color: surPlein } : { backgroundColor: colors.card, borderColor: colors.line, color: colors.ink }}
            >
              {nom}
            </button>
          );
        })}
      </div>

      <div
        className="mt-[14px] flex items-center gap-[14px] rounded-[16px] px-[18px] py-4"
        style={{ backgroundColor: colors.card, boxShadow: `inset 0 0 0 1.5px ${colors.orClair}, 0 6px 16px ${colors.lineSoft}` }}
        aria-live="polite"
        data-atlas="total-du-plan"
      >
        <div className="min-w-0 flex-1">
          <small className="block text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: colors.muted }}>
            Total indicatif, hors taxes
          </small>
          <span className="mt-1 block text-[32px] leading-[1.05] tabular-nums" style={{ fontFamily: font.display, color: colors.orTexte }}>
            {enEuros(t.total ?? 0)}
          </span>
          <span className="mt-[6px] block text-[12.5px]" style={{ color: colors.muted }}>
            {phraseDesDates(t)}
          </span>
        </div>
        <div
          className="atlas-plein flex h-16 w-16 flex-none flex-col items-center justify-center rounded-full text-center leading-[1.05]"
          style={{ backgroundColor: colors.plein, color: surPlein }}
        >
          <b className="text-[20px] font-semibold tabular-nums">{pieces.length}</b>
          <span className="text-[10.5px]">pièce{pieces.length > 1 ? "s" : ""}</span>
        </div>
      </div>
      {manque && (
        <p className="mt-[10px] text-[13.5px]" style={{ color: colors.alert }}>
          {manque}
        </p>
      )}

      <div className="mt-[10px] rounded-[12px] px-3 py-[2px]" style={{ backgroundColor: colors.card }}>
        {t.lignes.map((l) => (
          <div key={l.ref} className="flex items-center gap-[10px] border-t py-[9px] text-[14px] first:border-t-0" style={{ borderColor: colors.line }} data-atlas="ligne-prix-plan">
            <VignetteDeLigne cle={l.ref} />
            <span className="min-w-0 flex-1" style={{ color: colors.ink }}>
              {l.nom}
              <small className="block text-[12px]" style={{ color: colors.muted }}>
                {quantiteDeLigne(l)}
              </small>
            </span>
            {l.prix ? (
              <span className="w-[86px] flex-none text-right tabular-nums" style={{ color: colors.ink }}>
                {enEuros(l.prix.montant)}
                <small className="block text-[11.5px]" style={{ color: colors.muted }}>
                  {vue === "moins" ? l.prix.de : `${enEuros(l.prix.unitaire)}${l.u === "ml" ? " le m" : " pièce"}`}
                </small>
              </span>
            ) : (
              <span className="w-[86px] flex-none text-right text-[12.5px]" style={{ color: colors.muted }}>
                pas de prix
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
