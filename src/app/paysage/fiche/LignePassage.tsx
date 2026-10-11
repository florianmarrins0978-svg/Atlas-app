import Link from "next/link";
import { colors, font, texteSituation } from "@/lib/design-tokens";
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
  /** L'adresse du rapport chez le client, une fois envoyé. */
  jeton: string | null;
};

export default function LignePassage({
  passage,
  href,
  action,
}: {
  passage: PassageListe;
  /** Où mène la ligne : la fiche à cocher, ou le rapport tel que le client l'a reçu. */
  href: string;
  /**
   * Ce qui se pose APRÈS le lien : le « Retirer » d'un brouillon.
   *
   * Hors du lien, jamais dedans : un bouton imbriqué dans une ancre n'est pas
   * un HTML valide, et sur un téléphone l'appui part une fois sur deux ouvrir
   * la fiche qu'on voulait retirer.
   */
  action?: React.ReactNode;
}) {
  // « 3 prestations, 1 h 40 » : ce qui distingue deux fiches du même jour.
  // « aucune prestation » plutôt que « 0 prestation », qui se lit comme un
  // compteur en panne (planche du 11 octobre 2026).
  const bouts = [
    passage.faites === 0 ? "aucune prestation" : `${passage.faites} prestation${passage.faites > 1 ? "s" : ""}`,
    passage.minutes !== null ? libelleMinutes(passage.minutes) : null,
  ].filter(Boolean);

  return (
    <div className="flex items-center border-b" style={{ borderColor: colors.line }}>
      <Link
        href={href}
        className="flex min-h-[60px] min-w-0 flex-1 items-center gap-[15px] py-[13px] text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] leading-[1.25]" style={{ fontFamily: font.display }}>
            {passage.clientNom ?? "Sans client"}
          </span>
          {/* En inkSoft, à 13 px : la date et la durée se lisent au soleil
              (planche du 11 octobre 2026). */}
          <span className={`mt-[3px] block ${texteSituation}`} style={{ color: colors.inkSoft }}>
            {jourLisible(passage.jour)}, {bouts.join(", ")}
          </span>
        </span>
        {/* **Plus d'étiquette « Brouillon »** (planche du 11 octobre 2026) :
            sous « En cours », toutes les fiches le sont, et l'or redisait le
            titre de la section. Le brouillon porte « Retirer » au bout de sa
            ligne ; le rapport envoyé, son chevron. */}
        {passage.envoyeLe !== null && (
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
