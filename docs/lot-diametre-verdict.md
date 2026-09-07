# Le devis qui ne partait pas — ce qui a été trouvé, et ce qui a été fait

*7 septembre 2026. Trois défauts signalés dans un seul message, et un quatrième
trouvé en cherchant les trois premiers.*

---

## Ce que tu as dit, point par point

| # | Ce que tu as signalé | Verdict |
|---|---|---|
| 1 | *« Il m'a proposé la hauteur pour la fente »* | **Juste.** Corrigé |
| 2 | *« Il n'a pas réussi à retranscrire la hauteur dans la case »* | **Juste sur le symptôme, faux sur la cause** — voir ci-dessous |
| 3 | *« Cette case-là ne doit jamais comporter de hauteur »* | **Juste.** Corrigé |
| 4 | *« J'ai bien aimé le petit rond barré, mets-le à chaque fois »* | **Déjà le cas**, et ça ne bouge pas |
| 5 | *« Il n'a pas réussi à m'envoyer le devis »* | **Juste, et c'était le plus grave.** Corrigé |

---

## 1. La hauteur était demandée au mauvais endroit

**Ce qui se passait.** La question vivait sur la ligne du **fendage** depuis le
8 août — et c'est toi qui l'y avais mise : *« pour la fente ils devraient
demander la hauteur de l'arbre et son diamètre »*. La raison tient toujours : ta
grille de fendage se lit « hauteur × diamètre », c'est du volume de bois.

L'erreur n'était donc pas de demander la hauteur. C'était de te la demander
**sous le titre « Fente du gros bois »** : sur un objet qui n'a pas de hauteur.

**Ce qui a été fait.** La question **change de ligne, elle ne disparaît pas.**

| Ta dictée porte | Qui te pose la question |
|---|---|
| un arbre **et** du bois à fendre | l'**arbre** — « Quelle hauteur fait l'arbre ? » |
| du bois à fendre **seul** | la fente, comme avant : il n'y a personne d'autre |
| un arbre **sans** fendage | personne — la hauteur ne décide alors de rien |

**Pourquoi pas la supprimer purement, comme ta phrase le laissait entendre**
(*« pour la fente, on n'a pas besoin d'informations complémentaires »*) : sans
hauteur, la fente n'a plus de case dans sa grille, donc **plus de prix** — et
rien ne te l'aurait dit. C'est le genre de panne muette qu'on s'interdit.

Le prix de la fente ne souffre pas du déplacement : le chiffrage lit **toutes**
tes réponses du chantier, pas seulement celles de la ligne.

*Le fichier : `src/lib/questions-chiffrage.ts`. Le contrôle :
`scripts/test-questions-chiffrage.ts`, qui rejoue ta dictée du 7 septembre.*

---

## 2. Ta réponse n'était PAS perdue — et c'est le point le plus utile du lot

Tu as écrit : *« moi je lui ai écrit la hauteur de l'arbre vingt mètres, il n'a
pas réussi à la retranscrire dans la case »*.

**Le 20 était bien enregistré.** Il est allé dans sa colonne, correctement.
C'est le **nettoyage du libellé** qui l'a mangé, juste avant l'impression :

    « Fente du gros bois — 20 m de haut »   →   « Fente du gros bois de m de haut »

Le nettoyage retire des morceaux de texte quand la donnée est déjà rangée dans
une colonne — pour que ton client ne lise pas deux fois la même chose. Il
retirait le **nombre**, et gardait la phrase autour de lui.

Ce geste avait été écrit pour « — deux souches de 60 cm », où le nombre de tête
est une **quantité**. Sur « — 20 m de haut », où le nombre **est** la mesure, il
produit une phrase amputée.

**Ce qui a été fait.** Un morceau qui ne dit que ce que les colonnes portent
déjà s'en va **en entier**, jamais à moitié. La formulation que tu avais validée
le 30 août — « Dessouchage de souches de 60 cm » — ne bouge pas.

*Le fichier : `src/lib/libelle-client.ts`. Le contrôle :
`scripts/test-libelle-client.ts` — 27 cas, dont le tien.*

---

## 3. Le rond barré ne bouge pas dans l'application

*« Quand on parle de diamètre, s'il peut à chaque fois mettre ce signe-là. »*

C'est **déjà** ce que fait Atlas partout où une mesure de diamètre s'écrit, et
rien n'a été touché. Une seule exception, et elle est expliquée au point
suivant : **sur le PDF**, le signe devient **Ø** au lieu de **⌀**.

Les deux dessinent le même rond barré. Ton client ne verra pas la différence, et
Atlas sait relire les deux formes.

**J'avais laissé UNE ligne sans le signe, tu as tranché l'inverse, et tu as
eu raison.** Je t'avais dit que « Dessouchage de souches de 60 cm » resterait
sans ⌀, parce que « de souches de ⌀ 60 cm » se lit mal et que c'était ta
formulation du 30 août. Ta réponse : *« quand on dit souche de 60, ou 60 au
pied, on parle de diamètre en réalité »*.

**Le signe est donc posé partout où un nombre EST un diamètre :**

| l'endroit | maintenant |
|---|---|
| le devis du client | `Dessouchage de souches de ⌀ 60 cm` |
| une case de fendage | `10 à 15 m de haut · tronc de ⌀ 40 à 50 cm` |
| une case d'abattage | `démontage · tronc de ⌀ 40 à 50 cm` |
| une case de dessouchage | `Souche de ⌀ 40 à 50 cm` |

Tes prix déjà saisis ne bougent pas : seuls les libellés sont réécrits.

**Pas de signe là où le mot est déjà écrit** — la question « Quel diamètre
fait le tronc ? », le titre « Diamètre du tronc » en tête de tes grilles. Le
signe y répéterait le titre.

**Et l'autre moitié de ta phrase était DÉJÀ faite**, je l'ai vérifiée plutôt
que de la supposer : Atlas lit déjà « souche de 60 » et « 60 au pied » comme
des diamètres depuis le 31 août — et il refuse toujours « 60 cm de
circonférence », qui n'en est pas un. Il comprenait ta langue ; il ne te la
rendait pas.

---

## 4. Le devis ne partait pas : c'était le rond barré, et c'était la troisième fois

**Le message exact :** `WinAnsi cannot encode "⌀" (0x2300)`.

Les polices d'un PDF ne connaissent que **224 caractères**. Le ⌀ n'en fait pas
partie — et quand un seul caractère manque, ce n'est pas lui qui saute, c'est
**tout le document** qui refuse de se fabriquer.

**Ce n'était pas la première fois.** Deux autres caractères avaient déjà bloqué
un document, et les deux avaient été réparés un par un, là où ils étaient
apparus :

| le caractère | d'où il venait |
|---|---|
| l'espace fine des montants | l'écriture française des nombres |
| le « moins » d'une remise | la ligne de remise |
| **le ⌀** | la question sur le diamètre |

Réparer le troisième tout seul, c'était attendre le quatrième — et **le
quatrième serait venu d'une de tes dictées**, ou du nom d'un client, pas du
code. Tu aurais eu le même blocage, sur une phrase que personne n'a écrite.

**Ce qui a été fait.** Le contrôle vit maintenant à l'entrée du papier : plus
aucun caractère ne peut empêcher un envoi. Ceux qui ont un équivalent sont
remplacés (⌀ devient Ø) ; ceux qui n'en ont pas sont retirés — **et l'incident
est enregistré**, pour qu'un mot amputé sur un devis ne passe jamais inaperçu.

**Le choix assumé :** le document part quand même. Un devis bloqué te coûte un
chantier ; un signe manquant se voit et se corrige.

*Les fichiers : `src/lib/texte-pdf.ts` (neuf), `src/server/pdf/document-commun.ts`.
Le contrôle : `scripts/test-texte-pdf.ts`, qui compose ton devis du 7 septembre
en entier, avec ton ⌀ dedans.*

---

## Ce que j'ai trouvé en cherchant, et que tu n'avais pas signalé

**Mesurer un texte échoue autant que l'écrire.** Le premier correctif ne
protégeait que le moment où l'encre se pose. Or Atlas calcule d'abord la largeur
du texte pour caler les colonnes de chiffres à droite — et ce calcul plantait
lui aussi, avant même d'écrire. Deux endroits sur cinq restaient ouverts.

---

## Ce que ça a coûté, et ce qui reste

**Ce qui a été vérifié :**

| | |
|---|---|
| ta panne, reproduite à l'identique | oui — avant correction, sur les vraies fonctions |
| suites concernées rejouées | **18 vertes** |
| 4 autres suites | rouges faute de base de données sur ce poste : elles tombent **à l'ouverture**, avant que le code du lot soit atteint |
| la batterie complète | **pas encore lancée — je t'ai demandé le feu vert d'abord** |

**Ce qui reste ouvert, et qui te revient :**

1. **Le feu vert pour la batterie complète.** Tu m'as demandé de prévenir avant :
   tes autres sessions partagent le dossier.
2. **Le ⌀ sur « souches de 60 cm »** — point 3 ci-dessus. Ton arbitrage.
3. **Rien n'est encore sur `main`.** Tant que ce n'est pas fusionné, ton banc
   d'essai continue de servir la version d'avant.

---

# La suite : la dictée de la fiche client (7 septembre, 15 h → 16 h 30)

*Tu as continué d'essayer pendant que je corrigeais, et chaque essai a sorti un
défaut de plus. Ils sont tous réparés. Aucun n'a été trouvé par une suite de
tests : tous par toi.*

## D'abord, ce qu'il faut savoir avant de lire la suite

**Rien de tout ça n'est encore chez toi.** Ton écran de 16 h 20 portait le
bandeau « Version rapide en construction — vous voyez celle d'avant ». Tu as
donc essayé, quatre fois, une version qui ne contient aucune de ces
corrections — c'est normal qu'elle échoue de la même façon.

## 1. « Elle ne comprend pas l'arobase »

**Ce n'est pas la transcription qui comprend mal — c'est Atlas qui lisait mal ce
qu'elle avait écrit.** Et quand cette lecture échoue, c'est le modèle qui prend
la main et invente une adresse plausible. D'où tes trois captures.

Mesuré sur tes phrases exactes, avant correction :

| ce que tu dictes | ce qu'Atlas en tirait |
|---|---|
| `florian point martin zéro neuf sept huit arobase laposte point net` | **`huit@laposte.net`** |
| la même avec « arobas » | **rien du tout** |
| `... arobase la poste point net` | **rien du tout** |
| `flo tiret speed arobase hotmail point fr` | **`flo-speed-hotmail.fr`** |
| `arborea pro arobase outlook point fr` | **`arborea pro@outlook.fr`** |

Le premier est le pire : **ton prénom disparaissait en silence** et le résultat
avait l'air juste.

**Trois causes, et une seule racine :** les chiffres que tu dictes n'étaient pas
convertis pour l'e-mail (ils coupaient l'adresse en deux) ; une seule
orthographe d'« arobase » était reconnue ; et rien ne recollait les morceaux que
la transcription sépare.

**Ce que ça donne maintenant**, sur ces mêmes phrases :

| tu dictes | tu obtiens |
|---|---|
| `florian point martin zéro neuf sept huit arobase laposte point net` | `florian.martin0978@laposte.net` |
| `flo tiret speed arobase hotmail point fr` | `flo-speed@hotmail.fr` |
| `arborea pro arobase outlook point fr` | `arboreapro@outlook.fr` |

Et une **seconde ligne de défense** : ce que le modèle propose n'entre plus que
si ça a la forme d'une adresse. `flo-speed-hotmail.fr` laisse maintenant le
champ **vide** — un champ vide se voit et se corrige ; une adresse plausible
part avec le devis.

Ta règle est codée telle quelle : **aucun espace dans une adresse, jamais.**

## 2. L'adresse coupée par des virgules

| tu dictes | avant | maintenant |
|---|---|---|
| `27730 Villennes` | `27 730 Villene` | `27730 Villene` |
| `12 rue Bérangère 27500 Mâcon` | `12 rue Bérangère, 27 500, Macon` | `12 rue Bérangère, 27500 Macon` |
| `10 rue des marguerites` | `Dierud et Marguerite` | **inchangé** |

La virgule entre le code postal et la ville vient du modèle : elle est retirée.
**Celle qui suit la rue reste** — c'est du français, une enveloppe s'écrit ainsi.

**« Dierud et Marguerite » pour « rue des marguerites », je ne peux pas le
réparer**, et je préfère te le dire que de te laisser l'essayer : c'est une
faute d'oreille de la transcription, pas du code. Tu la corriges à la main.

## 3. « 60 cm de circonférence » et il redemandait le diamètre

**Tu as raison, et le refus était pourtant volontaire.** Atlas refusait de
prendre une circonférence pour un diamètre — confondre les deux **triple** la
mesure et range le prix trois cases plus loin dans ta grille.

Mais refuser ne suffisait pas : **sur un tronc debout, on ne mesure pas un
diamètre, on passe un ruban autour.** C'est ça que tu dis, et c'est ça qu'il
faut savoir utiliser.

Ce n'est pas une devinette, c'est une division : `diamètre = tour ÷ π`.

**60 cm de tour font 19 cm de tronc.** L'écart avec 60 dit à quel point s'en
passer coûtait cher. Ton chêne ne pose plus aucune question.

Et si tu donnes les deux, **le diamètre l'emporte toujours**.

## 4. « (1 arbre) » dans le libellé

Ta règle : la quantité a sa colonne, elle n'a rien à faire dans le texte.

La règle existait depuis le 30 août — **elle ne regardait que la fin du
libellé**. Une parenthèse posée au milieu passait sans être vue. Maintenant
toutes sont examinées, et celle qui apprend quelque chose reste :
« Taille **(haie mixte)** » ne bouge pas.

## 5. Le ⌀ qui ne passe toujours pas

C'est le premier défaut de la journée, réparé depuis ce matin. **Il n'est pas
chez toi**, comme le reste. Rien à refaire de ton côté.

## Ce qui reste, et ce que j'attends de toi

| | |
|---|---|
| suites concernées | **18 vertes** |
| types, lint | propres |
| batterie complète | **pas encore lancée** — j'attends ton feu vert |
| sur `main` | **rien** — c'est pour ça que tu vois toujours l'ancienne version |

**Il me faut une phrase de ta part :** je peux lancer la batterie et pousser sur
`main` ? Sans ça, tu continueras à essayer une version qui ne contient aucune de
ces corrections.

## Et ta question sur la note vocale

Tu demandais si tu pouvais supprimer une note vocale envoyée par erreur.

**Oui, mais pas depuis l'endroit où tu étais.** La suppression existe sur
l'écran de la note vocale du chantier, avec un « Annuler » qui la rend si tu te
ravises. Depuis le rond de dictée, la poubelle n'apparaît que **pendant**
l'enregistrement — une fois envoyée, elle disparaît.

Si tu ne l'as pas trouvée, c'est un défaut à part entière : chez toi, ce qui est
important doit être visible. **Dis-moi depuis quel écran tu cherchais** et je te
fais une maquette du geste manquant avant d'y toucher.

---

# Le soir du 7 septembre : trois fils de plus

## 6. Un devis accepté ne se disait nulle part — c'est corrigé

Ta demande : *« il faut aussi rajouter une notification lorsqu'un client accepte
un devis, elle doit apparaître en haut dans les retours client ! »*

**Ce que j'ai trouvé, et je te le dis parce que c'était volontaire :** Atlas
**taisait** exprès une acceptation sur l'une des dates que tu proposes. Le
raisonnement écrit dans le code : « ça ne surprend personne, et ça noierait les
refus et les demandes de correction, qui, eux, appellent un geste ».

**Il oubliait l'essentiel : c'est la nouvelle que tu attends.** Un chantier
gagné ne s'apprend pas en ouvrant une fiche.

| avant | maintenant |
|---|---|
| refus, correction, date contre-proposée | **plus toute acceptation** |
| titre unique « Autre date proposée » | « **Devis accepté** » quand il a pris une de tes dates |

**« En haut » ne demandait aucun code** : les cartes sont rangées par date de
réponse, la plus récente d'abord. Une acceptation qui vient d'arriver est en
tête toute seule.

## 7. Les deux flèches qui tournaient en rond — c'est corrigé

Ta remarque : *« j'appuie une fois sur le retour du devis, j'arrive sur la fiche
client, et si je refais retour arrière je retourne sur le devis et non sur la
page chantier. »*

**C'était une boucle, et elle venait de deux règles que tu avais posées le
31 août** — justes chacune de son côté :

| ta règle | ce que ça donnait |
|---|---|
| la flèche du devis mène à la fiche client, toujours | devis → fiche |
| « je veux revenir au devis » une fois la fiche remplie | fiche → devis |

Mises bout à bout, les deux flèches se pointaient l'une l'autre. **Aucune sortie**
sans fermer l'onglet.

**Ce que j'ai gardé, et c'est la moitié qui compte :** quand tu **enregistres** la
fiche, tu reviens sur ton devis — complété. C'est là que ta règle a du sens.
Ce qui change, c'est seulement la **flèche** : elle sert à renoncer. Renoncer,
c'est sortir — donc la liste des chantiers.

## 8. Ta note vocale : le geste existe déjà, dans l'autre sens

Ta question : *« déplacer la note vocale de droite vers la gauche, ça ferait
apparaître la suppression ? »*

**Il existe déjà.** Et voilà pourquoi tu ne l'as pas trouvé :

| | le geste |
|---|---|
| sur la note vocale | de **bas en haut** |
| dans la liste des chantiers | vers la **gauche** |

**Deux sens pour le même geste, dans la même application.** Tu cherchais celui
que tu connais.

**Une planche est prête, trois onglets, à essayer au doigt :** l'actuel, le tien,
et une **corbeille visible** sans aucun geste à découvrir.

**Cette troisième n'est pas là pour faire nombre.** C'est ta propre règle du
5 septembre : *« la plupart des patrons qui vont utiliser l'app sont des vieux
qui ont du mal à se servir de leur téléphone »* — un glissement ne s'apprend pas
tout seul, quel que soit son sens. Les deux règles se contredisent, et c'est toi
qui tranches.

**Je te donnerai l'adresse dès que ce sera en ligne** — pas avant : une adresse
qui répond 404 t'a déjà coûté un aller-retour, et la planche ne sera publiée
qu'une fois poussée.

## Où on en est

| | |
|---|---|
| suites concernées rejouées | **32 vertes**, aucune rouge |
| types, lint | propres |
| batterie complète | **pas lancée** — tu m'as dit qu'elle tournait ailleurs |
| sur `main` | **rien** |

**Trois choses m'attendent, de ta part :**

1. quand la batterie est libre, ton feu vert ;
2. l'autorisation de pousser sur `main` — sans elle tu continues d'essayer la
   version d'avant ;
3. **1, 2 ou 3** pour la note vocale, quand tu auras vu la planche.

---

# Ta réponse « 2 », et pourquoi le diamètre ne bouge toujours pas

## Le geste : fait

Tu as répondu 2. La note se glisse maintenant **vers la gauche**, comme dans la
liste des chantiers. Elle allait vers le haut depuis le 30 août — deux sens
pour le même geste dans la même application, et tu cherchais celui que tu
connais.

## Mais ça ne règle pas ton essai, et je préfère te le dire

*« Aujourd'hui, lever la note vocale ne propose pas de la supprimer, je viens
d'essayer. »* Tu as raison, et la cause n'est pas le sens du geste.

**Sur cet écran-là, après l'envoi, il n'y a aucune note affichée.** Ni objet, ni
glisseur : seulement le micro au repos et « Atlas prépare votre devis… ». Le
geste corrigé n'a donc rien à saisir.

**Ce qui manque est un objet, pas un geste :** faire apparaître la note que tu
viens d'envoyer pendant que le devis se prépare, et que la retirer **interrompe**
la préparation. Ça touche la chaîne du devis — je te fais une maquette avant d'y
toucher, comme d'habitude.

## Le diamètre de la fente : rien n'a changé chez toi, et c'est normal

Tu as rechargé ton espace, et c'est bien. **Mais seule la maquette est partie sur
`main`.** Le code — le ⌀ du PDF, la hauteur sur l'arbre, la dictée, la
circonférence, les parenthèses, les deux flèches, la notification d'acceptation —
est prêt, vert, et **toujours sur ce poste**.

Tant qu'il n'est pas poussé, ton espace continue de servir la version d'avant,
quel que soit le nombre de rechargements.

**Ce qui bloque, et c'est la seule chose :** tu m'as demandé de ne pas lancer la
batterie, elle tourne ailleurs. Je ne pousse pas un lot de cette taille sans
elle — c'est la règle du dépôt, et elle t'a déjà évité des régressions.

**Deux mots de ta part suffisent**, l'un ou l'autre :

| | |
|---|---|
| *« la batterie est libre »* | je la lance, et je pousse si elle est verte |
| *« pousse sans la batterie »* | je pousse tout de suite, et je te dis ce que ça risque |
