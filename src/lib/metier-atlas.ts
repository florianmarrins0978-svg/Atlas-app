/**
 * CE QU'ATLAS EST, ET POUR QUI — dit UNE fois, à toutes ses IA.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Sa colère du 28 août 2026, et elle est fondée :**
 *
 * > *« Ce que je veux, c'est que ce soit une intelligence artificielle qui
 * > rédige le devis. Si ici je te dis désherbage, tu vas comprendre qu'on parle
 * > d'espaces verts. Pourquoi dans une appli SPÉCIFIQUE pour l'espace vert elle
 * > comprend pas ? C'est pas logique ! »*
 *
 * **Il avait raison, et le défaut était structurel.** Chaque service d'IA
 * déclarait son propre métier, à sa façon :
 *
 * | Service | Ce qu'il annonçait |
 * |---|---|
 * | l'assistant | « une application pour **artisans du bâtiment** » |
 * | la dictée d'un chantier | « un artisan » |
 * | la lecture d'un ticket | « un artisan **élagueur** » |
 * | le plan d'arrosage | « un **paysagiste** français » |
 *
 * Quatre métiers pour une seule application, dont un — le bâtiment — qui n'est
 * pas le sien. Un modèle à qui l'on dit « bâtiment » entend « herbages » là où
 * un paysagiste entend « désherbage » : ce n'est pas un défaut du modèle, c'est
 * qu'on lui a menti sur le métier.
 *
 * **Il n'y a donc plus qu'une phrase, et elle vit ici.** Un service qui l'oublie
 * se voit (`test-metier-atlas.ts`), et le jour où le métier s'élargit, il
 * s'élargit à un seul endroit (`CLAUDE.md` §3).
 *
 * **Le métier lève une ambiguïté, il ne refuse rien** (27 octobre 2026). La
 * phrase disait « tout ce qu'on te donne vient de ce métier » : l'assistant a
 * donc refusé de chercher une ligne « coupe de cheveux » que le patron avait
 * écrite lui-même sur un devis. *« On ne fait pas une appli pour les
 * paysagistes, on la fait pour les artisans ! »*
 */
export const METIER_ATLAS = `Atlas est une application pour les artisans. Son métier d'origine est celui des ESPACES VERTS
français : paysagiste, élagueur, jardinier d'entretien (désherbage, débroussaillage, tonte, taille de haie,
élagage, abattage, dessouchage, paillage, engazonnement, massifs, arrosage automatique, évacuation des déchets
verts). Quand un mot est ambigu, c'est le sens de ce métier qui l'emporte, jamais le sens le plus courant de
la langue. Mais un artisan vend ce qu'il veut : un mot qui n'appartient pas à ce métier n'est jamais une raison
de refuser, ni de le corriger. Tu le prends tel qu'il est écrit, et tu le cherches dans ses données.`;

/**
 * La même chose en une ligne, pour les consignes qui n'ont pas la place.
 *
 * **Deux formes, une seule source.** Ce qui compte est que le métier soit dit ;
 * les services qui rendent du JSON court n'ont pas de quoi porter cinq lignes.
 */
export const METIER_ATLAS_COURT =
  "Atlas est une application pour les artisans, née dans les ESPACES VERTS français (paysagiste, élagueur, jardinier). " +
  "Devant un mot ambigu, retiens le sens de ce métier, jamais le sens le plus courant de la langue ; " +
  "un mot hors de ce métier n'est jamais une raison de refuser : prends-le tel qu'il est écrit.";
