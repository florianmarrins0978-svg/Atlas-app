# 05 — Lot C : les consommateurs passent à la donnée structurée

Tu n'as pas accès au dépôt. Ce document est autonome.

Contexte : application de paysagiste-élagueur (Next.js + PostgreSQL). L'artisan
dicte son chantier ; la dictée devient des prestations, puis un devis. Le lot A a
fermé une corruption de l'apprentissage ; le lot B a donné à la prestation des
colonnes (`quantite`, `unite`, `methode`, `caracteristiques`…) **sans retirer les
mesures du libellé**, parce que six modules les y relisent encore.

**Lot C fait basculer les lecteurs vers la colonne — et pose le contrat qui dit
quoi faire quand les deux sources se contredisent.**

---

## 1. La liste exhaustive des consommateurs

| # | Consommateur | Ce qu'il relit dans le texte | État |
|---|---|---|---|
| 1 | `chiffrage/proposition-prix.ts` | ⌀, hauteur, longueur de haie, tonnage | **MIGRÉ** |
| 2 | `services/apprendre-grille.ts` | ⌀, hauteur, longueur de haie, tonnage | **MIGRÉ** |
| 3 | `lib/mesures-arbre.ts` | les quatre mesures | **gardé exprès** — c'est le lecteur historique lui-même, devenu le repli |
| 4 | `lib/questions-chiffrage.ts` | nature + longueur | **déjà structuré** — voir §1.1 |
| 5 | `lib/lignes-vendables.ts` | nature, pour découper | **bloqué** — dépend de `nature`, §4 |
| 6 | `lib/lecons-prix.ts` | nature + technique + ⌀ | **hors périmètre** — c'est M6, la signature V2 |
| 7 | `lib/prix-attribuable.ts` | nature, pour l'attribution | **bloqué** — dépend de `nature`, §4 |
| 8 | `ai/lecture-litterale.ts` | quantité + unité | **rien à migrer** — il PRODUIT le JSON, il ne le consomme pas |

### 1.1 — Une découverte : `questions-chiffrage.ts` lisait déjà la structure

En l'inventoriant, je me suis aperçu qu'il ne relit pas seulement le libellé :
sa fonction interne joint `libelle + description + quantite + unite`, et elle
reçoit ces champs **depuis le JSON du brouillon**, pas depuis la table. Il
consomme donc déjà la donnée structurée, à sa source. Rien à migrer, et c'est
une bonne nouvelle : l'arrêt d'avant-chiffrage ne dépendait pas du libellé
recollé.

---

## 2. Le contrat exact de priorité

Une seule fonction pure le porte — `src/lib/mesures-prestation.ts` — et les deux
consommateurs migrés l'appellent. Elle rend, pour chaque mesure :

| Situation | Résultat | Origine |
|---|---|---|
| colonne seule | la valeur | `structure` |
| libellé seul (ancienne prestation) | la valeur | `libelle` |
| les deux, **d'accord** | la valeur | `structure` |
| les deux, **en désaccord** | **`null`** | `contradiction` |
| ni l'une ni l'autre | `null` | `aucune` |

**Une tolérance d'un centième**, et elle n'est pas cosmétique : la colonne est un
`numeric(10,2)` — 45 y devient 45.00 — quand le libellé porte « ⌀ 45 cm ». Sans
elle, **chaque prestation neuve se contredirait elle-même** et le chiffrage
s'arrêterait partout.

### Ce que « contradiction » produit concrètement

La mesure reste inconnue. Le chiffrage retombe alors sur son chemin habituel : la
case de la grille n'est pas trouvée, la ligne s'écrit sans prix, et l'écran nomme
ce qui manque. **On ne fabrique aucun mécanisme neuf** — on donne une raison de
plus à celui qui existe déjà. Et la réserve **nomme les deux valeurs** :

> « le diamètre du tronc » : la dictée dit 45 et le libellé dit 70. Le prix n'a
> pas été calculé sur une valeur incertaine — corrigez celle qui est bonne.

L'apprentissage, lui, ne range **rien** : un prix rangé dans une case désignée
par une mesure douteuse reviendrait plus tard avec l'autorité de la grille.

---

## 3. ⚠ La conséquence que tu dois connaître : le libellé retouché à la main

**C'est le seul cas où les deux sources divergent, et il change de comportement.**

`modifierPrestation` réécrit le libellé et **ne touche pas aux colonnes**. Si
l'artisan corrige « Haie (tout genre) (800 ml) » en « (80 ml) » depuis l'écran
Informations, la colonne reste à 800.

| | Avant | Après |
|---|---|---|
| Le prix | recalculé sur **80** (le texte gagnait, en silence) | **pas calculé** — la ligne attend, avec la raison affichée |

**J'applique ta règle** (§6 : « contradiction → refus, jamais arbitrage
silencieux »), et je pense qu'elle est juste : chiffrer sur une valeur dont deux
sources disent le contraire, c'est exactement ce que ce lot existe pour empêcher.

**Mais c'est une question métier que je ne tranche pas seul :** quand l'artisan
retouche un libellé à la main, **veut-il changer la mesure ?** Trois réponses
possibles, et aucune n'est déductible du dépôt :

- **A.** oui → `modifierPrestation` devrait relire la mesure du nouveau libellé
  et mettre la colonne à jour. Mais c'est réintroduire une lecture par
  expression régulière, celle que ton §7 veut voir disparaître.
- **B.** non, il corrige juste un mot → la colonne doit gagner, et le libellé
  n'est plus qu'un texte. Mais alors sa correction est ignorée sans un mot.
- **C.** on ne sait pas → **c'est ce qui est en place** : on refuse et on
  demande.

C est le plus sûr et le seul qui n'invente rien. Dis-moi si tu vois mieux.

---

## 4. `nature` et `espece` : je m'arrête avant de figer le schéma

Ton §2 demandait d'inspecter avant de toucher au contrat du modèle, et de
rapporter si une décision métier était nécessaire. **Elle l'est.**

### L'inspection

Le JSON demandé au modèle porte aujourd'hui, par prestation :
`libelle`, `description`, `quantite`, `unite`, `aConfirmer`. Ni nature, ni
espèce.

Et il existe **quatre vocabulaires de nature** dans le dépôt, qui ne coïncident
pas :

| Où | Les natures |
|---|---|
| la grille de prix | abattage, fendage, dessouchage, grumes, haie |
| la mémoire des prix | abattage, haie, élagage, dessouchage, fendage, broyage |
| le découpage du devis | fendage, haie, dessouchage, grumes, **+ « principal »**, un fourre-tout |
| le garde-fou du lot A | l'union des deux premiers — 7 natures |

### Le blocage, et il est métier, pas technique

Ces sept natures couvrent **l'arboriculture**. Elles ne couvrent PAS le reste de
son métier : tonte, plantation, désherbage, clôture, massifs, arrosage. Or c'est
précisément une tonte qui a déclenché tout cet audit.

Deux options, et je refuse de choisir en silence :

- **A. vocabulaire fermé aux 7 natures qui ont un comportement de prix.** Tout
  le reste vaut `null`. Honnête, mais `nature` reste vide sur la moitié de son
  travail — et le fourre-tout du découpage, lui, ne sera pas réparé par là.
- **B. vocabulaire élargi à son métier entier.** Mais alors **j'invente des
  catégories qu'il n'a jamais énoncées**, et ton §2 l'interdit : « ne crée pas
  silencieusement une nouvelle taxonomie ».

**Je n'ai donc pas touché au contrat du modèle.** Ce qu'il faut pour trancher,
c'est la liste des travaux qu'il vend réellement — elle est dans ses devis, pas
dans le dépôt.

### `espece`, séparément

L'espèce n'a **aucune ambiguïté de taxonomie** : c'est un texte libre, rempli
seulement quand il est prononcé (« démontage d'un **érable** »). L'ajouter au
JSON est additif et sûr sur le principe.

**Deux raisons de ne pas le faire dans ce lot :**

1. **Je ne peux pas vérifier ce que le modèle rend.** Cet environnement n'a
   aucune clé d'IA — c'est une contrainte du poste, pas du produit. Modifier
   l'invite sans pouvoir observer une seule réponse réelle, c'est livrer non
   éprouvé.
2. Le seul consommateur qui en a besoin est la comparabilité V2 — **M6, hors
   périmètre**.

Ma recommandation : ajouter `espece` en même temps que M6, et le vérifier sur
son espace à lui, où les clés sont branchées.

---

## 5. Les quantités de comptage (« deux souches ») : je ne peux pas répondre ici

Ton §4 demandait de vérifier **comment le modèle représente réellement** « deux
souches », « trois arbres », « quatre journées », « deux hommes », « une haie de
800 ml ».

**Je ne peux pas l'observer** : aucune clé d'IA sur ce poste. Ce que je peux
dire, et c'est tout :

- l'invite d'extraction ne donne **aucun exemple d'unité** ; elle dit seulement
  « sans nombre écrit, `quantite` et `unite` restent null » ;
- l'invite de la dictée-dans-le-devis, elle, en donne : « mètres linéaires,
  m², heures, jour/homme, forfait, tonne, ou une unité de son métier (stère,
  arbre) ». **Les deux invites ne demandent donc pas la même chose** — c'est en
  soi une incohérence à corriger ;
- le lecteur de secours (sans modèle) reconnaît m², ml, m³, cm, kg, t, litres,
  sacs, plaques, rouleaux, palettes, unités, heures — **ni « souche », ni
  « arbre »**. Sur « deux souches », il rend donc `quantite = null`.

**Ce qu'il ne faut surtout pas faire, et que je n'ai pas fait :** relâcher le
`CHECK quantite ⟺ unite` pour laisser passer « 2 » sans unité. Ce serait
rouvrir exactement l'ambiguïté qui a produit le devis fautif.

**La bonne piste, à confirmer sur son espace :** aligner l'invite d'extraction
sur celle de la dictée-dans-le-devis, qui autorise déjà explicitement une unité
de comptage de son métier (« arbre », « stère »). « Deux souches » deviendrait
alors `quantite: "2", unite: "souche"` — une unité **prononcée**, pas inventée.
Cela ne demande aucun changement de schéma ni de contrainte.

**Décision : à jouer chez lui, pas ici.** Je peux préparer la modification
d'invite et la commande de vérification quand tu me le dis.

---

## 6. Le format retenu pour `caracteristiques`

**Option A — clés typées**, et l'inspection le tranche sans hésitation :

```ts
type Caracteristiques = {
  diametreCm?: number;   // les tranches de la grille sont en cm : « 40 à 50 cm »
  hauteurM?: number;     // les tranches de hauteur sont en m : « 15 à 20 m »
  longueurMl?: number;   // la haie se chiffre au mètre linéaire
  tonnageT?: number;     // les grumes se chiffrent à la tonne
};
```

**Chaque caractéristique n'a qu'UNE unité canonique dans tout le dépôt**, et les
tranches de la grille sont écrites dans cette unité-là. Porter
`{ valeur, unite }` ajouterait un point de conversion là où il n'y a rien à
convertir — et une conversion silencieuse est exactement ce qu'on refuse.

**Ce qui rend le choix réversible :** une **seule** fonction lit ces objets
(`lireCaracteristiques`). Elle ignore toute clé inconnue, refuse zéro, les
négatifs et l'illisible. Le jour où une mesure aura deux unités, ça se verra là,
et nulle part ailleurs.

---

## 7. R23 — les prestations déjà existantes

**Rien n'a été fait, et c'est ta décision que je suis** : aucun backfill, aucune
réinterprétation d'ancien libellé.

Tu autorisais à traiter au lot C le cas d'une prestation déjà présente qu'une
nouvelle confirmation enrichirait — **à condition d'écrire d'abord les tests qui
prouvent les quatre invariants** (pas de doublon, pas de devinette, pas
d'écrasement d'une saisie humaine, pas de contradiction résolue en silence).

**Je ne l'ai pas fait dans ce lot**, et je te dis pourquoi plutôt que de le
laisser passer : le quatrième invariant — « une contradiction ne doit jamais être
résolue silencieusement » — dépend directement de la question ouverte du §3.
Tant qu'on ne sait pas si un libellé retouché à la main doit gagner sur la
colonne, on ne sait pas non plus ce qu'une nouvelle extraction a le droit de
faire à une prestation existante. **Traiter R23 avant de trancher §3, ce serait
inventer la règle en la codant.**

---

## 8. Les fichiers modifiés

| Fichier | Ce qui change |
|---|---|
| `src/lib/mesures-prestation.ts` | **neuf** — le contrat de priorité, pur |
| `src/lib/prestation-structuree.ts` | + le type `Caracteristiques` et sa validation unique |
| `src/server/chiffrage/proposition-prix.ts` | les quatre mesures passent par le contrat ; les réserves de contradiction remontent à l'écran |
| `src/server/services/apprendre-grille.ts` | idem, et refus d'apprendre sur contradiction |
| `scripts/test-mesures-prestation.ts` | **neuf** — 15 cas |
| `scripts/test-liste-clients.ts` | une ligne : un contrôle qui mentait deux heures par jour — voir §11 |

---

## 9. Les résultats

```
npx tsc --noEmit   → 0 erreur
npx eslint         → 0 erreur (2 avertissements préexistants, fichiers non touchés)
npm test           → 251 / 253 suites réussies
```

### Les contrôles A / B / C / E / H

| Cas | État | Pourquoi |
|---|---|---|
| **A** — la quantité survit jusqu'à la ligne du devis | ❌ | lot D |
| **B** — deux travaux, deux identités | ❌ | dépend de `nature` (§4) |
| **C** — inconnu n'est ni 0 ni 1 | ❌ | M4, hors périmètre |
| **E** — un faux comparable | ❌ | M6, hors périmètre |
| **H** — la troncature | ❌ | hors périmètre |
| **F**, **G** | ✅ | acquis aux lots A et B |

**Aucune assertion n'a été affaiblie ni déplacée.**

---

## 10. Une régression découverte — et elle n'est pas de ce lot

La batterie a fait tomber une troisième suite : `test-liste-clients.ts`, sur
« une facture émise et un règlement partiel donnent le reste dû ».

**Vérifié avant d'accuser mon code :** j'ai remisé toutes mes modifications et
rejoué la suite. **Elle échouait déjà.** Ce n'est pas le lot C.

La cause exacte : la facture date son émission avec le calendrier de **Paris**,
le contrôle datait son règlement avec `toISOString()`, c'est-à-dire en **UTC**.
Entre 22 h et minuit UTC, les deux ne sont plus le même jour — la facture était
émise « le 27 » et le règlement daté « le 26 » se faisait refuser. Le cas
rougissait alors **en accusant le calcul du reste dû**, sur du code juste.

Mesuré : il était 22 h 45 UTC, soit 00 h 45 à Paris. **Ce contrôle échouait donc
deux heures par jour**, et personne ne l'avait vu parce que les batteries
tombent rarement dans cette fenêtre.

Corrigé en une ligne : le contrôle emploie désormais le même calendrier que la
facture. Je le signale plutôt que de le corriger en silence — c'est une
modification hors de mon périmètre, et elle était nécessaire pour distinguer une
vraie régression d'un faux rouge.

---

## 11. Ce que je te demande

1. **Le §3** — le libellé retouché à la main. A, B ou C ? C'est la décision qui
   débloque R23.
2. **Le §4** — vocabulaire de `nature` fermé aux 7 natures qui portent un prix,
   ou élargi à son métier entier ? Sans réponse, le découpage et
   `prix-attribuable` restent sur les expressions régulières.
3. **Le §5** — d'accord pour aligner l'invite d'extraction sur celle qui autorise
   déjà « arbre », « stère » comme unités de comptage prononcées ?
4. **Le refus sur contradiction** fait disparaître un prix que l'artisan avait
   avant. Est-ce le bon arbitrage, ou préfères-tu une valeur retenue **plus** un
   avertissement bien visible ?
5. **Que casse ce lot** auquel je n'aurais pas pensé ?
