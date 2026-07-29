import { ChantierStatut } from "@/lib/mock-data";
import { colors } from "@/lib/design-tokens";

export default function StatusIcon({
  statut,
  size = 44,
}: {
  statut: ChantierStatut;
  size?: number;
}) {
  const common = {
    width: size * 0.45,
    height: size * 0.45,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: colors.rust,
    strokeWidth: 1.8,
  };
  return (
    <span
      className="flex flex-shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, backgroundColor: colors.rustTint }}
    >
      {statut === "a_verifier" && (
        <svg {...common}>
          <rect x="6" y="5" width="12" height="15" rx="2" />
          <path d="M9 5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" strokeLinecap="round" />
          <path d="M9 11h6M9 15h4" strokeLinecap="round" />
        </svg>
      )}
      {statut === "verifie" && (
        <svg {...common} strokeWidth={2.2}>
          <path d="M5 12.5l4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {statut === "devis_envoye" && (
        <svg {...common}>
          <path d="M4 12l16-7-6 16-2.5-6.5L4 12Z" strokeLinejoin="round" />
        </svg>
      )}
      {statut === "brouillon" && (
        <svg {...common}>
          <circle cx="12" cy="12" r="7" strokeDasharray="1.5 4" strokeLinecap="round" />
        </svg>
      )}
      {statut === "planifie" && (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M4 10h16M8 3v4M16 3v4" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}
