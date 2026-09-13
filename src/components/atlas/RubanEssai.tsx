import Link from "next/link";
import { colors, font, voile } from "@/lib/design-tokens";
import { texteDuRuban, type EtatEssai } from "@/lib/abonnements";

/**
 * LE RUBAN DE L'ESSAI — en tête de l'accueil, et nulle part ailleurs.
 *
 * Sa planche du 10 septembre 2026 (`appli/l-essai-et-ce-qui-est-ferme.html`) :
 * le compteur se pose sur le seul écran qu'il ouvre tous les matins. Une carte
 * posée au milieu se ferait dépasser par les chantiers du jour ; une fenêtre
 * qui s'ouvre se ferme sans être lue.
 *
 * **Or tant que tout va bien, rouge d'alerte à trois jours de la fin, et au
 * 16ᵉ jour.** Rien d'autre ne bouge : ni fenêtre, ni message à écarter — un
 * artisan sur un chantier n'a pas à fermer une boîte pour voir son planning.
 *
 * Les mots viennent de `texteDuRuban` : l'écran n'en décide aucun.
 */
export default function RubanEssai({ etat }: { etat: EtatEssai }) {
  const chaud = etat.statut === "termine" || etat.alerte;
  const teinte = chaud ? colors.alert : colors.or;
  return (
    <div
      data-atlas="ruban-essai"
      data-etat={etat.statut}
      data-ton={chaud ? "alerte" : "calme"}
      className="flex items-center justify-between gap-3 px-[26px] py-2.5 text-[13px]"
      style={{ backgroundColor: voile(teinte, 0.1), color: teinte, fontFamily: font.body }}
    >
      <span className="font-medium">{texteDuRuban(etat)}</span>
      <Link
        href="/reglages/abonnement"
        data-atlas="ruban-essai-sabonner"
        className="flex-none font-semibold underline underline-offset-4"
        style={{ color: teinte }}
      >
        S’abonner
      </Link>
    </div>
  );
}
