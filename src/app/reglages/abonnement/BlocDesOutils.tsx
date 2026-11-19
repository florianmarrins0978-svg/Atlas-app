import { colors, font, voile } from "@/lib/design-tokens";
import { MODULES, type Periodicite } from "@/lib/abonnements";
import DessinOutilPaysage, { estOutilDessine } from "@/components/atlas/DessinOutilPaysage";

/**
 * LE BLOC DES OUTILS DE PAYSAGE — sa planche du 19 novembre 2026,
 * `appli/soignee/abonnement-module-paysage.html`, choisie « A, trois lignes,
 * en doré ».
 *
 * **Il doit donner envie** — sa demande : *« il faut vraiment que ça tique
 * l'œil et qu'elle donne envie de rajouter les 6 euros. Là, c'est un truc tout
 * blanc, tout pâle, sur un fond blanc, on le voit à peine »*. D'où le fond doré
 * et son filet, le seul de l'écran. Et le nom dit ce qu'on achète : *« il voit
 * marqué ajouter paysage, il ne comprend pas ce que c'est »*.
 *
 * **Pas d'image**, son autre décision du 19 novembre : le plan réduit ne se
 * lisait plus. Chaque outil dit ce qu'il fait, avec les phrases de l'appli
 * (`MODULES`, que l'écran fermé lit aussi).
 *
 * **Les prix viennent de `MODULES`**, jamais écrits ici : un prix affiché qui
 * ne serait pas le prix débité est le pire défaut de cet écran.
 */
export default function BlocDesOutils({
  periodicite,
  ajoutes,
  onAjouter,
  onRetirer,
}: {
  periodicite: Periodicite;
  ajoutes: boolean;
  onAjouter: () => void;
  onRetirer: () => void;
}) {
  const outils = MODULES[0];
  const annuel = periodicite === "annuelle";
  const prix = annuel ? outils.prixAnnuel : outils.prixMensuel;
  return (
    <section
      data-atlas="bloc-des-outils"
      aria-label={`Ajoutez ${outils.nom}`}
      className="mt-3.5 rounded-[14px] px-4 pb-[18px] pt-5"
      style={{
        // Le doré du surtitre, fondu dans la carte : sur Nuit et Sylve, la
        // carte est sombre et le mélange le reste (`CLAUDE.md` §3).
        backgroundColor: `color-mix(in srgb, ${colors.or} 15%, ${colors.card})`,
        boxShadow: `inset 0 0 0 1.5px ${colors.or}, 0 14px 28px -18px ${voile(colors.ink, 0.55)}`,
      }}
    >
      <h3 className="text-[25px] leading-[1.15]" style={{ fontFamily: font.display, color: colors.ink }}>
        Ajoutez {outils.nom}
      </h3>
      <p
        className="mt-1.5 text-[17px] font-semibold"
        style={{ color: colors.ink, fontVariantNumeric: "tabular-nums lining-nums" }}
      >
        +{prix} € {annuel ? "par an" : "par mois"} HT
      </p>

      <ul className="mt-3.5">
        {outils.outils.map((o) => (
          <li
            key={o.fonction}
            className="flex items-start gap-3.5 py-3.5"
            style={{ borderTop: `1px solid ${voile(colors.ink, 0.1)}` }}
          >
            <span
              aria-hidden
              className="flex h-11 w-11 flex-none items-center justify-center rounded-[12px]"
              style={{ backgroundColor: colors.card, color: colors.rust }}
            >
              {estOutilDessine(o.fonction) && <DessinOutilPaysage outil={o.fonction} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[19px] leading-[1.2]" style={{ fontFamily: font.display, color: colors.ink }}>
                {o.titre}
              </span>
              <span className="mt-1 block text-[14.5px] leading-[1.45]" style={{ color: colors.inkSoft }}>
                {o.phrase}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {ajoutes ? (
        <div className="mt-4 flex min-h-[56px] items-center justify-between gap-3" data-atlas="outils-ajoutes">
          <span className="flex items-center gap-[9px] text-[17px] font-semibold" style={{ color: colors.carteVertTexte }}>
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
            Ajoutés à votre formule
          </span>
          <button
            type="button"
            onClick={onRetirer}
            data-atlas="retirer-les-outils"
            className="min-h-[48px] px-1 text-[15.5px] font-semibold underline underline-offset-[3px]"
            style={{ color: colors.inkSoft }}
          >
            Retirer
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onAjouter}
          data-atlas="ajouter-les-outils"
          className="atlas-plein mt-4 min-h-[56px] w-full rounded-full px-[22px] text-[17px] font-semibold"
          style={{ backgroundColor: colors.plein, color: colors.card }}
        >
          Ajouter pour {prix} € {annuel ? "par an" : "par mois"}
        </button>
      )}
    </section>
  );
}
