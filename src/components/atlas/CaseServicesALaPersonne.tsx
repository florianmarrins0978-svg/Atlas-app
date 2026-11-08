"use client";

import { colors, font } from "@/lib/design-tokens";
import Interrupteur from "./Interrupteur";

/**
 * LA CASE « SERVICES À LA PERSONNE », une pour tout le document : sur le devis,
 * où le choix se fait, puis sur la facture, qui la reprend (sa planche du
 * 8 novembre 2026, `appli/soignee/credit-d-impot.html`).
 *
 * **L'écran ne décide de rien** : il ne la monte que si elle existe
 * (`laCaseExiste`), et la ligne du dessous vient de `phraseSousLaCase`, la
 * même règle que le serveur et le papier.
 *
 * **Une pièce partie la montre sans interrupteur**, et seulement cochée : un
 * interrupteur qui ne répond plus se lit comme une panne, et une case
 * décochée sur une pièce partie n'a rien à dire.
 */
export default function CaseServicesALaPersonne({
  coche,
  sous,
  modifiable,
  enCours = false,
  refus,
  onBasculer,
  children,
}: {
  /** Ce qui suit la case sur la facture d'un client inscrit : l'addition de l'avance immédiate (lot 3). */
  children?: React.ReactNode;
  coche: boolean;
  /** « Mr. Lambert récupère 252,00 € sur ses impôts », ou « Devis normal ». */
  sous: string;
  modifiable: boolean;
  enCours?: boolean;
  refus?: string | null;
  onBasculer: (coche: boolean) => void;
}) {
  if (!modifiable && !coche) return null;
  return (
    <section
      className="rounded-[6px] px-[18px] py-3.5"
      data-atlas="case-services-a-la-personne"
      style={{ backgroundColor: colors.card }}
    >
      <div className="flex min-h-[44px] items-center justify-between gap-3">
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold leading-[1.3]" style={{ color: colors.ink, fontFamily: font.body }}>
            Services à la personne
          </span>
          <span
            className="mt-0.5 block text-[14px] leading-[1.4]"
            data-atlas="phrase-services-a-la-personne"
            style={{ color: colors.inkSoft, fontVariantNumeric: "tabular-nums" }}
          >
            {sous}
          </span>
        </span>
        {modifiable && (
          <Interrupteur
            actif={coche}
            libelle="Services à la personne"
            repere="services-a-la-personne"
            enCours={enCours}
            onChange={onBasculer}
          />
        )}
      </div>
      {refus && (
        <p role="alert" className="mt-2 text-[13.5px] font-semibold leading-[1.4]" style={{ color: colors.carteRougeTexte }}>
          {refus}
        </p>
      )}
      {children}
    </section>
  );
}
