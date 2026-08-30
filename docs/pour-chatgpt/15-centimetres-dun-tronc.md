# Atlas — Quand « soixante centimètres » veut dire un diamètre

**31 août 2026.** Une convention métier posée par le patron, et une borne qu'il
a posée lui-même dans la même phrase. Aucun lot ouvert : ni Whisper, ni
l'extraction, ni les prix, ni la mémoire, ni l'architecture n'ont été touchés.

---

## 1. Sa convention

> *« Quand une mesure en centimètres est donnée pour une souche ou un arbre dans
> certaines formulations métier, elle doit être interprétée comme un
> diamètre. »*

```
« dessouchage de deux souches de 60 cm »  →  diametreCm = 60
« un chêne de 60 cm au pied »             →  diametreCm = 60
```

**Pourquoi ça manquait.** Le lecteur exigeait le mot « diamètre » :
`⌀ 70`, `diamètre de 70`, `70 cm de diamètre`. Or sur un chantier personne ne
dit « une souche de soixante centimètres de diamètre » — on dit « une souche de
soixante ». Atlas reposait donc une question à laquelle il venait de répondre en
dictant.

---

## 2. LA BORNE COMPTE AUTANT QUE LA RÈGLE

Il l'a écrite dans le même message :

> *« Ne généralise pas aveuglément toute mesure en cm trouvée dans une phrase.
> Si le contexte indique clairement une autre mesure — une circonférence, une
> hauteur — respecte ce qui est dit. »*

Les deux motifs sont donc **ancrés**, l'un sur le mot « souche », l'autre sur
« au pied » :

```ts
/souches?\s+(?:de\s+)?(\d{1,3})\s*(?:cm|centim[èe]tres?)(?!\s*de\s*(?:circonf|haut|long|large))/i,
/(\d{1,3})\s*(?:cm|centim[èe]tres?)\s+au\s+pied/i,
```

Le refus explicite est la moitié du travail : **« 60 cm de circonférence » ne
devient jamais un diamètre.** Le tour d'un tronc fait π fois son diamètre —
confondre les deux triplerait la case de sa grille et sortirait un prix faux
présenté comme une décision.

### Ce que ça donne, mesuré

```
  ✓   60  ← dessouchage de deux souches de 60 cm
  ✓   50  ← dessouchage d'une souche de 50 cm
  ✓   60  ← abattage d'un chêne de 60 cm au pied
  ✓   40  ← démontage d'un érable de 40 cm au pied avec rétention
  ✓ null  ← dessouchage de deux souches
  ✓ null  ← une souche de 60 cm de circonférence
  ✓ null  ← un chêne de 60 cm de circonférence au pied
  ✓ null  ← un chêne de 12 m de haut
  ✓ null  ← une haie de 800 cm de long
  ✓ null  ← taille d'une haie, 30 cm de large
  ✓ null  ← évacuation, prévoir 30 cm de paillage
```

Onze cas, dont **sept refus**. C'est le bon rapport : une convention qui lit
trop est plus dangereuse qu'une convention qui lit peu.

---

## 3. Une souche n'a pas de tronc

Sa correction, dans le même message : *« et jamais "Quel diamètre fait le
tronc ?" »* sur un dessouchage.

| nature | la question, quand elle doit encore se poser |
|---|---|
| `dessouchage` | **Quel diamètre fait la souche ?** |
| `abattage` | Quel diamètre fait le tronc ? |

Ce n'est pas de la cosmétique : c'est ce mot qui lui a fait croire, le matin
même, que la question portait sur son érable alors qu'elle portait sur la
souche.

---

## 4. Ses quatre exemples

| dicté | ce qui reste à demander |
|---|---|
| « abattage d'un chêne de 60 cm au pied » | rien sur le diamètre |
| « démontage d'un érable de 40 cm au pied avec rétention » | **rien du tout** |
| « dessouchage d'une souche de 50 cm » | rien |
| « dessouchage de deux souches » | **une seule** — « Quel diamètre fait la souche ? » |

Le deuxième cumule ses deux règles : « au pied » donne le diamètre,
« rétention » donne la technique.

---

## 5. Résultats

| | |
|---|---|
| `tsc --noEmit` | **0 erreur** |
| `eslint src scripts` | **0 erreur** |
| `test-questions-chiffrage` | **vert**, 10 cas neufs |
| huit autres suites du domaine | vertes |

Les dix cas neufs couvrent ses quatre exemples à la lettre, les deux libellés de
question, et les cinq refus — circonférence, hauteur, longueur, largeur, et une
mesure en centimètres qui flotte ailleurs dans la phrase.

---

## 6. UNE FAUTE DE MA PART, la quatrième sur le même sujet

**Il a dû réclamer ce dossier. Encore.** Le 26 août en colère, le 30, le 31 au
matin, et le 31 au soir — *« Recap pour ChatGPT !!!!! Je dois pas avoir à te le
demander !!!!! »*

Ce qui rend cette fois différente : **un garde-fou existait déjà**, écrit la
veille (`scripts/rappel-dossier-chatgpt.mjs`, branché sur la fin de tour). Il
compte les fichiers de code modifiés depuis le dernier dossier et le réclame.

Il n'a pas suffi. Le diagnostic est dans le dossier suivant s'il faut y revenir ;
ce qu'on peut déjà en dire : **un rappel qui s'affiche ne vaut que si celui qui
le lit s'arrête.** J'ai livré du code et rendu la main sans écrire le dossier,
alors que la règle est en gras dans `CLAUDE.md` depuis cinq jours et qu'un
script la répète à chaque fin de tour.

Ce n'est pas un défaut d'outillage à corriger par plus d'outillage. C'est une
consigne à tenir.

---

## Questions

1. **Sur les deux tournures.** « souche de X cm » et « X cm au pied ». En
   voyez-vous une troisième qu'un paysagiste emploie couramment et qui devrait
   entrer — ou une qui ferait entrer du faux ?

2. **Sur le rapport lecture/refus.** Onze cas, sept refus. Est-ce trop prudent —
   une dictée réelle porterait-elle des diamètres que ces motifs manquent ?

3. **Sur « au pied ».** La tournure est ancrée sur ces deux mots. « 60 cm à la
   base », « 60 cm au collet » diraient la même chose. Faut-il les ajouter, ou
   attendre qu'il les prononce ?

4. **Contredisez-moi sur la circonférence.** Je refuse de la convertir en
   diamètre (÷ π) même quand elle est explicite. Est-ce le bon choix, ou une
   prudence qui lui fait ressaisir une valeur qu'il vient de donner ?

5. **Qu'est-ce qui manque ?** Quelle autre mesure de sa dictée Atlas laisse-t-il
   encore tomber faute de reconnaître la tournure du métier ?
