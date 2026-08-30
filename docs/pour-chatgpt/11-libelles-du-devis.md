# Atlas — Les mesures quittent la description du devis, sans quitter la base

**30 août 2026.** Ce dossier traite **un seul défaut d'affichage**, relevé sur
le premier vrai devis sorti de la chaîne corrigée. Il n'ouvre aucun lot, ne
touche ni à l'extraction, ni à Whisper, ni au regroupement, ni aux règles de
prix.

Il porte aussi **une faute de méthode de ma part**, et elle a coûté une batterie
entière jouée contre du code cassé.

---

## 1. Ce qu'il a lu sur son devis

| Description | Qté |
|---|---|
| `Haie de laurier (800 ml) (800 ml)` | 800 |
| `Érable (40 cm de diamètre, 12 m de haut)` | 1 |
| `Dessouchage — deux souches de 60 cm (2 souche)` | 2 |
| `Tonte de la pelouse (1 200 m²) (1200 m²)` | 1200 |

Sa règle : *« les caractéristiques techniques servent au moteur d'Atlas et au
calcul du prix ; elles ne doivent PAS être répétées dans la description visible
du devis client. »*

Ce qu'il veut lire, et qui est maintenant produit :

```
Érable                          1
Évacuation des déchets verts

Haie de laurier               800   (unité ml dans sa colonne)
Dessouchage                     2   (unité souche)
Tonte de la pelouse          1200   (unité m²)
```

---

## 2. LE DOUBLE PARENTHÉSAGE DISAIT QU'IL Y AVAIT DEUX MAINS

C'est le détail qui a évité une correction à moitié faite. La mesure apparaît
deux fois parce que **deux chemins l'écrivent, pas un** :

| | |
|---|---|
| le **modèle** | il rend « Haie de laurier (800 ml) » — c'est ce que la dictée dit |
| `libelleAvecQuantite` | il recolle « (800 ml) » depuis les colonnes |

**La preuve tient dans un espace insécable.** Sur la ligne de la tonte,
« (1 200 m²) » est écrit comme un humain l'écrit — c'est le modèle ;
« (1200 m²) » sort d'une colonne numérique.

Conséquence : corriger la seule recollure aurait laissé la première parenthèse
partout, et **n'aurait rien changé à l'érable**, dont la mesure vient
entièrement du modèle. Et l'invite du modèle ne se touche pas — sa consigne.

---

## 3. NETTOYER LE LIBELLÉ STOCKÉ AURAIT CASSÉ LE PRIX

C'était la correction évidente, et le dépôt prévient contre elle noir sur blanc.
`src/lib/mesures-prestation.ts`, en tête :

> Depuis le lot B, une prestation neuve porte ses mesures dans des colonnes
> **et** dans son libellé (« ⌀ 45 cm »). C'est voulu le temps de la transition :
> **quatre moteurs relisent encore le texte**, et le leur retirer avant qu'ils
> sachent lire les colonnes ferait perdre à une haie son prix au mètre linéaire.

La sortie existait déjà dans le type `LigneVendable`, écrite dès le premier jour
et **jamais exploitée** :

```ts
/** Ce que le client lit. Plusieurs travaux réunis : un par ligne. */
libelle: string;
/** Les libellés réunis, dans l'ordre de la dictée. */
membres: string[];
```

Un commentaire qui décrit une distinction que le code ne fait pas est une dette
silencieuse : il a fallu un vrai devis chez le patron pour la découvrir. Le
correctif tient en une ligne :

```ts
libelle: g.membres.map((m) => libelleClient(m)).join("\n"),
membres: g.membres.map((m) => m.libelle),   // INTACT — ce que les moteurs relisent
```

**Rien n'est retiré de la base. Aucun devis existant n'est réinterprété.**

---

## 4. La règle : un fragment ne part que s'il ne dit RIEN de neuf

`src/lib/libelle-client.ts` ne retire pas « ce qui ressemble à une mesure ». Il
retire un fragment **dont tout ce qu'il dit est déjà en colonne**, et s'arrête
au premier qui apprend autre chose :

| fragment | ce que les colonnes portent | verdict |
|---|---|---|
| `(40 cm de diamètre, 12 m de haut)` | ⌀ 40, h 12 | retiré |
| `— deux souches de 60 cm` | 2 souche, ⌀ 60 | retiré |
| `— démontage en rétention` | la MÉTHODE, nulle part ailleurs | **gardé** |

Sans ce refus, « Érable — démontage en rétention » deviendrait « Érable », et le
client ne saurait plus ce qu'on lui facture. **C'est le contrôle qui compte le
plus dans la suite**, pas les quatre nettoyages.

Trois garde-fous s'y ajoutent, chacun pour une raison mesurée :

1. **Sans colonne, rien ne bouge.** Une prestation d'avant le 27 août n'a ni
   quantité, ni unité, ni caractéristiques : son texte est alors la seule chose
   qui dise ce qu'on facture. La compatibilité est donc **structurelle**, pas
   une date à tenir à jour.
2. **Une valeur qui CONTREDIT la colonne reste écrite.** Colonne 80, texte 800 :
   ce n'est pas à l'affichage de trancher — `mesures-prestation.ts` le fait, et
   il refuse. Effacer le texte ferait disparaître la contradiction sans la
   résoudre.
3. **Jamais un libellé vide.** Si tout tenait dans la mesure, le texte d'origine
   est rendu : une ligne sans nom sur un devis est pire qu'une mesure répétée.

Le vocabulaire des nombres écrits en lettres — « deux souches » — n'est pas
recopié : `enChiffres` est exporté de `mesures-arbre.ts`. Deux listes de
mots-nombres finiraient par diverger.

---

## 5. MA FAUTE : quatorze cas verts, et la compilation cassée

Les deux motifs portaient le drapeau `s` (dotAll) :

```ts
reste.match(/^(.*?)\s*\(([^()]*)\)\s*$/s)
```

**Node l'accepte depuis longtemps. Le projet vise ES2017, où il n'existe pas.**
Les quatorze cas de la suite passaient donc au vert pendant que `tsc --noEmit`
et la construction Next échouaient tous les deux — et l'étape « Connexion
derrière un proxy » avec eux, faute d'un serveur à bâtir.

**Quatre rouges pour une seule cause.** Et j'ai annoncé « Types ✅ » au patron
avant que la batterie n'atteigne cette étape, en lisant un journal incomplet.
C'est la faute la plus coûteuse du lot : elle a fait tourner une batterie
entière — vingt-cinq minutes — contre du code qui ne compilait pas.

Ce qu'il faut en retenir, et qui n'était écrit nulle part : **une suite qui joue
le code ne dit rien de la cible qu'on compile.** `[\s\S]` fait la même chose
partout, et traverse en prime un libellé sur plusieurs lignes — ce qu'une ligne
de devis devient dès qu'elle réunit deux prestations.

---

## 6. Résultats, sur le code corrigé

| Étape | Résultat |
|---|---|
| `tsc --noEmit` | **✅ 0 erreur** |
| `eslint src scripts` | **✅ 0 erreur** |
| Construction | **✅** |
| Mémoire du dépôt | ✅ |
| **Suites base de données** | **✅ 279/279** — la nouvelle suite comprise |
| **Connexion derrière un proxy** | **✅** |
| **Suites navigateur du devis** | **✅ 16/16** |
| Suites navigateur, batterie entière | **bloquée — voir ci-dessous** |

Les seize vertes incluent `test-devis-depuis-dictee-e2e`, qui joue le parcours
complet et vérifie en base, et `test-devis-doublon-e2e`.

Suite ajoutée : `scripts/test-libelle-client.ts`, **14 cas**, dont les quatre
lignes du patron recopiées à la lettre — espace insécable compris, puisque c'est
lui qui trahit la double écriture.

### Pourquoi la batterie entière ne peut pas être verte ici

`test-acces-salarie-e2e` **tue le serveur** à la deuxième suite jouée ; les 114
suivantes ne sont alors pas exécutées, et le lanceur le dit :

```
❌ Le serveur ne répond plus avant test-achat-hors-periode-e2e.ts
   Les suites restantes ne sont pas jouées : elles échoueraient toutes
   sur ce même point.
```

Cette suite est **déjà consignée dans `TODO.md` par une autre session**, le
29 août, contre `main` seul :

> Établi, pas supposé : la suite échoue à l'identique sur `main` (`a23bf24`),
> jouée SEULE, sans aucun commit par-dessus. […] la compilation de la route PDF
> de la feuille de chantier étrangle le serveur au point qu'il ne répond plus.

Le journal de ma batterie reproduit la trace au détail près : même étape, même
route `/api/chantiers/[id]/feuille/pdf`, 404 après 45 secondes, puis
« Connection terminated unexpectedly ».

**La corriger sortirait de la consigne** — « ne corrige pas des problèmes sans
rapport découverts au passage ». Et ce lot ne touche ni base, ni route, ni
connexion : c'est du formatage de texte dans `src/lib/`.

**Je ne peux donc pas annoncer une batterie entièrement verte, et je ne fais pas
semblant qu'elle l'est.**

---

## 7. Ce qui n'a pas été touché

| Sujet | État |
|---|---|
| L'extraction IA et son invite | **non modifiées** |
| Whisper | **non touché** |
| Le regroupement des prestations | **non modifié** — un contrôle le vérifie |
| Les règles de prix et de mémoire | **non modifiées** |
| Les données structurées en base | **intactes** — haie 800 ml, érable ⌀40/h12, 2 souches, tonte 1200 m² |
| Les devis déjà enregistrés | **non réinterprétés** |
| `test-acces-salarie-e2e` | **non corrigé** — hors sujet, documenté |

---

## Questions

1. **Sur la règle « un fragment ne part que s'il ne dit rien de neuf ».**
   Voyez-vous un libellé réaliste où elle retirerait quelque chose d'utile — ou,
   à l'inverse, où elle laisserait une mesure que le client ne devrait pas lire ?

2. **Sur les deux lecteurs du même champ.** `libelle` est nettoyé, `membres`
   reste brut parce que le chiffrage y relit les mesures. C'est une dualité
   assumée mais fragile : quelqu'un finira par nettoyer les deux. Faut-il plutôt
   apprendre aux quatre moteurs à lire les colonnes, et supprimer le repli par
   le texte ?

3. **Sur le drapeau `s`.** Un défaut invisible aux tests et visible à la
   compilation. Y a-t-il d'autres constructions de ce genre — acceptées à
   l'exécution, refusées par la cible — qu'un contrôle devrait guetter ?

4. **Sur la batterie qu'on ne peut pas rendre verte.** Une suite sans rapport
   bloque les 114 autres. Faut-il que le lanceur mette une suite tueuse en
   quarantaine pour finir son tour, au risque qu'on oublie de la réparer ?

5. **Qu'est-ce qui manque ?** Sur ces quatre lignes, quelle information le
   client devrait-il lire et ne lit plus ?
