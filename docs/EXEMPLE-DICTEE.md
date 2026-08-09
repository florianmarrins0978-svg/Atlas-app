# La dictée de référence

Ce document tient **une vraie note vocale du patron**, dictée le 5 août 2026, et
ce que l'application en fait. Il sert d'étalon : c'est sur lui qu'on mesure si
l'agent fait le travail, au lieu de l'affirmer.

Il a été demandé parce que sans lui, on devine le métier du patron au lieu de le
connaître. Une seule note réelle vaut mieux que dix suppositions.

---

## 1. La note, mot pour mot

> Alors il y a une taille de haie de laurier, vingt mètres de long, un chêne mort
> à abattre, de vingt mètres de haut. On coupe le bois en cinquante centimètres,
> on le laisse sur place, on le fend. Pour ce faire, on aura besoin d'un camion,
> un broyeur et une fendeuse. J'estime le temps de travail à deux jours deux
> hommes.

Non retouchée. Les « Alors il y a » et les « Pour ce faire » en font partie :
c'est ainsi qu'on parle sur un chantier, et c'est ce que l'agent doit savoir
traverser.

---

## 2. Ce que l'application en fait en mode déterministe

Relevé le 5 août 2026, avec `LLM_PROVIDER=dev` :

```
PRESTATIONS :
  • Alors il y a une taille de haie de laurier
  • vingt mètres de long
  • un chêne mort à abattre
  • de vingt mètres de haut
  • on le laisse sur place
  • on le fend
  • Pour ce faire
  • on aura besoin d'un camion
  • un broyeur et une fendeuse

MATÉRIEL : (vide)
DURÉE : deux jours   ÉQUIPE : deux hommes
DÉCHETS : On coupe le bois en cinquante centimètres
AMBIGUÏTÉS : (aucune)   MANQUANT : (rien)
```

**Ce qu'il faut en retenir**, et qui explique tout le reste :

- « **Pour ce faire** » est devenu une prestation. « vingt mètres de long »
  aussi — une quantité promue en ligne de devis.
- Le camion, le broyeur et la fendeuse sont classés en **prestations** ; la case
  **Matériel est vide**.
- « Déchets » a capté la mauvaise phrase.
- **Rien n'est signalé** : ni ambiguïté, ni information manquante. L'agent
  affirme avoir tout compris.

C'est un découpage aux virgules, pas une compréhension. Le patron l'a nommé
avant de voir ce relevé : *« un traducteur recopieur de ce que j'énonce »*.

**Ce n'est pas un défaut à corriger dans ce mode** : le fournisseur `dev` existe
pour ne rien envoyer chez personne, pas pour comprendre. Le défaut était de
laisser croire que c'était l'agent (corrigé — voir `src/lib/etat-ia.ts`).

---

## 3. Ce que la note dit vraiment

Lecture humaine, à comparer à ce que produira un vrai modèle.

### Prestations

| Ligne | Quantité dite ? |
|---|---|
| Taille de haie de laurier | **20 ml** — explicite |
| Abattage d'un chêne mort, 20 m de haut | 1, hauteur explicite |
| Coupe du bois en billons de 50 cm | pas de volume dit |
| Fendage du bois | pas de volume dit |

### Matériel

Camion, broyeur, fendeuse.

### Chantier

Deux jours, deux hommes. **Bois laissé sur place** — donc pas d'évacuation du
bois, ce qui *retire* une ligne habituelle plutôt que d'en ajouter une.

### Ce qui manque, et qu'il faut signaler

1. **Comment le chêne est abattu — au pied, ou par démontage ?** La note ne le
   dit pas, et le patron a indiqué que la difficulté technique pèse sur son
   prix. C'est le trou le plus coûteux de cette note.
2. **La hauteur et la largeur de la haie.** Vingt mètres de long ne suffisent
   pas à chiffrer une taille.
3. **Que broie-t-on ?** Le bois est laissé sur place et fendu, mais un broyeur
   est demandé — vraisemblablement pour les branchages. Non dit.
4. **Accès au chantier** — jamais évoqué.

### Le piège de cette note

**« Vingt mètres » apparaît deux fois et ne désigne pas la même chose** : la
longueur de la haie, puis la hauteur du chêne. Un modèle qui rattache la seconde
à la première produit un devis faux et vraisemblable — le pire des deux mondes.

C'est le premier cas à vérifier sur tout fournisseur retenu.

---

## 4. Le devis que le patron aurait écrit

### Sa forme — répondu le 5 août 2026

**Une ligne par prestation.** Pour cette note, quatre lignes :

| # | Ligne | Quantité |
|---|---|---|
| 1 | Taille de haie de laurier | 20 ml |
| 2 | Abattage du chêne mort | 1 |
| 3 | Coupe du bois en billons de 50 cm | — |
| 4 | Fendage du bois | — |

**Ce qui ne figure PAS sur le devis, et pourquoi ça compte quand même :**

| | Sur le devis ? | Ce que l'agent doit en faire |
|---|---|---|
| **2 jours × 2 hommes** | Non | *« Ça me sert à vérifier mon prix. »* Donc l'agent ne l'écrit pas, mais **il peut en déduire le taux réel du patron** en rapprochant le total des jours-hommes. C'est un des meilleurs signaux d'apprentissage disponibles, et il est déjà dans chaque dictée. |
| **Camion, broyeur, fendeuse** | Non | *« Ça change le prix. »* Invisible pour le client, mais un chantier qui demande une fendeuse ne vaut pas un chantier qui n'en demande pas. **Règle à apprendre du patron**, pas à deviner. |

### Le chêne : la question que l'agent DOIT poser

À « votre prix suppose un démontage en corde ou un abattage au pied ? », la
réponse est **« l'un ou l'autre »**.

C'est la conclusion la plus utile de cet exemple : **la note ne permet pas de le
savoir, et le prix en dépend.** L'agent ne doit donc ni supposer, ni choisir. Il
signale — et pour un arbre **mort**, où le démontage est fréquent, la question
mérite d'être posée systématiquement plutôt que laissée dans un coin.

### Les montants — donnés par le patron le 5 août 2026

**Le devis compte trois lignes, pas quatre :** le billonnage est *compris dans
l'abattage*. L'agent ne doit donc pas créer cette ligne, alors même que la
dictée mentionne la coupe en 50 cm.

| # | Ligne | Prix HT |
|---|---|---|
| 1 | Taille de haie de laurier, 20 ml | **350 €** — soit 17,50 €/ml |
| 2 | Abattage du chêne mort | **selon la technique, voir ci-dessous** |
| 3 | Fendage du bois | **300 €** |

**Où en est l'application, au 8 août 2026 — à lire avant de « corriger ».** Elle
produit **deux** lignes sur cette dictée, pas trois : la haie est empilée avec
l'abattage, la fente est séparée. Ce n'est pas un oubli.

- La fente a le droit à sa ligne parce qu'elle a une **grille de prix**
  (hauteur × diamètre) : son montant est décidé, pas déduit.
- La haie n'en a pas encore. Séparer son prix de celui du chêne, quand le
  montant vient d'un tarif au jour/homme global, reviendrait à **inventer deux
  prix** — ce que `docs/AGENT.md` §3 interdit.

C'est donc une question à poser au patron (`TODO.md` §0 quinquies (c)), pas une
correction à faire seul. En attendant, la haie figure bien sur le devis, nommée,
et se sépare d'un geste sur l'écran.

### La règle de difficulté technique, enfin chiffrée

Le patron n'arrivait pas à la formuler ; ses trois prix la disent pour lui. Même
arbre, **diamètre 70 cm** :

| Technique | Prix HT | Rapport à l'abattage au pied |
|---|---|---|
| Abattage au pied | **600 €** | × 1 |
| Démontage | **1 000 €** | **× 1,67** |
| Démontage avec rétention (corde) | **1 400 €** | **× 2,33** |

**C'est la règle la plus utile obtenue jusqu'ici.** Elle ne se devine pas : elle
se demande une fois, et elle se réutilise ensuite sur chaque arbre.

> **Confirmé le 5 août 2026 : le rapport tient, la base varie.** Les
> multiplicateurs valent pour tout arbre ; c'est le prix de départ qui change
> avec le diamètre et l'essence.
>
> C'est la meilleure forme possible pour l'agent : **une seule règle à
> retenir**, appliquée par-dessus un prix de base qui, lui, vient du catalogue
> ou de l'historique. L'agent n'a donc jamais à inventer un multiplicateur — il
> a juste besoin de savoir quelle technique, et de connaître la base.

### Les totaux, et la vérification que le patron fait lui-même

| Cas | Total HT | Par jour-homme (4 jours-hommes) |
|---|---|---|
| Au pied | 1 250 € | 312 € |
| Démontage | 1 650 € | 412 € |
| Démontage avec rétention | 2 050 € | 512 € |

C'est exactement le contrôle qu'il décrit : *« deux jours deux hommes, ça me
sert à vérifier mon prix. »* Rapporter le total aux jours-hommes donne son taux
réel — **et l'agent peut faire ce calcul tout seul, sur chaque devis passé.**

---

## 6. Ce que cet exemple a révélé, et qui change la conception

**La dictée ne contient pas ce qui détermine la plus grosse ligne du devis.**

Le prix de l'abattage varie de **600 à 1 400 €** — plus du double — selon deux
paramètres :

| Paramètre | Dit dans la dictée ? |
|---|---|
| **La technique** (au pied / démontage / rétention) | **Non** |
| **Le diamètre** du tronc | **Non** — la dictée donne la hauteur (20 m), pas le diamètre (70 cm) |

La dictée dit « un chêne mort à abattre, de vingt mètres de haut ». La hauteur
est là ; **ni la technique ni le diamètre n'y sont**, et ce sont eux qui font le
prix.

**Conséquence, et elle est nette :** sur un arbre, l'agent ne peut pas chiffrer
sans poser deux questions. Ce n'est pas un trou à signaler parmi d'autres —
c'est **la** question, et elle porte à elle seule 800 € d'écart sur ce devis.

C'est le seul endroit du parcours où l'aller-retour se justifie, alors que le
patron a par ailleurs choisi « le devis avec les trous signalés ». Deux
questions fermées, avant de chiffrer, valent mieux qu'un devis faux du simple au
double.

---

## 5. À quoi ce document sert

1. **Mesurer** ce que produit chaque fournisseur retenu sur une note réelle.
2. **Garder la trace** de ce qui manquait, pour vérifier que l'agent le signale
   au lieu de le combler.
3. **Éprouver le piège des deux « vingt mètres »** à chaque changement de
   fournisseur ou d'invite.

Ce document se relit quand l'invite d'extraction change
(`src/server/ai/services/extraction-service.ts`) : une invite qui régresse ici
régressera chez le patron.

---

## 7. Comment l'agent obtient ce qui manque — et un changement de cap

Interrogé sur la façon d'obtenir la technique et le diamètre, le patron a
répondu, le 5 août 2026 :

> **« Il faut qu'il me pose toutes les questions dont il a besoin pour faire le
> devis le plus justement possible. »**

**C'est l'inverse de ce qu'il avait choisi une heure plus tôt**, où il préférait
« le devis avec les trous signalés » à un aller-retour de questions. Les deux
réponses sont notées telles quelles : les écraser l'une par l'autre ferait
perdre l'information que la position a bougé, et pourquoi.

**Lecture confirmée par le patron le 6 août 2026.** Question posée en QCM, réponse
retenue : *« Oui : il demande si ça change le prix, il signale sinon. »* Les deux
réponses précédentes ne portaient pas sur la même chose — c'est ce qui les
réconcilie, et c'est désormais la règle, plus une hypothèse.

| Ce dont il s'agit | Comportement |
|---|---|
| Une information **qui change le prix** — technique, diamètre, hauteur de haie | **L'agent demande avant de chiffrer.** Un devis faux du simple au double ne se rattrape pas par un signalement. |
| Une ambiguïté **qui ne change pas le prix** — que broie-t-on, accès non précisé | **Signalée sur le devis**, sans interrompre. |

Cette lecture réconcilie les deux réponses et respecte `AGENT.md` §2 (« l'arrêt
doit être franchissable en quelques secondes ») : on ne pose pas dix questions,
on pose celles qui portent de l'argent.

**Ce qui reste à trancher :** combien de questions au maximum avant que l'arrêt
cesse d'être un arrêt. Non demandé.

---

## 8. Ce que la mémoire devient à la commercialisation

Question du patron, le 5 août 2026 : *« est-ce que cette mémoire sera gardée
quand je publierai l'application et que je la commercialiserai ? »*

Sa réponse sur le partage : **« un socle commun, puis chacun ajuste »** — les
nouveaux artisans reçoivent une base de départ plutôt que de partir de rien.

**Ce que ça implique, et qui n'est pas encore décidé :**

1. **Le socle, c'est quoi ?** Les prix du patron tels quels, ou une moyenne
   anonymisée de plusieurs artisans ? Les deux options étaient dans la question ;
   il n'a pas départagé.
2. **Ses prix deviennent alors une donnée qui sort de chez lui.** L'isolation par
   entreprise (RLS) empêche aujourd'hui toute fuite entre artisans — un socle
   commun est une *dérogation volontaire* à ce principe, à construire
   explicitement, jamais à laisser advenir.
3. **Un artisan qui ajuste doit-il nourrir le socle en retour ?** Si oui,
   c'est un tout autre produit — et un tout autre contrat.

Aucun de ces trois points ne se code avant d'être tranché. **En attendant, la
mémoire se construit strictement privée** : c'est le seul choix qui n'interdit
rien. Ouvrir plus tard restera possible ; reprendre ce qui a été partagé, non.

---

## 9. Deux règles de chiffrage, données le 5 août 2026

### a. Le multiplicateur se recalcule, il ne se fige pas

> *« Il faut que le calcul ×1,67 ×2,33 soit recalculé à chaque fois, en faisant
> la moyenne des prix, qui change. »*

**C'est une correction de conception, pas un détail.** Ces deux nombres ne sont
pas un barème à inscrire en dur : ce sont une **moyenne mobile**, calculée sur
les devis réellement faits, et qui se déplace à mesure que le patron chiffre.

| Fixé en dur | Recalculé (ce qu'il demande) |
|---|---|
| Vieillit dès que les prix bougent | **Suit le métier tout seul** |
| Il faut penser à le corriger | **Personne n'a rien à corriger** |
| Une règle de plus à tenir | **La mémoire fait le travail** |

C'est exactement le « s'auto-alimente » qu'il demandait, appliqué à la seule
règle qu'on ait réussi à formuler. Le rapport se déduit des couples
(technique, prix) déjà enregistrés — donc il n'existe **qu'à partir du moment où
la mémoire existe**, et il est d'autant plus juste qu'elle est fournie.

> *Note : le patron cite « ×1,47 » de mémoire ; ses propres chiffres donnent
> 1 000 / 600 = 1,67. L'écart n'a aucune importance — c'est précisément
> l'argument de la moyenne mobile : personne n'a à retenir ce nombre.*

**Tant que la mémoire est vide**, aucun multiplicateur n'est appliqué : l'agent
demande le prix plutôt que d'en fabriquer un depuis un rapport qu'il n'a pas
encore observé.

### b. Les prix sortent ronds, en HT

> *« En HT on fait des prix ronds : 350, 400, 420, 560, etc. »*

Un prix calculé ne se présente jamais tel quel. **Arrondi au dizaine d'euros HT
la plus proche** — c'est ce que montrent ses exemples, tous multiples de dix.

Un devis à « 1 002,53 € HT » signale un prix calculé par une machine ; un devis
à « 1 000 € HT » se lit comme un prix décidé par un artisan. Le client voit la
différence, même s'il ne saurait pas la nommer.

**L'arrondi s'applique au montant HT de la ligne**, avant TVA — jamais au total
TTC, qui doit rester la somme exacte de ses lignes.

**Toujours à la dizaine, quel que soit le montant** (confirmé le 5 août 2026) :
350 €, 420 €, 1 000 €, 14 980 €. Une seule règle, pas de palier à retenir.

### c. Quand la mémoire est vide

Aucun rapport n'a encore été observé, donc aucun multiplicateur ne s'applique.
L'agent **propose alors le dernier prix comparable** — « la dernière fois, un
chêne en démontage : 1 000 € » — présenté comme un **rappel**, jamais comme un
calcul. Le patron valide ou corrige d'un geste.

La nuance porte tout : un rappel dit *d'où il vient* et se vérifie en un coup
d'œil ; un calcul non sourcé demande qu'on lui fasse confiance. C'est aussi ce
qui satisfait `AGENT.md` §3 — un prix estimé, mais signalé comme tel.
