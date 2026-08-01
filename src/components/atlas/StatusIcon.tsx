// Composant réel : son type vient de la source vivante, jamais des données
// fictives des maquettes — celles-ci sont gelées (voir src/lib/mock-data.ts) et
// ne connaissent pas les états ajoutés depuis.
import { ChantierStatut } from "@/lib/chantier-etat";
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
      {/* Le devis est parti, la balle est chez le client : un sablier, parce que
          la seule chose à faire est d'attendre. */}
      {statut === "en_attente_client" && (
        <svg {...common}>
          <path d="M7 3h10M7 21h10" strokeLinecap="round" />
          <path d="M8 3v3.5L12 12l-4 5.5V21M16 3v3.5L12 12l4 5.5V21" strokeLinejoin="round" />
        </svg>
      )}
      {/* Silence trop long, et refus : deux situations distinctes, mais toutes
          deux appellent un geste. D'où deux dessins qui alertent. */}
      {statut === "a_relancer" && (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4.5l3 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {/* Le lien a expiré sans que le client dise quoi que ce soit : ni oui, ni
          non — juste le temps qui a passé. */}
      {statut === "devis_caduc" && (
        <svg {...common}>
          <path d="M7 3h10M7 21h10" strokeLinecap="round" />
          <path d="M8 3v3.5L12 12l-4 5.5V21M16 3v3.5L12 12l4 5.5V21" strokeLinejoin="round" />
          <path d="M4 4l16 16" strokeLinecap="round" />
        </svg>
      )}
      {statut === "devis_retourne" && (
        <svg {...common}>
          <path d="M20 12H6" strokeLinecap="round" />
          <path d="M11 7l-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {statut === "planifie" && (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M4 10h16M8 3v4M16 3v4" strokeLinecap="round" />
        </svg>
      )}
      {/* Réalisé mais pas encore facturé : il reste un geste à faire. */}
      {statut === "termine" && (
        <svg {...common}>
          <path d="M4 7h12M4 12h12M4 17h8" strokeLinecap="round" />
          <path d="M17 15.5l1.8 1.8 3.2-3.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {/* Facturé : le chantier est clos, plus rien n'est attendu. */}
      {statut === "facture" && (
        <svg {...common}>
          <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" strokeLinejoin="round" />
          <path d="M9.5 8h5M9.5 12h5" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}
