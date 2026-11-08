import Link from "next/link";
import { colors, voile } from "@/lib/design-tokens";

/**
 * « IMPORTER DEVIS / FACTURE » — sa demande du 22 octobre 2026. Le nom est le
 * sien : « pas importer de l'ancienne appli, importer devis facture ». Geste
 * rare, il descend au bout de la liste depuis la planche soignée, en bouton
 * creux doré : il mène ailleurs.
 *
 * **Le même bouton au bout de la fiche d'un client** (sa demande du
 * 8 novembre 2026, planche `appli/client-importer-depuis-sa-fiche.html`) :
 * tel quel, à la même place au bout de son dossier, et l'import qu'il ouvre
 * range tout chez ce client (`clientId`). Un seul dessin pour les deux portes.
 */
export default function PorteImport({ clientId = null }: { clientId?: string | null }) {
  return (
    <div className="mx-[22px] mt-[28px]">
      <Link
        href={clientId ? `/clients/importer?client=${clientId}` : "/clients/importer"}
        data-atlas="porte-import"
        className="flex min-h-[56px] w-full items-center justify-center gap-[10px] rounded-full px-[22px] text-[17px] font-semibold"
        style={{ color: colors.or, boxShadow: `inset 0 0 0 1.5px ${voile(colors.or, 0.7)}`, WebkitTapHighlightColor: "transparent" }}
      >
        <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19.5h14" />
        </svg>
        Importer devis / facture
      </Link>
    </div>
  );
}
