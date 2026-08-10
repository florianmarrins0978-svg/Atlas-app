import Link from "next/link";
import { colors, font } from "@/lib/design-tokens";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { getCurrentCtx } from "@/server/session-ctx";
import { listerChantiersTermines } from "@/server/repositories/factures";
import { formatEuros, grouperParMois, totalFacture } from "@/lib/termines-par-mois";
import FilTermines from "./FilTermines";

export const dynamic = "force-dynamic";

/**
 * « Terminés » — le fil par mois, et facturer en trois appuis.
 *
 * *Refait le 10 août 2026 d'après la maquette retenue par le patron
 * (`maquettes/atlas-facturer.html`, `docs/INTEGRER-ORIGINE.md` §6 quinquies).*
 *
 * **Ce qui clochait, et qui n'était pas une affaire de goût.** L'écran empilait
 * trois sortes de pavés arrondis — le relevé de TVA, les chantiers à facturer,
 * les factures. Le relevé de TVA était le **seul cadre plein**, si bien que
 * l'œil allait d'abord sur ce qu'on consulte une fois par trimestre.
 * « Rien à facturer » s'affichait comme un titre de section suivi de rien :
 * l'écran avait l'air amputé au lieu d'avoir l'air calme. Et **il ne disait
 * jamais combien**, alors que c'est la seule question qu'on lui pose.
 *
 * **Un chantier non facturé reste DANS SON MOIS.** Le chantier du 20 août est
 * un chantier d'août ; le sortir dans un bloc à part casse le fil, qui ne
 * raconte plus le temps mais deux listes empilées.
 */
export default async function TerminesPage() {
  const ctx = await getCurrentCtx();
  const chantiers = await listerChantiersTermines(ctx);
  const mois = grouperParMois(chantiers);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-10" data-atlas="ecran-termines">
        <EnTeteEcran
          surtitre="Chantiers réalisés"
          titre="Terminés"
          // **Rien quand il n'y a rien.** L'ancien écran écrivait « Rien à
          // facturer », ce qui remplissait la place d'une absence par un titre
          // suivi de rien. Le compte vit désormais dans l'encart du mois — là
          // où il sert — et l'en-tête se tait.
        />

        {chantiers.length === 0 ? (
          <p className="mt-8 px-[26px] text-[13px] leading-[1.7]" style={{ color: colors.muted }}>
            Vos chantiers apparaîtront ici une fois leur date d&apos;intervention passée.
          </p>
        ) : (
          <FilTermines mois={mois} />
        )}

        {/* Le pied : ce que le trimestre a facturé, puis le relevé.
            **Le relevé cesse d'être un pavé** — c'est une ligne, comme le
            reste. Il se consulte une fois par trimestre : il n'a rien à faire
            en tête d'écran. */}
        <div className="mx-[26px] mt-[22px] pt-4" style={{ borderTop: `1px solid ${colors.line}` }}>
          <p
            className="flex items-baseline justify-between gap-3.5 py-1.5 text-[12.5px]"
            style={{ color: colors.muted }}
          >
            Facturé ce trimestre
            <b
              className="font-normal"
              style={{ color: colors.ink, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}
            >
              {formatEuros(totalFacture(mois))}
            </b>
          </p>
          <Link
            href="/termines/tva"
            className="flex items-center justify-between gap-3.5 py-3.5"
            style={{ borderTop: `1px solid ${colors.line}` }}
          >
            <span style={{ fontFamily: font.display, fontSize: 16, lineHeight: 1.2 }}>
              Relevé de TVA collectée
            </span>
            <span aria-hidden="true" className="text-[15px]" style={{ color: colors.or }}>
              ›
            </span>
          </Link>
          {/* **Cette mention reste, où que le relevé aille** (`docs/AGENT.md`
              §6) : Atlas le prépare, il ne le déclare pas. Le relevé est
              calculé à la demande, jamais stocké. */}
          <p className="text-[11px] leading-[1.6]" style={{ color: colors.muted }}>
            Atlas prépare ce relevé, il ne le déclare pas.
          </p>
        </div>
      </div>
    </div>
  );
}
