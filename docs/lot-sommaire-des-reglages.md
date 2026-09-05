# Le sommaire des réglages — ce qui a été fait, et ce qui a été refusé

**6 septembre 2026.** Premier lot de la reprise des Réglages. Il porte votre
consigne du 5 septembre :

> *« Imagine que la plupart des patrons qui vont utiliser l'app sont des vieux
> qui ont du mal à se servir de leur téléphone ; il faut que ce soit hyper
> intuitif et simple. »*

**La planche à ouvrir :**
`https://florianmarrins0978-svg.github.io/Atlas-app/sommaire-des-reglages.html`

Elle se manipule : le téléphone défile, les boutons **Après / Avant** basculent
sans bouger le doigt, et **Voir sur Nuit** montre les deux pôles.

---

## Ce qui a été tranché à votre place

Vous avez demandé que les deux planches en attente soient décidées plutôt que
reposées une troisième fois. Les voici, et **ce ne sont plus des questions**.

| Question | Depuis | Verdict |
|---|---|---|
| « Moins de mots » — faut-il retirer les phrases sous les titres des Réglages ? | 19 août, `docs/QUESTIONS.md` §23 | **Oui, les douze.** Codé |
| Planche 96 — quel écran Équipe ? | 26 août | **Proposition C**, le titre pose la question. **Pas codé** : c'est le sixième lot |

**Pourquoi le premier a été tranché ainsi.** Le motif était déjà dans votre
propre question du 19 août : *une phrase d'explication ne répare jamais un
mauvais titre, elle le cache*. Donc on corrige les titres et on retire les
phrases — jamais l'inverse.

---

## Verdict, point par point

### 1. Les douze phrases grises sont parties

| | |
|---|---|
| **Fait** | oui |
| **Le fichier** | `src/lib/rubriques-reglages.ts`, `src/app/reglages/Sommaire.tsx` |

Le champ qui les portait n'existe plus du tout. Sa propre description disait :
*« jamais vide : une rubrique sans explication oblige à l'ouvrir pour savoir si
c'est la bonne »* — c'était l'aveu du défaut, pas sa réparation.

### 2. Quatre titres ont changé de mot

| Avant | Après | Ce qui le fonde |
|---|---|---|
| Intégrations | **Mon agenda** | c'était déjà le titre de l'écran derrière. La phrase promettait « calendrier, comptabilité et services connectés » : deux des trois n'ont jamais existé |
| Connexion | **Mot de passe** | l'écran ne fait que ça — le mot de passe, Face ID qui le remplace, se déconnecter partout |
| Apparence | **Couleurs** | on y choisit huit chartes de couleurs, rien d'autre |
| Sécurité & données | **Mes données** | aucune sécurité ne s'y règle : on y télécharge un fichier, et l'écran dit lui-même que l'effacement du compte n'existe pas encore |

**Le mot suivait l'écran, mais l'icône ne suivait pas le mot.** « Mon agenda »
a gardé quelques minutes la **pièce de puzzle** d'« Intégrations » — la
métaphore d'informaticien qu'on venait justement de retirer du libellé. C'est
un calendrier depuis. **Aucun test ne l'a vu ; la capture, si.**

### 3. Ce qui se lit a grossi

| Quoi | Avant | Après |
|---|---|---|
| le nom d'une rubrique | 17 px | **19 px** |
| « L'ENTREPRISE », « MOI » | gris, **3,3** de contraste | encre douce, **8,0** |
| la ligne que lit un salarié | gris | encre douce |

**Votre palette n'a pas été touchée.** Le gris est le vôtre, relevé sur le site
d'Arborea, et le contrôle des chartes refuse délibérément d'y poser un seuil.
Ce qui change, c'est **où on l'emploie** : plus pour du texte à lire au soleil.

Mesuré sur vos huit chartes, ce gris tient de **2,85** (Moka) à **3,59**
(Brume) là où la norme demande 4,5. **Les deux seules qui passent sont Nuit et
Sylve** — celles dont vous vous étiez plaint le 22 août, et qui ont été
corrigées ce jour-là.

---

## Ce que ça change, en chiffres

Relevés dans un navigateur sur l'écran réel, à 390 × 664, avant et après,
sur les deux pôles — `scripts/capture-sommaire-reglages.mts`.

| | Avant | Après |
|---|---|---|
| hauteur de l'écran | 1 310 px | **1 145 px** |
| ce que ça fait en écrans de 664 | 1,97 | **1,72** |
| rubriques atteintes sans défiler | 6 | **8** |
| hauteur d'une ligne | 56 à 84 px | **56 px partout** |
| mots à l'écran | 89 | **30** |

**La ligne la plus parlante est la quatrième.** Avant, les lignes n'avaient pas
toutes la même hauteur : celle dont l'explication tenait sur deux lignes —
« Équipe » — poussait à 84 px. Une liste au pas irrégulier se parcourt moins
vite qu'une liste au pas égal, et cela ne se voit pas en lisant le code.

---

## Ce qui a été REFUSÉ, et ce que ça aurait coûté

**1. Renommer « Tarifs & catalogue » et « Devis & factures ».** Ce sont des
mots de votre métier, ils sont justes, et **neuf suites les lisent**. Les
retoucher aurait coûté une demi-journée pour un gain nul.

**2. Serrer les lignes pour tenir en un seul écran.** Il aurait fallu descendre
les rubriques sous 56 px — au-delà de la cible de 44 px d'Apple, et c'est
**toute la ligne** qui se touche aujourd'hui. Gagner un demi-écran se serait
payé au pouce, contre votre consigne même.

**3. Retirer la version du bas de l'écran.** C'est votre règle : ce n'est pas
un réglage, c'est la réponse à « est-ce que mes correctifs sont arrivés ».

**4. Toucher aux phrases grises que vous aviez déjà fait retirer le 31 août.**
Elles ne sont pas revenues ; elles ne reviendront pas.

---

## Ce que ça NE fait pas, et il faut le dire

**L'écran ne tient toujours pas en une seule fenêtre.** 1 145 px contre 664.
Douze rubriques à 56 px, plus la version en bas, font davantage. Annoncer le
contraire aurait été un mensonge de trois lignes.

Ce qui a vraiment changé, c'est qu'on **atteint les huit rubriques de
l'entreprise sans bouger le doigt** — avant, il en fallait six et un coup de
pouce pour voir les deux dernières.

---

## Deux contrôles ont été RETOURNÉS, pas réparés

C'est la règle du dépôt : *une suite qui réclame ce que le patron a fait
enlever rend son écran impossible à changer.*

**1.** `scripts/test-rubriques-reglages.ts` exigeait que chaque rubrique porte
une explication de plus de quatre lettres. Il a été remplacé par son contraire
utile : **aucune rubrique ne reprend un des quatre mots retirés**. Ce contrôle
a été confronté au défaut qu'il prétend attraper — remis « Intégrations » à la
main, il rougit ; remis « Mon agenda », il repasse au vert.

**2.** Les listes de rubriques y étaient écrites **par libellé**. Elles sont
désormais **par adresse**. Ce n'est pas seulement plus robuste, c'est plus sûr :
le contrôle qui vérifie qu'un salarié ne reçoit aucune rubrique de l'entreprise
se serait **désarmé tout seul** au premier renommage — « Intégrations » devenue
« Mon agenda » ne figurait plus dans sa liste d'interdits, et la rubrique aurait
pu sortir chez un salarié sans que rien ne rougisse.

---

## Les chiffres de la batterie

`npm run verifier:avant-livraison`, jouée en entier sur votre poste.

| Étape | Résultat |
|---|---|
| Types (`tsc`) | **vert** |
| Lint | **vert** — 0 erreur, 18 avertissements, tous antérieurs |
| Construction | **verte** |
| Mémoire du dépôt | **verte** |
| Suites base de données | **304 / 314** |
| Suites navigateur | **117 / 128** |
| Connexion derrière un proxy | **n'a pas mesuré** — voir plus bas |

**Aucun des 21 rouges n'appartient à ce lot**, et ce n'est pas une supposition :
les suites du lot sont vertes, nommément.

| Suite | Résultat |
|---|---|
| `test-rubriques-reglages` | 16 / 16 |
| `test-reglages-gardes` | verte |
| `test-agenda-reglages-e2e` | verte — **c'est elle qui éprouve le renommage** : elle part du sommaire, clique la rubrique, et attend le titre « Mon agenda » de l'autre côté |
| `test-reglages-e2e`, `test-chartes-e2e` | vertes |

*(Une précision, parce que je l'avais d'abord écrite de travers :
`test-aucune-barre-de-defilement-e2e` est verte et passe bien par ces deux
écrans, mais elle les atteint **par leur adresse** — « mon agenda » et « mes
données » y sont ses propres étiquettes, pas les libellés de l'écran. Elle ne
prouve donc rien du renommage.)*

**Les dix rouges en base** sont ceux qui rougissent déjà sans ce lot, relevés le
4 septembre : neuf de machine (`test-ouvrir-port`, `test-verrou-construction`,
`test-relance-construction`, `test-fiche-pendant-relance`,
`test-mise-a-jour-role-db`, `test-roles-capacites-db`,
`test-salarie-planning-lecture-seule-db`, `test-seed-conserve-identifiants`,
`test-boutons-arrondis`) et **`test-mode-emploi`**, qui cherche « Par SMS » là
où l'écran dit « SMS » — **le correctif est déjà sur `main`**, pas encore ici.

**Les onze rouges au navigateur** sont sur le devis, le planning, le calendrier,
la fiche client, Face ID et la TVA — les zones reprises par d'autres lots, déjà
consignées dans `TODO.md` le 5 septembre. Aucun ne touche les Réglages.

### La dernière étape ne mesure rien sur votre PC, et ce n'est pas ce lot

`verifier:connexion` annonce *« Le serveur n'a pas répondu en dix minutes »*.
**C'est faux, et c'est le contrôle qui se trompe de coupable :** le serveur ne
met pas dix minutes, il **meurt en une seconde**. Vérifié en le relançant à la
main hors du contrôle — il démarre et répond en quelques secondes.

La cause : ce contrôle lance le serveur par `npm.cmd`, et il le lance avec sa
sortie **jetée** (`stdio: "ignore"`). Le processus sort en code 1 sans un mot,
et le contrôle en déduit une lenteur. Les autres étapes de la batterie ont déjà
été corrigées de ce piège Windows le 2 septembre (`scripts/_processus.ts`) ;
celle-ci ne l'a pas été.

**Ce que ça veut dire pour vous :** l'étape qui attrape le
« Invalid Server Actions request. » **n'a rien vérifié**, ni pour ce lot ni pour
les précédents joués sur ce poste. Elle est réparée dans un lot à part — mêler
une réparation d'outillage à un lot d'écran rend les deux illisibles.

---

## Ce qui reste ouvert

| Quoi | Qui tranche |
|---|---|
| Le lot 2 — l'en-tête unique sur les quatre écrans qui se dessinent le leur (`agenda`, `prix`, `prix/mesures`, `vocabulaire`), et le bouton de l'assistant rendu partout | nous, à faire |
| Le lot 3 — « Devis & factures », 1 267 lignes en un seul écran | nous, à faire |
| L'écran **Équipe** (proposition C, décidée ici) | codé au lot 6 |
| Le raccordement iCloud : il demande d'aller sur `account.apple.com` générer un « mot de passe pour les apps » et de recopier seize lettres | **vous** — c'est le seul endroit des Réglages où la tâche elle-même est hors de portée, et la simplifier demanderait de changer ce qu'on demande, pas comment on le demande |

**Un point qui n'est pas dans les lots :** le texte secondaire de toute
l'application s'écrit en 9,5 et 11,5 px dans ce même gris. Les Réglages ne sont
qu'un écran parmi vingt. Le corriger partout est un lot à lui seul — pas une
retouche à glisser dans celui-ci.
