import { colors, font, smallCaps } from "@/lib/design-tokens";

export default function Chargement() {
  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="px-6 pt-9">
        <p className={smallCaps} style={{ color: colors.rust, marginBottom: 8 }}>
          Vos chantiers
        </p>
        <h1 className="text-[36px] leading-none" style={{ fontFamily: font.display }}>
          Chantiers
        </h1>
        <p className="mt-2 text-[14px]" style={{ color: colors.muted }}>
          Chargement…
        </p>
      </div>
    </div>
  );
}
