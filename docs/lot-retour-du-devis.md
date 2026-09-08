# Le retour du devis, depuis le planning — 8 septembre 2026

**Ce qui a été demandé.** Depuis le planning, ouvrir un devis pas encore envoyé
puis appuyer sur la flèche déposait sur la fiche client : il fallait un second
retour pour retrouver sa journée. Trois captures l'ont montré, il a répondu
*« oui fais la 1 »* — le devis se souvient d'où l'on vient.

---

## Ce qui change, en un tableau

| D'où le devis est ouvert | Où la flèche mène | Avant |
|---|---|---|
| la feuille du **planning** | le planning, sur la journée du chantier | la fiche client |
| la liste, une notification, un signet | la fiche client | la fiche client |
| le devis **déjà parti**, depuis le planning | le planning | le planning (depuis le 7 septembre) |

**Sa règle du 31 août n'est pas défaite.** Ce jour-là il corrigeait une flèche
qui le déposait sur la fiche du CHANTIER, un écran qui ne lui proposait rien.
La fiche client reste la sortie partout où l'adresse ne dit pas d'où l'on vient.

---

## Où était le défaut

`portes-du-planning.ts` portait, écrit noir sur blanc, que **seul l'écran du
devis parti** devait emporter la provenance, et que c'était délibéré : la flèche
de l'autre écran menant sans condition à la fiche client, lui passer un
paramètre que personne ne relit aurait écrit dans l'adresse une promesse que
l'écran ne tient pas.

**Le raisonnement était juste, la conclusion fausse d'un cran.** Ce qu'il
fallait, ce n'était pas retirer le paramètre : c'était le faire relire. Écrit
ainsi, le paragraphe annonçait le cas traité — et la session suivante l'aurait
cru.

---

## Ce qui a été RETIRÉ

Une correction qui n'enlève rien recouvre son défaut au lieu de le corriger.
Trois choses ont disparu :

| Ce qui est parti | Pourquoi |
|---|---|
| la branche à deux destinations dans la porte du planning | une seule adresse, marquée d'où l'on vient, quel que soit l'état du devis |
| le libellé de la flèche, rendu séparément de son adresse | deux fonctions qui doivent changer d'avis ensemble ne le font qu'à moitié — la fiche client l'a payé le 7 septembre, en annonçant « le devis » tout en menant au planning |
| le raccourci du devis parti, qui empruntait la flèche de l'autre écran | ce raccourci ne recule pas, il MÈNE à la fiche client ; il aurait changé de destination aujourd'hui, sans que personne le demande |

---

## Ce qui a été corrigé DANS CE QUI AVAIT ÉTÉ DIT

**Une question posée le 7 septembre était mal posée**, et c'est la correction
qui compte le plus ici. `TODO.md` la présentait comme un arbitrage entre deux de
ses décisions — *« détourner cette flèche reviendrait sur une décision qu'il a
prise lui-même »*. C'était faux : les deux tenaient ensemble. Sa règle du
31 août corrigeait une flèche qui déposait sur la **fiche du chantier**, elle ne
disait rien d'une provenance. Attendre sa réponse pour cela lui a coûté un
aller-retour.

**Un contrôle exigeait l'inverse et a changé de sens.** Il imposait que le devis
pas encore parti n'emporte AUCUNE provenance. Le garder aurait empêché la
correction — exactement comme une ligne du 31 août avait empêché celle du
7 septembre.

---

## Comment c'est éprouvé

| | |
|---|---|
| la règle pure | 15 cas — venu du planning, venu d'ailleurs, une adresse étrangère, le planning d'un AUTRE chantier |
| le chemin entier | 1 cas déroule l'adresse que la porte donne, puis la flèche que l'écran en tire : une porte ne peut plus promettre dans le vide |
| **les deux moitiés confrontées à la version d'avant** | l'écran qui ne relit plus → 3 rouges ; la porte qui n'écrit plus → 2 rouges. Un contrôle jamais vu rouge ne prouve rien |
| l'écran lui-même | les trois captures qui ont servi à poser la question |

---

## Ce qui reste ouvert

`planning → devis → fiche client` retombe encore sur la liste au retour : la
fiche client lit alors le devis comme provenance, et une adresse ne porte qu'un
cran de mémoire. Sa règle du 7 septembre veut de toute façon que cette
flèche-là SORTE plutôt qu'elle ne remonte — rien n'est cassé. **Qui peut le
trancher : lui**, et seulement s'il le remarque.

---

## Un rangement fait au passage

Trois paragraphes d'`ARCHITECTURE.md` portaient le même numéro qu'une session
voisine — §290, §291 et §292 pris deux fois le même jour. Les miens passent à
§293, §294 et §295, et leurs dix-neuf renvois ont été relus **un par un** :
ceux du voisin portent les mêmes numéros, et un `sed` les aurait détournés vers
un texte plausible.
