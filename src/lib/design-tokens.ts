// Système de design Atlas — la charte d'Arborea, celle du patron.
//
// Toute nouvelle interface importe ces valeurs plutôt que de redéfinir les
// siennes. Modifier ce fichier revient à modifier l'identité visuelle de toute
// l'application : à ne faire que sur demande explicite.
//
// **Pourquoi ces valeurs, et pas d'autres.** Atlas s'était donné en chemin une
// identité qui lui était propre — accent terre cuite, polices du système —
// pendant que les maquettes gardaient celle d'Arborea : vert pin, Playfair
// Display et Inter. Deux chartes coexistaient dans le même projet, et personne
// n'avait tranché. Le patron a comparé les deux le 3 août 2026 et décidé :
// **l'application reprend Arborea.**
//
// Les valeurs ci-dessous ne sont pas approchées à l'œil : elles ont été
// relevées sur `…github.io/Arborea-/app.html` par un navigateur, via
// `.github/workflows/relever-palette.yml` (voir `ARCHITECTURE.md` §17).
//
// **Les documents font exception**, et c'est délibéré : voir `couleursDocument`.

export const colors = {
  cream: "#f5f3ee", // --bone : fond de page
  card: "#faf9f5", // --cream : fond des cartes et tuiles
  ink: "#1c1c1a", // --charcoal : texte principal
  inkSoft: "#4a4a44", // --charcoal-soft : texte de second plan, chapôs
  muted: "#8a8578", // --muted : texte secondaire / meta
  // L'accent unique — actions, libellés de statut, états actifs. Le nom `rust`
  // est conservé : soixante fichiers l'emploient, et le renommer d'un coup
  // aurait mêlé un changement d'identité à un changement mécanique, chacun
  // masquant les erreurs de l'autre. C'est le vert pin d'Arborea.
  rust: "#2f3b2f", // --pine
  rustDeep: "#4f5f4c", // --pine-light : survol, second niveau
  rustTint: "#ece9e1", // --paper : fond des avatars d'icône et éléments teintés
  sage: "#7d9a6d", // --sage : bordure de survol, encarts d'information
  sageLight: "#9fbd82", // --sage-light
  // Exception discrète, sans équivalent chez Arborea : uniquement pour
  // confirmer une action destructive. Gardée en terre cuite sombre, car une
  // alerte en vert se confondrait avec l'accent ordinaire.
  alert: "#9C3B2E",
  // ─── L'or, second accent, posé le 9 août 2026 ────────────────────────────
  //
  // **Il vient d'une maquette du patron, pas d'une envie.** Il a envoyé une
  // capture de l'écran Chantiers refait — sceau, filet sous le titre,
  // « Bonjour <prénom> », libellés de statut — et demandé de la reproduire.
  // Jusque-là la charte n'avait qu'un accent, le vert pin ; elle en a deux.
  //
  // **Le partage des rôles, et il n'est pas décoratif :** le vert pin porte ce
  // qu'on FAIT (l'action principale, l'onglet où l'on est), l'or porte ce qu'on
  // LIT (l'accueil, les statuts, les traits). Les mélanger rendrait l'écran
  // bavard — c'est exactement l'aspect « tableau de bord » que le patron
  // refuse.
  //
  // Sur le fond crème, `or` tient le contraste du texte courant ; `orClair` est
  // réservé aux traits, cercles et icônes posés sur le vert pin, où il faut
  // remonter la clarté.
  or: "#B98B47",
  orClair: "#C9A15E",
  line: "rgba(28,28,26,0.12)", // --line : séparateurs, bordures fines
  lineSoft: "rgba(28,28,26,0.07)", // --line-soft : bordure des tuiles
  chevron: "rgba(28,28,26,0.28)", // affordance de navigation discrète
} as const;

// ─── Les documents que le client reçoit ─────────────────────────────────────
//
// Devis et facture gardent la terre cuite. Le patron l'a choisie le
// 3 août 2026, les deux versions sous les yeux, **et l'a maintenue** en
// demandant que le reste de l'application reprenne Arborea.
//
// Ce n'est pas une incohérence : un devis n'est pas un écran. C'est la pièce
// que son client garde, imprime et signe, et elle porte sa propre teinte.
export const couleursDocument = {
  accent: "#B25A2E", // terre cuite — intertitres « Émetteur » / « Client »
  papier: "#faf9f5",
  encre: "#1c1c1a",
  etiquette: "#6b6b5c",
} as const;

export const font = {
  display: "var(--font-display)", // titres de page, noms de chantier — Playfair Display
  body: "var(--font-body)", // texte courant, meta, navigation — Inter
} as const;

// Petites capitales utilisées pour tout libellé de statut ou d'eyebrow.
// Arborea espace davantage les siennes (`letter-spacing:0.22em` sur `.eyebrow`).
export const smallCaps = "text-[11px] font-semibold uppercase tracking-[0.18em]";

// Ombre de carte — presque invisible, sert uniquement à détacher la carte du
// fond. Teintée de vert pin comme chez Arborea, et non de gris neutre.
// **Allégée le 9 août 2026.** Elle portait 26 px de diffusion à 6 % : sur
// l'écran d'accueil refait, les cartes semblaient posées sur l'écran plutôt
// qu'imprimées dedans, et le patron l'a nommé — « ombres extrêmement légères ».
// Ce qui reste sert uniquement à détacher la carte du fond crème.
export const cardShadow = "0 1px 2px rgba(47,59,47,0.04), 0 6px 14px rgba(47,59,47,0.04)";

// Rayons de coin standard, relevés sur Arborea : 20px pour l'action
// principale, 16px pour les tuiles.
export const radius = {
  card: "16px",
  button: "20px",
  avatar: "9999px",
} as const;

// Échelle d'espacement (en usage Tailwind) — ne pas en introduire d'autres
export const spacing = {
  pageX: "px-6", // marge horizontale de page
  betweenCards: "gap-4",
  cardPadding: "px-5 py-5",
} as const;
