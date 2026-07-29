import { mockChantiers, ChantierStatut } from "@/lib/mock-data";

// Aperçu isolé — n'affecte aucune route existante, aucune logique métier modifiée.
// Statuts simplifiés visuellement : point de couleur + libellé, sans pastille.

const dot: Record<ChantierStatut, string> = {
  brouillon: "bg-[#C7C7CC]",
  a_verifier: "bg-[#D2571C]",
  verifie: "bg-[#2FA867]",
  devis_envoye: "bg-[#0A7AFF]",
  planifie: "bg-[#8E8E93]",
};

const label: Record<ChantierStatut, string> = {
  brouillon: "Brouillon",
  a_verifier: "À vérifier",
  verifie: "Vérifié",
  devis_envoye: "Devis envoyé",
  planifie: "Planifié",
};

export default function DesignAPage() {
  return (
    <div
      className="mx-auto flex min-h-dvh max-w-md flex-col bg-white text-[#1D1D1F]"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', ui-sans-serif, sans-serif" }}
    >
      <div className="flex-1 pb-28">
        {/* En-tête */}
        <div className="px-6 pt-8">
          <p className="mb-1 text-sm font-medium text-[#8E8E93]">Bonjour</p>
          <h1 className="text-[34px] font-bold leading-tight tracking-[-0.02em]">Chantiers</h1>
        </div>

        {/* Bouton principal */}
        <div className="px-6 pt-6">
          <button className="w-full rounded-2xl bg-[#1D1D1F] py-4 text-[17px] font-semibold text-white">
            Nouveau chantier
          </button>
        </div>

        {/* Liste — rows plates, hairline, sans carte */}
        <div className="mt-8 px-6">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[#8E8E93]">
            En cours · {mockChantiers.length}
          </p>
          <div className="border-t border-[#E5E5EA]">
            {mockChantiers.map((c) => (
              <div key={c.id} className="flex items-center gap-4 border-b border-[#E5E5EA] py-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[19px] font-semibold leading-snug tracking-[-0.01em]">
                    {c.nom}
                  </p>
                  <p className="mt-0.5 truncate text-[15px] text-[#8E8E93]">
                    {c.client.nom} · {c.adresseChantier}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${dot[c.statut]}`} />
                  <span className="text-[13px] font-medium text-[#8E8E93]">{label[c.statut]}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation — texte seul, sans icônes lourdes */}
      <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md justify-around border-t border-[#E5E5EA] bg-white/90 py-3 backdrop-blur">
        {[
          { label: "Chantiers", active: true },
          { label: "Planning", active: false },
          { label: "Tarifs", active: false },
        ].map((t) => (
          <div key={t.label} className="flex flex-col items-center gap-1.5">
            <span className={`h-1 w-1 rounded-full ${t.active ? "bg-[#D2571C]" : "bg-transparent"}`} />
            <span
              className={`text-[13px] ${t.active ? "font-semibold text-[#1D1D1F]" : "font-medium text-[#8E8E93]"}`}
            >
              {t.label}
            </span>
          </div>
        ))}
      </nav>
    </div>
  );
}
