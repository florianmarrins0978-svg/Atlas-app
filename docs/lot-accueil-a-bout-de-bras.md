# L'accueil — ce que j'ai trouvé, et ce que je propose

**Le 6 septembre 2026. Rien n'est codé : aucun fichier de `src/` n'a été touché.**

La planche à ouvrir :
`https://florianmarrins0978-svg.github.io/Atlas-app/l-accueil-a-bout-de-bras.html`

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

### 4. Ce qu'il faut viser du doigt fait 10 pixels

Mesuré sur l'écran d'aujourd'hui, reproduit au pixel près : la plus petite chose
qu'on doive toucher est **« Vos clients », 10 px de haut**. Il en faut 44.

Deux autres sont dans le même cas, et elles sont sur chaque bandeau de
notification : « Reprendre le devis » et « J'ai vu » n'ont aucun rembourrage
(`src/app/Notifications.tsx:503` et `539`) — **17 px de haut**.

### 5. Sur un matin chargé, « Vos chantiers » n'en montre aucun

Mesuré à 390 × 664, la barre du bas déduite, sur un matin à trois notifications :
**la liste commence à 738 px** dans une fenêtre qui en fait 596. Elle est hors
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

« Vos clients » (10 → 44), « Adresse non renseignée » (34 → 44), « J'ai vu » et
« Reprendre le devis » (17 → 44), l'anneau de « Créer un devis » (42 → 44 — **les
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
| la liste commence à | **738 px** — hors de l'écran | **479 px** sur 596 |
| du premier chantier, on voit | **rien** | **le nom, le lieu, l'état, la date** |
| le plus petit texte | 9,5 px | **11 px** |
| contraste de la ligne d'état | 2,77 | **4,59** |
| la plus petite cible | 10 px | **44 px** |
| mots qui ne sont pas un chantier | 53 | **44** |

| Matin calme | aujourd'hui | à bout de bras |
|---|---|---|
| la liste commence à | 323 px | **236 px** |
| chantiers entiers à l'écran | 1 | **2** |
| mots qui ne sont pas un chantier | 15 | **14** |

**Sur Nuit**, la ligne d'état passe de 6,14 à 6,14 : elle était déjà lisible —
c'est la charte que vous aviez fait corriger le 22 août. Le reste suit.

**Une franchise sur le compte de mots.** Le total affiché *monte* de 53 à 60 sur
un matin chargé. Ce n'est pas un échec : l'écran d'aujourd'hui en affiche moins
**parce qu'il n'affiche aucun chantier**. C'est pour ça que la planche compte
aussi les mots qui ne sont **pas** un chantier — le bruit — et celui-là baisse.

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

## Ce qui reste ouvert, et qui peut le trancher

| Question | Qui tranche |
|---|---|
| **Les deux propositions d'accueil** — la mienne et celle du 3 septembre. On fait les deux, une seule, ou aucune ? | **vous** |
| **Un chantier prévu hier passe tout seul dans « Terminés », sans rien dire.** Faut-il qu'il vous le signale sur l'accueil ? La question est dans `TODO.md` depuis le 8 août et ne vous a jamais été posée | **vous** |
| **Deux bandeaux ou un seul** avant « N autres devis à regarder » | **vous** |
| **Le compteur de mots qui empêche les écrans de regrossir** n'existe toujours pas. C'était la vraie réponse à « il y aura une quatrième fois » (`docs/QUESTIONS.md` §23) | n'importe quelle session |
| **Le gris hors des Réglages** — le planning, les terminés, le devis, la facture, la fiche client, Paysage. 525 emplois, 82 repris | à faire écran par écran, jamais en balayage |
