import Link from "next/link";
import IconeTrait from "@/components/atlas/IconeTrait";
import { colors, font } from "@/lib/design-tokens";

/**
 * « ATTESTATIONS FISCALES 2026 » sur Terminés — sa planche du 8 novembre 2026
 * (`appli/soignee/credit-d-impot.html`, « L'attestation »).
 *
 * **Du 1er janvier au 31 mars seulement**, pour une entreprise déclarée qui a
 * des attestations à faire : `ligneDesAttestations` rend `null` sinon, et la
 * ligne n'existe pas. Ambre tant qu'il en reste à envoyer, verte ensuite.
 *
 * **Une plage pleine largeur qu'on parcourt**, comme la ligne de la franchise :
 * ses 4 px sont ceux des cartes de Terminés (`test-boutons-arrondis.ts`, son
 * exception bornée à ce repère).
 */
export default function LigneDesAttestations({ annee, texte, ton }: { annee: number; texte: string; ton: "ambre" | "vert" }) {
  return (
    <Link
      href="/termines/attestations-fiscales"
      data-atlas="ligne-des-attestations"
      data-ton={ton}
      className="mx-[26px] mt-2.5 flex items-center gap-3.5 rounded-[4px] p-4 no-underline"
      style={{
        backgroundColor: ton === "vert" ? colors.carteVertFond : colors.carteAmbreFond,
        color: ton === "vert" ? colors.carteVertTexte : colors.carteAmbreTexte,
      }}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[15.5px] font-bold">Attestations fiscales {annee}</span>
        <span className="mt-1 block text-[19px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
          {texte}
        </span>
      </span>
      <IconeTrait nom="suivant" taille={20} epaisseur={2} />
    </Link>
  );
}
