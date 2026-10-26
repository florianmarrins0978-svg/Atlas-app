"use client";

import { useId, useState } from "react";
import { colors, voile } from "@/lib/design-tokens";
import LigneReglage, { styleValeurReglage } from "@/components/atlas/reglages/LigneReglage";
import {
  PAYS_TELEPHONE,
  afficherTelephone,
  composerTelephone,
  formaterDerriereIndicatif,
  type PaysTelephone,
} from "@/lib/telephone";
import Picto from "@/components/atlas/reglages/Picto";

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
 *
 * **Derrière l'indicatif, le numéro s'écrit sans son zéro** — sa demande du
 * 26 octobre 2026 : « +33 2 41 00 00 00 », et non plus « +33 02 41 … », qu'on
 * ne compose nulle part. Seul le champ change : ce qui se range et s'imprime
 * reste « 02 41 00 00 00 » (`formaterDerriereIndicatif`, `composerTelephone`).
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
  /**
   * À la sortie du champ, avec le numéro **prêt à ranger** — composé ici, et
   * non lu dans l'état de l'appelant, qui est celui du dernier rendu (leçon du
   * 30 août 2026). Ce qui s'affiche (« 6 79 98 45 14 ») n'est pas ce qui se
   * range (« 06 79 98 45 14 ») : le champ est le seul à savoir faire le pas.
   */
  onFini: (valeurPreteARanger: string) => void;
}) {
  const lu = afficherTelephone(valeur);
  const [pays, setPays] = useState<PaysTelephone>(lu.pays);
  const [ouvert, setOuvert] = useState(false);

  // Ce que le champ montre se recalcule de la valeur, sauf pendant la frappe :
  // un état local est nécessaire, sinon le curseur saute à chaque espace posé.
  const [saisi, setSaisi] = useState(lu.affiche);

  const id = useId();

  function ecrire(brut: string, p: PaysTelephone = pays) {
    setSaisi(formaterDerriereIndicatif(p, brut));
    onChange(composerTelephone(p, brut));
  }

  function choisirPays(p: PaysTelephone) {
    setPays(p);
    setOuvert(false);
    // Le numéro déjà tapé se réécrit à la découpe du nouveau pays. Le laisser
    // tel quel afficherait un espacement français sur un numéro belge.
    ecrire(saisi, p);
    onFini(composerTelephone(p, saisi));
  }

  return (
    <LigneReglage libelle="Téléphone" htmlFor={id}>
      <div className="flex items-center gap-2.5">
        {/* Sur la plage claire du paquet, la pastille prend un voile d'encre :
            posée en `card` comme avant, elle disparaissait dans son fond. */}
        <button
          type="button"
          onClick={() => setOuvert((o) => !o)}
          aria-expanded={ouvert}
          aria-label={`Indicatif : ${pays.nom} ${pays.indicatif}`}
          className="flex flex-none items-center gap-1.5 rounded-full px-3 text-[15px] font-semibold"
          style={{ backgroundColor: voile(colors.ink, 0.06), color: colors.ink, minHeight: 44 }}
        >
          <span aria-hidden="true" className="text-[19px] leading-none">
            {pays.drapeau}
          </span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{pays.indicatif}</span>
          <Picto nom="bas" taille={16} />
        </button>

        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          aria-label="Numéro de téléphone"
          placeholder="6 00 00 00 00"
          value={saisi}
          onChange={(e) => ecrire(e.target.value)}
          onBlur={(e) => onFini(composerTelephone(pays, e.currentTarget.value))}
          className="min-w-0 flex-1"
          // 18 px : en dessous de 16, iOS agrandit la page à la mise au point
          // et le patron se retrouve avec un écran zoomé à rétablir à la main.
          style={{ ...styleValeurReglage, fontVariantNumeric: "tabular-nums lining-nums" }}
        />
      </div>

      {ouvert && (
        <div
          className="mt-2.5 overflow-hidden rounded-[10px]"
          style={{ backgroundColor: colors.cream, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
        >
          {PAYS_TELEPHONE.map((p, rang) => (
            <button
              key={p.code}
              type="button"
              onClick={() => choisirPays(p)}
              aria-pressed={p.code === pays.code}
              className="flex w-full items-center gap-3 px-3.5 text-left"
              style={{
                borderTop: rang > 0 ? `1px solid ${colors.line}` : undefined,
                minHeight: 44,
                backgroundColor: p.code === pays.code ? voile(colors.ink, 0.06) : "transparent",
                color: colors.ink,
              }}
            >
              <span aria-hidden="true" className="text-[19px] leading-none">
                {p.drapeau}
              </span>
              <span className="flex-1 text-[15px]">{p.nom}</span>
              <span className="text-[14px]" style={{ color: colors.inkSoft, fontVariantNumeric: "tabular-nums" }}>
                {p.indicatif}
              </span>
            </button>
          ))}
        </div>
      )}
    </LigneReglage>
  );
}
