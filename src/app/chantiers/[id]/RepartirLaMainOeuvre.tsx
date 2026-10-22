"use client";

import { colors } from "@/lib/design-tokens";
import {
  ecrireChoix,
  lireChoix,
  repartirMainOeuvre,
  type ChoixMainOeuvre,
  type QuestionMainOeuvre,
} from "@/lib/main-oeuvre-dictee";

/**
 * La main d'œuvre dictée, à l'arrêt d'avant-chiffrage : sa planche du
 * 21 octobre 2026 (`appli/main-d-oeuvre-repartie.html`), choisie le soir même.
 *
 * Une ligne à part, ou répartie au curseur ; une croix qui rend un travail à
 * sa grille, avec la phrase qui le dit. Les montants affichés sont calculés
 * par `repartirMainOeuvre`, la fonction même qui écrira le devis : ce que les
 * curseurs montrent est ce qui partira (`CLAUDE.md` §3).
 */
export function choixDeDepart(q: QuestionMainOeuvre): string {
  const choix: ChoixMainOeuvre = {
    mode: "reparti",
    parts: Object.fromEntries(q.travaux.map((t) => [t.cle, t.part])),
    retires: [],
  };
  return ecrireChoix(choix);
}

const euros = (montant: string | number) =>
  `${Number(montant).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`;

export default function RepartirLaMainOeuvre({
  question,
  valeur,
  onChange,
}: {
  question: QuestionMainOeuvre;
  valeur: string;
  onChange: (valeur: string) => void;
}) {
  const choix = lireChoix(valeur) ?? lireChoix(choixDeDepart(question))!;
  const dedans = question.travaux.filter((t) => !choix.retires.includes(t.cle));
  const sommeParts = dedans.reduce((s, t) => s + (choix.parts[t.cle] ?? 0), 0);
  const pourcent = (cle: string) => (sommeParts > 0 ? Math.round(((choix.parts[cle] ?? 0) / sommeParts) * 100) : 0);
  const montants = repartirMainOeuvre(
    question.total,
    dedans.map((t) => t.cle),
    choix.parts
  );
  const changer = (suite: Partial<ChoixMainOeuvre>) => onChange(ecrireChoix({ ...choix, ...suite }));

  // Tirer un curseur : les autres se partagent le reste, au prorata de ce
  // qu'ils avaient. Les parts sont des pourcentages, qui font toujours 100.
  function deplacer(cle: string, voulu: number) {
    const v = Math.max(0, Math.min(100, voulu));
    const autres = dedans.filter((t) => t.cle !== cle);
    const avant = autres.reduce((s, t) => s + pourcent(t.cle), 0);
    const parts: Record<string, number> = { ...choix.parts, [cle]: v };
    for (const t of autres) parts[t.cle] = avant > 0 ? (pourcent(t.cle) / avant) * (100 - v) : (100 - v) / autres.length;
    changer({ parts });
  }

  const pastille = (actif: boolean) => ({
    backgroundColor: actif ? colors.plein : colors.card,
    color: actif ? colors.cream : colors.ink,
  });

  return (
    <div data-atlas="question-main-oeuvre">
      <p className="text-[12px]" style={{ color: colors.muted }}>
        {question.detail}
      </p>
      <div className="mt-2 flex flex-col gap-2">
        {(
          [
            ["ligne", "Sur une ligne Main d'œuvre"],
            ["reparti", "Répartis sur les travaux"],
          ] as const
        ).map(([mode, libelle]) => (
          <button
            key={mode}
            type="button"
            aria-pressed={choix.mode === mode}
            onClick={() => changer({ mode })}
            className="rounded-full px-4 py-2.5 text-left text-[14px] font-medium"
            style={pastille(choix.mode === mode)}
          >
            {libelle}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {question.travaux.map((t) => {
          const sorti = choix.retires.includes(t.cle);
          if (sorti) {
            return (
              <div key={t.cle} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-3 text-[14px]">
                  <span className="min-w-0 line-through" style={{ color: colors.muted }}>
                    {t.libelle}
                  </span>
                  <button
                    type="button"
                    onClick={() => changer({ retires: choix.retires.filter((r) => r !== t.cle) })}
                    className="py-1 text-[13px] font-medium"
                    style={{ color: colors.rust }}
                  >
                    Remettre
                  </button>
                </div>
                <p className="text-[13px]" style={{ color: colors.rust }}>
                  {t.grille !== null
                    ? `Atlas va se référer à votre grille tarifaire : ${euros(t.grille)}.`
                    : "Pas de prix dans votre grille, cette ligne sera à chiffrer."}
                </p>
              </div>
            );
          }
          return (
            <div key={t.cle} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-3 text-[14px]" style={{ color: colors.ink }}>
                <span className="min-w-0">{t.libelle}</span>
                <span className="flex items-center gap-1">
                  {choix.mode === "reparti" ? (
                    <span className="whitespace-nowrap font-semibold tabular-nums">
                      {euros(montants[t.cle] ?? 0)}
                      <span className="ml-1.5 font-normal" style={{ color: colors.muted }}>
                        {pourcent(t.cle)} %
                      </span>
                    </span>
                  ) : null}
                  <button
                    type="button"
                    aria-label={`Retirer ${t.libelle} de la main d'œuvre`}
                    onClick={() => changer({ retires: [...choix.retires, t.cle] })}
                    className="grid h-9 w-9 place-items-center rounded-full"
                    style={{ color: colors.muted }}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </span>
              </div>
              {choix.mode === "reparti" && (
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={pourcent(t.cle)}
                  disabled={dedans.length < 2}
                  aria-label={`Part de ${t.libelle}`}
                  onChange={(e) => deplacer(t.cle, Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: colors.plein }}
                />
              )}
            </div>
          );
        })}
        <div
          className="flex justify-between border-t pt-2.5 text-[13px] tabular-nums"
          style={{ color: colors.muted, borderColor: colors.line }}
        >
          <span>Total main d&apos;œuvre</span>
          <span>{euros(question.total)}</span>
        </div>
      </div>
    </div>
  );
}
