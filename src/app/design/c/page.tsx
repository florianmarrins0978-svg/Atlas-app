import { mockChantiers, ChantierStatut } from "@/lib/mock-data";

// Aperçu isolé — n'affecte aucune route existante, aucune logique métier modifiée.
// Signature Atlas : trait vertical fin ("fil à plomb") réservé aux chantiers qui
// attendent une action du patron — seul accent décoratif de l'écran.

const statusColor: Record<ChantierStatut, string> = {
  brouillon: "text-[#9A948C]",
  a_verifier: "text-[#C7551A]",
  verifie: "text-[#3D7A55]",
  devis_envoye: "text-[#8A6A2F]",
  en_attente_client: "text-[#8A6A2F]",
  a_relancer: "text-[#C7551A]",
  devis_retourne: "text-[#C7551A]",
  planifie: "text-[#9A948C]",
};

const label: Record<ChantierStatut, string> = {
  brouillon: "Brouillon",
  a_verifier: "À vérifier",
  verifie: "Vérifié",
  devis_envoye: "Envoyé",
  en_attente_client: "En attente",
  a_relancer: "À relancer",
  devis_retourne: "Retourné",
  planifie: "Planifié",
};

const needsAttention: ChantierStatut[] = ["a_verifier", "a_relancer", "devis_retourne"];

export default function DesignCPage() {
  return (
    <div
      className="mx-auto flex min-h-dvh max-w-md flex-col bg-[#FAF9F7] text-[#17140F]"
      style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="flex-1 pb-28">
        <div className="px-6 pt-10">
          <h1 className="text-[32px] font-bold leading-none tracking-[-0.03em]">Chantiers</h1>
          <p className="mt-2 text-[14px] text-[#9A948C]">{mockChantiers.length} chantiers en cours</p>
        </div>

        <div className="px-6 pt-6">
          <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#17140F] py-4 text-[16px] font-semibold text-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8630C" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Nouveau chantier
          </button>
        </div>

        <div className="mt-8 flex flex-col gap-3 px-6">
          {mockChantiers.map((c) => (
            <div
              key={c.id}
              className="relative flex items-center gap-4 rounded-2xl bg-white px-5 py-6 shadow-[0_1px_2px_rgba(23,20,15,0.04),0_8px_24px_rgba(23,20,15,0.03)]"
            >
              {needsAttention.includes(c.statut) && (
                <span className="absolute left-0 top-3 bottom-3 w-[2.5px] rounded-full bg-[#E8630C]" />
              )}
              <div className="min-w-0 flex-1 pl-2">
                <p className="truncate text-[20px] font-bold leading-tight tracking-[-0.01em]">
                  {c.nom}
                </p>
                <p className="mt-1 truncate text-[14px] text-[#9A948C]">
                  {c.client.nom} — {c.adresseChantier}
                </p>
              </div>
              <span className={`flex-shrink-0 text-[13px] font-medium ${statusColor[c.statut]}`}>
                {label[c.statut]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md justify-around border-t border-[#EEEBE6] bg-[#FAF9F7]/95 py-3 backdrop-blur">
        {[
          { label: "Chantiers", active: true, icon: "square" },
          { label: "Planning", active: false, icon: "calendar" },
          { label: "Tarifs", active: false, icon: "tag" },
        ].map((t) => (
          <div key={t.label} className="flex flex-col items-center gap-1.5">
            <NavIcon kind={t.icon} active={t.active} />
            <span
              className={`text-[11px] font-medium ${t.active ? "text-[#17140F]" : "text-[#9A948C]"}`}
            >
              {t.label}
            </span>
          </div>
        ))}
      </nav>
    </div>
  );
}

function NavIcon({ kind, active }: { kind: string; active: boolean }) {
  const stroke = active ? "#E8630C" : "#9A948C";
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke, strokeWidth: 1.6 };
  if (kind === "calendar")
    return (
      <svg {...common}>
        <rect x="4" y="5" width="16" height="15" rx="3" />
        <path d="M4 10h16M8 3v4M16 3v4" strokeLinecap="round" />
      </svg>
    );
  if (kind === "tag")
    return (
      <svg {...common}>
        <path d="M12 3h6a1 1 0 0 1 1 1v6a1 1 0 0 1-.29.71l-9 9a1 1 0 0 1-1.42 0l-6-6a1 1 0 0 1 0-1.42l9-9A1 1 0 0 1 12 3Z" />
        <circle cx="16.5" cy="7.5" r="1" />
      </svg>
    );
  return (
    <svg {...common}>
      <rect x="4" y="4" width="16" height="16" rx="4" />
    </svg>
  );
}
