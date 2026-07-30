import { colors, font, smallCaps } from "@/lib/design-tokens";

export default function Chargement() {
  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="px-6 pt-8">
        <span className={smallCaps} style={{ color: colors.muted }}>
          Chargement…
        </span>
      </div>
    </div>
  );
}
