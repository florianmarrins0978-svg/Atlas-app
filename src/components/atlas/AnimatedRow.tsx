import { colors } from "@/lib/design-tokens";

// Composant stabilisé (voir docs/DESIGN_SYSTEM.md) : enveloppe toute ligne d'une
// liste éditable (prestations, matériel, lignes de prix...) pour lui donner la
// même transition de sortie et le même bouton de retrait partout dans Atlas.

export function AnimatedRow({
  leaving,
  onRemove,
  children,
}: {
  leaving: boolean;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-2 overflow-hidden transition-all duration-200 ease-in-out"
      style={leaving ? { opacity: 0, maxHeight: 0, marginBottom: 0 } : { opacity: 1, maxHeight: 60 }}
    >
      <div className="flex flex-1 items-center gap-2">{children}</div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Retirer cette ligne"
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
        style={{ color: colors.muted }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
