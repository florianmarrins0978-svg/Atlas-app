"use client";

import type { ReactNode } from "react";
import { colors, libelleCaps } from "@/lib/design-tokens";

/**
 * Une ligne dont le TEXTE glisse vers la gauche pour découvrir « Retirer ».
 *
 * **Elle remplace `AnimatedRow` et `CarteGlissante`.** Il y avait trois
 * mécaniques de suppression dans l'application — glissement et corbeille rouge,
 * croix nue, panneau de confirmation — et le patron en a retenu une seule le
 * 10 août 2026. Cette dispersion est ce qu'il fallait faire disparaître ; la
 * réinventer sur place, écran par écran, la ramènerait en trois semaines.
 *
 * **Le glissement ne prend que la colonne du texte.** La date et le fil ne
 * bougent pas. Faire partir la ligne d'un bloc coupe le nom en plein mot et
 * laisse le fil traverser les lettres : ça se lit comme un défaut d'affichage,
 * pas comme un geste. Le voile de 16 px (`.atlas-glisse`) fait DISSOUDRE le
 * texte qui sort au lieu de le trancher.
 *
 * **C'est un défilement natif, pas un suivi du doigt.** `CarteGlissante`
 * mesurait l'élan à la main, en `touchstart`/`touchmove`/`touchend` — cent
 * lignes de calcul pour reproduire ce que le système fait mieux. Ce qui vient
 * gratuitement avec le défilement, et qui manquait : l'inertie et le rebond de
 * la plateforme, `prefers-reduced-motion`, la molette et le pavé tactile, et
 * surtout un « Retirer » **atteignable au clavier** — le focus fait défiler la
 * colonne tout seul, là où l'ancienne carte devait retirer le bouton de l'ordre
 * de tabulation tant qu'elle était fermée.
 *
 * **Un refus se lit, il ne se subit pas.** Un chantier facturé ne se retire
 * pas : sa facture figure au relevé de TVA. `CarteGlissante` portait `desactive`
 * et ne faisait alors plus rien du tout — un geste sans effet ressemble à une
 * panne. Ici, le glissement découvre le MOTIF à la place du bouton.
 */
export default function LigneRetirable({
  children,
  avant,
  libelle,
  retiree,
  onRetirer,
  refus,
  hauteurMax = 170,
  plage,
  className,
  style,
}: {
  /** Ce qui glisse : la colonne du texte. */
  children: ReactNode;
  /** Ce qui NE glisse PAS, à gauche — la date d'un chantier, par exemple. */
  avant?: ReactNode;
  /**
   * Ce qu'on retire, dit en toutes lettres : « le chantier Terrasse bois ».
   * Sert à la personne qui n'utilise pas ses yeux, et c'est aussi le seul
   * moyen de vérifier qu'on retire bien celui qu'on croit.
   */
  libelle: string;
  /** L'écran décide : la ligne tombe et l'enveloppe se referme. */
  retiree: boolean;
  onRetirer: () => void;
  /** Présent, il remplace « Retirer » — la ligne ne peut pas partir, et dit pourquoi. */
  refus?: string;
  /**
   * La hauteur d'où la ligne tombe. Une ligne plus haute que cette valeur
   * serait tronquée au repos : `.atlas-ligne` masque ce qui dépasse pour
   * pouvoir se refermer.
   */
  hauteurMax?: number;
  /**
   * Le fond de la ligne, quand elle en a un.
   *
   * **Il est porté par l'ENVELOPPE, qui ne bouge pas.** Sur les écrans où la
   * ligne est une carte — le planning, les tarifs —, laisser le fond glisser
   * avec le texte tire la carte hors de l'écran : le rectangle clair part en
   * biais, sa bordure est tranchée net, et « Retirer » se retrouve posé sur le
   * fond de page. Ça se lit comme un défaut d'affichage, pas comme un geste,
   * et c'est exactement ce que la maquette évitait en ne faisant glisser que
   * la colonne du texte.
   */
  plage?: { fond: string; rayon?: number };
  /** La grille de la ligne — elle varie d'un écran à l'autre. */
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="atlas-ligne"
      data-retiree={retiree ? "oui" : "non"}
      style={{
        maxHeight: hauteurMax,
        backgroundColor: plage?.fond,
        borderRadius: plage ? (plage.rayon ?? 4) : undefined,
      }}
    >
      <div className="atlas-chute">
        <div className={className} style={style}>
          {avant}
          <div className="atlas-glisse">
            <div className="atlas-volet">{children}</div>

            {refus ? (
              /* Le motif, à la place du bouton. Il se lit sur deux lignes s'il
                 le faut — c'est une phrase, pas un libellé, et l'abréger
                 reviendrait à ne rien dire. */
              <div
                className="atlas-decouvre"
                style={{ flexBasis: 168, paddingLeft: 12 }}
                role="note"
                aria-label={`${libelle} ne peut pas être retiré : ${refus}`}
              >
                <span className="text-[10px] leading-[1.35]" style={{ color: colors.muted }}>
                  {refus}
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={onRetirer}
                aria-label={`Retirer ${libelle}`}
                className={`atlas-decouvre ${libelleCaps}`}
                style={{ color: colors.or, letterSpacing: "0.26em" }}
              >
                Retirer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
