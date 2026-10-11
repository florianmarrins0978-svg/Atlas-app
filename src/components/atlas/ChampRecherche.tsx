"use client";

import { colors } from "@/lib/design-tokens";

/**
 * LE champ de recherche d'Atlas, le même partout où l'on cherche.
 *
 * **Sa demande du 22 septembre 2026**, capture de shapersclub.com à l'appui,
 * puis la planche `appli/la-recherche-soulignee.html` regardée : *« change-le
 * moi partout où il y a la possibilité de rechercher par celui de la photo »*.
 * Une loupe au trait dans l'accent, le mot en gris, **aucune boîte**, un filet
 * dessous qui passe à l'or quand on écrit.
 *
 * Quatre écrans dessinaient chacun le leur — une plage teintée, une pilule, une
 * boîte crème, une boîte blanche — et trois n'avaient pas la même loupe. Ils
 * passent tous par ici : un cinquième ne pourra plus en inventer un sixième.
 *
 * **`type="text"`, et surtout PAS `type="search"`** : le navigateur ajoute
 * alors sa propre croix d'effacement, d'un BLEU VIF qui n'existe dans aucune
 * charte. On la refuse et l'on pose la nôtre, qui n'existe que s'il y a
 * quelque chose à effacer.
 */
export function ChampRecherche({
  valeur,
  onChange,
  placeholder,
  ariaLabel,
  dataAtlas,
  autoFocus,
  className,
}: {
  valeur: string;
  onChange: (valeur: string) => void;
  placeholder: string;
  ariaLabel: string;
  dataAtlas: string;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <div
      // Le filet est une classe et non un style en ligne : un style en ligne
      // l'emporterait sur `focus-within`, et le trait ne passerait jamais à l'or.
      className={`relative flex items-center gap-[12px] border-b-[1.5px] border-[color:var(--atlas-muted,#8a8578)] focus-within:border-[color:var(--atlas-or,#B98B47)] ${className ?? ""}`}
    >
      {/* Dessinée, jamais un caractère emprunté à une police d'émojis. */}
      <svg
        aria-hidden="true"
        width="21"
        height="21"
        viewBox="0 0 20 20"
        fill="none"
        stroke={colors.or}
        strokeWidth="1.5"
        className="pointer-events-none flex-none"
      >
        <circle cx="8.2" cy="8.2" r="6.2" />
        <path d="M12.8 12.8L18 18" strokeLinecap="round" />
      </svg>

      <input
        type="text"
        inputMode="search"
        autoComplete="off"
        autoFocus={autoFocus}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        data-atlas={dataAtlas}
        // `atlas-recherche` porte le gris du mot (globals.css) : aucun style en
        // ligne ne vise `::placeholder`.
        className="atlas-recherche min-w-0 flex-1 border-0 bg-transparent py-[11px] outline-none"
        style={{
          color: colors.ink,
          // **16 px au moins.** En dessous, Safari sur iPhone zoome tout seul
          // au premier appui et l'écran part de travers.
          fontSize: 17,
          caretColor: colors.or,
        }}
      />

      {valeur && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Effacer la recherche"
          data-atlas="effacer-recherche"
          className="flex h-[44px] w-[40px] flex-none items-center justify-center"
          style={{ color: colors.muted, fontSize: 17, lineHeight: 1 }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
