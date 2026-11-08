import Link from "next/link";
import { colors, font } from "@/lib/design-tokens";
import { enEurosEntiers } from "@/lib/euros";
import { tonDeLAnnee, type EtatDeLObjectif } from "@/lib/mon-annee";
import IconeTrait from "./IconeTrait";
import JaugeAnnee from "./JaugeAnnee";

/**
 * La ligne de Mon année sur Terminés, sous les deux boutons : sa planche du
 * 8 novembre 2026. **Elle n'existe que s'il l'a allumée**, dans Réglages, Mon
 * année (*« il ne faut pas que ça s'affiche de base »*) ; c'est la page qui
 * décide de la poser, cette ligne ne fait que se dessiner.
 */
export default function LigneMonAnnee({ etat }: { etat: EtatDeLObjectif | null }) {
  const eur = (c: number) => enEurosEntiers(Math.round(c / 100));
  return (
    <Link
      href="/reglages/mon-annee"
      data-atlas="ligne-mon-annee"
      className="mx-[26px] mt-2.5 block rounded-[6px] px-4 pb-4 pt-3.5 no-underline"
      style={{ backgroundColor: colors.card, color: colors.ink }}
    >
      <span className="flex items-center justify-between gap-2.5 text-[15.5px] font-bold" style={{ color: colors.or }}>
        Mon année
        <IconeTrait nom="suivant" taille={20} epaisseur={2} />
      </span>
      {etat ? (
        <>
          <span className="mb-3 mt-1.5 block text-[19px] leading-[1.25]" style={{ fontFamily: font.display, fontVariantNumeric: "tabular-nums lining-nums" }}>
            {eur(etat.fait)} sur {eur(etat.objectif)}
          </span>
          <JaugeAnnee part={etat.fait / etat.objectif} trait={etat.passe ? null : etat.trait} ton={tonDeLAnnee(etat)} />
        </>
      ) : (
        <span className="mt-1.5 block text-[19px] leading-[1.25]" style={{ fontFamily: font.display }}>
          Fixer mon objectif
        </span>
      )}
    </Link>
  );
}
