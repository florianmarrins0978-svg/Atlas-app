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
// **La terre cuite est abandonnée le 10 août 2026, à sa demande** : *« oui,
// harmonise aussi le devis »*. Elle avait été choisie le 3 août, les deux
// versions sous les yeux, et maintenue quand le reste de l'application est
// passé à Arborea — le devis n'étant pas un écran mais une pièce que le client
// garde et signe.
//
// Il a tranché l'inverse une fois l'application refaite : une seule identité,
// écran et document. L'accent devient donc **l'or**, celui qui porte partout
// ailleurs ce qu'on LIT — et un intertitre « ÉMETTEUR » est exactement cela.
// Le vert pin aurait été le mauvais choix : il porte ce qu'on FAIT, et il n'y a
// rien à faire sur un devis imprimé.
//
// **Ce bloc existe encore, et doit rester**, même s'il ne diverge plus : le
// papier et l'encre d'un document imprimé ne suivront pas forcément un futur
// changement d'écran. Le jour où l'application passera au sombre, ce fichier
// sera l'endroit où l'on empêchera le devis de partir en noir chez le client.
export const couleursDocument = {
  accent: "#B98B47", // l'or — intertitres « Émetteur » / « Client »
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
// **Supprimée le 10 août 2026**, avec le reste de la refonte. Le patron a
// retenu un écran sans une seule ombre : une plage plus claire que le fond
// suffit à détacher, et une ombre — même à 4 % — remet le contenu « au-dessus »
// de la page au lieu de dedans. La constante reste, et vaut « aucune ombre » :
// une soixantaine d'endroits l'importent, et les reprendre un par un aurait
// mêlé un changement d'identité à un changement mécanique.
export const cardShadow = "none";

// Rayons de coin standard, relevés sur Arborea : 20px pour l'action
// principale, 16px pour les tuiles.
// **Resserrés le 10 août 2026.** L'écran retenu n'arrondit presque rien : au
// delà de 6 px, une plage devient un galet et l'écran perd sa tenue. Seuls les
// ronds — pastilles, avatars — restent pleinement circulaires.
export const radius = {
  card: "4px",
  button: "5px",
  avatar: "9999px",
} as const;

// Échelle d'espacement (en usage Tailwind) — ne pas en introduire d'autres
export const spacing = {
  pageX: "px-6", // marge horizontale de page
  betweenCards: "gap-4",
  cardPadding: "px-5 py-5",
} as const;
