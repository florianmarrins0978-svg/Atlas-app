// Système de design Atlas — direction artistique validée.
// Toute nouvelle interface doit importer ces valeurs plutôt que redéfinir ses propres couleurs.
// Modifier ce fichier revient à modifier l'identité visuelle de toute l'application :
// à ne faire que sur demande explicite.

export const colors = {
  cream: "#F6F1E6", // fond de page
  card: "#FBF8F3", // fond des cartes
  ink: "#1C1B17", // texte principal
  muted: "#6B6656", // texte secondaire / meta
  rust: "#B25A2E", // accent unique — actions, labels de statut, états actifs
  rustTint: "#F1DECB", // fond des avatars d'icône et éléments teintés
  alert: "#9C3B2E", // exception discrète — uniquement pour confirmer une action destructive (ex. suppression)
  line: "#E7E0D0", // séparateurs, bordures fines
  chevron: "#B7AF9C", // affordance de navigation discrète
} as const;

export const font = {
  display: "ui-serif, Georgia, 'Times New Roman', serif", // noms de chantier, titres de page
  body: "ui-sans-serif, system-ui, sans-serif", // texte courant, meta, navigation
} as const;

// Petites capitales utilisées pour tout libellé de statut ou d'eyebrow
export const smallCaps = "text-[11px] font-semibold uppercase tracking-[0.12em]";

// Ombre de carte — presque invisible, sert uniquement à détacher la carte du fond
export const cardShadow =
  "0 1px 2px rgba(28,27,23,0.04), 0 6px 18px rgba(28,27,23,0.03)";

// Rayons de coin standard
export const radius = {
  card: "22px",
  button: "16px", // rounded-2xl
  avatar: "9999px",
} as const;

// Échelle d'espacement (en usage Tailwind) — ne pas en introduire d'autres
export const spacing = {
  pageX: "px-6", // marge horizontale de page
  betweenCards: "gap-4",
  cardPadding: "px-5 py-5",
} as const;
