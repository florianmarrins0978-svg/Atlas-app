import { colors, font } from "@/lib/design-tokens";

// L'action principale, refaite le 10 août 2026 avec le reste de l'application.
//
// **Le changer, c'est changer partout d'un coup — et c'est bien l'intention.**
// Trois choses le rapprochent de l'écran des chantiers que le patron a retenu :
// le rayon tombe de 16 px à 5, le libellé passe à la serif de titre, et la
// hauteur se resserre.
//
// **Combien d'écrans, exactement.** Ce commentaire a longtemps annoncé
// « vingt-sept », chiffre qui ne correspondait à rien de vérifiable et qui a été
// répété tel quel au patron le 11 août. Recompté ce jour-là, à sa demande :
//
//   · **8 écrans du produit**, 11 boutons — création de chantier, informations,
//     prix, transcription, photos, note vocale (2), devis à envoyer, facture (3) ;
//   · **10 écrans d'erreur**, servis par un seul bouton dans `CorpsErreur` ;
//   · 8 pages `/design/*`, 9 boutons — **hors produit**, découplées depuis le
//     1er août (voir `smallCaps` dans `design-tokens.ts`).
//
// Soit **18 écrans réels**. Pour recompter sans se fier à cette ligne :
//
//     grep -rl PrimaryButton src/ --include="*.tsx"
//
// Un chiffre écrit dans un commentaire vieillit ; la commande, non.
//
// **Le rayon est ce qui compte le plus.** Un rectangle presque droit se lit
// comme une pièce imprimée ; le même arrondi à 16 px se lit comme un bouton
// d'application — c'est très exactement ce dont le patron ne voulait plus.

// ─── La capsule, ajoutée le 11 août 2026 ────────────────────────────────────
//
// Le patron, capture à l'appui : *« pour créer le chantier, je trouve le bouton
// un peu trop gros, carré, pas esthétique »*. Huit formes lui ont été montrées
// (`docs/maquettes/17-le-bouton.html`) ; il a retenu **la capsule**.
//
// **Ce qui l'allège n'est PAS le rayon, et c'est le point.** La masse venait de
// trois choses à la fois : la hauteur (58 px), l'aplat, et la PLEINE LARGEUR —
// un bouton qui touche les deux marges n'est contenu par rien. La capsule lâche
// la pleine largeur : elle est tenue par le blanc autour d'elle, et cesse
// aussitôt de peser. L'aplat reste plein, donc l'action reste évidente ; c'est
// ce qui la sépare des propositions sans fond, plus élégantes mais qui se
// cherchent au lieu de se trouver.
//
// **Le rayon plein n'entre pas en contradiction avec la décision du 10 août.**
// Celle-ci visait le rayon MOYEN — « le même arrondi à 16 px se lit comme un
// bouton d'application, c'est très exactement ce dont le patron ne voulait
// plus ». Un demi-cercle franc ne se lit pas comme un coin arrondi hésitant :
// c'est une forme en soi, celle d'un jeton, pas d'une tuile d'application. La
// plaque droite reste la forme par défaut partout ailleurs.
//
// **Pour l'instant, un seul écran s'en sert** — celui de la création. Basculer
// la valeur par défaut changerait les dix-sept autres d'un coup (voir le compte
// en tête de fichier), sans que le patron les ait vus. Le jour où il le demande,
// c'est `forme = "capsule"` par défaut ici, et rien d'autre.
type Forme = "plaque" | "capsule";

export default function PrimaryButton({
  children,
  onClick,
  href,
  disabled = false,
  forme = "plaque",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  forme?: Forme;
}) {
  const capsule = forme === "capsule";

  // La capsule ne prend que la place de son texte : c'est tout son intérêt.
  // 13 px de retrait vertical sur un corps de 17 la posent à 50 px de haut —
  // au-dessus des 44 px qu'Apple demande au doigt, et huit de moins que la
  // plaque.
  const className = capsule
    ? "inline-flex items-center justify-center gap-2 px-9 py-[13px] text-[17px] transition-transform active:scale-[0.985]"
    : "flex w-full items-center justify-center gap-2 py-4 text-[18px] transition-transform active:scale-[0.985]";
  const dessin = { borderRadius: capsule ? 9999 : 5, fontFamily: font.display };

  // **La capsule se centre elle-même.** Un bouton à largeur libre laissé au
  // fil du texte se collerait à gauche ; l'appelant l'oublierait une fois sur
  // deux, et le défaut passerait pour un choix.
  const envelopper = (el: React.ReactElement) =>
    capsule ? <div className="flex justify-center">{el}</div> : el;

  if (disabled) {
    return envelopper(
      <button
        type="button"
        disabled
        aria-disabled="true"
        className={`${className} cursor-not-allowed`}
        style={{ ...dessin, backgroundColor: colors.line, color: colors.muted }}
      >
        {children}
      </button>
    );
  }

  const style = { ...dessin, backgroundColor: colors.rust, color: colors.card };

  if (href) {
    return envelopper(
      <a href={href} className={className} style={style}>
        {children}
      </a>
    );
  }
  return envelopper(
    <button type="button" onClick={onClick} className={className} style={style}>
      {children}
    </button>
  );
}
