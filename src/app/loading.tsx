import { colors, font, smallCaps } from "@/lib/design-tokens";

// Écran d'attente de TOUTE l'application, pas seulement des chantiers.
//
// Il annonçait « Vos chantiers / Chantiers » quelle que soit la page en cours
// de chargement — y compris la connexion, les réglages ou le planning. Vu sur
// un téléphone, cela donne l'impression d'être arrivé sur le mauvais écran, et
// une attente un peu longue devient un doute sur l'application elle-même.
export default function Chargement() {
  return (
    <div
      style={{
        backgroundColor: colors.cream,
        color: colors.ink,
        fontFamily: font.body,
        minHeight: "100%",
      }}
    >
      <div className="px-6 pt-9">
        <p className={smallCaps} style={{ color: colors.rust, marginBottom: 8 }}>
          Atlas
        </p>
        <p className="mt-2 text-[14px]" style={{ color: colors.muted }}>
          Chargement…
        </p>
      </div>
    </div>
  );
}
