import { colors, smallCaps } from "@/lib/design-tokens";
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
 */
export default function TitreDeCarte({ ton, children }: { ton: TonCarte; children: React.ReactNode }) {
  const couleurs = couleursDuTon(ton);
  return (
    <p className={`${smallCaps} flex items-center gap-[7px]`} style={{ color: couleurs.titre, marginBottom: 6 }}>
      <span
        aria-hidden
        className="h-2 w-2 flex-none rounded-full"
        style={{ backgroundColor: ton === "blanc" ? colors.line : couleurs.titre }}
      />
      {children}
    </p>
  );
}
