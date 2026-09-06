# L'en-tête unique des Réglages — lot 2

**6 septembre 2026.** Deuxième lot de la reprise des Réglages, dans l'ordre que
vous avez accepté. Il porte la même consigne que le premier :

> *« Imagine que la plupart des patrons qui vont utiliser l'app sont des vieux
> qui ont du mal à se servir de leur téléphone. »*

**Pas de maquette pour ce lot, et c'est voulu.** Il n'invente aucune apparence :
il fait entrer quatre écrans dans la grammaire des treize autres, que vous avez
déjà validée. Ce qui se montre ici, ce sont donc des **captures de
l'application** — pas un dessin.

---

## Le défaut, et pourquoi il ne se voyait pas

Sur dix-sept écrans des Réglages, **quatre se dessinaient leur propre en-tête**
au lieu d'employer la pièce commune : « Mon agenda », « Mes prix »,
« Mes mesures » et le vocabulaire.

Chacun était juste pris isolément. Ensemble, ils divergeaient :

| | Les quatre | Les treize autres |
|---|---|---|
| taille du titre | 32 px | **36 px** |
| le surtitre doré | **au-dessus** du titre | en dessous |
| bouton de l'assistant | **absent** | présent |

**Le surtitre au-dessus est la faute la plus nette :** vous aviez demandé
l'inverse le 26 août — *« sur plusieurs catégories le titre était en dessous du
sous-titre en doré, inversez-les »*. La correction avait été faite dans la pièce
partagée, donc elle n'a jamais atteint les quatre écrans qui ne s'en servaient
pas. **Onze jours qu'ils désobéissaient à une demande exaucée.**

**Et l'assistant manquait là où il sert le plus.** Le recours — le bouton vert
qui ouvre l'aide — était absent de « Mon agenda » et de « Mes prix »,
c'est-à-dire des deux écrans les plus difficiles des Réglages.

---

## Ce qui a été fait

| Fichier | Quoi |
|---|---|
| `src/app/reglages/agenda/page.tsx` | en-tête commune |
| `src/app/reglages/prix/page.tsx` | en-tête commune |
| `src/app/reglages/prix/mesures/page.tsx` | en-tête commune |
| `src/app/reglages/vocabulaire/page.tsx` | en-tête commune |
| les cinq blocs de contenu | passés de 24 px de marge à **26 px**, le rail des autres écrans |

**Ce qui a été gardé, et qu'il ne faut pas défaire en passant :** la flèche de
« Mes prix » ramène à « Tarifs & catalogue », pas à la racine des Réglages —
votre remarque du 17 août. Idem pour « Mes mesures » et le vocabulaire.

**Le surtitre de « Mon agenda » disait « Mes disponibilités ».** Il dit
« Réglages ». La grammaire de ce mot est *d'où l'on vient*, pas *de quoi ça
parle* : c'est ce qui permet de savoir où la flèche ramène sans l'essayer.

---

## Mesuré, après

`npx tsx --env-file=.env scripts/capture-entetes-reglages.mts`, à 390 × 664 :

| Écran | Titre | Lignes | Assistant | Doré |
|---|---|---|---|---|
| Mon agenda | 36 px | 1 | oui | sous le titre |
| Mes prix | 36 px | 1 | oui | sous le titre |
| Mes mesures | 36 px | 1 | oui | sous le titre |
| Mon vocabulaire | 36 px | 1 | oui | sous le titre |
| *témoin — Mon entreprise* | 36 px | 1 | oui | sous le titre |
| *témoin — Mes données* | 36 px | 1 | oui | sous le titre |

**Les deux témoins ne sont pas de l'ornement.** Sans un écran qui employait déjà
la bonne en-tête, ce tableau ne dirait pas si les quatre autres ont rejoint la
grammaire ou en ont inventé une nouvelle.

---

## Deux choses que seule la capture a montrées

**1. Un titre qui se cassait en deux, à cause de l'assistant.**
« Le vocabulaire de mon métier » tenait sur une ligne à 32 px. Passé à 36, avec
la pastille de l'assistant à sa droite, il se coupait en deux lignes — le défaut
exact que le dépôt surveille depuis le 11 août.

**L'écran s'appelle donc « Mon vocabulaire ».** C'est la règle du lot 1
appliquée à elle-même : un titre qui ne tient pas est un titre trop long. Et il
rejoint la famille — Mon agenda, Mes prix, Mes mesures, Mes données, Mon compte.

**2. « Mon agenda » demande de créer un identifiant OAuth.**
La capture montre ce qu'on y lit vraiment : *« Il faut d'abord créer des
identifiants Google pour cette application »*, puis `console.cloud.google.com`,
*« l'API Google Agenda activée »*, *« un identifiant OAuth de type application
Web »*. Le raccordement Google **n'est pas disponible** tant que ce n'est pas
fait.

Ce n'est pas ce lot qui le répare — c'est le lot 5. Mais c'est pire que ce que
je vous ai écrit hier : je n'avais signalé que le mot de passe iCloud, et le
côté Google est au moins aussi hors de portée.

---

## Un contrôle a été RETOURNÉ, pas réparé

`scripts/test-vocabulaire-editeur-e2e.ts` vérifie qu'un compte ordinaire ne se
voit pas proposer le vocabulaire. Il cherchait la **phrase**
« vocabulaire de mon métier ». L'écran renommé, ce contrôle serait resté **vert
en ne prouvant plus rien** — le texte cherché n'existant plus nulle part.

Il vise désormais l'**adresse** du lien. C'est la même correction qu'au lot 1, et
la même raison : une adresse ne se renomme pas pour faire tenir un titre.

---

## Les chiffres de la batterie

`npm run verifier:avant-livraison`, jouée en entier sur votre poste, **après**
la fusion avec `main`.

| Étape | Résultat |
|---|---|
| Types (`tsc`), lint, construction, mémoire | **verts** — 0 erreur |
| Suites base de données | **305 / 314** |
| Suites navigateur | **114 / 129** |
| Connexion derrière un proxy | **n'a toujours pas mesuré** — même panne d'outillage qu'hier |

**Les six suites qui parcourent les écrans de ce lot sont vertes**, nommément :
`test-agenda-reglages-e2e`, `test-grille-prix-e2e`, `test-cases-reglables-e2e`,
`test-vocabulaire-editeur-e2e`, `test-catalogue-mes-mots-e2e`,
`test-reglages-e2e`.

**Les neuf rouges en base** sont les mêmes qu'hier, tous de machine :
`test-ouvrir-port`, `test-port-remesure`, `test-verrou-construction`,
`test-relance-construction`, `test-fiche-pendant-relance`,
`test-mise-a-jour-role-db`, `test-roles-capacites-db`,
`test-salarie-planning-lecture-seule-db`, `test-seed-conserve-identifiants`.

**Deux rouges d'hier ont DISPARU sans que j'y touche** — `test-boutons-arrondis`
et `test-mode-emploi` : leur correctif était sur `main`, la fusion l'a apporté.

**Quatre rouges navigateur sont apparus** par rapport à hier :
`test-anneau-dictee-e2e`, `test-arrosage-e2e`, `test-brouillon-e2e`,
`test-feuille-envoi-lisible-e2e`. Ils sont sur la note vocale, l'arrosage, le
brouillon de devis et la feuille d'envoi — **aucun des quatre ne mentionne un
seul des écrans de ce lot**, vérifié fichier par fichier, et ils tombent dans
les zones que la fusion vient d'apporter. Je ne les mets pas sur le dos de la
fusion pour autant : je dis seulement qu'ils ne sont pas de ce lot, et ils sont
notés dans `TODO.md`.

---

## Ce qui reste

| Lot | Quoi |
|---|---|
| 3 | « Devis & factures » — 1 267 lignes et six blocs sans rapport en un seul écran |
| 4 | « Mon entreprise » — le régime de TVA et sa périodicité séparés par le bloc bancaire |
| 5 | « Mon agenda » — Google et iCloud, tous deux hors de portée. **C'est vous qui tranchez** ce qu'on fait de ces raccordements |
| 6 | Équipe (proposition C), notifications, mot de passe, données, couleurs, IA, abonnement, compte |

**Toujours ouvert, et ce n'est dans aucun lot :** le texte secondaire de toute
l'application — 9,5 et 11,5 px dans un gris à 3 de contraste. Les Réglages n'en
sont qu'une partie.
