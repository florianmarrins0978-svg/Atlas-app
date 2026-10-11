# Atlas — Le devis se rédige en français, il ne s'assemble pas au tiret

**30 août 2026.** Deuxième passe sur les libellés visibles du devis, le même
jour. La première retirait les mesures ; celle-ci corrige la **tournure**.

Aucun lot ouvert. Ni Whisper, ni l'extraction, ni le regroupement, ni le prix,
ni la mémoire, ni l'architecture n'ont été touchés.

---

## 1. Sa consigne, et ce qu'elle a révélé

> *« Les tirets ne doivent pas servir à assembler artificiellement plusieurs
> morceaux d'un libellé client. Quand plusieurs informations doivent apparaître
> dans une même description, construis une vraie formulation française
> naturelle. »*

Ses deux exemples :

| ce qu'il refuse | ce qu'il veut |
|---|---|
| `Érable — démontage en rétention` | `Démontage en rétention d'un érable` |
| `Dessouchage — deux souches de 60 cm` | `Dessouchage de souches de 60 cm` |

**Ce que ces deux lignes ont en commun n'est pas évident, et c'est tout le
problème.** Le tiret réunit un **sujet** et un **geste** — et il ne dit pas
lequel est lequel. Dans la première, le geste est à droite ; dans la seconde, à
gauche. Une règle qui inverserait toujours produirait « Souches de 60 cm de
dessouchage ».

---

## 2. Ce qui décide de l'ordre des mots

Le référentiel des natures répond déjà à la question, et il n'a pas fallu
l'étendre : `natureDuLibelle("dessouchage")` rend `"dessouchage"`,
`natureDuLibelle("érable")` rend `null`. **Le côté qui porte une nature est le
geste.** D'où deux tournures, et pas une de plus :

| ce qui porte le geste | la phrase composée |
|---|---|
| la tête | `Dessouchage` + `de` + `souches de 60 cm` |
| le complément | `Démontage en rétention` + `d'un` + `érable` |

```ts
if (estUnGeste(tete)) {
  reste = `${tete} de ${complement.toLocaleLowerCase("fr")}`;
} else if (estUnGeste(complement)) {
  reste = `${capitale(complement)} ${article(tete)} ${tete.toLocaleLowerCase("fr")}`;
}
// Sinon : ni l'un ni l'autre n'est un geste connu — on ne rédige pas à l'aveugle.
```

### Le refus, qui compte plus que la rédaction

**Quand aucun des deux côtés n'est un geste connu, le texte reste tel quel,
tiret compris.**

```
« Bassin — pose et raccordement »  →  inchangé
```

Inventer « Pose d'un bassin » sur un travail que le produit ne sait pas nommer,
c'est écrire du français au hasard sur un document qui part chez un client. Un
tiret est laid, **mais il se voit — donc il se corrige.** Une tournure fausse ne
se voit pas : elle a l'air d'une phrase.

C'est le même principe que le reste de la chaîne : ce qu'on ne sait pas, on ne
le devine pas.

---

## 3. Deux détails qui ne se devinaient pas

### 3.1 « Haie de laurier » nomme l'objet, pas le travail

Il attend `Taille de haie de laurier`. Le libellé brut dit `Haie de laurier` : il
nomme **ce qu'on taille**, pas ce qu'on fait.

Le référentiel porte déjà le nom du travail — la nature `haie` a pour libellé
« Taille de haie » —, et **ce libellé se termine par le mot même sur lequel le
texte s'ouvre.** C'est cette coïncidence qui autorise la substitution sans rien
inventer :

```
nature haie      libellé « Taille de haie »   →  Haie de laurier → Taille de haie de laurier
nature grumes    libellé « Enlèvement des grumes » → Grumes de chêne → Enlèvement des grumes de chêne
nature tonte     libellé « Tonte »            →  un seul mot : rien à préfixer
nature abattage  libellé « Abattage »         →  « Démontage du chêne » NE devient PAS « Abattage du chêne »
```

La dernière ligne est le garde-fou : la substitution ne vise que les libellés qui
**s'ouvrent sur leur objet**. Un texte qui nomme déjà un geste garde ses mots.

### 3.2 Le diamètre reste sur le dessouchage, pas sur l'érable

C'est ce qu'il demande, et cela peut sembler incohérent :

| | |
|---|---|
| érable | `(40 cm de diamètre, 12 m de haut)` → **retiré** |
| dessouchage | `de 60 cm` → **gardé** |

Ce n'en est pas. Sur l'érable, la mesure est un **bloc technique entre
parenthèses** — c'est ce que la première passe retire. Sur le dessouchage, le
« 60 cm » est dans la prose et dit **quelles** souches ; seul le mot de quantité
(« deux ») part, parce qu'il a sa colonne.

```
« deux souches de 60 cm » → « souches de 60 cm »
```

Le pluriel reste : c'est du français, pas une donnée.

---

## 4. La technique : deux sources, et le texte gagne

Sur son vrai devis, le libellé brut est `Érable (40 cm de diamètre, 12 m de
haut)` — **la méthode n'est pas dans le texte**, elle est en colonne
(`methode = demontage_retention`). Il faut donc aller la chercher.

Et là, deux écritures s'opposent :

| source | ce qu'elle écrit |
|---|---|
| sa dictée, quand elle le dit | « démontage **en** rétention » |
| `grille-prix.ts`, le catalogue | « démontage **avec** rétention » |

**Règle retenue : quand ses mots sont dans le texte, on ne les remplace pas par
les nôtres.** La colonne ne sert qu'à combler un silence.

| libellé brut | ce que le client lit |
|---|---|
| `Érable (40 cm de diamètre, 12 m de haut)` | Démontage **avec** rétention d'un érable |
| `Érable — démontage en rétention` | Démontage **en** rétention d'un érable |

**Le mot du catalogue n'a pas été changé sans son accord** : « démontage avec
rétention » s'affiche aussi sur ses écrans de grille, et le modifier dépasse
« les libellés clients ».

*(Accord grammatical : « d'un » par défaut, « d'une » sur une courte liste de
mots féminins — haie, souche, pelouse, clôture… La quasi-totalité des noms
d'arbres français étant masculins, le défaut se trompe rarement, et jamais sur
une donnée.)*

---

## 5. LES LIBELLÉS EXACTS PRODUITS

Joués sur ses cinq prestations réelles, à travers `lignesVendables` — donc le
regroupement compris :

```
  DESCRIPTION                                QTÉ    UNITÉ
  ──────────────────────────────────────────────────────────
  Démontage avec rétention d'un érable         1    —
  Évacuation des déchets verts
  Taille de haie de laurier                  800    ml
  Dessouchage de souches de 60 cm              2    souche
  Tonte de la pelouse                       1200    m²
```

Aucun tiret d'assemblage. Aucune quantité répétée. Aucune mesure technique de
l'érable.

---

## 6. Ce qui protège le prix, et qui n'a pas bougé

La correction ne touche **que** `LigneVendable.libelle`. Le champ `membres`
reste brut, parce que le chiffrage y relit les mesures quand les colonnes ne
suffisent pas (`mesures-prestation.ts` : *« quatre moteurs relisent encore le
texte »*).

```ts
libelle: g.membres.map((m) => libelleClient(m)).join("\n"),  // le client
membres: g.membres.map((m) => m.libelle),                    // les moteurs — INTACT
```

Un contrôle le fixe explicitement : la ligne rédigée dit « Taille de haie de
laurier » pendant que son membre porte encore « Haie de laurier (800 ml)
(800 ml) ».

**Rien n'est retiré de la base. Aucun devis existant n'est réinterprété** — une
prestation sans colonne garde son texte entier, et c'est structurel, pas une
date à tenir à jour.

---

## 7. Résultats

| | |
|---|---|
| `tsc --noEmit` | **0 erreur** |
| `eslint src scripts` | **0 erreur** (14 avertissements, tous préexistants) |
| `scripts/test-libelle-client.ts` | **19 cas, 0 échec** |
| dix suites du domaine | vertes — `lignes-vendables`, `natures-prestation`, `quantite-commerciale`, `prix-attribuable`, `mesures-prestation`, `chaine-dictee-attendue`, `correspondance-prestation`, `prestation-structuree`, `grille-prix` |

Les 19 cas comprennent ses quatre lignes à la lettre, plus les refus : le texte
inconnu qui garde son tiret, la mesure absente des colonnes qu'on n'efface pas,
la valeur qui contredit sa colonne et qu'on laisse visible, et « Abattage » qui
ne remplace pas « Démontage ».

---

## Questions

1. **Sur le refus de rédiger.** « Bassin — pose et raccordement » garde son
   tiret. Est-ce le bon arbitrage, ou vaudrait-il mieux une tournure neutre du
   type « Bassin : pose et raccordement » — qui n'invente pas de grammaire mais
   n'assemble plus au tiret ?

2. **Sur « avec » contre « en » rétention.** Le catalogue de la grille dit
   « avec ». Faut-il changer le catalogue (donc ses écrans de réglage) pour un
   seul mot, ou garder deux écritures selon la source ?

3. **Sur la substitution « Haie » → « Taille de haie ».** Elle repose sur le
   fait que le libellé de la nature se termine par le mot du texte. Voyez-vous
   une nature où cette coïncidence produirait une phrase fausse ?

4. **Sur l'accord.** « d'un » par défaut, une liste courte pour le féminin. Un
   « d'un aubépine » resterait possible sur une espèce oubliée. Faut-il une
   liste plus longue, ou une tournure qui évite l'article ?

5. **Qu'est-ce qui manque ?** Sur ces cinq lignes, quelle information le client
   devrait-il lire et ne lit pas ?
