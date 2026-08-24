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

// ─── CES VALEURS PASSENT PAR UNE VARIABLE CSS DEPUIS LE 14 AOÛT 2026 ────────
//
// **Pourquoi, et ce que ça permet.** Le patron a choisi sept chartes de
// couleurs (`src/lib/chartes.ts`), dont deux sombres, et veut pouvoir en
// changer depuis les réglages. Elles étaient écrites en clair ici et employées
// dans plus de trois cents endroits, en style en ligne : rien n'aurait suivi.
//
// **La valeur de repli EST la charte d'origine, au caractère près.** Une page
// qui ne poserait aucune variable — un écran rendu hors du gabarit, un courriel,
// un document — retombe donc exactement sur ce que l'application portait avant
// ce lot. Ce n'est pas une précaution de style : c'est ce qui fait que ce
// changement n'a, par défaut, aucun effet visible.
//
// **Ce qui ne passe PAS par une variable :** `alert`, `sage` et `sageLight` —
// ils ne changent pas d'une charte à l'autre —, et surtout `couleursDocument`
// plus bas, qui doit rester en clair : un devis ne part pas en noir chez le
// client parce que l'artisan a choisi « Nuit ».
export const colors = {
  cream: "var(--atlas-cream, #f5f3ee)", // --bone : fond de page
  card: "var(--atlas-card, #faf9f5)", // --cream : fond des cartes et tuiles
  ink: "var(--atlas-ink, #1c1c1a)", // --charcoal : texte principal
  inkSoft: "var(--atlas-inkSoft, #4a4a44)", // --charcoal-soft : texte de second plan, chapôs
  muted: "var(--atlas-muted, #8a8578)", // --muted : texte secondaire / meta
  // L'accent unique — actions, libellés de statut, états actifs. Le nom `rust`
  // est conservé : soixante fichiers l'emploient, et le renommer d'un coup
  // aurait mêlé un changement d'identité à un changement mécanique, chacun
  // masquant les erreurs de l'autre. C'est le vert pin d'Arborea.
  rust: "var(--atlas-rust, #2f3b2f)", // --pine
  rustDeep: "var(--atlas-rustDeep, #4f5f4c)", // --pine-light : survol, second niveau
  rustTint: "var(--atlas-rustTint, #ece9e1)", // --paper : fond des avatars d'icône et éléments teintés
  sage: "#7d9a6d", // --sage : bordure de survol, encarts d'information
  sageLight: "#9fbd82", // --sage-light
  // Exception discrète, sans équivalent chez Arborea : uniquement pour
  // confirmer une action destructive. Terre cuite sombre, car une alerte en
  // vert se confondrait avec l'accent ordinaire.
  //
  // **ELLE PASSE PAR UNE VARIABLE DEPUIS LE 22 AOÛT 2026.** Elle était écrite
  // en clair, et ce fichier affirmait qu'elle n'avait pas à suivre la charte.
  // C'est faux sur les deux sombres : une terre cuite sombre posée sur un noir
  // chaud tient 2,5 de contraste — un refus qu'on ne peut pas lire n'a pas
  // refusé. La TEINTE reste la sienne ; seule la clarté s'accorde au fond, et
  // seulement quand elle en a besoin (`chartes.ts`, `detacher`).
  alert: "var(--atlas-alerte, #9C3B2E)",
  // ─── Les deux couleurs du planning, posées le 21 août 2026 ───────────────
  //
  // **Elles ne suivent pas la charte, comme `sage` et `alert`**, et c'est
  // délibéré : le calendrier distingue quatre états d'une même demi-journée —
  // rien, incomplet, complet, au-delà. Dérivées de chaque charte, deux d'entre
  // elles finiraient par se ressembler sur l'une des sept, et le mois cesserait
  // de se lire d'un coup d'œil, ce qui est sa seule raison d'être.
  //
  // `vertPale` : « il reste de la place ». Assez clair pour se distinguer du
  // vert pin plein, assez soutenu pour ne pas se confondre avec un carré vide.
  //
  // **Elles suivent la charte depuis le 22 août 2026, et pour la raison même
  // qui les avait fixées.** Leur rôle est que quatre états se distinguent d'un
  // coup d'œil ; sur les deux chartes sombres l'accent plein DEVIENT clair, si
  // bien qu'« incomplet » (vert pâle) et « complet » (l'accent) se lisaient
  // tous les deux comme deux blancs — 1,5 de contraste entre eux —, et que le
  // bordeaux du dépassement disparaissait dans le fond noir (1,76). Ce qui les
  // gardait fixes est exactement ce qui exige qu'elles bougent.
  vertPale: "var(--atlas-vertPale, #b9c6b4)",
  // `bordeaux` : le dépassement — plus de chantiers que d'équipes. **Son choix
  // du 21 août, après l'or puis l'ardoise**, tous deux écartés par lui. L'or
  // sert partout ailleurs à ce qu'on LIT, il ne signalait donc plus rien ; et
  // ce n'est PAS `alert` (#9C3B2E), qui dit « erreur » — dépasser est un choix
  // qu'il assume : *« il peut quand même le faire, nous on prévient juste »*.
  bordeaux: "var(--atlas-bordeaux, #6E2433)",
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
  or: "var(--atlas-or, #B98B47)",
  orClair: "var(--atlas-orClair, #C9A15E)",
  line: "var(--atlas-line, rgba(28,28,26,0.12))", // --line : séparateurs, bordures fines
  lineSoft: "var(--atlas-lineSoft, rgba(28,28,26,0.07))", // --line-soft : bordure des tuiles
  chevron: "var(--atlas-chevron, rgba(28,28,26,0.28))", // affordance de navigation discrète
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

// ═══ CE QU'ON ÉCRIT SUR UN APLAT — le défaut du 22 août 2026 ════════════════
//
// **Sa capture, le 22 août :** *« le mode nuit est illisible »*. La pastille
// d'équipe du planning portait « Julien ＋ » en `#faf9f5` — un crème écrit en
// clair — sur `colors.rust`. Sur les cinq chartes claires, l'accent est un vert
// pin sombre et cela se lit très bien. **Sur Nuit et Sylve, l'accent EST
// l'encre** : un crème sur un crème, 1,05 de contraste. Le même défaut se
// répétait sur les boutons pleins, les icônes `fill="white"` et les libellés
// posés sur le rouge d'alerte — huit endroits, tous écrits en clair, tous
// justes sur cinq chartes et illisibles sur deux.
//
// **`card` est la réponse, et ce n'est pas un hasard :** dans chacune des sept
// chartes, la plage et l'accent sont aux deux bouts de l'échelle — l'un clair
// et l'autre sombre, ou l'inverse. Ce qui se lit sur la plage se lit sur
// l'accent, retourné. Sur « Origine », `card` vaut `#faf9f5` au caractère près :
// les cinq chartes claires ne bougent donc pas d'un pixel.
//
// La garantie n'est pas une intuition : `scripts/test-chartes-lisibles.ts`
// mesure les sept chartes et refuse la moindre sous 4,5.
export const surPlein = colors.card;

/**
 * Un voile d'encre qui SUIT la charte — ce que `rgba(28,28,26,…)` ne faisait
 * pas.
 *
 * Le calendrier éteignait ses week-ends et ses jours passés avec l'encre
 * d'Origine écrite en clair. Sur un fond noir, du noir à 42 % est du noir :
 * les chiffres « 29 » et « 30 » de sa capture n'existaient tout simplement
 * pas. Écrit ainsi, le voile est clair sur une charte sombre et sombre sur une
 * charte claire, sans que l'écran ait à savoir laquelle est posée.
 *
 * **Ce qu'il se passe si le navigateur ne connaît pas `color-mix`** (avant
 * iOS 16.2) : la déclaration est ignorée, et la couleur retombe sur celle
 * qu'elle hérite — c'est-à-dire l'encre pleine. Le chiffre est alors trop VU,
 * jamais invisible. La dégradation va du bon côté, et c'est délibéré : le
 * défaut qu'on répare est l'effacement, pas l'excès.
 */
export function voile(couleur: string, part: number): string {
  return `color-mix(in srgb, ${couleur} ${Math.round(part * 1000) / 10}%, transparent)`;
}

export const font = {
  display: "var(--font-display)", // titres de page, noms de chantier — Playfair Display
  body: "var(--font-body)", // texte courant, meta, navigation — Inter
} as const;

// Petites capitales utilisées pour tout libellé de statut ou d'eyebrow.
// Arborea espace davantage les siennes (`letter-spacing:0.22em` sur `.eyebrow`).
//
// **Ancienne voix.** Elle survit parce que les maquettes `/design/*` s'en
// servent, et qu'elles sont découplées du produit depuis le 1er août : les
// toucher reviendrait à réécrire des pages qui ne sont plus des écrans du
// patron. Un écran refondu prend `libelleCaps` ci-dessous.
export const smallCaps = "text-[11px] font-semibold uppercase tracking-[0.18em]";

// ─── Les deux voix de l'écran retenu le 10 août 2026 ─────────────────────────
//
// Elles étaient recopiées à la main dans chaque écran refait — six fois les
// mêmes quatre valeurs, et un `0.28em` mal retapé ne se voit pas en relecture.
// `CLAUDE.md` §3 le dit : une allure ne se recopie pas dans un écran, elle
// s'ajoute aux pièces partagées. Les voici.
//
// **La voix des libellés** : tout ce qui nomme sans être un titre — l'intitulé
// d'une rubrique, un état, une action secondaire. Neuf virgule cinq pixels et
// 0,28 em d'écartement : c'est ce qui distingue un repère d'une phrase, et
// c'est ce qui manquait à « Ajouter un fichier audio » quand elle se lisait
// comme du texte courant.
export const libelleCaps = "text-[9.5px] font-medium uppercase tracking-[0.28em]";

// **La voix de la situation** : l'adresse sous un nom, ce que change une
// durée, d'où viennent les informations affichées. Elle se lit, elle ne se
// touche pas — et à 11,5 px elle ne dispute jamais la place au serif.
export const texteSituation = "text-[11.5px] leading-[1.5]";

// La plage d'un champ de saisie : 15 px de retrait, 4 px de rayon, le fond des
// plages, aucune bordure. Ce sont les mesures de la maquette retenue.
//
// **Deux choses à ne pas défaire.** Les 16 px de corps : en dessous, iOS
// agrandit la page dès qu'un champ prend le focus, et le patron se retrouve
// avec un écran zoomé qu'il doit rétablir à la main. Et la plage elle-même :
// un champ vide sans repère se lit comme « pas cliquable », quel que soit ce
// qu'en dit le navigateur (`HANDOVER.md`, piège 18).
export const champPlage = "border-0 px-[15px] py-3 outline-none";
export const styleChampPlage = {
  backgroundColor: colors.card,
  color: colors.ink,
  fontSize: "16px",
  borderRadius: 4,
} as const;

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
