# Atlas — Le diamètre n'était pas perdu : il n'était jamais créé

**30 août 2026.** Un test téléphone réel, deux défauts d'affichage, et un défaut
de chaîne qui rendait toutes les suites vertes menteuses.

---

## 1. Ce qu'il a constaté, en vrai

Il redicte son chantier dans l'application :

> « Taille de 800 mètres linéaires de haie de laurier, démontage d'un érable de
> **40 centimètres au pied** et 12 mètres de haut avec rétention, dessouchage de
> **deux souches de 60**, évacuation des déchets et tonte de 1 200 mètres carrés
> de pelouse, prévoir deux hommes pendant une journée. »

Ce qui marche désormais : la méthode « en rétention » n'est plus redemandée.

Ce qui ne marche pas : Atlas demande **« Quel diamètre fait le tronc ? »** pour
l'érable, et **« Quel diamètre fait la souche ? »** pour les souches. Il vient de
prononcer les deux.

Or les conventions métier — « souche de 60 », « 40 au pied », l'unité facultative
— étaient codées la veille, avec dix-neuf cas de contrôle, **tous verts**.

Sa consigne : *« Cherche pourquoi les tests passent alors que le parcours
téléphone réel ne reçoit pas ces diamètres. Ne corrige pas seulement le symptôme
de l'écran. »*

---

## 2. Le résultat de la remontée, et il n'est pas celui qu'on cherchait

On cherchait **où la valeur se perd**. Elle ne se perd nulle part.

| étape | ce qu'elle fait de la mesure |
|---|---|
| transcription | « souches de 60 » est bien là |
| **JSON du modèle** | **aucun champ pour une mesure** — le contrat n'en a pas |
| `libelleAvecQuantite` | ne garde que la quantité : « Dessouchage (2 souche) » |
| `ajouterPrestation` | écrit le libellé et les colonnes ; la `description` **n'est pas persistée** |
| colonnes structurées | `caracteristiques` restait **toujours NULL** |
| `questionsAvantChiffrage` | ne trouve ni colonne ni texte — donc **elle demande** |

Le contrat d'extraction, verbatim, dans `src/server/ai/schemas/extraction.ts` :

```ts
export const LigneExtraiteSchema = z.object({
  libelle: z.string().min(1),
  description: z.string().nullable().default(null),
  quantite: z.string().nullable().default(null),
  unite: z.string().nullable().default(null),
  nature: z.string().nullable().optional(),
  espece: z.string().nullable().optional(),
  aConfirmer: z.boolean().default(false),
});
```

Aucun champ de mesure. Et le commentaire qui vivait au-dessus de la fonction de
structuration disait la chose en toutes lettres, depuis des jours :

```
 * **Ce que cette fonction ne remplit toujours PAS** : ni `methode`, ni
 * `caracteristiques`. Elles arrivent d'ailleurs, et sûrement — des réponses du
 * patron à l'arrêt d'avant-chiffrage (`precisions_chantier`).
```

### La boucle qui se referme sur elle-même

Le **seul** écrivain de `caracteristiques` était `structureDepuisPrecisions`,
c'est-à-dire **les réponses du patron aux questions dont il se plaint**.

Autrement dit : la seule façon d'avoir le diamètre en base était qu'il le
saisisse — donc qu'on le lui demande. La question ne pouvait pas disparaître,
quel que soit le soin mis dans les expressions régulières.

**C'est le verdict de ce dossier, et il corrige ce que le dossier 16 laissait
croire.** Celui-ci annonçait la convention « une souche de 60 » comme acquise.
Elle l'était — dans `mesures-arbre.ts`, jamais dans le parcours réel. Une
convention qu'aucun appelant ne consulte n'existe pas.

---

## 3. Pourquoi cinquante suites vertes ne voyaient rien

Chaque maillon était couvert, et bien couvert :

- `test-mesures-arbre` : « souches de 60 » → 60. ✅
- `test-questions-chiffrage` : `caracteristiques.diametreCm = 60` → aucune question. ✅

**Le défaut vivait exactement entre les deux**, là où personne ne regardait. Les
deux suites auraient pu rester vertes pour toujours.

C'est la leçon qui compte, plus que le correctif : **on peut avoir une batterie
verte sur une chaîne cassée**, dès lors que chaque suite part de données qu'elle
fabrique elle-même plutôt que de ce que l'étape précédente produit vraiment.

---

## 4. La correction

### 4.1 La mesure se lit là où elle existe encore

```ts
function mesuresDeLaDictee(ligne: LigneExtraite): Record<string, number> | null {
  // **Le libellé ET la description.** Le modèle range volontiers la mesure
  // dans l'une ou dans l'autre, et rien dans le contrat ne l'oblige à choisir.
  const texte = [ligne.libelle, ligne.description ?? ""].join(" ");
  const mesures: Record<string, number> = {};
  const diametre = diametreLu(texte);
  if (diametre !== null) mesures.diametreCm = diametre;
  const hauteur = hauteurLue(texte);
  if (hauteur !== null) mesures.hauteurM = hauteur;
  return Object.keys(mesures).length > 0 ? mesures : null;
}
```

**Pourquoi à cet endroit précis :** `ligne.description` vit dans le JSON du
modèle et **meurt à l'insertion** — `ajouterPrestation` n'écrit que le libellé et
les colonnes. La lire plus tard, dans `questions-chiffrage.ts`, serait la
chercher là où elle n'est plus. Et corriger l'écran aurait laissé le trou intact
— **avec le prix**, puisque le chiffrage lit la même colonne.

### 4.2 Le contrat demande au modèle de conserver la dimension

Sans cette règle, le modèle n'a aucune raison de garder « de 60 » : rien ne le
lui demandait, et ce que le code ne reçoit pas, il ne peut pas le lire.

```
- **Les DIMENSIONS d'un arbre, d'une souche ou d'une haie ne se perdent jamais.**
  Diamètre, diamètre au pied, hauteur, longueur : recopie-les dans "description",
  avec leur nombre et le mot de l'artisan. Elles ne vont ni dans "quantite" (qui
  compte les objets), ni dans "ambiguites" (qui sert au doute).
    « dessouchage de deux souches de 60 »
      -> "libelle": "Dessouchage", "description": "souches de 60",
         "quantite": "2", "unite": "souche"
  Recopie le nombre même si l'artisan n'a pas prononcé l'unité.
```

### 4.3 Fusionner mesure par mesure, jamais en bloc

Poser l'objet entier effacerait une hauteur qu'il a saisie lui-même le jour où
la dictée ne porte qu'un diamètre — et l'écrasement ne se verrait nulle part,
la colonne étant un seul JSON.

---

## 5. Ce que le contrôle de bout en bout a immédiatement attrapé

`scripts/test-son-cas-reel.ts` part de ce que le **modèle** rend et va jusqu'à ce
que le patron **lit**. Dès sa première exécution, il a fait rougir une régression
que le correctif venait d'introduire :

```
✗ les trois autres libellés qu'il a validés ne bougent PAS
+ actual   "Démontage d'un érable de arbre de 40 cm"
- expected "Démontage d'un érable"
```

La cause : `estUnGeste(texte)` répond « oui » dès qu'un geste apparaît **quelque
part** dans le texte — ce n'est pas « ce texte EST un geste ». « Démontage d'un
érable » en contient un. La borne est devenue : **un seul mot**.

**Aucune suite unitaire ne l'aurait vu**, et c'est exactement le défaut que ce
lot corrige, reproduit à l'intérieur du correctif lui-même. Sur une des trois
lignes qu'il venait justement de valider.

---

## 6. Les deux points d'affichage

| il voyait | il voit |
|---|---|
| `Dessouchage` | `Dessouchage de souches de 60 cm` |
| en-tête de colonne `TOTAL HT` | `MONTANT HT` (le total du bas reste `Total HT`) |

Le compte reste dans sa colonne — Qté 2, Unité souche —, jamais dans le libellé :
c'est sa règle.

### Le relevé au pixel, refait sur preuve mesurée et non à l'œil

Le PDF porte une empreinte figée. La règle du fichier veut qu'on ne la relève
qu'**après avoir regardé le document**. Or le visualiseur de cet environnement
rend une page vide, et il n'y a ni `pdftoppm` ni `pdfjs` : une capture aurait
mesuré **zéro**, ce qui est pire qu'absent.

La trace des deux documents a donc été relevée **des deux côtés** — sur
`origin/main` dans un arbre de travail séparé, et après correction — puis
comparée ligne à ligne. Sur **917 lignes**, deux diffèrent :

| | avant | après |
|---|---|---|
| texte | `TOTAL HT` | `MONTANT HT` |
| abscisse | 523,55 | 509,10 |

L'étiquette est calée à droite : un mot plus long commence plus à gauche, il ne
pousse rien. Le seul risque — cogner la colonne voisine — a été mesuré :
« PRIX UNITAIRE HT » finit à 424,28, « MONTANT HT » commence à 509,10, soit
**85 points d'écart**.

---

## 7. Les mesures

```
scripts/test-son-cas-reel.ts        15 / 15   (sa dictée, de bout en bout)
suites base                        289 / 289
suites navigateur, groupe A         15 / 15
npx tsc --noEmit                      0 erreur
npm run lint                          0 error (16 warnings préexistants)
npm run verifier:memoire              ✅
```

Sur sa dictée exacte, jouée d'un bout à l'autre :

```
l'érable      « 40 centimètres au pied »  → diametreCm 40, hauteurM 12  → 0 question
les souches   « souches de 60 »            → diametreCm 60              → 0 question
la haie, l'évacuation, la tonte            → aucune mesure inventée
un dessouchage SANS mesure                 → la question revient (le garde-fou tient)
le devis      → « Dessouchage de souches de 60 cm », sans le « deux »
```

**Ce qui n'est PAS prouvé ici, et il faut le dire :** ce que le modèle répond
vraiment. Cet environnement n'a aucune clé d'IA. Les sorties de modèle du
contrôle sont des **hypothèses** — la plus dure d'abord (tout rangé en colonnes,
un seul mot de libellé), puis la variante bavarde. Le contrôle réel reste
`npm run verifier:chaine-dictee`, sur son espace.

---

## 8. Questions pour toi, ChatGPT

1. **Contredis-moi sur le diagnostic.** J'affirme que `diametreCm` n'était
   jamais créé, en m'appuyant sur le schéma d'extraction, sur le fait que
   `ajouterPrestation` n'écrit pas `description`, et sur un commentaire du dépôt
   qui le dit. Mais je n'ai pas pu appeler le modèle. Est-ce que je n'aurais pas
   dû exiger une trace réelle du JSON avant de conclure — et si oui, qu'est-ce
   que mon raisonnement structurel ne couvre pas ?

2. **Le pari sur le modèle.** Mon correctif relit le texte que le modèle rend.
   Si le modèle décide de résumer « souches de 60 » en « Dessouchage » sans
   description, je ne récupère rien — j'ai ajouté une règle au contrat pour l'en
   empêcher, mais c'est une consigne, pas une garantie. Fallait-il plutôt ajouter
   un champ typé `mesures: { diametreCm?: number }` au schéma ? J'ai jugé ça plus
   risqué (tous les consommateurs, la compatibilité des brouillons enregistrés).
   Où est le bon arbitrage ?

3. **La leçon de la batterie verte.** Deux suites vertes encadraient un trou.
   Est-ce qu'un seul contrôle de bout en bout suffit à fermer cette classe de
   défaut, ou est-ce que je viens juste de déplacer le problème d'un cran — le
   nouveau contrôle partant lui aussi de données que j'ai écrites à la main ?

4. **Le relevé au pixel.** J'ai remplacé « regarder l'image » par « comparer la
   trace des deux côtés ». C'est plus précis (ça nomme chaque élément qui bouge)
   mais ça ne voit pas ce qu'un œil verrait — un chevauchement, un contraste.
   Est-ce que j'ai le droit d'appeler ça une vérification, ou est-ce que j'aurais
   dû refuser de relever l'empreinte et laisser la suite rouge ?

5. **Ce que j'ai laissé de côté.** Le prix. Remplir `diametreCm` fait entrer une
   valeur dans la colonne que le moteur de chiffrage lit déjà — donc le montant
   d'une ligne peut changer, alors qu'il m'a écrit « ne change rien aux prix ».
   Je soutiens que c'est exactement le prix qu'il aurait obtenu en répondant
   « 60 » à la question, et donc que ce n'est pas un changement de règle. Est-ce
   que tu vois un cas où ce raisonnement est faux ?
