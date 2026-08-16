"use client";

import { useState } from "react";
import BottomSheet from "./BottomSheet";
import { colors, font, libelleCaps } from "@/lib/design-tokens";

/**
 * Qui s'occupe de ce chantier — la feuille qu'ouvre la pastille du planning.
 *
 * *Geste A, retenu par le patron le 14 août 2026 sur
 * `docs/maquettes/52-appliquer-une-equipe.html`.*
 *
 * **Pourquoi une feuille à part et non celle du chevron.** La feuille « Y aller »
 * porte déjà une ligne « Équipe » (geste B, livré le 14 août) : elle répond à la
 * même question, mais depuis un écran qu'il faut ouvrir chantier par chantier.
 * Ce qu'il a retenu, c'est de voir et de changer l'équipe **là où il la lit** —
 * sur la ligne. Les deux chemins mènent à la même action serveur ; ce qui change
 * est le nombre de gestes pour y arriver.
 *
 * **« Personne pour l'instant » est une vraie option**, pas un ornement : une
 * équipe posée par erreur ne pouvait, jusqu'à ce jour, plus jamais être défaite
 * (`changerEquipeChantier`). Elle n'apparaît que si le chantier en a une —
 * proposer de retirer ce qui n'existe pas ne veut rien dire.
 *
 * **Le refus se lit ici, pas dans une exception.** Une équipe déjà prise sur ces
 * créneaux est refusée par le serveur, et le message revient en valeur de
 * retour : levé, Next.js le remplacerait par un identifiant opaque et le patron
 * réessaierait la même équipe sans comprendre (`AGENTS.md`).
 */
export default function FeuilleEquipe({
  ouverte,
  onFermer,
  nomChantier,
  quand,
  equipes,
  rangEquipe,
  onChoisir,
}: {
  ouverte: boolean;
  onFermer: () => void;
  nomChantier: string;
  /** « journée », « du 21 au 25 août » — ce que le chantier occupe. */
  quand: string;
  equipes: { rang: number; libelle: string }[];
  rangEquipe: number | null;
  onChoisir: (rang: number | null) => Promise<{ succes: boolean; erreur?: string }>;
}) {
  // **L'état se remet à neuf PAR LA CLÉ, pas par un effet.** L'appelant monte
  // la feuille avec `key={chantier.id}` : changer de chantier la remonte, et le
  // refus du précédent ne survit pas. Un `useEffect` qui remettrait ces deux
  // états déclenche une cascade de rendus — et React le refuse désormais à
  // juste titre (`react-hooks/set-state-in-effect`).
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<number | "aucune" | null>(null);

  async function choisir(rang: number | null) {
    setRefus(null);
    setEnCours(rang ?? "aucune");
    try {
      const r = await onChoisir(rang);
      if (r.succes) onFermer();
      else setRefus(r.erreur ?? "Ce changement n'a pas abouti.");
    } finally {
      setEnCours(null);
    }
  }

  return (
    <BottomSheet open={ouverte} onBackdropClick={onFermer}>
      <p className={`mb-1 text-center ${libelleCaps}`} style={{ color: colors.or }}>
        Qui s’en occupe
      </p>
      <p
        className="text-center"
        style={{ fontFamily: font.display, fontSize: 21, lineHeight: 1.24, color: colors.ink }}
      >
        {nomChantier}
      </p>
      <p className="mt-[5px] text-center text-[12px]" style={{ color: colors.muted }}>
        {quand}
      </p>

      <div className="my-4 h-px" style={{ backgroundColor: colors.lineSoft }} />

      {equipes.map((e) => (
        <button
          key={e.rang}
          type="button"
          aria-pressed={e.rang === rangEquipe}
          disabled={enCours !== null}
          onClick={() => choisir(e.rang)}
          className="flex w-full items-center justify-between gap-3 border-b py-[14px] text-left"
          style={{ borderColor: colors.line, minHeight: 46 }}
        >
          <span style={{ fontFamily: font.display, fontSize: 17, lineHeight: 1.2 }}>{e.libelle}</span>
          {/* La coche en or, jamais une case à cocher : on choisit UNE équipe,
              et deux cases cochables laisseraient croire qu'on peut en prendre
              deux. */}
          <span aria-hidden="true" style={{ color: colors.or, opacity: e.rang === rangEquipe ? 1 : 0 }}>
            ✓
          </span>
        </button>
      ))}

      {/* Elle n'existe que s'il y a quelque chose à retirer. */}
      {rangEquipe !== null && (
        <button
          type="button"
          disabled={enCours !== null}
          onClick={() => choisir(null)}
          className="flex w-full items-center justify-between gap-3 py-[14px] text-left"
          style={{ minHeight: 46 }}
        >
          <span style={{ fontFamily: font.display, fontSize: 17, lineHeight: 1.2, color: colors.muted }}>
            Personne pour l’instant
          </span>
          <span className="text-[11.5px]" style={{ color: colors.muted }}>
            Le chantier reste posé
          </span>
        </button>
      )}

      {refus && (
        <p role="alert" className="mt-2 text-[13px]" style={{ color: colors.alert }}>
          {refus}
        </p>
      )}

      <button
        type="button"
        onClick={onFermer}
        className="mt-1.5 w-full py-[13px] text-[15px]"
        style={{ color: colors.muted }}
      >
        Annuler
      </button>
    </BottomSheet>
  );
}
