import { colors } from "@/lib/design-tokens";

/**
 * La pastille d'un choix : un rond creux, plein d'or quand il est pris. Le même
 * dessin que les choix d'aujourd'hui (Mentions légales, régime de TVA), en
 * 22 px pour le pouce.
 */
export default function CocheRonde({ pris }: { pris: boolean }) {
  return (
    <span
      aria-hidden
      className="block h-[22px] w-[22px] flex-none rounded-full transition-shadow duration-200"
      style={{ boxShadow: pris ? `inset 0 0 0 7px ${colors.or}` : `inset 0 0 0 1.5px ${colors.chevron}` }}
    />
  );
}
