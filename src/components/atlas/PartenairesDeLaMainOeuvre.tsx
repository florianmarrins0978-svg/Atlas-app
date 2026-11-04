"use client";

import IconeTrait from "./IconeTrait";
import { colors, font, surPlein, voile } from "@/lib/design-tokens";
import { prixEnMots, type PrixDePartenaire } from "@/lib/feuille-main-oeuvre";

/**
 * ─── « MES PARTENAIRES » : la pastille, leurs prix, celui qui est pris ────────
 *
 * Née dans la feuille « Main d'œuvre » du devis (sa planche du 1er novembre
 * 2026), montée sur la question de la main d'œuvre dictée le 4 novembre (son
 * « B », `appli/soignee/main-oeuvre-dictee-partenaires.html`). Les deux
 * écrans montrent la MÊME liste : une seconde copie aurait dit un prix
 * autrement au premier remaniement (`CLAUDE.md` §3).
 *
 * Les repères (`mo-partenaires`, `mo-prix-<id>`, `mo-revenir`) restent ceux
 * de la feuille : les suites qui la parcourent les lisent.
 */

const virgule = (n: number | string) => String(n).replace(".", ",");

function initiales(nom: string): string {
  return nom
    .split(/\s+/)
    .slice(0, 2)
    .map((m) => m.charAt(0).toUpperCase())
    .join("");
}

function Initiales({ nom }: { nom: string }) {
  return (
    <span
      className="grid h-9 w-9 flex-none place-items-center rounded-full text-[14px]"
      style={{ fontFamily: font.display, color: colors.or, boxShadow: `inset 0 0 0 1.5px ${voile(colors.or, 0.6)}` }}
      aria-hidden="true"
    >
      {initiales(nom)}
    </span>
  );
}

/** La pastille, en or plein quand un partenaire est pris. */
export function PastilleMesPartenaires({ pris, onClick }: { pris: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={pris}
      onClick={onClick}
      data-atlas="mo-partenaires"
      className="inline-flex min-h-[40px] flex-none items-center gap-1.5 whitespace-nowrap rounded-full pl-2.5 pr-3.5 text-[14.5px] font-semibold"
      style={
        pris
          ? { color: surPlein, backgroundColor: colors.or }
          : { color: colors.or, boxShadow: `inset 0 0 0 1.5px ${voile(colors.or, 0.6)}` }
      }
    >
      <IconeTrait nom="equipe" taille={18} />
      Mes partenaires
    </button>
  );
}

/** Leurs prix, rangés sous leur société ; un prix touché est pris. « Mon équipe » revient à la sienne. */
export function ListeDesPartenaires({
  partenaires,
  onChoisir,
  onMonEquipe,
}: {
  partenaires: readonly PrixDePartenaire[];
  onChoisir: (p: PrixDePartenaire) => void;
  onMonEquipe: () => void;
}) {
  // Les prix rangés sous leur partenaire, dans l'ordre où ils arrivent.
  const parSociete = partenaires.reduce<Map<string, PrixDePartenaire[]>>((m, p) => {
    m.set(p.societeNom, [...(m.get(p.societeNom) ?? []), p]);
    return m;
  }, new Map());

  return (
    <div data-atlas="mo-liste">
      {parSociete.size === 0 ? (
        <p className="py-3 text-[15px]" style={{ color: colors.inkSoft }}>
          Aucun prix de partenaire. Ils se notent dans Réglages, Fournisseurs et partenaires.
        </p>
      ) : (
        <ul>
          {[...parSociete.entries()].map(([societe, prix], i) => (
            <li key={societe} style={i > 0 ? { boxShadow: `inset 0 1px 0 ${colors.line}` } : undefined}>
              <div className="flex items-center gap-2.5 pb-0.5 pt-3">
                <Initiales nom={societe} />
                <p className="flex-1 text-[18px]" style={{ fontFamily: font.display, color: colors.ink }}>
                  {societe}
                </p>
                <span className="text-[14px] tabular-nums" style={{ color: colors.inkSoft }}>
                  {prix[0].marge === null ? "sans marge" : `× ${virgule(Number(prix[0].marge).toFixed(2))}`}
                </span>
              </div>
              {prix.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onChoisir(p)}
                  data-atlas={`mo-prix-${p.id}`}
                  className="flex min-h-[52px] w-full items-center justify-between gap-2.5 py-1.5 pl-[46px] pr-1 text-left text-[15.5px]"
                  style={{ color: colors.ink }}
                >
                  <span>{p.nom}</span>
                  <b className="whitespace-nowrap font-semibold tabular-nums">{prixEnMots(p)}</b>
                </button>
              ))}
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={onMonEquipe}
        className="mt-4 min-h-[52px] w-full rounded-full text-[16px] font-semibold"
        style={{ color: colors.ink, boxShadow: `inset 0 0 0 1.5px ${colors.line}` }}
      >
        Mon équipe
      </button>
    </div>
  );
}

/** Le partenaire pris : son nom, son prix, et la croix qui revient à son équipe. */
export function PartenairePris({ prix, onRevenir }: { prix: PrixDePartenaire; onRevenir: () => void }) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-[12px] py-2.5 pl-3 pr-2"
      style={{ backgroundColor: voile(colors.or, 0.13) }}
      data-atlas="mo-partenaire-pris"
    >
      <Initiales nom={prix.societeNom} />
      <div className="min-w-0 flex-1">
        <p className="text-[17px]" style={{ fontFamily: font.display, color: colors.ink }}>
          {prix.societeNom}
        </p>
        <p className="text-[13.5px]" style={{ color: colors.inkSoft }}>
          {prix.nom}, {prixEnMots(prix)}
        </p>
      </div>
      <button
        type="button"
        onClick={onRevenir}
        aria-label="Revenir à mon équipe"
        data-atlas="mo-revenir"
        className="grid h-11 w-11 flex-none place-items-center rounded-full"
        style={{ color: colors.inkSoft }}
      >
        <IconeTrait nom="croix" taille={20} />
      </button>
    </div>
  );
}
