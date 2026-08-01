import { mockChantiers, ChantierStatut } from "@/lib/mock-data";
import { colors, font, smallCaps, cardShadow } from "@/lib/design-tokens";
import StatusIcon from "@/components/atlas/StatusIcon";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import AtlasBottomNav from "@/components/atlas/AtlasBottomNav";

// Référence de la direction artistique validée — utilise désormais les jetons
// et composants partagés de src/lib/design-tokens.ts et src/components/atlas/.

const label: Record<ChantierStatut, string> = {
  brouillon: "Brouillon",
  a_verifier: "À vérifier",
  verifie: "Vérifié",
  devis_envoye: "Devis envoyé",
  en_attente_client: "En attente de réponse",
  a_relancer: "À relancer",
  devis_retourne: "Devis retourné",
  planifie: "Planifié",
};

function MetaIcon({ kind }: { kind: "photo" | "mic" }) {
  const common = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: colors.muted, strokeWidth: 1.8 };
  if (kind === "photo")
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="9" cy="10" r="1.6" />
        <path d="M3 16l5-4 4 3 3-3 6 5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  return (
    <svg {...common}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" strokeLinecap="round" />
      <path d="M12 18v3" strokeLinecap="round" />
    </svg>
  );
}

export default function DesignDPage() {
  return (
    <div
      className="mx-auto flex min-h-dvh max-w-md flex-col"
      style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body }}
    >
      <div className="flex-1 pb-28">
        <div className="flex items-start justify-between px-6 pt-9">
          <div>
            <p className={smallCaps} style={{ color: colors.rust, marginBottom: 8 }}>
              Vos chantiers
            </p>
            <h1 className="text-[36px] leading-none" style={{ fontFamily: font.display }}>
              Chantiers
            </h1>
            <p className="mt-2 text-[14px]" style={{ color: colors.muted }}>
              {mockChantiers.length} chantiers en cours
            </p>
          </div>
          <button
            aria-label="Filtrer"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.rustTint }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.rust} strokeWidth="2">
              <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-6 pt-6">
          <PrimaryButton href="/chantiers/nouveau">
            <span className="text-lg leading-none">+</span> Nouveau chantier
          </PrimaryButton>
        </div>

        <div className="mt-8 flex flex-col gap-4 px-6">
          {mockChantiers.map((c) => (
            <a
              key={c.id}
              href={`/chantiers/${c.id}`}
              className="flex items-start gap-4 rounded-[22px] px-5 py-5"
              style={{ backgroundColor: colors.card, boxShadow: cardShadow }}
            >
              <StatusIcon statut={c.statut} />
              <div className="min-w-0 flex-1">
                <span className={smallCaps} style={{ color: colors.rust }}>
                  {label[c.statut]}
                </span>
                <h2 className="mt-1 truncate text-[22px] leading-tight" style={{ fontFamily: font.display }}>
                  {c.nom}
                </h2>
                <p className="mt-1 truncate text-[14px]" style={{ color: colors.muted }}>
                  {c.client.nom} — {c.adresseChantier}
                </p>
                <div className="mt-3 flex items-center gap-4 text-[13px]" style={{ color: colors.muted }}>
                  <span className="flex items-center gap-1.5">
                    <MetaIcon kind="photo" /> {c.photos} photo{c.photos > 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MetaIcon kind="mic" /> {c.aUneNoteVocale ? "Note vocale" : "Pas de note vocale"}
                  </span>
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.chevron} strokeWidth="2" className="mt-1 flex-shrink-0">
                <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          ))}
        </div>
      </div>

      <AtlasBottomNav />
    </div>
  );
}
