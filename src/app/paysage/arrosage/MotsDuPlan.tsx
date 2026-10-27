import { colors, font } from "@/lib/design-tokens";
import { motsPresents } from "@/lib/arrosage/mots-du-plan";

/**
 * LES MOTS DU PLAN — sa demande du 18 octobre 2026 : *« que tu nous expliques
 * ce que ça veut dire quand il y a marqué tuyère, SAM, PRS, tous les petits
 * trucs à côté »*. Seuls les mots présents dans ce qui est écrit au-dessus
 * s'affichent : on n'explique pas ce qu'on ne voit pas.
 */
export default function MotsDuPlan({ texte }: { texte: string }) {
  const mots = motsPresents(texte);
  if (mots.length === 0) return null;
  return (
    <dl className="mx-[22px] mt-[10px] rounded-[6px] px-[18px] py-1" style={{ backgroundColor: colors.card }} data-atlas="mots-du-plan">
      {mots.map((m, i) => (
        <div key={m.mot} className="py-3" style={i === 0 ? undefined : { borderTop: `1px solid ${colors.line}` }}>
          <dt style={{ fontFamily: font.display, fontWeight: 400, fontSize: 18, lineHeight: 1.25 }}>{m.mot}</dt>
          <dd className="m-0 mt-1 text-[15px] leading-[1.45]" style={{ color: colors.inkSoft }}>
            {m.sens}
          </dd>
        </div>
      ))}
    </dl>
  );
}
