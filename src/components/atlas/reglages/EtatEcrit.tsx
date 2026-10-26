import { colors, voile } from "@/lib/design-tokens";
import { teintesDuTon, type Ton } from "./PlageTon";

/**
 * UN ÉTAT ÉCRIT : un point ET un mot, sur une pastille au ton de ce qu'il dit.
 *
 * **Jamais la couleur seule** (planches des Réglages soignés, 25 et 26 octobre
 * 2026, `appli/soignee/kit.css`, `.etat`) : « Oui » sur une pastille verte,
 * « Pas encore » en gris, « Ne se lit plus » en rouge. Un œil qui distingue mal
 * le vert du rouge lit encore le mot ; l'ancien écran n'avait que des
 * capitales espacées de 11 px, grises ou vertes, et se déchiffrait.
 *
 * Sans ton, la pastille est grise : ce qui n'est ni bien ni mal, seulement
 * pas fait (« Non relié », « En pause »). L'or ne s'aplatit pas : il cerne,
 * comme sur la planche (« Réservé à l'éditeur »).
 */
export default function EtatEcrit({
  ton,
  children,
  dataAtlas,
}: {
  ton?: Ton;
  children: React.ReactNode;
  dataAtlas?: string;
}) {
  const style: React.CSSProperties =
    ton === "or"
      ? { color: colors.or, boxShadow: `inset 0 0 0 1px ${voile(colors.or, 0.6)}` }
      : ton
        ? { backgroundColor: teintesDuTon(ton).fond, color: teintesDuTon(ton).texte }
        : { backgroundColor: voile(colors.ink, 0.06), color: colors.inkSoft };
  return (
    <span
      data-atlas={dataAtlas}
      className="inline-flex min-h-[28px] items-center gap-[7px] whitespace-nowrap rounded-full px-[11px] text-[13.5px] font-semibold leading-none"
      style={style}
    >
      <span aria-hidden className="h-[7px] w-[7px] flex-none rounded-full" style={{ backgroundColor: "currentColor" }} />
      {children}
    </span>
  );
}
