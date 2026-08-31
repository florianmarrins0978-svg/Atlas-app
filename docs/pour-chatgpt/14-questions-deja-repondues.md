# Atlas — Une question ne se pose que si la prestation ne sait pas déjà

**31 août 2026.** Deux défauts relevés sur un test téléphone réel. Le premier
était un vrai bug, et il en cachait un second. Le deuxième n'en était pas un —
et le dire est plus utile que de corriger au hasard.

Aucun lot ouvert. Ni Whisper, ni l'extraction, ni les règles de prix, ni la
mémoire n'ont été touchés.

---

## 1. Ce qu'il a vu

Il dicte :

> « démontage d'un érable de 40 cm de diamètre et 12 mètres de haut avec
> rétention »

Et l'écran « précisions avant de chiffrer » lui demande :

```
Dessouchage
  Comment s'abat-il ?      [ Au pied | Démontage | Démontage avec rétention ]
  Quel diamètre fait le tronc ?
```

Sa règle, en une phrase :

> *« Une question n'est posée que si l'information nécessaire au prix est
> réellement absente des données structurées de LA prestation concernée. Ne
> récupère pas l'information depuis une autre prestation. »*

---

## 2. LE TITRE DISAIT LA VÉRITÉ, et c'est ce qui trompait

Il a lu « Comment s'abat-il ? » et pensé à son érable. **Les deux questions
portaient bien sur la SOUCHE** — le titre était juste, et c'est la question qui
n'avait pas lieu d'être.

Ce détail change tout le diagnostic : il n'y avait pas de mauvaise liaison entre
une question et sa prestation. `libellePrestation` portait déjà le bon libellé.
Chercher un défaut de liaison aurait fait perdre l'après-midi.

Deux défauts distincts s'y cachaient.

### 2.1 Une souche recevait la question de l'abattage

```ts
if (estDeNature(ligne, ["abattage", "dessouchage"], ABATTAGE)) {
  if (!techniqueDeja(ligne)) {
    questions.push({ question: "Comment s'abat-il ?", … });
```

Le dessouchage était dans la même branche que l'abattage — délibérément, pour le
**diamètre** : celui de la souche est celui du même tronc. Mais la branche posait
aussi la question de la technique. **Une souche se rogne ou s'arrache ; elle ne
s'abat pas.**

```ts
if (estDeNature(ligne, ["abattage"], ABATTAGE) && !techniqueDeja(ligne)) {
```

Le dessouchage reste dans la branche pour le diamètre, qu'une souche possède bel
et bien.

### 2.2 La technique et le diamètre ne se cherchaient que dans le TEXTE

```ts
function techniqueDeja(ligne) {
  return /\b(au\s+pied|démont|demont|rétention|retention)/i.test(
    [ligne.libelle, ligne.description ?? ""].join(" ")
  );
}
function contientDiametre(ligne) {
  return diametreLu(toutLeTexte(ligne)) !== null;
}
```

`LignePourQuestions` portait `nature`, mais **ni `methode` ni
`caracteristiques`**. Une prestation qui portait la technique et le diamètre en
colonne — donc qui savait — se faisait redemander l'un et l'autre.

Les colonnes passent maintenant devant, le texte reste le repli :

```ts
if (ligne.methode?.trim()) return true;
if (lireCaracteristiques(ligne.caracteristiques).diametreCm !== undefined) return true;
```

### 2.3 LA CAUSE DE FOND, et elle est de mon fait

Les questions se décidaient sur le **brouillon** — ce que le modèle vient de
rendre — et non sur les prestations en base :

```ts
const questions = await questionsRestantes(ctx, chantierId, contenu?.prestations ?? []);
```

Le brouillon ne porte ni `methode` ni `caracteristiques` : ces colonnes sont
calculées à la confirmation. Décider là, c'est décider **sans regarder les
colonnes**, par construction.

```ts
const enBase = await listerPrestations(ctx, chantierId);
const surQuoi = enBase.length > 0 ? enBase : prestations;
```

**Et mon propre correctif de la veille a rendu ce défaut ordinaire.** Le
nettoyage des libellés du 30 août a retiré « (40 cm de diamètre, 12 m de haut) »
du texte — c'est-à-dire la seule chose que `contientDiametre` regardait. Ce qui
était un cas de bord est devenu le cas normal.

C'est le genre d'effet qu'aucune suite ne voit : les deux correctifs sont justes
séparément, et leur rencontre ne l'est pas.

### 2.4 Le garde-fou dans l'autre sens

**Une question tue coûte plus cher qu'une question de trop.** Sans colonne NI
mention dans le texte, la technique et le diamètre se demandent encore — un
contrôle le fixe :

```ts
cas("sans colonne NI texte, la technique et le diamètre se demandent encore", () => {
  const q = questionsAvantChiffrage([{ libelle: "Abattage d'un chêne", nature: "abattage" }]);
  assert.equal(q.length, 2);
});
```

Les taire ferait chiffrer sans savoir, et un abattage va du simple au double
selon la technique.

---

## 3. LE SECOND DÉFAUT N'EN ÉTAIT PAS UN

Il voit dans son PDF :

```
Démontage en rétention d'un érable (1 arbre)
Taille de haie de laurier (800 ml)
Dessouchage (2 souche)
Tonte de pelouse (1200 m²)
```

**Mesure faite plutôt que supposée** — ses quatre chaînes exactes, passées dans
le chemin actuel :

```
Érable (40 cm de diamètre, 12 m de haut) (1 arbre) → « Démontage en rétention d'un érable »
Haie de laurier (800 ml)                           → « Taille de haie de laurier »
Dessouchage (2 souche)                             → « Dessouchage »
Tonte de pelouse (1200 m²)                         → « Tonte de pelouse »
```

Le code produit déjà ce qu'il demande.

**Le chemin d'écriture, vérifié bout en bout :**

| étape | ce qui s'écrit |
|---|---|
| `lignesVendables` | `libelle: g.membres.map(libelleClient).join("\n")` |
| `proposition-prix` | `ecrire()` recopie `l.libelle` |
| `lignes_devis` | recopie `lignes_prix.libelle` |
| le PDF | met quantité et unité dans **leur colonne** — il n'ajoute rien au libellé |

Et il n'existe aucun autre chemin d'écriture depuis la dictée : le seul autre
appelant, `ajouterLignePrixDirectAction`, sert à l'assistant quand le patron
tape lui-même un libellé.

**Conclusion : son PDF lit un libellé écrit AVANT la correction.** Un devis est
une photographie — la ligne a été figée quand le prix a été calculé. Rien n'a
été réécrit : c'est sa règle, et un devis déjà envoyé ne se réinterprète pas.

**Ce qui tranche, et il peut le faire en trente secondes :** refaire le calcul du
prix sur ce chantier, ou dicter un chantier neuf.

- libellés propres → c'était bien la photographie ;
- « (1 arbre) » encore là → **le code n'est pas arrivé chez lui**. Les
  corrections des 30 et 31 août sont sur la branche de travail, **pas sur
  `main`**, et son banc ne suit que `main`.

La seconde hypothèse est la plus probable, et elle explique aussi pourquoi il
voit « Dessouchage (2 souche) » plutôt que « Dessouchage de souches de 60 cm ».

---

## 4. Les colonnes du devis

Inchangées, comme demandé : **Qté**, **Prix unitaire HT**, **Montant HT**.

Sa raison, et elle est juste : les deux dernières ont des fonctions différentes
dès que la quantité dépasse 1 — 800 ml × 17,50 € n'est pas la même information
que 14 000 €. Et « Montant HT » plutôt que « Total HT », pour ne pas donner
l'impression d'un doublon avec le total du document.

---

## 5. Résultats

| | |
|---|---|
| `tsc --noEmit` | **0 erreur** |
| `eslint src scripts` | **0 erreur** |
| `test-questions-chiffrage` | **vert**, 7 cas neufs |
| `test-libelle-client` | 25 cas, 0 échec |
| sept autres suites du domaine | vertes |

Les sept cas neufs : la technique en colonne éteint la question, le diamètre en
colonne aussi, un érable renseigné ne pose **aucune** question, une souche ne se
fait jamais demander comment elle s'abat, le diamètre d'une souche vient de sa
colonne et non de l'arbre d'à côté, le repli par le texte tient encore, et
chaque question porte le libellé de sa prestation.

---

## Questions

1. **Sur le brouillon contre la base.** Les questions interrogent maintenant les
   prestations en base dès qu'elles existent. Voyez-vous un moment du parcours
   où le brouillon dirait quelque chose que la base ignore, et où ce choix
   ferait perdre une question nécessaire ?

2. **Sur la rencontre de deux correctifs justes.** Nettoyer les libellés a
   cassé une lecture qui dépendait d'eux. Quel contrôle aurait pu voir cela —
   sachant qu'aucune des deux suites concernées n'avait tort ?

3. **Sur le dessouchage dans la branche de l'abattage.** Il y reste pour le
   diamètre. Est-ce une économie saine, ou faut-il lui donner sa propre branche
   au risque de dupliquer la question du tronc ?

4. **Sur le second défaut.** Je conclus que son PDF lit une photographie
   ancienne, ou que le code n'est pas chez lui. Voyez-vous une troisième
   explication que la mesure ci-dessus n'aurait pas écartée ?

5. **Qu'est-ce qui manque ?** Quelle autre question l'écran pourrait-il poser
   alors que la réponse est déjà en colonne ?
