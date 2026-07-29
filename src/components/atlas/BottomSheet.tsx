import { colors } from "@/lib/design-tokens";

// Composant partagé : la coquille visuelle commune à toute feuille modale
// (confirmation de suppression, confirmation d'envoi...). Le contenu (titre,
// texte, boutons) reste propre à chaque écran — seule la structure est partagée.

export default function BottomSheet({
  open,
  onBackdropClick,
  children,
}: {
  open: boolean;
  onBackdropClick?: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-40 flex items-end"
      style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
      onClick={onBackdropClick}
    >
      <div
        className="w-full rounded-t-[26px] px-6 pb-9 pt-3"
        style={{ backgroundColor: colors.cream }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full" style={{ backgroundColor: colors.line }} />
        {children}
      </div>
    </div>
  );
}
