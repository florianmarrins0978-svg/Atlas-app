import { colors, font } from "@/lib/design-tokens";

// L'action principale, refaite le 10 août 2026 avec le reste de l'application,
// **et passée en capsule le 11 août au soir**.
//
// **Le changer, c'est changer partout d'un coup — et c'est bien l'intention.**
// Il n'existe qu'une forme d'action principale dans Atlas : deux formes dans la
// même application se lisent comme un travail inachevé.
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
// ─── La capsule ─────────────────────────────────────────────────────────────
//
// Le patron, le 11 août 2026, capture à l'appui : *« pour créer le chantier, je
// trouve le bouton un peu trop gros, carré, pas esthétique »*. Huit formes lui
// ont été montrées (`docs/maquettes/17-le-bouton.html`), puis la capsule lui a
// été montrée **sur ses vrais écrans, avant d'être posée** — c'est sa règle :
// *« montre-moi avant de faire, plutôt que de faire pour revenir en arrière »*.
// Il a répondu « partout ».
//
// **Ce qui l'allège n'est PAS le rayon, et c'est le point.** La masse venait de
// trois choses à la fois : la hauteur (58 px), l'aplat, et la PLEINE LARGEUR —
// un bouton qui touche les deux marges n'est contenu par rien. La capsule lâche
// la pleine largeur : elle est tenue par le blanc autour d'elle, et cesse
// aussitôt de peser. L'aplat, lui, **reste plein** : c'est ce qui la sépare des
// formes cernées ou soulignées, plus élégantes mais qui se cherchent au lieu de
// se trouver sur un écran qu'on parcourt vite.
//
// **Le rayon plein ne contredit pas la décision du 10 août.** Celle-ci visait le
// rayon MOYEN — « le même arrondi à 16 px se lit comme un bouton d'application,
// c'est très exactement ce dont le patron ne voulait plus ». Un demi-cercle
// franc ne se lit pas comme un coin arrondi hésitant : c'est une forme en soi,
// celle d'un jeton, pas d'une tuile d'application.
//
// **Aucune variante « plaque » n'est conservée.** Elle a existé une journée, le
// temps que le patron voie la capsule sur ses écrans. Garder le dessin d'avant
// « au cas où » aurait laissé dans le dépôt une seconde forme d'action que plus
// rien n'emploie — et qu'un écran futur aurait fini par reprendre au hasard.
// L'historique la garde ; le code, non.
//
// **Les largeurs, mesurées et non supposées** (11 août, sur 390 px d'écran, la
// place réelle de son téléphone) : de 141 px pour « Réessayer » à 316 px pour
// « Confirmer le départ de la facture ». Aucun libellé ne déborde. Le dernier
// occupe 92 % de la largeur et redevient pleine largeur de fait — ce n'est pas
// un défaut : c'est le geste le plus irréversible de l'application.
export default function PrimaryButton({
  children,
  onClick,
  href,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}) {
  // La capsule ne prend que la place de son texte : c'est tout son intérêt.
  // 13 px de retrait vertical sur un corps de 17 la posent à 50 px de haut —
  // au-dessus des 44 px qu'Apple demande au doigt, et huit de moins qu'avant.
  const className =
    "inline-flex items-center justify-center gap-2 px-9 py-[13px] text-[17px] transition-transform active:scale-[0.985]";
  const dessin = { borderRadius: 9999, fontFamily: font.display };

  // **Le bouton se centre lui-même.** À largeur libre, laissé au fil du texte,
  // il se collerait à gauche ; l'appelant l'oublierait une fois sur deux, et le
  // défaut passerait pour un choix. Aucun des dix-huit écrans n'a à le savoir.
  const centrer = (el: React.ReactElement) => <div className="flex justify-center">{el}</div>;

  if (disabled) {
    return centrer(
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
    return centrer(
      <a href={href} className={className} style={style}>
        {children}
      </a>
    );
  }
  return centrer(
    <button type="button" onClick={onClick} className={className} style={style}>
      {children}
    </button>
  );
}
