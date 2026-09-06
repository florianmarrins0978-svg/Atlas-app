# L'accueil — ce que j'ai trouvé, et ce que je propose

**Le 6 septembre 2026. Rien n'est codé : aucun fichier de `src/` n'a été touché.**

**Trois planches, et elles ne disent pas la même chose :**

| | |
|---|---|
| **Vos deux registres** — élégante, minimaliste, avec vos clients | `https://florianmarrins0978-svg.github.io/Atlas-app/l-accueil-elegant.html` |
| **Ma journée** — repartie de zéro · **vous l'avez refusée** | `https://florianmarrins0978-svg.github.io/Atlas-app/ma-journee.html` |
| **À bout de bras** — votre écran d'aujourd'hui, rendu lisible | `https://florianmarrins0978-svg.github.io/Atlas-app/l-accueil-a-bout-de-bras.html` |

---

## Le défaut que vous avez trouvé — et il est dans l'APPLICATION

**Vos mots, le 6 septembre :** *« les autres devis à regarder, on peut cliquer
dessus pour agrandir la fenêtre mais on peut pas la refermer »*.

**Vous avez raison, et ce n'est pas un défaut de la maquette.** Dans
l'application, `src/app/Notifications.tsx` ligne 564 : l'appui pose
`setToutVoir(true)`, et il n'existe aucun retour. Pire, le bouton **disparaît**
une fois déplié — il ne reste plus rien à toucher. La seule façon de replier est
de quitter l'écran et d'y revenir.

C'est votre propre règle du 5 septembre, « une erreur se rattrape » : un geste
sans retour en est une. La planche porte maintenant **« Replier »** — un verbe,
un mot. **À corriger dans l'application au même endroit**, et c'est deux lignes.

---

## D'abord, une chose que vous devez savoir avant de me lire

**Une autre proposition d'accueil vous attend depuis le 3 septembre**, faite par
une autre de vos sessions :
`https://florianmarrins0978-svg.github.io/Atlas-app/accueil-ce-qui-vous-attend.html`

Vous lui avez répondu une fois — *« ça ressemble à un rappel »* —, elle a
corrigé le soir même, et depuis, rien. Je ne l'ai pas refaite et je ne l'ai pas
jetée.

| | |
|---|---|
| **celle du 3 septembre** | change ce que l'écran **montre** — le retard à gauche, ce qui attend posé sur le fil, l'action rangée à droite |
| **celle-ci** | change ce qu'on arrive à **lire** dessus, sans rien déplacer |

Les deux peuvent se faire ensemble. Si l'une des deux ne vous va pas, dites-la.

---

## Ce que j'ai trouvé

### 1. Votre consigne du 5 septembre n'a pas atteint l'accueil

**C'est le point le plus important, et il est vérifiable en une ligne.**

Votre phrase — *« des vieux qui ont du mal à se servir de leur téléphone »* — a
été appliquée aujourd'hui même, le 6 septembre à 16 h 51, et vous l'avez
acceptée. Le passage a grossi le petit texte de 9,5 à 11 px et de 11,5 à 13.

**Il n'a touché que les Réglages.** L'accueil écrit ses tailles à la main plutôt
que de passer par le jeton commun : elles n'ont donc pas suivi.

| Ce qui est resté petit | Où c'est écrit |
|---|---|
| l'état de chaque chantier — 9,5 px | `src/app/ListeChantiers.tsx:319` |
| le mois sur le fil — 9,5 px | `src/app/ListeChantiers.tsx:29` |
| « En cours » — 9,5 px | `src/app/EcranChantiers.tsx:341` |
| « Vos clients » — 9,5 px | `src/app/EcranChantiers.tsx:232` |
| le lieu du chantier — 11,5 px | `src/app/ListeChantiers.tsx:314` |
| « Adresse non renseignée » — 11,5 px | `src/app/ListeChantiers.tsx:303` |
| la date d'envoi — 11,5 px | `src/app/ListeChantiers.tsx:328` |

Le document de ce lot-là annonce « l'accueil : 664 px → 664 px, coût 0 ». C'est
exact, et c'est justement le signe : le coût est nul parce que **rien n'a
changé**.

### 2. L'or de vos lignes d'état ne se lit pas — et le remède est déjà dans le dépôt

Vous avez demandé le 16 août que **toutes** les lignes d'état soient dorées :
*« pour tous les messages je veux que cette partie-là apparaisse en doré »*.
C'est fait, et ça ne se discute pas.

**Mais ce n'est pas le bon or.** Mesuré sur votre charte Origine :

| | Contraste sur le fond crème | Ce qu'un mot demande |
|---|---|---|
| l'or employé aujourd'hui — `or` | **2,77** | 4,5 |
| l'or prévu pour les mots — `orTexte` | **4,59** | 4,5 |

`orTexte` existe depuis le 4 septembre (`src/lib/design-tokens.ts:151`) : c'est
**le même or, assombri juste ce qu'il faut**, dérivé automatiquement pour
chacune de vos huit chartes. L'accueil ne l'emploie nulle part — il emploie
encore `or` à quatre endroits : la ligne d'état, « Vos clients », « Retirer »,
« Annuler ».

Ce n'est donc pas revenir sur votre décision : c'est la tenir.

### 3. Le gris de vos lieux ne se lit pas non plus

Le lieu d'un chantier et la date d'envoi sont en gris `muted` : **3,32** de
contraste. En plein soleil, sur un écran sale, à bout de bras, ce n'est pas lu.

### 4. Ce qu'il faut viser du doigt fait 14 pixels

Mesuré sur l'écran d'aujourd'hui, reproduit au pixel près : la plus petite chose
qu'on doive toucher est **« Vos clients », 14 px de haut**. Il en faut 44.

Deux autres sont dans le même cas, et elles sont sur chaque bandeau de
notification : « Reprendre le devis » et « J'ai vu » n'ont aucun rembourrage
(`src/app/Notifications.tsx:503` et `539`) — **21 px de haut**.

### 5. Sur un matin chargé, « Vos chantiers » n'en montre aucun

Mesuré à 390 × 664, la barre du bas déduite, sur un matin à trois notifications :
**la liste commence à 770 px** dans une fenêtre qui en fait 596. Elle est hors
de l'écran. On ne voit **rien** du premier chantier — ni son nom, ni son lieu.

*(Cette mesure recoupe celle de la session du 3 septembre, qui annonçait 300 px
de départ sur un matin à deux notifications.)*

### 6. Une flèche décorative échappe à votre propre contrôle

Vous avez demandé le 25 août : *« arrête de mettre des flèches, c'est moche »*,
et `scripts/test-aucune-fleche.ts` les refuse depuis. **Il en reste une sur
l'accueil**, au bout de « Vos clients » (`src/app/EcranChantiers.tsx:236`).

Elle passe parce qu'elle n'est pas écrite avec le caractère « › » : c'est un
carré dessiné et tourné à 45°. Le contrôle cherche des caractères ; il ne peut
pas la voir.

---

## Ce que je propose

**Un seul parti pris : ne rien déplacer, tout rendre lisible.** Vous avez payé
cet écran en maquettes et en allers-retours ; ce qui lui manque n'est pas une
autre idée, c'est d'être lu par quelqu'un qui n'aime pas les téléphones.

### Ce qui grossit et sort du gris

| | aujourd'hui | proposé |
|---|---|---|
| l'état d'un chantier | 9,5 px · or à 2,77 | **12 px · or à 4,59** |
| le lieu | 11,5 px · gris à 3,32 | **14 px · encre douce à 8,04** |
| la date d'envoi | 11,5 px · gris | **13 px · encre douce** |
| le mois sur le fil | 9,5 px · gris | **11 px · encre douce** |
| « En cours », « Vos clients » | 9,5 px | **11 px** |
| le nom du chantier | 19 px | 19 px — **inchangé** |

### Ce qui part, et ce que ça coûte

| Ce qui part | Ce que ça rend | Ce que ça coûte |
|---|---|---|
| **« ATLAS »** en haut de l'écran | 39 px sur 596 | le nom de l'application quitte l'accueil. Il reste dans les Réglages et sur l'écran de lancement. C'est le nom de l'application, écrit en haut de l'application qu'on vient d'ouvrir |
| **la bande du compteur** : « En cours 3 » rejoint « Vos clients » sur une ligne | 34 px | vos deux éléments, vos mots, votre ordre — mais côte à côte au lieu d'être empilés |
| **la flèche de « Vos clients »** | rien | rien : c'est celle que vous avez fait retirer partout ailleurs |
| **la phrase des bandeaux** — « Le client n'a pas donné suite. Le devis peut être repris et renvoyé. » | 38 px par bandeau | elle redit le titre au-dessus et le bouton en dessous. **Ce que le client a écrit, lui, reste mot pour mot** |
| **le mot « Envoyé » de la date** : « Envoyé le lundi 1er septembre. » devient « Lundi 1er septembre » | 2 mots | c'est votre remarque du 19 août : l'ancienneté du devis était écrite deux fois. La ligne juste au-dessus dit déjà « DEVIS ENVOYÉ » |
| **un bandeau au lieu de deux** avant « 2 autres devis à regarder » | 118 px | vous en voyez un à la fois. C'est un seul chiffre à changer si vous préférez deux |

### Ce qui devient une cible de 44 px

« Vos clients » (14 → 44), « Adresse non renseignée » (34 → 44), « J'ai vu » et
« Reprendre le devis » (21 → 44), l'anneau de « Créer un devis » (42 → 44 — **les
deux pixels sont autour, l'anneau garde ses 42**, c'est votre mesure).

### Ce qui ne bouge pas d'un pixel

Le fil et la perle. Les 44 px au-dessus du titre, le titre à 40 px, les 21 px
entre deux chantiers. Le mot « Créer un devis » à 13 px graisse 800, l'anneau de
42 px, le battement, les onze grains, la demi-seconde avant la feuille. Les cinq
onglets sans icônes à 8,5 px / 0,14 em et leur trait d'or. Le glissement qui
retire une ligne et le tiroir qui annule. Aucun trait gris dans l'en-tête, aucun
« Bonjour », aucune phrase sur la liste vide.

---

## Les chiffres, mesurés et non estimés

Relevés par la planche elle-même, à 390 × 664, la barre du bas déduite. Elle
n'affiche pas des chiffres recopiés : elle interroge l'écran affiché.

| Matin chargé — trois notifications | aujourd'hui | à bout de bras |
|---|---|---|
| la liste commence à | **770 px** — hors de l'écran | **487 px** sur 596 |
| du premier chantier, on voit | **rien** | **le nom, le lieu, l'état** |
| le plus petit texte | 9,5 px | **11 px** |
| contraste de la ligne d'état | 2,77 | **4,59** |
| la plus petite cible | 14 px | **44 px** |
| mots qui ne sont pas un chantier | 51 | **44** |

| Matin calme | aujourd'hui | à bout de bras |
|---|---|---|
| la liste commence à | 326 px | **236 px** |
| chantiers entiers à l'écran | 1 | **2** |
| mots qui ne sont pas un chantier | 15 | **14** |

**Sur Nuit**, la ligne d'état passe de 6,14 à 6,14 : elle était déjà lisible —
c'est la charte que vous aviez fait corriger le 22 août. Le reste suit.

**Une franchise sur le compte de mots.** Le total affiché *monte* de 53 à 60 sur
un matin chargé. Ce n'est pas un échec : l'écran d'aujourd'hui en affiche moins
**parce qu'il n'affiche aucun chantier**. C'est pour ça que la planche compte
aussi les mots qui ne sont **pas** un chantier — le bruit — et celui-là baisse.

---

## Une correction, parce que je vous ai donné quatre faux chiffres

**La première version de cette planche inventait ses interlignes.** Elle écrivait
« 1,35 » ou « 1,4 » là où votre application n'écrit rien du tout — et quand elle
n'écrit rien, la valeur héritée est **1,5**. Une reproduction ne vaut que si le
« avant » est exact : quatre chiffres étaient donc faux, tous dans le sens qui
me flattait.

| Ce que j'annonçais | La vraie valeur |
|---|---|
| la liste commence à 738 px | **770 px** |
| la plus petite cible : 10 px | **14 px** |
| les deux gestes d'un bandeau : 17 px | **21 px** |
| sur un matin chargé, on lit « le nom, le lieu, l'état, la date » | **« le nom, le lieu, l'état »** — la date passe sous le bord |

Les corrections vont **dans les deux sens** : l'écran d'aujourd'hui est un peu
pire que je ne le disais, et le mien un peu moins bon. Les chiffres ci-dessus
sont les corrigés.

---

## Ce que j'ai refusé, et ce que ça aurait coûté

**1. Refaire un monde visuel neuf.** Vous m'avez écrit « tu peux partir sur
totalement autre chose », et je ne l'ai pas fait. Ce n'est pas de la prudence :
un accueil dessiné autrement, c'est vous qui recommencez à apprendre un écran
que vous ouvrez vingt fois par jour, au moment précis où votre consigne dit
l'inverse. Ce qui manque à cet écran n'est pas une idée, c'est d'être lu.

**Si vous voulez quand même voir autre chose, la porte est ouverte** — et une
proposition qui déplace vraiment les choses vous attend déjà (celle du
3 septembre, plus haut).

**2. Rendre visible le glissement qui retire un chantier.** Votre règle du
5 septembre dit « rien de caché — pas de glissement ». Votre décision du 10 août
dit que le retrait se fait au glissement. Les deux sont de vous.

Je tranche pour le glissement, et voici pourquoi : votre règle dit « aucun geste
à découvrir **pour ce qui compte** ». Retirer un chantier n'est pas ce qui
compte sur cet écran — ouvrir un chantier, créer un devis, voir ses clients le
sont, et les trois sont visibles. Ajouter une croix ou un bouton « Retirer » sur
chaque ligne, c'est un mot de plus sur chaque ligne pour un geste qu'on fait une
fois par semaine.

**3. Toucher à `CHANGELOG.md`, `TODO.md`, `PROJECT_STATE.md`, `HANDOVER.md` et
`ARCHITECTURE.md`.** Une autre de vos sessions y a du travail **non
enregistré** en ce moment (un lot sur la barre d'enregistrement des Réglages).
Les modifier revenait à commiter son travail inachevé avec le mien — c'est
exactement ce qui est arrivé le 4 septembre. Ce lot vit donc ici et dans la
planche ; ces cinq fichiers seront tenus à jour au moment où l'on codera.

---

## Ce que ça casse si vous dites oui

**Dix-sept scripts lisent cet écran par ses repères.** Aucun ne tombe :
`a.atlas-brin`, `.atlas-ligne`, `data-atlas="compteur"` et
`data-atlas="nouveau-chantier"` restent en place, au même endroit, avec le même
rôle. Ce qui change est la taille, la couleur et deux blocs déplacés.

**Trois contrôles demanderont un mot :**

| Le contrôle | Ce qu'il faudra faire |
|---|---|
| `scripts/test-accueil-en-tete.ts` | il lit la source pour prouver que « Bonjour » et le trait gris sont partis. Le retrait d'« ATLAS » s'y ajoute de la même façon, pour qu'aucune session ne le remette |
| `scripts/test-aucune-fleche.ts` | il ne voit pas les flèches dessinées en CSS. À étendre : c'est un trou, pas un détail |
| `scripts/test-aucun-texte-coupe-e2e.ts` | il vérifie qu'aucun texte n'est tronqué. Il a raison de s'inquiéter : à 12 px, « DEVIS PRÊT À ENVOYER · 3 PHOTOS » passait à la ligne — l'espacement des lettres est descendu de 0,28 à 0,14 em, comme sur vos onglets du bas. **Trouvé en capture, par aucun test** |

---

## La batterie

**Elle n'a pas été jouée, et il faut le dire plutôt que le laisser croire.**

Ce lot ne touche **aucun fichier de `src/`** : il ajoute une planche dans
`appli/`, un lien, ce document, et corrige une phrase périmée de l'index des
maquettes. Il n'y a rien à éprouver dans le produit.

**Ce qui a été joué :** `npm run verifier:memoire` — et il est **rouge**, pour
une référence morte (`identite/page.tsx`) qui vient du travail **non
enregistré** de la session voisine, pas de HEAD ni de ce lot. Vérifié :
`git show HEAD:ARCHITECTURE.md` ne la contient pas.

**Ce qui sera joué quand vous direz de coder :** la batterie complète, et je
vous préviendrai avant de la lancer.

---

## « Vos deux registres » — élégante, et vos clients y sont

**Votre réponse à « Ma journée », le 6 septembre :** *« sur la page neuve tu ne
l'as pas mis mes clients ??? Et j'aime pas ce que tu as fait. Propose-moi
quelque chose d'élégant, minimaliste ; il faut qu'il y ait un endroit pour les
retours client et l'autre pour les devis en cours de conception. Tu peux
rajouter des choses si tu estimes que c'est utile, même des éléments de
décoration, vu que c'est la première page. »*

`https://florianmarrins0978-svg.github.io/Atlas-app/l-accueil-elegant.html`

### D'abord, la faute

**Vos clients avaient disparu, et je ne l'avais pas dit.** Le lien existe depuis
le 17 août — c'est vous qui l'aviez réclamé, *« la catégorie client n'a pas été
créée »* — et « Ma journée » l'avait supprimé en silence. C'est exactement ce
que ce dépôt s'interdit : un retrait non dit se lit comme un oubli. Il l'était.

Il est revenu **en haut à droite, avec le nombre de vos clients**, en face de la
date. Le premier jour, le nombre disparaît plutôt que d'afficher un zéro qui se
lirait comme une panne.

### Les deux endroits que vous demandez

| | |
|---|---|
| **Retours clients** | ce que vos clients vous ont répondu — leurs mots y sont **tels quels**, en italique derrière un filet d'or. Sous chacun, le geste qu'il appelle, et « J'ai vu » à côté |
| **Devis en cours** | ceux que vous êtes en train de faire, rangés par celui qui attend depuis le plus longtemps |

Chaque enseigne porte **son compte**, en serif : vous savez d'un coup d'œil s'il
en reste sous le pli. **Un registre vide n'existe pas** — il ne s'affiche pas
avec un zéro.

### Vos quatre corrections du 6 septembre — toutes faites

| Ce que vous avez demandé | Ce qui a été fait |
|---|---|
| *« tout ce qui est en doré foncé, mets-le en doré, celui de l'appli »* | les libellés portaient `orTexte` (#8b6835), ils portent votre `or` (#B98B47) |
| *« retire ta déco en haut »* | le sceau est parti. C'est écrit dans le fichier pour qu'aucune session ne le remette en citant votre autorisation de la veille |
| *« retire la déco qu'il y a entre les deux »* | la feuille du milieu est partie. **Les deux filets d'or restent** — c'est vous qui les avez gardés |
| *« créer le chantier ne doit pas être tout en bas »* | remonté sous la date, et une bascule vous laisse comparer les deux places au doigt |

**Ce que votre or coûte, et je ne le redirai pas.** Sur le crème, `or` tient
**2,77** de contraste là où un mot en demande 4,5. La bande de mesure sous
l'écran l'affiche en clair, à chaque bascule. **Sur Nuit il en tient 6,14** :
les deux ors y sont identiques, rien n'y change. C'est votre écran et c'est
votre couleur ; une seule ligne la défait le jour où vous voudrez.

### Ce qui reste de la décoration

- **Les deux filets d'or** qui séparent les deux registres, vidés de ce qu'il y
  avait entre eux. Ils **séparent** — ils ne ferment pas l'en-tête. **Le trait
  gris de l'en-tête que vous aviez fait retirer le 24 août n'est pas revenu**,
  et il ne reviendra pas par cette porte.
- **Deux voix de caractères** : le nom d'un client est en serif — c'est une
  personne ; ce qu'il faut faire est en sans — c'est l'application qui parle.
- **Une seule couleur** dans tout l'écran, et elle veut dire quelque chose :
  depuis combien de temps ça attend.

### Vos deux remarques du soir — faites

**1. « Il manque les dates à laquelle on a créé le devis pour les clients. »**

Elles y sont, et **il y en a DEUX, parce que ce ne sont pas les mêmes faits** :

| Ce que le chantier a | Ce qui s'écrit |
|---|---|
| un devis déjà rédigé (`devisGenereAt`) | **« devis du 7 septembre »** |
| pas encore de devis — Brouillon, À vérifier (`createdAt`) | **« ouvert le 25 août »** |

Écrire « devis du 25 août » sur un chantier qui n'a pas de devis serait inventer
une date, et ce dépôt s'y refuse. Le format est celui que l'application réserve
déjà aux listes — `jourEtMois()`, « 25 août », sans le jour de la semaine qui
prendrait la moitié de la ligne.

**Ce que ça coûtera à coder :** `createdAt` n'est pas descendu à l'accueil
aujourd'hui — la requête l'emploie pour **trier** mais ne le sélectionne pas.
Une colonne de plus, rien d'autre.

**2. « Les deux rubriques se ressemblent trop. » — et vous me l'avez dit DEUX
fois**

**La première fois, j'ai répondu par une couleur et un filet. C'était une
mauvaise réponse, et vous avez eu raison de le redire :** la **forme** restait
la même — une enseigne, puis des noms en serif avec une seconde ligne dessous.
Repeindre deux choses bâties pareil ne les distingue pas.

Ce sont deux natures différentes. Elles ont donc **deux formes** :

| | Retours clients | Devis en cours |
|---|---|---|
| **ce que c'est** | une **correspondance** — quelqu'un vous a écrit | un **registre** — votre travail à vous |
| **la forme** | un bloc aéré, porté par un filet d'or, qui rentre dans la page | une ligne par devis, un filet fin dessous, comme un carnet |
| **les caractères** | serif — le nom d'une personne, et ses mots | droits — c'est l'application qui parle |
| **la date** | à la suite : « depuis 3 jours » | **alignée à droite**, en chiffres qui s'alignent d'une ligne à l'autre |
| **l'enseigne** | petites capitales dorées | un titre en serif |

L'un **se lit**, l'autre **se parcourt**. C'est ce qui les sépare, et ce n'est
plus une question de teinte.

*Deux choses trouvées en capture, par aucun test : le filet d'or s'arrêtait
au-dessus de « Corriger le devis » et se lisait comme un trait interrompu ; et
les filets du registre allaient d'un bord à l'autre du téléphone, ce qui les
faisait ressembler au cadre d'un tableau posé sur l'écran.*

### Votre question sur le bouton — ce que j'en pense

*« Je pense que créer le chantier ne doit pas être tout en bas, tu en penses
quoi ? »*

**Je pense comme vous, et pas pour la raison qu'on croit.** Ce n'est pas une
question de place : mesuré, les deux positions montrent **exactement le même
nombre d'entrées** — trois sur quatre. Ce qui les sépare est ailleurs.

| | |
|---|---|
| **en bas** | il faut une bande OPAQUE de 76 px pour que le bouton ne tranche pas une ligne en deux. Cette bande est là **en permanence**, et la fin de la liste passe toujours dessous |
| **en haut** | il est annoncé une fois et ne cache plus rien. La page redevient une page |

**Ce que ça coûte, dit franchement : le pouce doit remonter.** Sur un téléphone
tenu d'une main, le bas est plus facile à atteindre que le haut — et vous vous
en servez debout, sur un chantier. C'est le seul argument contre, et il est
sérieux.

**La bascule « Le geste : en haut / en bas » est là pour ça** : essayez les deux
au pouce, sur votre téléphone, et tranchez avec votre main plutôt qu'avec mon
avis.

### Ce que j'ai ajouté sans que vous le demandiez

- **La date**, en haut à gauche : sans elle, « depuis 14 jours » ne se rapporte
  à rien.
- **« Et deux autres » qui SE REPLIE.** C'est le défaut que vous avez trouvé ce
  matin, et il ne se refait pas ici.
- **Un seul retour est ouvert en entier** par défaut. C'est mesuré, pas choisi :
  à deux, le second registre passait sous le pli — et ce sont justement les deux
  endroits que vous demandez.

### Les chiffres, relevés par la planche elle-même

| Matin chargé — 3 retours, 5 devis | |
|---|---|
| les deux registres se voient | **oui**, sans défiler |
| entrées lisibles sans défiler | **3 sur 4** — le bouton en haut ou en bas n'y change rien |
| le plus petit texte | **11 px** (les cinq mots du bas) |
| le pire contraste | **2,77** — c'est votre or, et il est sous 4,5 · sur Nuit **6,14** |
| la plus petite cible | **44 px** |

---

## « Ma journée » — la page repartie de zéro, que vous avez refusée

**Gardée dans le dépôt, comme vous l'avez demandé** — *« ne supprime pas les
maquettes déjà créées »*. Ce qui suit reste vrai, et le défaut de contraste
qu'elle a fait apparaître vaut pour toute l'application.

**Votre demande, le 6 septembre :** *« oublie ma page, oublie ce qu'on m'a déjà
proposé, repars à 0 et crée-moi une page d'accueil adaptée à mes besoins »*.

`https://florianmarrins0978-svg.github.io/Atlas-app/ma-journee.html`

### L'idée, en une phrase

**L'accueil ne décrit plus des états, il donne du travail.**

Aujourd'hui il écrit « Devis envoyé · sans réponse » : un état, qu'il faut
traduire avant d'agir. Debout au soleil, à soixante-cinq ans, cette traduction
est ce qui coûte.

**Et votre application sait DÉJÀ dire le geste.** La fonction `getNextAction()`
(`src/lib/chantier-etat.ts`) le calcule pour chaque chantier — « Envoyer le
devis au client », « Préparer le devis », « Calculer le prix », « Ajouter des
photos ». Elle ne sert qu'à décider où mène un appui. **Elle n'est écrite nulle
part à l'écran.** Rien n'est donc inventé ici : ce sont vos mots, déjà calculés,
enfin affichés.

### Ce qu'il y a dessus, et rien d'autre

| | |
|---|---|
| **le jour**, en grand | il situe, et il ne demande rien |
| **Aujourd'hui** | où vous allez, avec l'adresse — celle que vous tapez dans votre GPS |
| **À faire** | un geste par ligne, au verbe, rangé par ce qui attend depuis le plus longtemps |
| **un seul bouton**, sous le pouce | « Nouveau chantier », avec son mot écrit |
| **les cinq sections** | en bas, en bas de casse et lisibles |

Ce que le client a **écrit** est là, mot pour mot, en serif — c'est la seule
chose de cet écran que l'application n'a pas rédigée.

### Ce qui a été mis de côté, et je le nomme

Le **fil** et sa **perle**. Les **cartes** de notification. « **ATLAS** », le
titre « **Vos chantiers** », le compteur « **En cours** », le lien « **Vos
clients** ». Le mot et l'**anneau** de « Créer un devis », son battement et ses
onze grains. Le **glissement** qui retire un chantier — pour retirer, on ouvre
le chantier.

Rien de tout cela n'est jugé mauvais. Vous avez demandé une page neuve.

### Un vrai défaut trouvé sur le chemin, et il touche TOUS vos boutons

Le mot écrit sur vos boutons verts tient **2,97** de contraste. Vous avez choisi
ce vert le 3 septembre en connaissance de cause — le « 3,0 » était écrit en
rouge sous chaque bouton de la planche —, **mais ce que vous avez choisi, c'est
l'aplat, pas la couleur du mot**.

| Sur votre vert #7d9a6d | Contraste |
|---|---|
| le mot en crème — ce que fait l'application | **2,97** |
| le mot en encre — ce que fait la planche | **5,46** |

**Votre vert ne bouge pas d'un cheveu.** C'est le mot qui change de couleur, et
il devient lisible au soleil. Le contrôle qui devrait l'attraper regarde
l'ancienne couleur des boutons (`test-chartes-lisibles.ts` mesure `card` contre
`rust`, pas contre `plein`) : il ne peut pas voir le défaut.

### Les chiffres, relevés par la planche elle-même

| Matin chargé — deux chantiers aujourd'hui, cinq gestes | |
|---|---|
| gestes lisibles sans défiler | **3 sur 7** |
| le plus petit texte | **11 px** (les cinq sections du bas) ; rien de ce qui se lit n'est sous 15 |
| le pire contraste | **4,59** — passe 4,5 |
| la plus petite cible | **44 px** |

Sur **Nuit**, le pire contraste est 6,14. Les pôles s'inversent proprement : le
bouton devient clair et son mot devient sombre.

### Ce qu'il faut me dire

| | |
|---|---|
| **« Aujourd'hui » montre des chantiers rangés au planning** | Votre règle du 6 août dit qu'un chantier ne figure que dans un seul onglet. Les trois onglets la gardent — c'est l'accueil qui cesse d'être l'un d'eux pour devenir la page qui répond à « et maintenant ? ». **Si vous refusez, cette rubrique tombe** et le reste tient sans elle |
| **Le bouton vert en bas** | Vous aviez refusé « ce gros bouton en plein milieu, ça ne fait pas très luxe ». Celui-ci n'est pas au milieu et porte son mot — dites-moi s'il vous gêne quand même |
| **« Ma journée » remplace « Chantiers »** dans la barre du bas | |
| **L'écran du premier jour** est le jour, du vide, et un bouton | Aucune phrase, comme vous l'avez demandé le 25 août. Si ce vide vous gêne, c'est une ligne à ajouter |

---

## Ce qui reste ouvert, et qui peut le trancher

| Question | Qui tranche |
|---|---|
| **Les trois propositions vivantes** — « Vos deux registres », « À bout de bras » (le vôtre rendu lisible) et celle du 3 septembre. « Ma journée » est refusée mais gardée | **vous** |
| **Le mot des boutons verts en encre plutôt qu'en crème** — 2,97 → 5,46, sur tous les écrans, sans toucher à votre vert | **vous**, mais je le recommande |
| **Le dépliage sans repli** (`Notifications.tsx:564`) — deux lignes à corriger dans l'application | n'importe quelle session |
| **`test-chartes-lisibles.ts` mesure `card` contre `rust`** alors que les boutons portent `plein` depuis le 3 septembre : le contrôle regarde une couleur que plus personne n'emploie | n'importe quelle session |
| **Un chantier prévu hier passe tout seul dans « Terminés », sans rien dire.** Faut-il qu'il vous le signale sur l'accueil ? La question est dans `TODO.md` depuis le 8 août et ne vous a jamais été posée | **vous** |
| **Deux bandeaux ou un seul** avant « N autres devis à regarder » | **vous** |
| **Le compteur de mots qui empêche les écrans de regrossir** n'existe toujours pas. C'était la vraie réponse à « il y aura une quatrième fois » (`docs/QUESTIONS.md` §23) | n'importe quelle session |
| **Le gris hors des Réglages** — le planning, les terminés, le devis, la facture, la fiche client, Paysage. 525 emplois, 82 repris | à faire écran par écran, jamais en balayage |
