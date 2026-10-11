# Atlas — La tournure vient de la nature déclarée, l'article du seul genre connu

**31 août 2026.** Troisième passe sur les libellés visibles du devis, et la
dernière. Elle corrige trois points qu'il a relevés en lisant le résultat de la
précédente — dont **deux qui étaient de vrais défauts de conception**, pas des
préférences.

Aucun lot ouvert. Ni Whisper, ni l'extraction, ni le regroupement, ni le prix,
ni la mémoire, ni l'architecture n'ont été touchés.

---

## 1. Les cinq descriptions produites

Jouées à travers `lignesVendables` — donc le regroupement compris :

```
  DESCRIPTION                                QTÉ    UNITÉ
  ──────────────────────────────────────────────────────────
  Démontage en rétention d'un érable           1    —
  Évacuation des déchets verts
  Taille de haie de laurier                  800    ml
  Dessouchage de souches de 60 cm              2    souche
  Tonte de la pelouse                       1200    m²
```

Aucun tiret. Aucune quantité dans le texte. Ni les 40 cm ni les 12 m de
l'érable : ils restent en colonne.

---

## 2. « UNE RESSEMBLANCE DE CHAÎNES » — il avait raison, et c'était un vrai défaut

> *« La formulation "Taille de haie" doit venir explicitement de la nature
> structurée de la prestation, pas d'une simple ressemblance entre deux chaînes
> de texte. »*

La version d'hier cherchait la substitution ainsi : pour chaque nature, comparer
le **dernier mot de son libellé** au **premier mot du texte**.

```
nature haie   libellé « Taille de haie »   ← dernier mot « haie »
texte         « Haie de laurier »          ← premier mot « Haie »   → substitution
```

Cela marchait sur les douze natures d'aujourd'hui — et **rien n'empêchait la
treizième de produire une phrase fausse**. Il suffisait d'une nature dont le
libellé finirait par un mot qu'un autre libellé emploie autrement.

**Ce n'est plus une inférence, c'est une donnée.** Chaque nature déclare son
objet :

```ts
{
  cle: "haie",
  libelle: "Taille de haie",
  objet: "haie",          // ← déclaré : le libellé peut s'ouvrir sur ce mot
  …
},
{
  cle: "grumes",
  libelle: "Enlèvement des grumes",
  objet: "grumes",
  …
},
{
  cle: "abattage",
  libelle: "Abattage",
  objet: null,            // ← un libellé d'abattage nomme déjà le geste
  …
}
```

Et la substitution part de la **colonne** `nature`, plus du texte :

```ts
function nommerLeTravail(texte, cleNature) {
  const n = nature(cleNature);
  if (!n?.objet) return texte;        // rien de déclaré : on ne touche à rien
  …
}
```

Un contrôle fixe la différence avec le même texte des deux côtés :

| texte | nature en colonne | résultat |
|---|---|---|
| `Haie de laurier (800 ml)` | `"haie"` | **Taille de haie de laurier** |
| `Haie de laurier (800 ml)` | `null` | **Haie de laurier** |

Sans nature, Atlas ne nomme pas le travail à la place du texte.

---

## 3. « D'UN PAR DÉFAUT » — le défaut qu'il a vu venir

> *« Évite une règle grammaticale basée sur "d'un par défaut" avec une petite
> liste de mots féminins. Atlas ne doit pas produire une formulation
> grammaticalement fausse parce qu'une espèce manque dans une liste. »*

La version d'hier écrivait « d'un » partout, sauf sur une douzaine de mots
féminins. **« d'un aubépine » n'attendait qu'une espèce oubliée.**

Allonger la liste aurait déplacé le problème d'un cran. **Ce qui le supprime,
c'est le retrait de l'article** — le français en offre une tournure qui ne
demande aucun genre, et c'est celle qu'il a lui-même validée dans « Taille de
haie **de laurier** » :

```ts
function complementDe(mot) {
  const genre = GENRE_CONNU[motNu(mot)];
  if (genre === "m") return `d'un ${minuscule}`;
  if (genre === "f") return `d'une ${minuscule}`;
  // Genre inconnu : la tournure sans article, correcte dans les deux genres.
  return /^[aeiouy…]/i.test(minuscule) ? `d'${minuscule}` : `de ${minuscule}`;
}
```

| espèce | résultat |
|---|---|
| érable *(connue, masculin)* | Démontage en rétention **d'un** érable |
| aubépine *(connue, féminin)* | Démontage en rétention **d'une** aubépine |
| sophora *(inconnue)* | Démontage en rétention **de** sophora |
| ostrya *(inconnue, voyelle)* | Démontage en rétention **d'**ostrya |

**Un mot absent de la liste coûte un article, jamais une faute** — et l'espèce
reste écrite, ce qui vaut mieux que de la taire. La liste n'enrichit plus,
elle ne décide plus.

---

## 4. « En rétention », et le catalogue qui ne bouge pas

> *« Pour la rétention, harmonise la formulation visible en "Démontage en
> rétention d'un érable". »*

Deux écritures existent, et elles ne servent pas au même lecteur :

| où | ce qui s'écrit | qui le lit |
|---|---|---|
| `TECHNIQUES_PAR_DEFAUT` | « démontage avec rétention » | **lui**, sur ses écrans de grille |
| `TECHNIQUE_POUR_LE_CLIENT` | « démontage en rétention » | **son client**, sur le devis |

Le catalogue de la grille n'a **pas** été modifié : changer un mot qui s'affiche
dans ses réglages dépasse « les libellés clients ». Les deux tableaux vivent
dans le même fichier, côte à côte, pour qu'ils ne puissent pas dériver l'un de
l'autre (`CLAUDE.md` §3). Une technique que le devis ne sait pas encore dire
retombe sur le mot du catalogue plutôt que d'être tue.

---

## 5. Ce qui n'a pas bougé

Le champ `membres` de la ligne reste **brut** : le chiffrage y relit les mesures
quand les colonnes ne suffisent pas.

```ts
libelle: g.membres.map((m) => libelleClient(m)).join("\n"),  // le client
membres: g.membres.map((m) => m.libelle),                    // les moteurs — INTACT
```

Une prestation sans colonne garde son texte entier — la compatibilité est
structurelle, pas une date à tenir à jour. Rien n'est retiré de la base, aucun
devis existant n'est réinterprété.

---

## 6. Résultats

| | |
|---|---|
| `tsc --noEmit` | **0 erreur** |
| `eslint src scripts` | **0 erreur** (14 avertissements, tous préexistants) |
| `scripts/test-libelle-client.ts` | **25 cas, 0 échec** |
| neuf suites du domaine | vertes — `lignes-vendables`, `natures-prestation`, `prix-attribuable`, `mesures-prestation`, `chaine-dictee-attendue`, `grille-prix`, `questions-chiffrage`, `lecons-prix` |

Les six cas neufs éprouvent exactement les deux points de robustesse : la
substitution qui disparaît sans nature en colonne, une nature sans `objet` qui
ne substitue rien, les grumes, trois espèces inconnues qui ne reçoivent aucun
article, et l'accord des genres connus.

---

## 7. UNE FAUTE DE MA PART, et ce que j'en ai fait

**Il a dû me demander ce dossier.** C'est la troisième fois — le 26 août en
colère, le 30 août, et aujourd'hui : *« rapport pour ChatGPT, je ne dois pas
avoir à te le demander »*.

La règle est en gras dans `CLAUDE.md` depuis le 26 août. Elle n'a donc jamais
manqué d'être écrite : **elle a manqué d'être tenue.** Une consigne qui vit dans
de la prose se lit au début d'une conversation et s'oublie au bout de trois
heures — or c'est au bout de trois heures qu'un lot se termine.

Un premier garde-fou avait été posé la veille dans `verifier-memoire.mjs` : tout
dossier écrit doit figurer dans son index. **Il ne pouvait pas attraper la faute
suivante** — ne pas en écrire du tout.

`scripts/rappel-dossier-chatgpt.mjs` la voit, et il est branché sur `Stop` :
il parle au moment où la session croit avoir fini, pas au moment où elle
commence.

```
⚠ 3 fichier(s) de code modifié(s) depuis le dernier dossier, et AUCUN nouveau
  dossier dans docs/pour-chatgpt/.
```

Le repère est le **dernier commit qui a posé un dossier**, pas la base de la
branche : une branche qui en porte déjà trois ne dit rien du travail fait depuis
le dernier. C'était l'angle mort de ma première version, corrigé avant de
livrer. Le rappel ne bloque rien, et se tait devant le moindre doute — un
garde-fou qui parle à tort s'apprend à être ignoré.

---

## Questions

1. **Sur la tournure sans article.** « Démontage en rétention de sophora » est
   correct mais sec. Vaut-il mieux cela, ou enrichir la liste des genres au
   risque d'un oubli qui écrirait faux ?

2. **Sur `objet` déclaré nature par nature.** Seules `haie` et `grumes` en ont
   un aujourd'hui. En voyez-vous d'autres où le libellé nomme l'objet plutôt que
   le geste — et une où cette déclaration produirait une phrase fausse ?

3. **Sur les deux écritures de la rétention.** « avec » pour ses réglages, « en »
   pour le client, dans le même fichier. Est-ce une séparation saine, ou deux
   vérités qui finiront par diverger malgré la proximité ?

4. **Sur le rappel branché sur `Stop`.** Il se déclenche sur « du code modifié
   depuis le dernier dossier ». Trop bavard — il parlera sur une correction de
   trois lignes — ou pas assez ?

5. **Qu'est-ce qui manque ?** Sur ces cinq lignes, quelle information le client
   devrait-il lire et ne lit pas ?
