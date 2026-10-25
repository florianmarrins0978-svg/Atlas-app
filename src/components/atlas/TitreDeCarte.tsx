import { colors } from "@/lib/design-tokens";
import { couleursDuTon, type TonCarte } from "@/lib/ton-des-cartes";

/**
 * Le titre d'une carte de l'accueil, précédé du point de sa famille.
 *
 * **Une seule écriture pour toutes les cartes** — les notifications et les
 * rappels des véhicules forment une seule pile à l'écran, et deux façons de
 * dessiner le même titre finiraient par diverger.
 *
 * **Le point ne remplace pas le mot** : la couleur fait voir, le titre fait
 * comprendre, et c'est lui que lit qui ne distingue pas les couleurs. Sur une
 * carte « pour mémoire », le point est un simple trait gris : il garde la place
 * sans rien signaler.
 *
 * **En phrase et non plus en petites capitales — sa planche du 25 octobre 2026**
 * (`appli/soignee/accueil.html`, « tu peux coder ça »). À 11 px espacés de
 * 0,18 em, « CORRECTION DEMANDÉE » se lisait mal sur un téléphone tenu d'une
 * main ; à 15 px en gras, le titre se lit d'un coup, et le point garde la
 * couleur de la famille.
 */
export default function TitreDeCarte({ ton, children }: { ton: TonCarte; children: React.ReactNode }) {
  const couleurs = couleursDuTon(ton);
  return (
    <p className="flex items-center gap-[8px] text-[15px] font-bold leading-[1.3]" style={{ color: couleurs.titre, marginBottom: 2 }}>
      <span
        aria-hidden
        className="h-2 w-2 flex-none rounded-full"
        style={{ backgroundColor: ton === "blanc" ? colors.line : couleurs.titre }}
      />
      {children}
    </p>
  );
}
