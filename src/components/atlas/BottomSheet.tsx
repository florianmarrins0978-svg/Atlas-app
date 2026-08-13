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
        {/* **La poignée FERME la feuille.** Demandé par le patron le 13 août
            2026 : *« si j'appuie sur le petit trait gris au-dessus de "y aller",
            c'est censé refermer la page, sauf que ça ne marche pas »*.

            Elle n'était qu'un trait décoratif, et pire : posée dans le panneau
            qui arrête les appuis (`stopPropagation` ci-dessus), elle absorbait
            le geste sans rien en faire. Toucher la poignée d'une feuille pour la
            refermer est le geste que tout téléphone enseigne — le refuser ici
            n'apprenait rien, cela donnait juste une feuille qui ignore le doigt.

            **La zone touchable est bien plus grande que le trait** : quatre
            pixels de haut ne s'atteignent pas au doigt. Le bouton fait toute la
            largeur et 28 px de haut ; le trait, lui, garde son dessin.

            Rendue comme un vrai bouton — et non un `<div>` avec un `onClick` —
            pour qu'elle porte un nom lisible et réponde au clavier. */}
        {onBackdropClick ? (
          <button
            type="button"
            onClick={onBackdropClick}
            aria-label="Refermer"
            className="mx-auto mb-3 flex h-7 w-full items-center justify-center"
          >
            <span className="h-1 w-10 rounded-full" style={{ backgroundColor: colors.line }} />
          </button>
        ) : (
          // Une feuille qu'on ne peut pas refermer d'un geste garde un trait
          // muet : une poignée qui ne répond pas est pire que pas de poignée.
          <div className="mx-auto mb-5 h-1 w-10 rounded-full" style={{ backgroundColor: colors.line }} />
        )}
        {children}
      </div>
    </div>
  );
}
