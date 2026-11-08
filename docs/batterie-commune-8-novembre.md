# Batterie commune du 8 novembre : trois lots, une seule batterie

Ta demande : *« Il y a 3 sessions qui attendent de jouer une batterie. Fusionne les 3 et joue qu'une seule batterie pour les 3. »*

Branche : `claude/eager-cori-g7qv8y`, partie de `main` (`eb952c24`), où les deux autres lots ont été fusionnés.

## Les lots

| Session | Lot | Migrations | Ce que la fusion a demandé |
|---|---|---|---|
| jolly | Le téléphone du chantier, l'import depuis la fiche d'un client, les entrées et sorties de la banque, « Autre chose » pour un client facturé ailleurs, la fiche de l'espace | 0176, 0177 | rien |
| epic | Le crédit d'impôt de tes clients (lots 1 et 2 : les heures du jour, l'attestation de janvier), l'avance immédiate de l'Urssaf | 0178, 0179, 0180 | rien |
| la mienne | Mon année, Vos prix, le plafond de la franchise dans la feuille de l'objectif, le HT des factures importées | 0176, devenue **0181** | sur Terminés, la ligne des attestations passe avant celle de Mon année (une action datée avant un tableau de bord) ; les types de la fiche de l'espace écrits, sans quoi la vérification des types refusait la suite de jolly |

Paragraphes d'`ARCHITECTURE.md` : les trois lots avaient pris le §569. Jolly garde §569 à §573, epic passe à **§574 à §577**, le mien à **§578**. Chaque renvoi déplacé a été relu sur les lignes de son lot seulement, jamais remplacé à l'aveugle.

## Les mesures

| | Base | Navigateur | Connexion derrière un proxy |
|---|---|---|---|
| batterie | 592 sur 599 | **215 sur 215** | verte |
| rattrapage | **599 sur 599** | **14 sur 14**, dont Mon année | |
| seconde fois | les sept rouges, verts | | |

Types, style, construction, mémoire du dépôt, fournisseurs d'IA et données de démonstration verts à la batterie ; types, style et données de démonstration verts au rattrapage.

La suite navigateur de Mon année est neuve, et je ne l'ai pas encore vue rougir sur un écran cassé. Ses cas « la ligne est absente » ne mesurent pas un vide : sur le même écran, le cas « allumée » trouve la ligne.

## Ce que la batterie a trouvé, et ce qui a été fait

| Rouge | D'où | Ce qui a été fait |
|---|---|---|
| L'écran Mon année lisait la base avant de savoir qui le regarde | Mon année | la question « est-ce le patron ? » passe avant la lecture, comme dans toute rubrique de l'entreprise |
| Mon année n'était pas préparé d'avance | Mon année | ajouté aux écrans compilés au démarrage de ton espace : sans cela, la première ouverture attend |
| La consigne de lecture des pièces importées recopiait la phrase de la franchise | Mon année | elle cite les deux articles (CGI et CIBS) sans recopier la phrase : celle de tes factures ne s'écrit qu'à un endroit |
| Deux boutons à coins carrés : la ligne de Mon année sur Terminés, les deux cases du relevé | Mon année, et la banque (jolly) | **ce sont des cartes de tes planches**, à leur rayon de planche : déclarées comme telles, bornées à leur repère. Tout autre bouton carré fait toujours rougir |
| Le mode d'emploi citait un ancien texte d'« Autre chose » et l'ancien lien de l'import | jolly | les deux fiches suivent le code d'aujourd'hui |
| Le logo des services à la personne manquait à la liste des fichiers stockés | epic | **un vrai oubli** : la vérification de la sauvegarde ne le regardait pas. Ajouté |
| La base devait refuser un code Urssaf écrit en clair | le test d'epic | **le test se trompait** : la base refuse bien (vérifié à la main), mais le test cherchait le nom de la garde dans un message qui ne le porte plus. Il le lit là où il est |
| Aucune suite navigateur n'ouvrait Mon année | Mon année | **une suite écrite** : fixer l'objectif, allumer et éteindre la ligne de Terminés (éteinte par défaut, ta règle), l'avertissement de la franchise. Sans elle, le rattrapage exigeait une seconde batterie entière |

## Ce qui a été dit et se révèle faux

- Avant la batterie, je n'avais joué que les suites de Mon année, et je t'avais dit le lot prêt. Quatre contrôles qui surveillent tous les écrans le refusaient (les gardes de Réglages, le préchauffage, la phrase de la franchise, les boutons) : c'est la batterie qui les a trouvés, pas moi.

## Ce qui reste, et qui le tranche

| | Qui |
|---|---|
| Regarder sur ton espace : Mon année (l'objectif, l'interrupteur, Vos prix), la ligne sur Terminés, l'import depuis la fiche d'un client, les entrées et sorties de la banque, le crédit d'impôt et l'avance immédiate | **toi**, une fois ton espace à jour |
| Une facture importée de 2027 portera l'article L. 233-3 au lieu du 293 B : la lecture sans IA ne le reconnaît pas encore, et laisse alors le HT vide (jamais faux) | **moi**, au prochain lot de l'import |
