# Facturer sans passer par la case devis — ce qui a été fait

*11 septembre 2026. Document de clôture du lot, à transmettre tel quel.*

---

## Ce que vous aviez demandé, et où ça en est

> *« Il faut que l'on puisse facturer sans avoir besoin de passer par la case
> devis. »* (10 septembre)

> *« Sous retour d'intervention, collé à droite, tu mets créer une facture en
> doré, comme tu as fait le bouton vide contour doré. »* (11 septembre)

> *« Reprends un maximum la façon et le style qui existe déjà pour faire et
> envoyer les devis — je parle dans la disposition des boutons, des tailles. »*

**Le parcours entier est codé.** Cinq gestes, et rien d'inventé au milieu :

| | |
|---|---|
| 1 | **Créer une facture**, dans Terminés |
| 2 | La **fiche client** s'ouvre — nom, téléphone, e-mail, adresse |
| 3 | **Faire la facture** → le client, le chantier et la facture existent |
| 4 | **Remplir la facture** → vos lignes, chacune avec sa TVA |
| 5 | **Envoyer la facture** → votre SMS ou votre e-mail, message déjà écrit |

Le chantier part **directement dans Terminés**, comme vous l'aviez demandé.

---

## Un verdict par point

| Votre point | Verdict | Ce qui le fonde |
|---|---|---|
| Facturer sans devis | **fait** | `drizzle/0086_facture_sans_devis.sql` |
| La porte dans Terminés | **fait** | `src/app/termines/ListeTermines.tsx` |
| Bouton doré, collé à droite, contour vide | **fait** | mesuré à 26 px du bord, 44 px de haut |
| Reprendre le style des devis | **fait** | mêmes pièces, pas des copies — voir plus bas |
| La 4ᵉ pastille sur la même ligne | **refusé, mesures à l'appui** | elle déborde de 75 px sur votre téléphone |

---

## Ce que j'ai fait AUTREMENT que demandé, et pourquoi

### La quatrième pastille ne pouvait pas tenir

Vous vouliez « Créer une facture » à côté de « Retours d'intervention », sur la
même ligne. **Ce n'était pas un avis, c'est une mesure :** cette rangée prend
déjà **300 px sur les 306** d'un écran de 360 — et c'est vous qui l'aviez fait
resserrer le 9 septembre pour que les trois y tiennent.

J'ai cherché la place plutôt que de vous dire non : **cinq resserrements
différents, mesurés aux trois largeurs** (`appli/faire-rentrer-les-quatre.html`,
la planche se mesure elle-même). Tous achetaient la place en coupant un mot.

**C'est vous qui avez trouvé la sortie** — la seconde rangée. Elle ne coûte
qu'un peu de hauteur, et les deux noms restent entiers. Je cherchais à faire
tenir quatre pastilles sur une ligne parce que j'avais borné la question ainsi.

### Ce qui a été RETIRÉ de la fiche client quand elle facture

La note vocale, les photos et la dictée des coordonnées. Ce n'est pas un oubli :
ces trois pièces nourrissent le **chiffrage**, et il n'y a pas de devis ici.
*« On ne dicte pas une facture qu'on tape. »*

---

## Ce que j'ai ajouté et que personne n'avait demandé

### Une facture vide ne peut plus partir

Née d'un devis, une facture arrive avec ses lignes. **Née sans devis, elle naît
vide** — et rien n'empêchait de l'envoyer telle quelle. Votre client aurait reçu
une pièce comptable à **0,00 €**, immuable, qui ne se corrige que par un avoir.

L'envoi est donc fermé tant que la facture ne porte rien, **et le refus nomme le
geste qui le lève** : un bouton grisé sans un mot se lit comme une application
en panne.

### « Reprendre le devis » est refusé sur une facture directe

C'est le refus qui coûtait le plus cher. Ce geste efface les lignes pour
recopier le devis — sur une facture faite sans devis, **c'est toute la
facture**. Un devis écrit après coup sur le même chantier vous aurait fait
perdre votre saisie entière d'un seul appui.

---

## Ce que j'ai dit et qui était FAUX

**« La quatrième pastille est impossible. »** C'était vrai du dessin
d'aujourd'hui, pas de tout dessin possible. Vous avez eu raison de me faire
chercher : il y avait bien une solution, et c'est la vôtre.

**Mon premier contrôle a accusé du code juste.** Il lisait l'écran de la facture
avant que celui-ci ait fini de s'afficher, et concluait « l'écran ne parle pas
de facture » — sur un produit qui marchait. Corrigé : il attend désormais la
chose qu'il va lire.

**Un de mes contrôles était vert sans rien prouver.** Il annonçait vérifier
qu'un chantier avec devis est refusé ; en réalité il déclenchait un autre refus
(« déjà facturé »), qui passe en premier. Le cas qu'il prétendait tenir n'était
jamais atteint.

---

## Ce qui a été repris du devis, plutôt que recopié

Vous avez demandé de reprendre au maximum ce qui existe. **Ce sont les mêmes
pièces, pas des copies** — c'est ce qui les empêche de diverger :

| | |
|---|---|
| la fiche client | **le même écran**, avec un réglage — pas un jumeau |
| les champs de saisie des lignes | ceux du devis (`ChampsDuDevis`) |
| le choix SMS / e-mail | la même capsule (`ChoixCanal`) |
| les boutons | `PrimaryButton`, mêmes tailles, même disposition |
| la règle « ça ne peut pas partir vide » | celle du devis, élargie — pas une seconde |

---

## Ce que ça a obligé à renommer

Trois fonctions mentaient sur ce qu'elles font, depuis qu'elles servent aussi la
facture : elles s'appellent désormais `ajouterLigneDeFacture`,
`majLigneDeFacture`, `retirerLignesDeFacture`. Et la règle du devis vide est
devenue `peutPreparerLaPiece` — elle prend le nom de la pièce, pour qu'un écran
de facture ne dise **jamais** « devis ».

---

## La TVA : rien de nouveau, et c'est voulu

Vous avez tranché le 11 septembre : **le schéma des factures normales, sans
exception**. Une facture sans devis part par SMS ou e-mail, puis entre dans la
TVA selon votre réglage — à l'émission, ou quand le client paie. Le réglage
« Réglée sur place » dessiné sur la planche est écarté, à votre demande
(*« généralement les factures sont envoyées et non réglées direct »*).

Deux contrôles le tiennent, pour que ça reste vrai : aux débits, elle est au
relevé le jour même ; aux encaissements, elle attend « Payée », puis y entre.

---

## Les chiffres de la batterie

Cette machine n'a pas les clés IA : **38 suites sont rouges sur `main` seule**
(dictée, transcription, banc d'essai). J'ai donc joué la même batterie sur
`main` sans mon lot, pour comparer rouge à rouge.

| | |
|---|---|
| batterie complète, mon lot | 35 rouges — **aucun nouveau** par rapport à `main` |
| suites base de mon domaine (18) | **18 vertes** |
| suites navigateur de mon domaine (8) | 7 vertes ; la huitième est rouge sur `main` aussi |
| `test-facture-sans-devis-db` | **16 / 16** |
| `test-facture-sans-devis-e2e` — votre chemin, depuis Terminés | **9 / 9**, sur une base vierge |
| `test-lignes-corrigeables` | 4 / 4 |

**Deux défauts sont sortis d'une capture, pas d'un test :** sur une base neuve,
la porte disparaissait avec la liste vide de Terminés (corrigé : les portes
restent) ; et un bouton éteint perdait son repère (corrigé dans la pièce
partagée).

---

## Ce qui reste ouvert, et qui peut le trancher

| Quoi | Qui |
|---|---|
| La hauteur que la seconde rangée pousse vers le bas (54 px) | **vous**, si ça vous gêne à l'usage |
| Les suites qui dépendent des clés IA ne peuvent pas être jouées ici | se vérifient sur **votre espace** |
| Le SMS et l'e-mail qui s'ouvrent vraiment, et la facture reçue par le client | **votre espace**, sur votre téléphone |
