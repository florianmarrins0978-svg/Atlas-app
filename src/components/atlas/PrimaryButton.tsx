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
//   · **9 écrans d'erreur**, servis par un seul bouton dans `CorpsErreur` ;
//   · 8 pages `/design/*`, 9 boutons — **hors produit**, découplées depuis le
//     1er août (voir `smallCaps` dans `design-tokens.ts`).
//
// Soit **17 écrans réels**. Pour recompter sans se fier à cette ligne :
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
//
// ─── Deux réglages ajoutés le 12 août 2026, pour le message de la facture ────
//
// Ce bouton-là est un LIEN (`sms:` ou `mailto:`) et non un geste : il ouvre la
// messagerie du patron. Jusqu'ici la variante `href` perdait `onClick` en
// silence, et le départ vers la messagerie n'était donc plus retenu — le retour
// ne ramenait plus à l'accueil avec un mot (`src/lib/annonce-transmission.ts`).
// D'où `onClick` honoré des deux côtés.
//
// `repere` pose un `data-atlas` : sans lui, une suite ne peut désigner ce lien
// que par son texte, et « Ouvrir le SMS tout prêt » / « Ouvrir l'e-mail tout
// prêt » se ressemblent assez pour qu'un contrôle passe au vert sur le mauvais.
// C'est la convention du dépôt, pas une invention pour l'occasion.
//
// **Aucun des deux ne touche au DESSIN.** Ajouter un réglage d'apparence ici
// serait rouvrir « une seule forme d'action », qui est le sujet même de ce
// fichier.
export default function PrimaryButton({
  children,
  onClick,
  href,
  disabled = false,
  repere,
  pleineLargeur = false,
  secondaire = false,
  part,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  /** Repère de suite, posé en `data-atlas`. Jamais lu par le produit. */
  repere?: string;
  /**
   * La capsule prend toute la largeur de son bloc.
   *
   * **Sa maquette de la fiche client le veut ainsi** (`.principal{width:100%}`
   * dans `appli/fiche-client-vocale.html`), et il a demandé qu'elle soit codée
   * trait pour trait. Le 22 août, devant l'écran : *« ça fait déjà deux fois
   * que je te le demande »*.
   *
   * **Cela ne rouvre PAS « une seule forme d'action »**, qui est le sujet de ce
   * fichier : le dessin ne bouge pas d'un pixel — même capsule, même vert,
   * même serif, même hauteur. Seule la largeur suit le bloc, et un écran qui
   * n'en veut pas n'a rien à faire.
   */
  pleineLargeur?: boolean;
  /**
   * La capsule cède la vedette : fond transparent, liseré d'or, encre.
   *
   * **Sa demande du 30 août 2026 :** *« le bouton change par "je rédige à la
   * main", mais ça doit être un bouton secondaire, car l'idée c'est qu'il
   * utilise en priorité la note vocale »*.
   *
   * **Ce n'est pas « une seconde forme d'action », c'est une HIÉRARCHIE.** Le
   * dessin ne bouge pas — même capsule, même serif, même hauteur ; seul
   * l'aplat s'en va. Un écran n'a qu'un seul plein, et il désigne ce qu'on
   * veut qu'on fasse : tant que ce bouton-là était plein, l'œil y allait
   * d'abord et la dictée devenait un accessoire — l'inverse de ce produit.
   *
   * Le vocabulaire est celui des capsules de canal (`ChoixCanal.tsx`), pas une
   * invention : transparent, liseré, encre.
   */
  secondaire?: boolean;
  /**
   * La part de la largeur du bloc que prend la capsule — « 66 % », sa
   * proposition 4 du 30 août, choisie sur planche parmi quatre.
   *
   * Sans effet si `pleineLargeur` n'est pas demandé : c'est un réglage de
   * ce mode-là, pas une largeur libre.
   */
  part?: string;
}) {
  // La capsule ne prend que la place de son texte : c'est tout son intérêt.
  // 13 px de retrait vertical sur un corps de 17 la posent à 50 px de haut —
  // au-dessus des 44 px qu'Apple demande au doigt, et huit de moins qu'avant.
  // **`atlas-plein` remplace `active:scale-[0.985]`, et c'est sa décision du
  // 31 août 2026** : « comme force du geste tu mets discret sur chaque bouton
  // qui demande à être appuyé ». Discret vaut 0,975 — contre 0,985 ici, soit
  // moins d'un pixel sur une capsule de 50 px, un geste qui vivait dans le code
  // et pas sous le doigt. La classe porte aussi le vert 8 (Origine seulement)
  // et l'éclaircissement à l'appui ; tout est dans `globals.css`.
  //
  // **La capsule SECONDAIRE ne la prend pas** : elle est creuse, et sa consigne
  // dit « surtout pas ceux qui sont creux ». Son geste lui vient d'ailleurs.
  const geste = secondaire ? "transition-transform active:scale-[0.975]" : "atlas-plein";
  const className =
    `${pleineLargeur ? "flex w-full" : "inline-flex"} items-center justify-center gap-2 px-9 py-[13px] text-[17px] ${geste}`;
  const dessin: React.CSSProperties = {
    borderRadius: 9999,
    fontFamily: font.display,
    // La part ne s'applique qu'en pleine largeur : ailleurs la capsule tient à
    // son texte, et lui imposer une fraction la couperait.
    ...(pleineLargeur && part ? { width: part, alignSelf: "center" } : null),
  };

  // **Le bouton se centre lui-même.** À largeur libre, laissé au fil du texte,
  // il se collerait à gauche ; l'appelant l'oublierait une fois sur deux, et le
  // défaut passerait pour un choix. Aucun des dix-sept écrans n'a à le savoir.
  const centrer = (el: React.ReactElement) =>
    pleineLargeur ? el : <div className="flex justify-center">{el}</div>;

  if (disabled) {
    return centrer(
      <button
        type="button"
        disabled
        aria-disabled="true"
        className={`${className} cursor-not-allowed`}
        // **Une capsule secondaire éteinte reste CREUSE.** Sinon, appuyer sur
        // « Je rédige à la main » la remplirait d'un aplat gris le temps de la
        // création : le bouton changerait de nature sous le doigt, et l'on
        // croirait avoir touché autre chose.
        style={
          secondaire
            ? { ...dessin, backgroundColor: "transparent", color: colors.muted, boxShadow: `inset 0 0 0 1.5px ${colors.line}` }
            : { ...dessin, backgroundColor: colors.line, color: colors.muted }
        }
      >
        {children}
      </button>
    );
  }

  const style: React.CSSProperties = secondaire
    ? {
        ...dessin,
        backgroundColor: "transparent",
        color: colors.ink,
        // Un liseré posé en `box-shadow` plutôt qu'en `border` : la bordure
        // ajouterait trois pixels de haut, et la capsule secondaire cesserait
        // d'avoir exactement la taille de la pleine.
        //
        // **IL N'EST PLUS EN OR DEPUIS LE 2 SEPTEMBRE 2026** — planche
        // « A — Épurée ». L'or dit « à faire » partout ailleurs dans
        // l'application, et il cerclait ici le bouton dont on veut justement
        // qu'on se détourne. Pire depuis le même jour : la note vocale porte
        // désormais un filet d'or, à trente pixels au-dessus. Deux ors qui
        // s'appellent, et l'œil ne sait plus lequel est le geste.
        //
        // Cette capsule ne sert QUE sur la fiche client (`secondaire` n'a pas
        // d'autre appel) : le changement ne déborde nulle part.
        boxShadow: `inset 0 0 0 1.5px ${colors.line}`,
      }
    : { ...dessin, backgroundColor: colors.rust, color: colors.card };

  if (href) {
    return centrer(
      <a href={href} onClick={onClick} data-atlas={repere} className={className} style={style}>
        {children}
      </a>
    );
  }
  return centrer(
    <button type="button" onClick={onClick} data-atlas={repere} className={className} style={style}>
      {children}
    </button>
  );
}
