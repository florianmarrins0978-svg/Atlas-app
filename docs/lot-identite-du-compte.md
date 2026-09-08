# L'identité du compte — civilité, prénom, nom

**8 septembre 2026.** Votre demande, en regardant la planche de la porte et une
capture de Qonto :

> « Et l'identité comme sur la photo avec Mr. Madame nom prénom ? (également une
> info à rajouter dans les réglages également) »

Puis, devant le coût annoncé de trois colonnes neuves : **« oui fais-le »**.

---

## 1. Vous aviez raison de le pressentir

L'application ne gardait **qu'un seul champ** pour vous : `nom`. Pas de civilité,
pas de prénom séparé. La civilité existait bien dans le produit — mais seulement
pour **vos clients**, jamais pour vous.

| | Avant | Maintenant |
|---|---|---|
| Civilité | — | **Madame / Monsieur**, ou rien |
| Prénom | — | **une case à part** |
| Nom | le nom complet | le **nom de famille** |

---

## 2. Ce qui a été fait

| | |
|---|---|
| **Migration 0077** | deux colonnes sur `users`, avec la contrainte qui n'accepte que `mr` et `mme` |
| **Écran « Mon compte »** | Civilité (deux boutons), Prénom, Nom |
| **Une seule fonction compose le nom** | `src/lib/identite-personne.ts` — employée par l'écran, la liste de l'équipe et les appareils reconnus |

**Pourquoi une seule fonction.** Le nom d'une personne s'affiche à quatre
endroits. Quatre façons de le composer finiraient par diverger — c'est ce que la
règle du dépôt interdit, et c'est ce qui fait qu'un écran finit par montrer
« Amiot » quand un autre montre « Anne Amiot ».

---

## 3. LE PIÈGE QUI AURAIT COÛTÉ UNE SOIRÉE

`users` est **la seule table du dépôt dont les droits sont donnés colonne par
colonne**. C'était voulu : depuis août, l'application n'a plus le droit de lire
le mot de passe chiffré.

Conséquence : **une colonne neuve est invisible pour l'application** tant qu'on
ne lui en donne pas le droit explicitement. Sans les deux lignes ajoutées à la
migration, la lecture du compte aurait échoué sur un message qui accuse la
**table entière** — donc au mauvais endroit —, et l'on aurait cherché du côté de
l'isolation, qui n'a rien à voir.

**Un essai garde ce piège pour la prochaine colonne**, pas seulement pour
celles-ci.

---

## 4. CE QUI N'A PAS ÉTÉ FAIT, ET C'EST DÉLIBÉRÉ

**Aucun découpage automatique des noms existants.** Les comptes déjà créés
portent leur nom complet dans une seule case — « Anne Amiot ».

On aurait pu couper au premier espace. **On ne l'a pas fait** : « Jean-Pierre de
La Fontaine » ne se coupe pas ainsi, et un découpage automatique aurait fabriqué
des prénoms faux sur des comptes qui marchaient. Ces comptes gardent donc leur
nom entier et s'affichent **exactement comme hier**. Celui qui veut séparer les
deux le fera lui-même, en dix secondes et en connaissance de cause.

C'est le cas principal éprouvé par la suite des fonctions pures — pas un cas
limite : sans lui, une mise à jour aurait renommé des comptes en silence.

---

## 5. Trois défauts de MON fait, attrapés par vos garde-fous

Ils sont écrits ici parce que ce sont eux qui rendent le reste croyable.

| Le défaut | Le garde-fou qui l'a vu |
|---|---|
| L'exemption des actions gardées nommait encore l'ancienne fonction, disparue | `test-actions-gardees-db` |
| Mes boutons Madame/Monsieur étaient à angles droits | `test-boutons-arrondis` — votre règle du 12 août : la même forme partout |
| Ils peignaient le vert pin au lieu du jeton des boutons pleins — **illisible sur vos deux chartes sombres** | `test-boutons-pleins` |

---

## 6. Les chiffres

| Contrôle | Résultat |
|---|---|
| Types, lint, mémoire | **vert** |
| **Suites base de données** | **313/323** |
| **Connexion derrière un proxy** | **vert** |
| Suites navigateur | *(voir §7)* |

**Les 10 rouges des suites base ne sont pas de ce lot** : ce sont les pannes
d'infrastructure que le dépôt traîne déjà — port du banc, veilleur, verrou de
construction, mise à jour du rôle. Elles rougissaient avant, elles rougissent
après.

**Mes deux suites à moi sont vertes** : 16/16 sur le compte en base, 14/14 sur
les fonctions pures.

---

## 7. Ce qui reste ouvert, et pour qui

| Point | Qui |
|---|---|
| Les 17 suites navigateur rouges — devis, dates, factures, TVA, message au client — sont **dans le domaine d'une autre session** qui travaillait en même temps dans le même dossier | à mesurer sur `main` propre, c'est en cours |
| Faut-il **afficher la civilité** sur les documents qui partent chez vos clients ? Aujourd'hui elle ne sert qu'à l'écran | **vous** |
| Faut-il **reprendre** civilité, prénom et nom depuis la porte quand elle sera codée ? La maquette les demande déjà | **vous** |
