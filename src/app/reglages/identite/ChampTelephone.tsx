"use client";

import { useState } from "react";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import {
  PAYS_TELEPHONE,
  afficherTelephone,
  composerTelephone,
  formaterNational,
  type PaysTelephone,
} from "@/lib/telephone";

/**
 * Le téléphone : drapeau, indicatif, et espaces posés sous le doigt.
 *
 * *Demandé par le patron le 14 août 2026, arrêté sur planche
 * (`maquettes/atlas-identite-saisie.html`).*
 *
 * **Ce composant ne décide de rien** : la découpe, le zéro national et ce qui
 * part en base sont dans `src/lib/telephone.ts`, éprouvés sans navigateur. Ici
 * il n'y a que le geste.
 *
 * **La pastille du pays fait 44 px et se touche.** Un menu caché derrière le
 * champ serait invisible ; et une cible plus petite est un geste raté une fois
 * sur trois, que le patron rapporterait comme « ça ne marche pas ».
 *
 * **La liste se referme dès qu'un pays est choisi.** La laisser ouverte
 * obligerait à un second geste pour revenir au numéro, sans rien apporter.
 */
export default function ChampTelephone({
  valeur,
  onChange,
  onFini,
}: {
  /** Ce que la base porte : « 06 79 98 45 14 » ou « +32 471 12 34 56 ». */
  valeur: string;
  /** Reçoit la valeur PRÊTE À RANGER, jamais la frappe brute. */
  onChange: (v: string) => void;
  onFini: () => void;
}) {
  const lu = afficherTelephone(valeur);
  const [pays, setPays] = useState<PaysTelephone>(lu.pays);
  const [ouvert, setOuvert] = useState(false);

  // Ce que le champ montre se recalcule de la valeur, sauf pendant la frappe :
  // un état local est nécessaire, sinon le curseur saute à chaque espace posé.
  const [saisi, setSaisi] = useState(lu.affiche);

  function ecrire(brut: string, p: PaysTelephone = pays) {
    const espace = formaterNational(p, brut);
    setSaisi(espace);
    onChange(composerTelephone(p, brut));
  }

  function choisirPays(p: PaysTelephone) {
    setPays(p);
    setOuvert(false);
    // Le numéro déjà tapé se réécrit à la découpe du nouveau pays. Le laisser
    // tel quel afficherait un espacement français sur un numéro belge.
    ecrire(saisi, p);
    onFini();
  }

  return (
    <div className="border-b py-[13px]" style={{ borderColor: colors.line }}>
      <span className={`mb-[5px] block ${libelleCaps}`} style={{ color: colors.muted }}>
        Téléphone
      </span>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => setOuvert((o) => !o)}
          aria-expanded={ouvert}
          aria-label={`Indicatif : ${pays.nom} ${pays.indicatif}`}
          className="flex flex-none items-center gap-[7px] rounded-full px-3"
          style={{ backgroundColor: colors.card, minHeight: 44 }}
        >
          <span aria-hidden="true" className="text-[19px] leading-none">
            {pays.drapeau}
          </span>
          <span style={{ fontFamily: font.display, fontSize: 16, fontVariantNumeric: "tabular-nums" }}>
            {pays.indicatif}
          </span>
          <span
            aria-hidden="true"
            className="-mt-[3px] h-[7px] w-[7px] rotate-45"
            style={{ borderRight: `1.5px solid ${colors.muted}`, borderBottom: `1.5px solid ${colors.muted}` }}
          />
        </button>

        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          aria-label="Numéro de téléphone"
          value={saisi}
          onChange={(e) => ecrire(e.target.value)}
          onBlur={onFini}
          className="min-w-0 flex-1 border-0 bg-transparent p-0 outline-none"
          // 17 px : en dessous de 16, iOS agrandit la page à la mise au point et
          // le patron se retrouve avec un écran zoomé à rétablir à la main.
          style={{
            fontFamily: font.display,
            fontSize: 17,
            lineHeight: 1.35,
            color: colors.ink,
            fontVariantNumeric: "tabular-nums",
          }}
        />
      </div>

      {ouvert && (
        <div className="mt-2 overflow-hidden rounded-[4px]" style={{ backgroundColor: colors.card }}>
          {PAYS_TELEPHONE.map((p) => (
            <button
              key={p.code}
              type="button"
              onClick={() => choisirPays(p)}
              aria-pressed={p.code === pays.code}
              className="flex w-full items-center gap-3 border-b px-3.5 text-left last:border-b-0"
              style={{
                borderColor: colors.line,
                minHeight: 44,
                backgroundColor: p.code === pays.code ? colors.line : "transparent",
              }}
            >
              <span aria-hidden="true" className="text-[19px] leading-none">
                {p.drapeau}
              </span>
              <span className="flex-1 text-[15px]">{p.nom}</span>
              <span
                className="text-[14px]"
                style={{ color: colors.muted, fontVariantNumeric: "tabular-nums" }}
              >
                {p.indicatif}
              </span>
            </button>
          ))}
        </div>
      )}

    </div>
  );
}
