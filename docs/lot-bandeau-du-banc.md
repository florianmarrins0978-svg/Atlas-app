# Le bandeau du banc — ce qui n'allait pas, et ce qui reste

**10 septembre 2026.** Votre demande : *« Répare le bandeau du banc. »*

---

## Ce qui se passait

Le bandeau **« version rapide en construction »** — celui qui vous prévient que
votre banc est en train de bâtir — s'affichait sur le serveur des tests, qui
n'avait plus rien à bâtir. Comme il pousse tout le contenu vers le bas,
**vingt-six suites** mesuraient des écrans décalés et accusaient chacune un
écran différent.

## La racine

La règle croyait qu'un serveur qui sert une version **bâtie** a forcément
`NODE_ENV=production`. C'est faux : cette variable n'est posée que si elle
manque, et la batterie en pose une autre. Le code demandait donc **à
l'environnement** s'il avait été bâti — et l'environnement pouvait mentir.

**Ce qui la remplace :** un fait figé à la construction. Le code servi sait
désormais tout seul s'il a été bâti, et aucune variable ne peut lui faire dire
le contraire. C'est la forme qu'employait déjà l'écran des Réglages.

**Éprouvé sur la panne elle-même**, pas sur une panne imaginée : même serveur,
même variable posée exprès, le fichier d'avancement sur le disque.

| | Avant | Après |
|---|---|---|
| l'adresse d'état | `{faits:2, total:40, …}` | `null` |
| le bandeau | affiché | absent |

## Ce que ça change, en chiffres

| | Avant | Après |
|---|---|---|
| suites navigateur | 114 / 140 | **121 / 140** |
| suites base | 338 / 339 | 338 / 339 |
| la suite du bandeau | 4 / 6 | **6 / 6** |

Sept suites se sont éteintes avec lui : le bandeau, la connexion figée, Face ID,
la fiche client, la grille des prix, les cases réglables, les onglets.

## CE QUE JE VOUS AI DIT HIER ET QUI ÉTAIT FAUX

J'ai écrit : *« un bandeau s'affiche là où il ne devrait pas… c'est ce poste, le
produit n'y est pour rien »*. **Le produit y était pour quelque chose.** Le
défaut aurait pu paraître sur votre banc, servi avec cette variable posée à la
main. Corrigé dans le dépôt (`ARCHITECTURE.md` §317), et écrit ici pour que
personne ne reparte sur ma conclusion d'hier.

## Ce qui reste rouge, et qui n'a rien à voir

**Dix-neuf suites**, et ce ne sont plus les mêmes causes — chacune la sienne :
un écran qui n'annonce pas le mode sans clé, une recherche client qui ne filtre
pas, un geste recouvert. Elles sont notées dans `TODO.md` : elles ne se
soignent pas d'un seul correctif, et je ne les ai pas ouvertes dans ce lot.

**Tant qu'elles sont là, la batterie ne peut pas rendre un vert complet.** Je ne
vous le présente donc pas comme tel.
