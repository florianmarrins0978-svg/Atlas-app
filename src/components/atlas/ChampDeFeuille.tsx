"use client";

import { useId } from "react";
import { colors } from "@/lib/design-tokens";

/**
 * UNE CASE DE FEUILLE : son nom au-dessus, la case sur le fond de la carte, et
 * une ligne d'aide dessous (« L'Urssaf y prélève sa moitié. »). Celles de
 * l'avance immédiate (lot 3) : relier l'Urssaf, inscrire un client.
 *
 * **Une case qui manque se dit par son trait, en ambre**, comme `.champ-manque`
 * sur la planche : pas une phrase de plus sous chacune, le compte « Il manque
 * 3 cases » le dit une fois pour toutes.
 *
 * 16 px de texte : en dessous, iOS agrandit la page à l'appui, et la feuille
 * sort de l'écran.
 */
export default function ChampDeFeuille({
  libelle,
  valeur,
  onChange,
  type = "text",
  inputMode,
  placeholder,
  aide,
  manque = false,
  repere,
  autoComplete = "off",
}: {
  libelle: string;
  valeur: string;
  onChange: (v: string) => void;
  type?: "text" | "password" | "date" | "tel" | "email";
  inputMode?: "text" | "numeric" | "tel" | "email";
  placeholder?: string;
  aide?: string;
  manque?: boolean;
  repere?: string;
  autoComplete?: string;
}) {
  const id = useId();
  return (
    <div className="mt-4">
      <label htmlFor={id} className="mb-1.5 block text-[13.5px] font-semibold" style={{ color: colors.inkSoft }}>
        {libelle}
      </label>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        spellCheck={false}
        value={valeur}
        placeholder={placeholder}
        data-atlas={repere}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[4px] border-0 px-4 py-3 outline-none"
        style={{
          backgroundColor: colors.card,
          color: colors.ink,
          fontSize: "16px",
          boxShadow: manque ? `inset 0 -2px 0 ${colors.carteAmbreTexte}` : undefined,
        }}
      />
      {aide && (
        <span className="mt-1 block text-[13px]" style={{ color: colors.inkSoft }}>
          {aide}
        </span>
      )}
    </div>
  );
}
