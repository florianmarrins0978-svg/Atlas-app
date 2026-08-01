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
      {/* Le contenu défile plutôt que de déborder : une feuille plus haute que
          l'écran verrait son titre coupé en haut, hors d'atteinte — le cas
          arrive dès que la liste des jours libres est longue sur un petit
          téléphone. */}
      <div
        className="w-full overflow-y-auto rounded-t-[26px] px-6 pb-9 pt-3"
        style={{ backgroundColor: colors.cream, maxHeight: "88svh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full" style={{ backgroundColor: colors.line }} />
        {children}
      </div>
    </div>
  );
}
