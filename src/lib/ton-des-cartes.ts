import { colors } from "./design-tokens";

/**
 * LES CINQ COULEURS DE L'ACCUEIL — sa planche du 23 octobre 2026.
 *
 * *« Fais-moi une planche avec différents codes couleurs en fonction des
 * différentes notifications. Comme ça, l'utilisateur, en un coup d'œil, il
 * saura ce qui est arrivé, ce qui se passe »*, puis, planche en main
 * (`appli/accueil-codes-couleur.html`) : *« autre date proposée, mais en
 * bleu »* et *« tout est bon »*.
 *
 * **Rangées par ce qu'il a à faire, pas par sujet.** Un devis accepté et un
 * virement reçu ne parlent pas de la même chose, mais ils demandent le même
 * regard : une bonne nouvelle à confirmer. C'est ce que l'œil doit trier.
 *
 * | ton | ce qu'il dit | les cartes |
 * |---|---|---|
 * | `vert` | bonne nouvelle | devis accepté, facture reçue, virement reçu |
 * | `ambre` | à vous de répondre | correction demandée, chantier sans devis |
 * | `bleu` | une date qui bouge | autre date proposée |
 * | `rouge` | ça peut coûter | devis retourné, devis caduc, facture impayée, contrôle dépassé |
 * | `blanc` | pour mémoire | devis sans réponse, à facturer, retour pas reçu, contrôle à venir |
 *
 * **Cinq, et pas une couleur par carte** : au delà, on ne retient plus
 * laquelle veut dire quoi, et l'œil ne trie plus rien.
 *
 * **Ce qui a disparu** : le fond beige « urgent » (`rustTint`). Il disait
 * « regardez » sans dire si c'était à répondre ou à rattraper.
 */
export type TonCarte = "vert" | "ambre" | "bleu" | "rouge" | "blanc";

export type CouleursDuTon = {
  fond: string;
  /** Le titre en petites capitales, et le point qui le précède. */
  titre: string;
  /** La phrase de la carte. */
  texte: string;
};

/**
 * Les couleurs d'un ton — la seule table, pour toutes les cartes de l'accueil.
 *
 * **Sur une carte teintée, la phrase passe au gris FONCÉ** (`inkSoft`) : le
 * gris clair d'aujourd'hui (`muted`) tombait à 2,4 de contraste sur le fond
 * bleu, illisible au soleil. Sur la carte blanche il reste le gris d'avant :
 * rien ne bouge là où rien n'a été demandé.
 */
export function couleursDuTon(ton: TonCarte): CouleursDuTon {
  switch (ton) {
    case "vert":
      return { fond: colors.carteVertFond, titre: colors.carteVertTexte, texte: colors.inkSoft };
    case "ambre":
      return { fond: colors.carteAmbreFond, titre: colors.carteAmbreTexte, texte: colors.inkSoft };
    case "bleu":
      return { fond: colors.carteBleuFond, titre: colors.carteBleuTexte, texte: colors.inkSoft };
    case "rouge":
      return { fond: colors.carteRougeFond, titre: colors.carteRougeTexte, texte: colors.inkSoft };
    case "blanc":
      return { fond: colors.card, titre: colors.muted, texte: colors.muted };
  }
}
