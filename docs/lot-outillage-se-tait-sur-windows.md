# Les suites d'outillage sur ton PC — compte rendu

*20 septembre 2026. Lot `lot/outillage-se-tait-sur-windows`, deux commits
(`f017a5c0`, `eb7aa833`), joué dans un dossier à part. **Pas encore sur
`main`** : niveau 3, la batterie entière attend ton feu vert.*

---

## Ce que tu as demandé

Vérifier que les suites d'outillage se **taisent** sur ta machine au lieu de
rougir, lire la dernière ligne de `npm test`, corriger celles qui rougissent
encore.

## Ce que ça a donné

| | La dernière ligne de `npm test` | Rouges |
|---|---|---|
| **avant** le lot | `383/398 suites réussies. 2 non mesurable(s) ici.` | 13 |
| **après** le lot | `389/398 suites réussies. 8 non mesurable(s) ici.` | 1 — corrigé, rejoué vert seul |

Le mécanisme du matin ne faisait taire que **trois** suites : celles qui
appellent `npx`. Tout le reste répond sur ton PC — `bash`, `gh`, `curl` sont
là — donc les suites tournaient, et treize tombaient pour **d'autres raisons**.

---

## Les treize rouges, et d'où ils venaient

| La suite | La vraie cause | Ce qui a été fait |
|---|---|---|
| `batterie-solitaire`, `garde-fusion-main`, `mise-a-jour-role-db` | les chemins s'écrivaient avec la barre inversée de Windows ; tout le reste attend celle de git | corrigé **à la source** (l'empreinte des fichiers), et les deux rustines qui compensaient plus loin sont **retirées** |
| `garde-fusion-main`, `mise-a-jour-espace`, `migrations-banc` | ton git réécrit les fins de ligne (`CRLF`) : un fichier « change » sans qu'on l'ait touché | les dépôts d'essai qui imitent ton espace Linux se montent sans cette réécriture |
| `secret-authentification-db` (5 rouges) | la suite lisait une variable que personne ne pose, et interrogeait **une autre base** que celle où elle avait posé son décor | elle lit la même variable que toutes les suites base |
| `fiche-pendant-relance`, `port-remesure`, `verrou-construction`, `relance-construction`, `ouvrir-port`, `ouvrir-session` | elles emploient des mécanismes que **Windows n'a pas** : arrêter un groupe de processus, lancer un script `#!/bin/sh`, un `PATH` séparé par `:` | elles le **déclarent**, et se taisent en le nommant — même règle que pour un outil absent |
| `version-executee` | elle exigeait le nom de la branche, donc « HEAD » dans un dossier de batterie détaché — l'état recommandé par le dépôt | elle mesure l'autre moitié de la règle : un arbre détaché n'affiche **aucune** branche |

Et un rouge apparu **par** la correction : `portee-batterie` éprouvait la
rustine retirée. La règle qu'il défend (une commande proposée se recopie sans
barre inversée) n'a pas changé ; le contrôle la mesure désormais là où elle vit.

## Ce que la mesure a laissé derrière, et qui est réglé

Pendant la première mesure, les six suites « Windows n'a pas ça » ont laissé
**cinq processus orphelins** sur ton PC — des veilleurs d'essai que la suite
croyait avoir arrêtés, et qui écrivaient dans un dossier temporaire toutes les
deux secondes. Ils sont arrêtés, par leur numéro. Un contrôle refuse désormais
une suite qui arrête un groupe de processus sans le déclarer : ça ne peut plus
se reproduire.

## Ce qui n'est PAS une liste d'exemptions

Aucune suite n'est « dispensée sur Windows ». Chacune déclare **ce qu'elle
emploie** — un fait sur elle, vrai partout — et c'est ta machine qu'on
interroge. Sur ton espace Linux, les huit muettes mesurent exactement comme
avant. Un contrôle vérifie qu'un mécanisme déclaré est un mécanisme réellement
employé dans la suite, et l'inverse pour les groupes de processus.

---

## Ce qui reste, et qui décide

| | Qui |
|---|---|
| lancer la batterie complète (~50 min, dans mon dossier à part, atelier 4) — le lot est de niveau 3 | **toi** : un mot |
| pousser sur `main` une fois vert | **toi** : un mot |

Les huit suites muettes chez toi ne sont **pas** éprouvées sur ton PC — c'est
le principe — ; elles le sont sur ton espace et en CI, qui ont ce que Windows
n'a pas.

*Le détail technique est dans `ARCHITECTURE.md` §394 et `CHANGELOG.md` du
20 septembre.*
