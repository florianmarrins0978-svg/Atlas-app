import { mockChantiers, ChantierStatut } from "@/lib/mock-data";

// Aperçu isolé — n'affecte aucune route existante, aucune logique métier modifiée.
// Statuts simplifiés visuellement via une icône d'anneau de progression (inspiration Linear).

function StatusRing({ statut }: { statut: ChantierStatut }) {
  const progress: Record<ChantierStatut, number> = {
    brouillon: 0,
    a_verifier: 0.35,
    verifie: 0.7,
    devis_envoye: 1,
    en_attente_client: 1,
    a_relancer: 1,
    devis_retourne: 1,
    planifie: 1,
  };
  const p = progress[statut];
  const r = 7;
  const c = 2 * Math.PI * r;
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" className="flex-shrink-0">
      <circle cx="9" cy="9" r={r} fill="none" stroke="#E8E8EC" strokeWidth="2" />
      <circle
        cx="9"
        cy="9"
        r={r}
        fill="none"
        stroke="#E8630C"
        strokeWidth="2"
        strokeDasharray={`${c * p} ${c}`}
        strokeLinecap="round"
        transform="rotate(-90 9 9)"
      />
    </svg>
  );
}

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

export default function DesignBPage() {
  return (
    <div
      className="mx-auto flex min-h-dvh max-w-md flex-col bg-[#FCFCFD] text-[#16161A]"
      style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="flex-1 pb-24">
        {/* Barre supérieure compacte */}
        <div className="flex items-center justify-between border-b border-[#EBEBEF] px-5 py-4">
          <h1 className="text-[15px] font-semibold tracking-tight">Chantiers</h1>
          <button className="rounded-lg bg-[#E8630C] px-3 py-1.5 text-[13px] font-medium text-white">
            + Nouveau chantier
          </button>
        </div>

        {/* Recherche factice — évoque la palette de commandes */}
        <div className="px-5 pt-4">
          <div className="rounded-lg border border-[#EBEBEF] bg-white px-3 py-2 text-[13px] text-[#8A8A94]">
            Rechercher un chantier…
          </div>
        </div>

        <p className="px-5 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-wider text-[#8A8A94]">
          {mockChantiers.length} chantiers
        </p>

        {/* Liste dense, bordures fines */}
        <div className="mx-5 overflow-hidden rounded-xl border border-[#EBEBEF] bg-white">
          {mockChantiers.map((c, i) => (
            <div
              key={c.id}
              className={`flex items-center gap-3 px-4 py-3.5 ${
                i !== mockChantiers.length - 1 ? "border-b border-[#EBEBEF]" : ""
              }`}
            >
              <StatusRing statut={c.statut} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium leading-snug">{c.nom}</p>
                <p className="truncate text-[12.5px] text-[#8A8A94]">
                  {c.client.nom} · {c.adresseChantier}
                </p>
              </div>
              <span className="flex-shrink-0 text-[12px] text-[#8A8A94]">{label[c.statut]}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C6C6CC" strokeWidth="2" className="flex-shrink-0">
                <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation compacte */}
      <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md justify-around border-t border-[#EBEBEF] bg-white/95 py-2.5 backdrop-blur">
        {[
          { label: "Chantiers", active: true },
          { label: "Planning", active: false },
          { label: "Tarifs", active: false },
        ].map((t) => (
          <div
            key={t.label}
            className={`rounded-md px-3 py-1.5 text-[12.5px] font-medium ${
              t.active ? "bg-[#F4EDE7] text-[#E8630C]" : "text-[#8A8A94]"
            }`}
          >
            {t.label}
          </div>
        ))}
      </nav>
    </div>
  );
}
