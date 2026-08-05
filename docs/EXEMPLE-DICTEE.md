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

> **À remplir par le patron.** C'est la seconde moitié de l'étalon, et sans elle
> on sait juger la compréhension mais pas le chiffrage.

| Ligne | Quantité | Prix |
|---|---|---|
| | | |

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
