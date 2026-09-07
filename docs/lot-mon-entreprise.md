# « Mon entreprise » — lot 4

**6 septembre 2026.** Quatrième lot de la reprise des Réglages.

Pas de maquette : ce lot ne dessine rien de neuf. Il remet une chose à sa place
et en supprime deux copies. Les preuves sont des mesures et des captures de
l'application.

---

## 1. Votre TVA était coupée en deux, et le code prétendait le contraire

Le 14 août, la périodicité de TVA a quitté l'écran d'ensemble des réglages pour
« rejoindre le régime de TVA ». Le commentaire du code le dit encore mot pour
mot.

**Elle ne l'a jamais rejoint.** Elle était posée *après* tout l'écran d'identité
— donc après le téléphone, l'e-mail et vos coordonnées bancaires.

Mesuré au navigateur, à 390 × 664 :

| | Avant | Après |
|---|---|---|
| « Votre régime de TVA » | 994 px | 994 px |
| la périodicité | **1 734 px** | **1 306 px** |
| **écart entre les deux moitiés** | **740 px** | **312 px** |
| hauteur de l'écran | 2 199 px | **2 177 px** |

Un écran de défilement en moins entre « suis-je en franchise » et « à quel
rythme je déclare » — deux questions qui se répondent ensemble ou pas du tout.
Et l'écran est **plus court qu'avant**, pas plus long.

**Un titre est parti avec le déplacement.** La périodicité portait son propre
intertitre, « VOTRE TVA ». Collé sous « VOTRE RÉGIME DE TVA », il donnait deux
titres de TVA à trois centimètres l'un de l'autre. La phrase qui suit suffit, et
elle dit mieux ce que le titre disait : *« à quel rythme vous la déclarez »*.

---

## 2. La barre d'enregistrement était écrite TROIS fois

Hier, le lot 3 a corrigé cette barre sur « Devis & factures » : elle était
rendue en permanence, opaque, et le contenu passait dessous.

**Le correctif n'a atteint qu'un écran sur trois.** « Mon entreprise » et « Mon
compte » portaient **leur propre copie** de la même barre, à quelques lignes
près, et rien dans le code ne le disait.

C'est la faute du lot 2 en pire : là-bas, quatre écrans n'employaient pas la
pièce commune ; ici, **il n'y avait pas de pièce commune du tout — il y avait
trois jumelles.**

**Il n'y en a plus qu'une**, dans `src/components/atlas/BarreEnregistrer.tsx`,
et les trois écrans s'en servent. Les 85 pixels rendus hier sur un écran le sont
maintenant sur les trois.

**Un détail qui dit tout de l'état d'avant :** les trois copies ne s'accordaient
même pas sur la question posée. Deux répondaient « oui ou non », la troisième
comptait les champs modifiés. La barre en faisait exactement la même chose.

---

## Deux contrôles ont été RETOURNÉS, et c'est moi qui les ai fait rougir

La première batterie de ce lot a rendu **deux rouges qui étaient bien les
miens**. Je ne les ai pas mis sur le compte du hasard : ils disaient exactement
ce que j'avais changé.

**1. `test-periodicite-tva-e2e`** attendait le mot « Votre TVA » — l'intertitre
que je venais de retirer. Il ne vise plus un mot mais un repère posé dans le
code (`data-atlas="periodicite-tva"`), qui ne se renomme pas pour faire joli.

**2. `test-compte-connexion-e2e`** exigeait *« le bouton du bas est là, et dit
que tout est écrit »* — c'est-à-dire la barre permanente qu'on vient de retirer.
Il défend désormais la règle : au repos, aucune barre ; et elle revient dès
qu'on écrit dans un champ.

**Dans les deux cas, on adapte le contrôle — on ne remet pas ce qui a été
retiré.** Une suite qui réclame l'ancien écran rend l'écran impossible à
changer.

---

## Ce que le contrôle tient maintenant

`scripts/test-barre-enregistrer-e2e.ts` parcourt **les trois écrans**, pas le
seul d'origine — sinon le défaut reviendrait par les deux autres.

**Il sait échouer, et je l'ai vérifié :** en retirant la condition dans la pièce
partagée, **les trois cas rougissent d'un coup**. C'est la démonstration que la
pièce est bien partagée.

---

## Les chiffres de la batterie

`npm run verifier:avant-livraison`, jouée **deux fois** : la première a trouvé
mes deux rouges, la seconde après correction.

| Étape | Résultat |
|---|---|
| Types, lint, construction | **verts** — 0 erreur |
| Mémoire du dépôt | **verte après correction** — mon propre document citait un chemin qui n'existe pas (`identite/page.tsx` au lieu de son chemin complet). Le contrôle a eu raison de m'arrêter |
| Suites base de données | **306 / 314** |
| Suites navigateur | **117 / 130** |
| Connexion derrière un proxy | **n'a toujours pas mesuré** — la panne d'outillage Windows |

**Les trois suites de ce lot sont vertes**, et deux d'entre elles étaient rouges
au premier tour, à cause de moi : `test-barre-enregistrer-e2e` (les trois
écrans), `test-periodicite-tva-e2e`, `test-compte-connexion-e2e`.

**Les treize rouges au navigateur** sont ceux qui reviennent d'une batterie à
l'autre sans qu'on touche à leur code — deux d'entre eux, rouges au lot
précédent, sont verts aujourd'hui sans que personne ne les ait corrigés. Ce sont
des suites qui se gênent entre elles, et c'est consigné depuis le 26 août.

---

## Une chose que je n'ai pas faite, et que je vous signale

`src/app/reglages/compte/CompteClient.tsx` et `IdentiteClient.tsx` gardent
chacun leur propre logique de « ce qui reste à enregistrer » — l'un en oui/non,
l'autre en liste de champs. Ce n'est plus un défaut d'affichage depuis que la
barre est commune, mais c'est encore deux façons de dire la même chose.

Les unifier demande de toucher à la façon dont ces deux écrans enregistrent, ce
qui n'est pas une mise en ordre : c'est un lot.

---

## Ce qui reste des Réglages

| Lot | Quoi |
|---|---|
| 5 | « Mon agenda » — Google demande un identifiant OAuth, iCloud un mot de passe d'application. **Les deux sont hors de portée, et c'est vous qui tranchez** |
| 6 | Équipe (proposition C), notifications, mot de passe, données, couleurs, IA, abonnement, compte |

**Toujours sans réponse, et ce n'est pas un reproche :** faut-il couper
« Devis & factures » ? Vos décisions des 23 et 25 août datent d'un écran à deux
blocs ; il en porte six.
