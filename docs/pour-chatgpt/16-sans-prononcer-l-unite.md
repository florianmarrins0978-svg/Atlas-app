# Atlas — « Une souche de 60 » : lire la mesure sans exiger l'unité

**31 août 2026, au soir.** Une précision qui prolonge la convention du matin.
Aucun lot ouvert, rien d'autre touché.

---

## 1. Sa précision

> *« Quand je dis "une souche de 60", cela signifie une souche de 60 cm de
> diamètre. De la même manière, "un chêne de 60 au pied" signifie un chêne de
> 60 cm de diamètre au pied. »*

Le matin, la convention exigeait encore l'unité — « souche de 60 **cm** ». Il ne
la prononce pas. Exiger le mot revenait à jeter la mesure qu'il venait de
donner, puis à la lui redemander à l'écran suivant.

L'unité devient donc facultative **dans les deux contextes ancrés**, et nulle
part ailleurs.

---

## 2. RENDRE UNE UNITÉ FACULTATIVE OUVRE TROIS PORTES

C'est tout l'enjeu de ce lot : un motif plus permissif est un motif qui se
trompe. Les trois portes sont fermées dans le motif lui-même.

### 2.1 Une autre unité

```
« une souche de 2 m »      →  null
« une souche de 2 mètres » →  null
```

Deux mètres de diamètre n'existent pas sur ses chantiers — mais lire « 2 »
rangerait le prix dans la case des troncs de 2 cm.

### 2.2 Une autre mesure nommée

```
« une souche de 60 de circonférence »       →  null
« un chêne de 60 de circonférence au pied » →  null
« un chêne de 12 m de haut »                →  null
« une haie de 800 cm de long »              →  null
« bordure de 30 cm de large »               →  null
```

Sa règle du matin, inchangée : *« si je précise explicitement une autre mesure,
respecte cette information. »*

### 2.3 LA QUANTITÉ — le piège le plus dangereux

```
« dessouchage de deux souches »  →  null
```

**Et c'est le cas où j'aurais pu écrire un vrai bug.** « deux souches » devient
« 2 souches » une fois les mots-nombres passés en chiffres — un motif qui lirait
« un nombre près du mot souche » y verrait un diamètre de 2 cm.

Ce qui l'écarte n'est pas une exception ajoutée après coup, c'est **la position
exigée** : le nombre doit venir **après** le mot « souche ». Dans « 2 souches »
il est avant.

```ts
/souches?\s+de\s+(\d{1,3})\b(?!…)(?!…)/i
```

Et le comportement qu'il demande est préservé : « dessouchage de deux souches »
pose encore **une** question — « Quel diamètre fait la souche ? ».

---

## 3. Ce que ça donne, mesuré

Vingt et une lectures, dont **treize refus** :

```
  ✓   60  ← dessouchage de deux souches de 60
  ✓   50  ← dessouchage d'une souche de 50
  ✓   60  ← abattage d'un chêne de 60 au pied
  ✓   40  ← démontage d'un érable de 40 au pied avec rétention
  ✓   60  ← dessouchage de deux souches de 60 cm      (avec unité : inchangé)
  ✓   40  ← Érable — 40 cm de diamètre                (motif d'origine : inchangé)
  ✓   70  ← diamètre de 70

  ✓ null  ← dessouchage de deux souches
  ✓ null  ← dessouchage d'une souche
  ✓ null  ← une souche de 60 de circonférence
  ✓ null  ← un chêne de 60 de circonférence au pied
  ✓ null  ← une souche de 2 m
  ✓ null  ← une souche de 2 mètres
  ✓ null  ← un chêne de 12 m de haut
  ✓ null  ← une haie de 800 cm de long
  ✓ null  ← bordure de 30 cm de large
  ✓ null  ← évacuation, prévoir 30 cm de paillage
  ✓ null  ← tonte de 1200 m²
  ✓ null  ← trois arbres à abattre
```

**Ce rapport est le bon.** Une convention qui lit trop coûte un prix faux
présenté comme une décision ; une convention qui lit peu coûte une question.

---

## 4. Ses quatre exemples

| dicté | ce qui reste à demander |
|---|---|
| « dessouchage de deux souches de 60 » | rien |
| « dessouchage d'une souche de 50 » | rien |
| « abattage d'un chêne de 60 au pied » | rien sur le diamètre |
| « démontage d'un érable de 40 au pied avec rétention » | **rien du tout** |

Le dernier cumule les deux règles du jour : « au pied » donne le diamètre,
« rétention » donne la technique.

---

## 5. Résultats

| | |
|---|---|
| `tsc --noEmit` | **0 erreur** |
| `eslint src scripts` | **0 erreur** |
| `test-questions-chiffrage` | **vert**, 9 cas neufs |
| dix autres suites du domaine | vertes |

Les neuf cas neufs : ses quatre exemples, les quatre lectures valeur par valeur,
et surtout les trois refus que l'unité facultative pouvait casser — la quantité,
l'autre unité, l'autre mesure nommée.

---

## Questions

1. **Contredisez-moi sur « 2 souches ».** Je m'appuie sur la position du nombre
   pour distinguer la quantité du diamètre. Voyez-vous une tournure française
   où le diamètre viendrait AVANT le mot « souche » — et que je rejetterais donc
   à tort ?

2. **Sur « au pied » sans unité.** Le motif accepte « 60 au pied ». Une phrase
   comme « abattage de 3 arbres au pied » donnerait-elle un faux diamètre de 3 ?
   *(Testé : non — le nombre y est suivi de « arbres », pas de « au pied ». Mais
   dites-moi si vous voyez une formulation qui passerait.)*

3. **Sur le rapport treize refus pour huit lectures.** Trop prudent ? Une dictée
   réelle porte-t-elle des diamètres que ces deux motifs manquent encore ?

4. **Sur les unités refusées.** La liste est `m, mètres, mm, km, ml, t, tonnes`.
   En manque-t-il une qu'un paysagiste emploie et qui produirait un faux
   diamètre ?

5. **Qu'est-ce qui manque ?** Quelle autre mesure de sa dictée Atlas laisse-t-il
   encore tomber faute de reconnaître la tournure du métier ?
