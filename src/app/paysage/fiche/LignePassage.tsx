import Link from "next/link";
import TuileIcone from "@/components/atlas/TuileIcone";
import { colors, font } from "@/lib/design-tokens";
import { libelleMinutes } from "@/lib/passage-entretien";
import { jourLisible } from "@/lib/jour";
import IconeDeFiche from "./icones";

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
  const envoye = passage.envoyeLe !== null;

  // **Sa planche du 9 novembre 2026** (`appli/fiche-de-chantier-soignee.html`,
  // D et B) : un visuel devant le nom, l'icône dorée au trait pour une fiche en
  // cours, la tuile teintée de Paysage pour un rapport parti. Les deux tiennent
  // dans la même colonne de 40 px : empilées, les deux listes alignent leurs
  // noms, et le filet part sous le nom (68 px), comme dans Paysage.
  return (
    <div className="group relative flex min-h-[68px] items-center px-[14px]">
      <span
        aria-hidden="true"
        className="absolute right-0 top-0 h-px group-first:hidden"
        style={{ left: 68, backgroundColor: colors.line }}
      />
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-[14px] py-[12px] text-left">
        {envoye ? (
          <TuileIcone>
            <IconeDeFiche nom="envoyee" taille={22} epaisseur={1.7} />
          </TuileIcone>
        ) : (
          <span aria-hidden="true" className="flex w-10 flex-none justify-center" style={{ color: colors.or }}>
            <IconeDeFiche nom="enCours" taille={25} epaisseur={1.6} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[18.5px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
            {passage.clientNom ?? "Sans client"}
          </span>
          {/* **La date sur sa ligne, ce qui a été fait dessous** : sur une
              seule, « 1 h » finissait une ligne et « 40 » commençait la
              suivante (planche du 9 novembre 2026). En inkSoft, à 14 px : elles
              se lisent au soleil. */}
          <span className="mt-[3px] block truncate text-[14px] leading-[1.4]" style={{ color: colors.inkSoft }}>
            {jourLisible(passage.jour)}
          </span>
          <span className="mt-[1px] block truncate text-[14px] leading-[1.4]" style={{ color: colors.inkSoft }}>
            {bouts.join(", ")}
          </span>
        </span>
        {/* **Plus d'étiquette « Brouillon »** (planche du 11 octobre 2026) :
            sous « En cours », toutes les fiches le sont, et l'or redisait le
            titre de la section. Le brouillon porte « Retirer » au bout de sa
            ligne ; le rapport envoyé, son chevron. */}
        {envoye && (
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

/**
 * La carte qui tient une liste de fiches : la même pour « En cours » et pour
 * « Rapports envoyés », sans quoi les deux, empilées, ne tombaient plus sur la
 * même colonne (planche du 9 novembre 2026). L'arrondi de 14 px est celui de
 * « Composer ma fiche », au-dessus.
 */
export function CarteDesFiches({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-[12px] overflow-hidden rounded-[14px]" style={{ backgroundColor: colors.card }}>
      {children}
    </div>
  );
}
