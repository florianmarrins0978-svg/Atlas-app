import Picto from "@/components/atlas/reglages/Picto";
import { teintesDuTon } from "@/components/atlas/reglages/PlageTon";
import { colors, font, voile } from "@/lib/design-tokens";
import { jourDeReprise, type EtatCreditsIA } from "@/lib/credits-ia";

/**
 * LES CRÉDITS IA DU MOIS : la plage de sa planche du 26 octobre 2026
 * (`appli/soignee/abonnement-credits-ia.html`, retenue « en rouge » le 29),
 * juste sous l'état de l'abonnement, dans le même paquet.
 *
 * Un pourcentage, jamais d'euros : il comparerait ce que l'IA coûte à ce qu'il
 * paie. **Cet écran ne compare aucun seuil** : l'état vient de
 * `etatDesCreditsIA`, la même règle que la coupure (`CLAUDE.md` §3). Vert tant
 * que tout va, ambre quand il en reste peu, rouge une fois épuisé ; le titre,
 * la pastille et la barre gardent leur place dans les trois états. Épuisé, la
 * pastille passe de l'étincelle au symbole pause, et rien ne vient encadrer la
 * plage (*« enlève l'encadré marron »*, 26 octobre).
 *
 * **Le rouge est celui des cartes**, `carteRougeTexte`, et non celui de
 * l'alerte : c'est le jeton de la planche, et sur Nuit et Sylve les deux ne
 * sont pas la même teinte.
 *
 * Sans plafond (son entreprise), rien : il n'y a rien à surveiller.
 */
export default function CreditsIA({ credits }: { credits: EtatCreditsIA }) {
  if (!credits.plafonne) return null;
  const { pourcent, etat, reprise } = credits;
  const teinte = etat === "epuise" ? colors.carteRougeTexte : etat === "presque" ? colors.carteAmbreTexte : colors.carteVertTexte;
  // La pastille de l'épuisé n'a pas de fond de carte : un voile de sa teinte,
  // comme sur la planche, pour que le rouge ne s'y lise qu'une fois.
  const pastille =
    etat === "epuise" ? { fond: voile(colors.carteRougeTexte, 0.13), texte: colors.carteRougeTexte } : teintesDuTon(etat === "presque" ? "ambre" : "vert");
  const jour = jourDeReprise(reprise);
  const detail =
    etat === "epuise"
      ? `Atlas IA reprend le ${jour}. D'ici là, tout s'écrit à la main.`
      : etat === "presque"
        ? `Il en reste peu jusqu'au ${jour}.`
        : `Repart à zéro le ${jour}.`;

  return (
    <section
      className="mt-3 rounded-[6px] px-[18px] py-4"
      style={{ backgroundColor: colors.card }}
      aria-labelledby="credits-ia-titre"
      data-atlas="credits-ia"
      data-etat={etat}
    >
      <div className="flex items-center gap-3.5">
        <span
          aria-hidden
          data-atlas="credits-ia-pastille"
          className="grid h-[52px] w-[52px] flex-none place-items-center rounded-[14px]"
          style={{ backgroundColor: pastille.fond, color: pastille.texte }}
        >
          <Picto nom={etat === "epuise" ? "pause" : "etincelle"} />
        </span>
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
      <p className="mt-2.5 text-[15px] leading-[1.45]" style={{ color: etat === "epuise" ? colors.ink : colors.inkSoft }}>
        {detail}
      </p>
    </section>
  );
}
