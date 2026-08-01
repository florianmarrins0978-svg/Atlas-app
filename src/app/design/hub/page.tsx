import { mockChantiers, ChantierStatut } from "@/lib/mock-data";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import AtlasBottomNav from "@/components/atlas/AtlasBottomNav";

// Maquette isolée — n'affecte aucune route existante.
// Logique de démonstration : détermine l'action principale à partir de l'état du chantier.
// (Cette règle sera formalisée si la maquette est validée — pour l'instant, uniquement du mock.)

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

const chantier = mockChantiers[0]; // Rénovation salle de bain — 6 photos, note vocale, à vérifier

// Détermine l'étape suivante logique et les étapes déjà accomplies
const nextAction = { label: "Vérifier les informations", href: "/chantiers/1/informations" };

const secondarySteps = [
  { label: "Photos", meta: `${chantier.photos} photos`, done: true, href: "/chantiers/1/photos" },
  { label: "Note vocale", meta: "Enregistrée le 24/07", done: true, href: "/chantiers/1/note-vocale" },
  { label: "Prix", meta: "En attente des informations", done: false, href: "/chantiers/1/prix" },
  { label: "Devis", meta: "En attente du prix", done: false, href: "/chantiers/1/export" },
];

export default function HubMockupPage() {
  return (
    <div
      className="mx-auto flex min-h-dvh max-w-md flex-col"
      style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body }}
    >
      <div className="flex-1 pb-28">
        {/* Retour seul — pas de titre dupliqué en haut, le nom du chantier porte le titre */}
        <div className="px-6 pt-8">
          <a
            href="/design/d"
            aria-label="Retour"
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.rustTint }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.rust} strokeWidth="2.4">
              <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>

        {/* Statut → nom → client, dans cet ordre de lecture */}
        <div className="px-6 pt-5">
          <span className={smallCaps} style={{ color: colors.rust }}>
            {label[chantier.statut]}
          </span>
          <h1 className="mt-1 text-[32px] leading-tight" style={{ fontFamily: font.display }}>
            {chantier.nom}
          </h1>
          <p className="mt-1.5 text-[14px]" style={{ color: colors.muted }}>
            {chantier.client.nom} — {chantier.adresseChantier}
          </p>
        </div>

        {/* Action principale — une seule, contextuelle à l'état du chantier */}
        <div className="px-6 pt-7">
          <PrimaryButton href={nextAction.href}>{nextAction.label} →</PrimaryButton>
        </div>

        {/* Étapes secondaires — discrètes, liste plate, pas de cartes */}
        <div className="mt-9 px-6">
          <p className={smallCaps} style={{ color: colors.muted, marginBottom: 4 }}>
            Autres étapes
          </p>
          <div style={{ borderTop: `1px solid ${colors.line}` }}>
            {secondarySteps.map((s) => (
              <a
                key={s.label}
                href={s.href}
                className="flex items-center gap-3 py-4"
                style={{ borderBottom: `1px solid ${colors.line}` }}
              >
                <StepIcon done={s.done} />
                <span className="flex-1">
                  <span className="block text-[16px]" style={{ color: colors.ink }}>
                    {s.label}
                  </span>
                  <span className="block text-[13px]" style={{ color: colors.muted }}>
                    {s.meta}
                  </span>
                </span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={colors.chevron} strokeWidth="2">
                  <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            ))}
          </div>
        </div>
      </div>

      <AtlasBottomNav />
    </div>
  );
}

function StepIcon({ done }: { done: boolean }) {
  if (done) {
    return (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={colors.rust} strokeWidth="2.2" className="flex-shrink-0">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12.5l2.5 2.5L16 9.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={colors.chevron} strokeWidth="1.8" className="flex-shrink-0">
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
