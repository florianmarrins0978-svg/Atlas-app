# Le plan d'arrosage repris — ce qui a été trouvé, corrigé, refusé, et ce qui reste

*Document de retour du lot du 11 septembre 2026. Il se tient à jour ; la
version consultable est `docs/lot-arrosage-impeccable.html`.*

## En cinq lignes

Le plan d'arrosage n'avait pas été repris depuis le 20 août. La lecture a trouvé
trois endroits où il rendait un plan faux, et **deux de vos règles perdues** —
le quinconce du couloir (18 août) et l'antenne Ø16 de 2 m au plus. Tout est
corrigé à la racine, l'écran est refait sur la maquette que vous avez vue, et
**dix-sept de vos règles vivent désormais dans une suite qu'aucune session ne
peut réécrire**. Un point reste à trancher par vous, en bas.

## Ce qui a été trouvé, et le verdict

| Point | Ce qui se passait | Verdict | Où c'est fondé |
|---|---|---|---|
| Sans nourrice, le plan sortait quand même | la lecture ne faisait qu'une réserve, et la liste des pièces partait — avec une ligne rouge sous vingt-trois lignes | **corrigé** : aucun plan, les trois éléments cochés un par un, le manquant en rouge, un seul geste | `src/lib/arrosage/croquis-complet.ts`, `actions.ts` |
| La liste des pièces ne disait pas ce que le plan dessinait | vos deux pelouses : liste 8 tés + 4 coudes + 2 tés égaux, dessin 7 + 5 + 0 — aucune suite ne les confrontait | **corrigé** : les raccords se lisent sur le tracé, réseau par réseau | `src/lib/arrosage/pieces.ts` |
| Ni tuyau Ø25, ni amenée, ni té du compteur dans la liste | la page publiée les ajoutait depuis une case saisie ; l'application n'a pas cette case | **corrigé** : la zone « du compteur à la nourrice » existe, avec le té égal 25×25×25 ; le Ø25 des réseaux est mesuré sur le tracé | `pieces.ts` |
| Une tête à trois branches perdait son té égal | c'est vous qui l'avez lu sur la maquette | **corrigé** : chaque branche au-delà de deux est un té égal, et son losange se dessine à côté de la tête | `plan-dessine.ts` |
| L'amenée comptée pour 30 m sans un mot | le chiffre entrait dans la pression au dernier arroseur ; « 0,27 bar dans l'amenée » s'affichait comme un fait | **corrigé, sur votre réponse « calculée, ni lue ni supposée »** : la place du piquage se lit sur le croquis comme celle de la nourrice, et la longueur se calcule entre les deux à l'échelle des cotes. Sans piquage dessiné, pas de plan | `geometrie-croquis.ts` `longueurDeLAmenee`, `lire-croquis.ts`, `croquis-complet.ts` |
| Les réserves disparaissaient après une discussion | « trop peu de pression » tombait au premier message | **corrigé** : une seule fonction pour les deux chemins | `actions.ts`, `lePlan()` |
| Le dessin aveugle sur Nuit et Sylve | six couleurs écrites en clair ; la nourrice en noir sur une carte noire | **corrigé**, et les quatre fichiers sont sous surveillance | `PlanDessine.tsx`, `test-aucune-couleur-en-clair.ts` |
| Deux listes de réseaux pour les mêmes vannes | huit cartes pour quatre réseaux ; vous les reliiez au carré de couleur | **corrigé** : une carte par réseau — la pelouse, la buse, ce qu'elle consomme, ce qu'elle emporte | `ArrosageClient.tsx` |
| Les réserves sous vingt-trois lignes de pièces | « pas dessiné », « trop peu de pression » se lisaient en dernier, ou jamais | **corrigé** : sous le dessin | `ArrosageClient.tsx` |
| Deux symboles au même point, l'un sur l'autre | votre règle du jour | **corrigé** : côte à côte, le point vrai ne bouge pas | `plan-dessine.ts`, `ecarterLesSymboles` |

## Vos deux règles retrouvées

**Le quinconce du couloir — 18 août.** Votre croquis : 10 × 2 m, sept tuyères
en quinconce. L'application en posait douze alignées depuis le 24 août. La
cause : le garde-fou « jamais sous la portée » mesurait le **pas des colonnes**
(1,67 m) au lieu de la **distance entre deux tuyères** du damier (2,60 m). Le
contrôle qui tenait votre règle est devenu rouge ce jour-là, et il a été réécrit
au lieu d'être compris. Corrigé dans le calcul ; le couloir rend 7.

**L'antenne Ø16 — donnée avant le 11 septembre, jamais écrite.** *« Un seul
passage pour le 25, des antennes en 16 rigide de part et d'autre, 2 m au
maximum. »* Le tracé amenait le Ø25 jusqu'à chaque tuyère. Il passe maintenant
au milieu d'un couloir jusqu'à 4 m, et va chercher chaque tête par une antenne
d'un demi-couloir ; au-delà de 4 m, la ligne repasse au pied des têtes. Sur
votre couloir de 10 × 3 : une tranchée de 10 m, sept antennes de 1,50 m.

## Ce qui empêche que ça recommence

| | |
|---|---|
| `scripts/test-regles-du-patron.ts` | dix-sept entrées, chacune une phrase de vous, datée, éprouvée sur l'exemple que vous avez donné avec elle. Elle rougit sur le code d'hier (12 tuyères au lieu de 7 — vérifié) |
| `scripts/garde-regles-du-patron.mjs` | branché sur chaque geste de chaque session : le fichier ne s'écrase pas, une entrée existante ne se modifie pas, ni par l'éditeur ni par le terminal. On ne peut qu'**ajouter** |
| la règle écrite | un rouge dans cette suite ne se réécrit jamais : soit le code a tort, soit c'est **vous** qui avez changé la règle — alors votre phrase s'ajoute, l'ancienne reste barrée |

## Ce qui a été fait autrement, et pourquoi

- **Le damier reste réservé aux tuyères.** Avec la bonne mesure, il devient
  possible sur les turbines : votre carré de 12 × 12 tomberait à **6 turbines**
  au lieu des 9 que vous avez dessinées le 23 août. Je n'ai pas tranché à votre
  place : vos 9 sont gardées (question plus bas).
- **Le calcul n'a pas été réécrit en TypeScript** pour lire le tracé : ce serait
  une seconde façon de calculer un plan. Les pièces se lisent à la frontière,
  une fois, dans `pieces.ts`. Le comptage par rangées de la page publiée reste
  pour elle seule, et part avec elle.
- **Le piquage se lit désormais sur le croquis**, comme la nourrice — c'est sa
  place qui donne l'amenée. Le déroulant « compteur / robinet » reste : lui
  commande le débit.

## Ce qui a été dit et qui s'est révélé inexact

- J'avais écrit dans la maquette que « les infos sont bonnes ». Le compte du té
  égal l'était ; **le dessin du couloir ne l'était pas** — il reproduisait le
  plan de l'application, contraire à votre règle du 18 août. C'est vous qui
  l'avez vu.
- La règle de l'antenne de 2 m n'était nulle part dans le dépôt : je vous ai
  demandé de la redonner. Elle est écrite dans `CLAUDE.md` §4 bis avec vos mots.

## Les chiffres de la batterie

Jouée deux fois le 11 septembre 2026, sur votre poste Windows.

| | Dans le dossier principal | Dans le dossier 5, sur le lot seul |
|---|---|---|
| Types, lint, construction | **rouges** — le travail non enregistré d'une autre session (`abonnements.ts`), pas le lot | **verts** |
| Mémoire du dépôt | vert | vert |
| Suites base | 349 / 357 | 345 / 355 |
| Suites navigateur | non jouées (pas de construction) | 117 / 143 |
| Connexion derrière un proxy | vert | vert |

**Tout ce qui touche l'arrosage est vert** : `test-arrosage-calcul`,
`test-plan-dessine`, `test-trace-arrosage`, `test-consignes-arrosage`,
`test-geometrie-croquis`, `test-lecture-croquis`, `test-discussion-plan`,
`test-arrosage-e2e` (15 sur 15 au navigateur), `test-regles-du-patron` (17
règles), `test-garde-regles-du-patron` (30), et le contrôle de la page publiée
(`essai-arrosage-detaille`, 78 sur 78).

**Les rouges, et ce qu'ils sont :**

- les 8 à 10 suites base rouges sont les suites d'infrastructure qui rougissent
  déjà sur `main` sur ce poste (verrou de batterie, port du banc, relance de
  construction, seed, version exécutée…) — aucune ne touche l'arrosage ;
- les 26 suites navigateur rouges ne touchent pas l'arrosage non plus (devis
  complet, anneau de dictée, suivi de devis, planning…). **Témoin joué sur le
  commit juste avant le lot, même dossier, même machine : elles tombent
  exactement pareil (0 / 4 sur l'échantillon).** Elles sont rouges sur `main`
  sur ce poste, pas à cause du lot. Ce point est ouvert plus bas.

Journaux : `batterie.log`, `batterie-s5-2.log`, `e2e-temoin.log`,
`e2e-temoin-main.log` dans le dossier de travail de la session.

## Ce qui reste ouvert, et qui tranche

| | Aujourd'hui | Qui |
|---|---|---|
| **Le damier pour les turbines des grandes pelouses** — le 18 août vous disiez « pour les grands espaces, faire la même » ; le 23 vous avez dessiné 9 alignées sur 12 × 12 | tuyères seulement ; le 12 × 12 donnerait 6 en damier | **vous** |
| ~~**La longueur d'amenée**~~ — **tranchée le 11 septembre : calculée** sur le croquis, du piquage à la nourrice | la lecture de la place du piquage se vérifie sur votre espace, comme celle de la nourrice (`npm run verifier:croquis`) | **votre espace** |
| **Les positions sur une vraie photo** | jamais éprouvées ici | **votre espace** |
| **La page publiée `arrosage.html`** — en sursis depuis le 20 août | une fois l'écran validé, elle n'a plus de raison d'être | **vous** |
| **26 suites navigateur rouges sur `main`, sur votre poste** — devis complet, anneau, suivi de devis… — identiques avec et sans le lot | à regarder par la session qui porte ces écrans : ce lot ne les touche pas | **une autre session** |
