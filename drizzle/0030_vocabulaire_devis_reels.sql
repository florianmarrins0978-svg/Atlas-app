-- Le vocabulaire et les tournures d'un élagueur, tirés de devis réels.
--
-- **Le patron, le 9 août 2026**, en transmettant quatre devis d'un confrère :
-- *« voici des exemples de vrais devis faits par un élagueur, inspire-toi,
-- apprends les phrases, les mots clés, les tournures de phrase, sauts de ligne
-- par rapport aux différentes tâches à effectuer. Et ajoute ça au document
-- vocabulaire. »*
--
-- =========================================================================
-- CE QUI N'ENTRE PAS ICI, ET POURQUOI
-- =========================================================================
--
-- Les quatre devis portent le nom, l'adresse et la commune de **vrais clients**,
-- ainsi que la raison sociale, le SIRET, l'IBAN, le téléphone et l'e-mail d'une
-- **entreprise tierce**. Rien de tout cela n'est reproduit.
--
-- Ce n'est pas de la prudence en plus : c'est la règle déjà écrite. Ce
-- vocabulaire est PARTAGÉ — il part avec l'application chez tous les artisans
-- (`docs/QUESTIONS.md` §10) : *« ce sont des mots, pas des données de client :
-- aucun nom, aucune adresse, aucun prix. C'est ce qui les rend partageables
-- sans le moindre risque. »* Et le dépôt est public depuis le 1ᵉʳ août.
--
-- Les prix des devis ne sont pas repris non plus, et pour une autre raison :
-- ce sont les prix d'un confrère. Les faire entrer dans les grilles du patron
-- reviendrait à lui faire facturer les tarifs de quelqu'un d'autre.
--
-- =========================================================================
-- CE QUE CES DEVIS APPRENNENT VRAIMENT
-- =========================================================================
--
-- Ils confirment la règle que le patron avait énoncée seul le 7 août — « chaque
-- ligne doit pouvoir se vendre seule » — et ils en montrent la forme :
--
--   * une ligne porte un ARBRE ou une ZONE, jamais un verbe. « Hêtre »,
--     « Espace Hangar », « Bouleau (près de la clôture du voisin) » ;
--   * le détail des opérations vient SOUS ce titre, une par ligne ;
--   * ce qui se vend seul garde sa propre ligne — la fente du gros bois, le
--     rognage des souches, le débroussaillage. Exactement son découpage.
--
-- Le vocabulaire ci-dessous est donc du métier, pas du style : chaque terme
-- change soit ce qu'Atlas ÉCRIT, soit la case de grille qu'il va chercher.

-- =========================================================================
-- 1. Les règles de rédaction
-- =========================================================================
--
-- Elles passent avant les mots dans la consigne (`consigne-metier.ts`) : une
-- règle mal appliquée fausse un devis entier, un mot mal compris un libellé.

INSERT INTO "termes_metier" ("nature", "intitule", "definition", "consigne", "ordre") VALUES
(
  'regle',
  'Une ligne porte un arbre ou une zone, jamais un verbe',
  'Le titre nomme ce sur quoi on intervient — « Hêtre », « Espace Hangar », « Zone acacia mort » — pas le geste.',
  'Titrer par l''essence ou la zone. « Abattage », « Taille » vont dans le détail, sous le titre.',
  1
),
(
  'regle',
  'Situer l''arbre entre parenthèses',
  'Un jardin a plusieurs arbres de la même essence : « Bouleau (près de la clôture du voisin) ».',
  'Reprendre le repère dicté entre parenthèses. Sans repère, ne pas en inventer.',
  2
),
(
  'regle',
  'Le détail va sous le titre, une opération par ligne',
  'Chaque geste occupe sa ligne. Un paragraphe compact se lit comme une seule prestation.',
  'Retours à la ligne, jamais de points-virgules. Une puce par arbre quand il y en a plusieurs.',
  3
),
(
  'regle',
  'Dire toujours ce que devient le bois',
  'Aucune ligne d''abattage ne finit sans dire où va la matière : débité, broyé, ou évacué.',
  'Finir par « Gros bois débité en 40 cm », « Broyage des branches au pied », ou « Évacuation par camion ». Si la dictée le tait, le signaler comme manquant.',
  4
),
(
  'regle',
  'La longueur de débit se dit en centimètres',
  'Le gros bois se débite en 40 ou 50 cm, selon le poêle du client.',
  'Reprendre la longueur dictée telle quelle. Ne jamais l''arrondir ni la supposer.',
  5
),
(
  'regle',
  'Signaler les travaux éligibles en service à la personne',
  'La fente du bois et le petit entretien de jardin ouvrent droit au crédit d''impôt ; l''abattage non.',
  'Ajouter « (travaux éligibles en service à la personne) » au titre de ces lignes-là seulement.',
  6
);

-- =========================================================================
-- 2. Le vocabulaire du métier
-- =========================================================================
--
-- **Tenu court, et le chiffre a été mesuré.** Écrites longues, ces vingt-six
-- entrées faisaient une consigne de 6 044 caractères qui chassait SES CINQ
-- CORRECTIONS du budget — la source la plus précieuse, jetée pour faire tenir
-- la définition de « jumelle ». Une réserve leur est désormais gardée
-- (`PART_RESERVEE_CORRECTIONS`), et ces définitions ont été raccourcies de
-- moitié. Un glossaire sert mieux court : c'est une consigne, pas un cours.
--
-- **L'ordre n'est pas alphabétique, il est conséquentiel.** C'est lui qui
-- décide de ce qui part quand le budget se resserre, et le compte a été fait :
-- avec cinq corrections enregistrées, dix-sept termes sur vingt-six voyagent.
-- Passent donc en premier ceux qui changent un PRIX (les deux techniques
-- d'abattage, l'état de l'arbre qui les impose) ou qui créent une LIGNE
-- détachable (fente, rognage, débroussaillage, échenillage). Le vocabulaire de
-- description vient après : mal compris, il coûte un libellé, pas un montant.

INSERT INTO "termes_metier" ("nature", "intitule", "definition", "consigne", "ordre") VALUES
(
  'mot',
  'Démontage',
  'Abattre par morceaux depuis la cime, quand l''arbre ne peut pas tomber d''un tenant.',
  'Technique d''abattage, jamais une taille. C''est elle qui commande le prix.',
  10
),
(
  'mot',
  'Démontage en rétention',
  'Chaque morceau est retenu à la corde et descendu. Plus lent, nettement plus cher.',
  'La technique la plus coûteuse des trois. Le mot « rétention » la distingue.',
  11
),
(
  'mot',
  'Taille douce',
  'Taille qui suit la structure de l''arbre au lieu de la contraindre. Dite aussi « raisonnée ».',
  'C''est une taille, jamais un abattage.',
  20
),
(
  'mot',
  'Taille de cohabitation',
  'Tailler pour faire coexister l''arbre avec une maison, une toiture, un autre arbre.',
  'Préciser avec quoi : c''est ce qui justifie le travail auprès du client.',
  21
),
(
  'mot',
  'Houppier',
  'Les branches et le feuillage au-dessus du tronc. On l''« éclaircit » pour le vent et la lumière.',
  'Dire « éclaircie du houppier » plutôt qu''« élagage » quand rien n''est réduit en hauteur.',
  22
),
(
  'mot',
  'Charpentière',
  'Grosse branche maîtresse portant la structure. On la contrôle, on l''allège si elle surcharge.',
  'Ne jamais écrire « grosse branche » : le client d''un élagueur connaît le mot.',
  23
),
(
  'mot',
  'Rehaussement',
  'Remonter les branches basses pour dégager un passage, une allée, un massif.',
  'À distinguer de la réduction de hauteur, qui touche le haut.',
  24
),
(
  'mot',
  'Réduction sur bois sain',
  'Raccourcir en coupant là où le bois vit encore, pour que l''arbre cicatrise.',
  'Reprendre la formule entière : c''est une garantie technique, pas une redondance.',
  25
),
(
  'mot',
  'Arbre mort en tête',
  'La cime est morte, le bas vit encore. La partie morte est cassante.',
  'Le signaler : c''est une raison d''intervenir, et elle justifie la technique.',
  15
),
(
  'mot',
  'Champignonné',
  'Attaqué par un champignon lignivore : le bois se creuse de l''intérieur.',
  'Facteur de risque — un arbre champignonné se démonte, il ne s''abat pas au pied.',
  14
),
(
  'mot',
  'Encroué',
  'Arbre ou branche tombée restée retenue dans un autre. Sous tension, dangereux.',
  'Justifie sa propre ligne : c''est du travail et du risque.',
  16
),
(
  'mot',
  'Jumelle',
  'Arbre à deux troncs sur un même pied. La jonction est un point faible.',
  'Préciser lequel : « le tronc de gauche (mort) ».',
  26
),
(
  'mot',
  'Rejets',
  'Repousses partant du pied ou de la souche d''un arbre coupé.',
  'Vont avec la « souche mère » sur la ligne de rognage.',
  27
),
(
  'mot',
  'Rognage',
  'Broyer la souche en place, sur une quinzaine de cm. Laisse un andain de terre et de copeaux.',
  'Même ligne détachable que le dessouchage. Dire ce que ça laisse : le client attend souvent un trou propre.',
  13
),
(
  'mot',
  'Débroussaillage',
  'Nettoyer une zone envahie de ronces et de rejets. Se chiffre à la zone.',
  'Ligne à part, titrée par la zone.',
  17
),
(
  'mot',
  'Échenillage',
  'Retirer les nids de chenilles processionnaires par grimpe, puis les incinérer.',
  'Ligne à part. Compter une grimpe par arbre : c''est ce qui fait le prix.',
  18
),
(
  'mot',
  'Fût',
  'Le tronc, du pied aux premières charpentières. Laissé debout, il fait « hôtel à insectes ».',
  'Quand le patron le laisse, dire à quelle hauteur : c''est un choix expliqué au client.',
  28
),
(
  'mot',
  'Fente du gros bois',
  'Fendre en bûches le gros bois déjà débité.',
  'Toujours sa propre ligne. Dire où vont les bûches.',
  12
);
