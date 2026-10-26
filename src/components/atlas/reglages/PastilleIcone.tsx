import { colors, voile } from "@/lib/design-tokens";
import { teintesDuTon, type Ton } from "./PlageTon";

/**
 * Le carré arrondi d'une icône devant une ligne : doré par défaut, ou au ton
 * de l'état qu'elle annonce (vert à jour, ambre à faire, rouge dépassé).
 */
export default function PastilleIcone({ ton, children }: { ton?: Exclude<Ton, "or">; children: React.ReactNode }) {
  const teintes = ton ? teintesDuTon(ton) : { fond: voile(colors.or, 0.12), texte: colors.or };
  return (
    <span
      aria-hidden
      className="grid h-10 w-10 flex-none place-items-center rounded-[12px]"
      style={{ backgroundColor: teintes.fond, color: teintes.texte }}
    >
      {children}
    </span>
  );
}
