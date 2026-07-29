import { colors, font } from "@/lib/design-tokens";

export default function Chargement() {
  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="px-6 pt-9">
        <h1 className="text-[36px] leading-none" style={{ fontFamily: font.display, opacity: 0.4 }}>
          Planning
        </h1>
      </div>
    </div>
  );
}
