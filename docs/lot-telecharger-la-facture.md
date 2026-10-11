# « Quand je clique sur télécharger, ça ne la télécharge pas »

> ## ⚠ CORRECTION DU 10 SEPTEMBRE 2026 — ce correctif était faux
>
> Ce qui est écrit plus bas a **cassé l'ouverture de vos documents**. Vos deux
> captures : *« j'ai essayé de télécharger la facture. Une fois que je l'ouvre,
> page blanche »*, puis *« même problème avec le devis »*.
>
> Le fichier, lui, était bon — nous l'avons téléchargé et relu entièrement.
>
> **Ce qui n'allait pas :** pour forcer l'enregistrement, le serveur annonçait
> vos téléchargements comme des fichiers **sans type**, au lieu de PDF. Ce type
> reste collé au fichier une fois enregistré : en le rouvrant, votre iPhone ne
> savait plus qu'il tenait un PDF, et n'avait plus rien pour l'afficher.
>
> **C'est réparé** : un fichier annonce désormais toujours ce qu'il est. Ce qui
> le fait descendre plutôt que s'ouvrir, c'est l'autre en-tête (`attachment`),
> et lui seul.
>
> **Ce qui n'a PAS changé :** la protection anti-retouche de vos devis. Elle
> avait été soupçonnée à tort, et c'est vous qui avez redressé la recherche —
> *« avant ça fonctionnait, donc il y a quelque chose qui a buggé »*.

**7 septembre 2026.** Votre message du matin, sous votre facture
F2026-000001.

---

## Ce qui se passait

Le lien **était** juste, et le serveur répondait bien « range ce fichier ». Ce
qui manquait, c'est ce qu'on lui disait du fichier : on l'annonçait comme un
**PDF**. Or un PDF, Safari sait le peindre — alors il le peint, et il
n'enregistre rien. Le geste paraît sans effet : il montre au lieu de ranger.

C'est réparé : une adresse de téléchargement annonce désormais un fichier que le
navigateur **ne sait pas afficher**. Il ne lui reste qu'à l'enregistrer.

L'aperçu (« Voir la facture en PDF ») n'a pas changé d'un pouce.

---

## Ce que je ne peux pas vous promettre, et je préfère l'écrire

**Je n'ai pas pu reproduire votre panne, et je n'ai pas pu éprouver le
correctif là où il compte.** Le moteur de Safari ne s'installe pas sur ma
machine — le réseau me le refuse. Chromium, lui, rangeait déjà le fichier
**avant** la correction : il ne pouvait pas voir le défaut, et il ne peut pas
prouver qu'il est parti.

**Ce sur quoi je m'appuie n'est pas une intuition.** Le 7 août, sur votre
iPhone, votre sauvegarde était arrivée sous le nom « reglages », sans
extension : votre Safari ne lit pas le nom que le serveur lui donne. Un
navigateur qui ignore le nom n'a aucune raison de respecter la consigne
« enregistre-le » — et ce jour-là le fichier descendait quand même, parce qu'un
`.zip` ne s'affiche pas. Un PDF, si.

**Donc c'est vous qui tranchez.** Rechargez la page de la facture, appuyez sur
« Télécharger ».

| Ce que vous voyez | Ce que ça veut dire |
|---|---|
| le fichier s'enregistre (une feuille peut demander de confirmer — c'est iOS) | **c'est réglé** |
| la facture s'ouvre encore | dites-le-moi : la correction n'est pas arrivée jusqu'à votre espace |
| toujours rien du tout | dites-le-moi aussi : ce n'est pas la même panne, et l'écran ne vous dit rien — c'est ce qu'il faudra corriger d'abord |

---

## Ce qui a été corrigé en même temps, sans que vous l'ayez demandé

Cinq écrans servaient ce même téléchargement, chacun à sa façon — et ils
avaient déjà pris des chemins différents.

| | |
|---|---|
| **la facture et le devis** (votre écran) | même défaut, même correction |
| **la fiche de chantier** | même défaut ; c'était la seule à savoir écrire un nom accentué |
| **la page de votre client** (devis, facture) | même défaut : il croyait garder son devis alors qu'il ne faisait que le regarder |
| **un nom de chantier avec un accent** | faisait tomber la réponse entière sur quatre routes sur cinq — un fichier qui n'arrive pas du tout |

La règle vit maintenant à **un seul endroit** (`src/lib/remise-de-fichier.ts`).
Écrite cinq fois, elle se corrigeait une fois sur cinq.

---

## Ce que j'ai refusé de faire, et ce que ça vous aurait coûté

**Faire passer le téléchargement par du code, pour pouvoir afficher une
erreur.** C'était tentant : aujourd'hui, si quelque chose se refuse, votre écran
ne dit **rien** du tout. Mais cela remplacerait un mécanisme natif — qui marche
partout ailleurs — par un mécanisme qui dépend de ce que ce même Safari fait
d'un fichier fabriqué dans la page. On soignerait un doute avec un second doute,
et sur l'écran qui engage votre comptabilité.

Si vous me dites qu'il ne se passe toujours **rien**, c'est ce qu'il faudra
faire — mais dans ce sens-là : d'abord rendre le refus visible, puis corriger ce
qu'il désigne.

---

## Ce que ce défaut apprend sur mes contrôles

**Trois contrôles vérifiaient ce téléchargement. Les trois étaient verts.** Ils
interrogeaient le serveur sans jamais appuyer sur le lien — la moitié que je
venais d'écrire, jamais le chemin que vous prenez, vous.

Deux choses ont changé :

- la suite de la facture **appuie pour de bon** sur « Télécharger », et exige
  qu'un fichier descende ;
- elle refuse désormais qu'une adresse de téléchargement annonce un type que le
  navigateur sait afficher — c'est le défaut du jour, et il ne peut plus
  repasser en silence.

Un huitième contrôle, sans base ni réseau, tient la règle elle-même
(`scripts/test-remise-de-fichier.ts`). Je l'ai confronté à la version qui vous a
gêné : il rougit dessus.

---

## Les chiffres

| Étape | Verdict |
|---|---|
| Types, lint, construction | ✅ |
| Mémoire du dépôt | ✅ |
| Suites base de données | ✅ **toutes** |
| Connexion derrière un proxy | ✅ |
| Les 5 suites navigateur qui touchent ce lot | **4 sur 5** — détail ci-dessous |

**Le nouveau contrôle dit ce qu'on voulait lui faire dire :**
`✓ l'appui fait descendre F2026-000001.pdf (8189 octets)`. Il APPUIE sur le
lien, il n'interroge plus le serveur.

**Le rouge, et il n'est pas de ce lot :** sur la page de votre client, « tout
tient dans un écran » mesure 665 px pour 664 px disponibles — **un pixel**.
Ce lot ne touche aucun écran : il ne change que des en-têtes de réponse
(17 fichiers, zéro ligne d'affichage). Ce pixel était déjà là avant, et il
reste à traiter.

**Et la batterie complète n'a pas pu être jouée d'une traite sur ma machine :**
le serveur d'essai y meurt en mémoire au bout de deux suites — panne connue, un
outil existe pour la contourner (`scripts/jouer-suites-par-groupes.mjs`, écrit
le 30 août pour ça). Le rejeu par groupes était au sixième sur vingt-deux quand
vous avez demandé l'envoi ; je l'ai arrêté pour jouer d'abord les cinq suites
qui touchent ce lot. **Trois rouges y étaient apparus, aucun sur ce lot** (une
dictée, un lien de planning, un appui intercepté).

---

## Ce qui reste ouvert

| Quoi | Qui peut trancher |
|---|---|
| Est-ce que ça télécharge, sur votre iPhone ? | **vous**, en une minute |
| L'écran ne dit rien quand un téléchargement se refuse | moi, si votre réponse est « toujours rien » |
