import Link from "next/link";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import { libelleMinutes } from "@/lib/passage-entretien";
import { jourLisible } from "@/lib/jour";

/**
 * Une ligne de la liste des fiches — la MÊME pour les brouillons et les envoyés.
 *
 * **Elle est sortie de l'écran le 24 août 2026**, quand les brouillons ont reçu
 * leur croix de retrait : la section « En cours » est devenue un composant
 * client, l'autre est restée rendue par le serveur, et recopier la ligne dans
 * chacune aurait donné deux vérités sur ce qu'on lit — le compte des
 * prestations d'un côté, la durée de l'autre (`CLAUDE.md` §3).
 *
 * Aucune directive `"use client"` ici, et c'est voulu : sans elle, ce composant
 * suit celui qui l'importe — serveur d'un côté, navigateur de l'autre.
 */
export type PassageListe = {
  id: string;
  jour: string;
  clientNom: string | null;
  envoyeLe: Date | null;
  minutes: number | null;
  faites: number;
};

export default function LignePassage({
  passage,
  action,
}: {
  passage: PassageListe;
  /**
   * Ce qui se pose APRÈS le lien — la croix de retrait d'un brouillon.
   *
   * Hors du lien, jamais dedans : un bouton imbriqué dans une ancre n'est pas
   * un HTML valide, et sur un téléphone l'appui part une fois sur deux ouvrir
   * la fiche qu'on voulait retirer.
   */
  action?: React.ReactNode;
}) {
  // « 3 prestations · 1 h 40 » — ce qui distingue deux fiches du même jour.
  const bouts = [
    `${passage.faites} prestation${passage.faites > 1 ? "s" : ""}`,
    passage.minutes !== null ? libelleMinutes(passage.minutes) : null,
  ].filter(Boolean);

  return (
    <div className="flex items-center border-b" style={{ borderColor: colors.line }}>
      <Link
        href={`/paysage/fiche/${passage.id}`}
        className="flex min-h-[56px] min-w-0 flex-1 items-center gap-[15px] py-[13px] text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] leading-[1.25]" style={{ fontFamily: font.display }}>
            {passage.clientNom ?? "Sans client"}
          </span>
          <span className="mt-[3px] block text-[11.5px] leading-[1.5]" style={{ color: colors.muted }}>
            {jourLisible(passage.jour)} · {bouts.join(" · ")}
          </span>
        </span>
        {passage.envoyeLe === null ? (
          <span className={libelleCaps} style={{ color: colors.or, opacity: 0.9, flex: "none" }}>
            Brouillon
          </span>
        ) : (
          <span
            aria-hidden="true"
            className="h-2 w-2 rotate-45"
            style={{
              flex: "none",
              borderRight: `1.5px solid ${colors.chevron}`,
              borderTop: `1.5px solid ${colors.chevron}`,
            }}
          />
        )}
      </Link>
      {action}
    </div>
  );
}
