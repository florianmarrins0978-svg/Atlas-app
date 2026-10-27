import { colors, font, texteSituation, voile } from "@/lib/design-tokens";
import { jourDeReprise, type EtatCreditsIA } from "@/lib/credits-ia";

/**
 * LES CRÉDITS IA DU MOIS — la barre de sa planche du 26 octobre 2026
 * (`appli/soignee/abonnement-credits-ia.html`), juste sous l'état de
 * l'abonnement.
 *
 * Un pourcentage, jamais d'euros : il comparerait ce que l'IA coûte à ce qu'il
 * paie. **Cet écran ne compare aucun seuil** : l'état vient de
 * `etatDesCreditsIA`, la même règle que la coupure (`CLAUDE.md` §3). Vert tant
 * que tout va, ambre quand il en reste peu, rouge une fois épuisé (son choix du
 * 26 octobre) ; le titre et la barre gardent leur place dans les trois états.
 *
 * Sans plafond (son entreprise), rien : il n'y a rien à surveiller.
 */
export default function CreditsIA({ credits }: { credits: EtatCreditsIA }) {
  if (!credits.plafonne) return null;
  const { pourcent, etat, reprise } = credits;
  const teinte = etat === "epuise" ? colors.alert : etat === "presque" ? colors.carteAmbreTexte : colors.carteVertTexte;
  const jour = jourDeReprise(reprise);
  const detail =
    etat === "epuise"
      ? `Atlas IA reprend le ${jour}. D'ici là, tout s'écrit à la main.`
      : etat === "presque"
        ? `Il en reste peu jusqu'au ${jour}.`
        : `Repart à zéro le ${jour}.`;

  return (
    <section className="mx-[26px] mt-[22px]" aria-labelledby="credits-ia-titre" data-atlas="credits-ia" data-etat={etat}>
      <div className="flex items-baseline gap-3">
        <h2 id="credits-ia-titre" className="min-w-0 flex-1" style={{ fontFamily: font.display, fontSize: 21, lineHeight: 1.2, color: colors.ink }}>
          {etat === "epuise" ? "Crédits IA épuisés" : "Crédits IA du mois"}
        </h2>
        <span
          aria-hidden="true"
          style={{
            fontFamily: font.display,
            fontSize: 30,
            lineHeight: 1,
            whiteSpace: "nowrap",
            fontVariantNumeric: "tabular-nums lining-nums",
            color: etat === "normal" ? colors.ink : teinte,
          }}
        >
          {pourcent}
          <small style={{ fontSize: 18 }}>&#8239;%</small>
        </span>
      </div>
      <div
        role="meter"
        aria-labelledby="credits-ia-titre"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pourcent}
        aria-valuetext={`${pourcent} % utilisés`}
        className="relative mt-4 h-3 overflow-hidden rounded-[6px]"
        style={{ backgroundColor: voile(colors.ink, 0.09) }}
      >
        <span className="absolute inset-y-0 left-0 rounded-[6px]" style={{ width: `${pourcent}%`, backgroundColor: teinte }} />
      </div>
      <p className={`mt-2.5 ${texteSituation}`} style={{ color: etat === "epuise" ? colors.ink : colors.inkSoft }}>
        {detail}
      </p>
    </section>
  );
}
